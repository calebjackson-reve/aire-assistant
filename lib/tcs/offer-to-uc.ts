// lib/tcs/offer-to-uc.ts
// The magic moment. When a TCS session exits the Offer stage and enters
// UNDER_CONTRACT, we:
//   1. Call the existing contract writer to generate the LREC-101 PA PDF
//      from the answers accumulated so far
//   2. Persist it to Blob (if configured) or local /uploads fallback, then
//      create a Document row linked to the Transaction
//   3. Auto-create an AirSign envelope in DRAFT status with the PA + signers
//      (buyer + seller if known). DO NOT send.
//   4. Call calculateDeadlines() with contractDate/closingDate/inspection/etc
//      and create Deadline rows for each returned deadline.
//
// Each step is independent — a failure in step 2 doesn't block step 3.
// All actions are returned so the conversation engine can surface them in
// the TCS silent-actions rail.

import prisma from "@/lib/prisma"
import { writeContract } from "@/lib/contracts/contract-writer"
import { calculateDeadlines } from "@/lib/louisiana-rules-engine"
import { onDocumentUploaded } from "@/lib/workflow/state-machine"
import { logAction, type SilentAction } from "./stage-actions"
import { put } from "@vercel/blob"
import fs from "fs/promises"
import path from "path"

// ─── FIELD MAP ───────────────────────────────────────────────────────────────
// Convert TCS answer keys → LREC contract writer fields

function mapAnswersToContractFields(
  answers: Record<string, unknown>,
): Record<string, string> {
  const s = (v: unknown) => (v === null || v === undefined ? "" : String(v))
  const money = (v: unknown) => s(v).replace(/[^0-9.]/g, "")

  const fields: Record<string, string> = {}

  const address = s(answers["intake.address"])
  if (address) fields.property_address = address

  const client = s(answers["intake.client"])
  const side = s(answers["intake.side"])
  if (client) {
    if (side === "BUYER" || side === "DUAL") fields.buyer_name = client
    if (side === "LISTING" || side === "DUAL") fields.seller_name = client
  }

  const offerPrice = money(answers["offer.price"])
  if (offerPrice) fields.purchase_price = offerPrice

  const earnest = money(answers["offer.earnestMoney"])
  if (earnest) fields.earnest_money = earnest

  const inspectionDays = s(answers["offer.inspectionDays"])
  if (inspectionDays) fields.inspection_days = inspectionDays

  const closingDate = s(answers["offer.closingDate"])
  if (closingDate) fields.closing_date = closingDate

  const financing = s(answers["offer.financing"])
  if (financing) fields.financing_type = financing.toLowerCase()

  // Default LREC standards that the user wasn't asked
  if (!fields.appraisal_days) fields.appraisal_days = "14"
  if (!fields.financing_days) fields.financing_days = "30"

  fields.contract_date = new Date().toISOString().slice(0, 10)

  return fields
}

// ─── STORAGE ─────────────────────────────────────────────────────────────────
// Prefer Vercel Blob if token present; otherwise write to local /uploads.

async function persistPdf(
  buffer: Buffer,
  filename: string,
  userId: string,
): Promise<{ url: string }> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(
      `tcs/contracts/${userId}/${Date.now()}-${filename}`,
      buffer,
      { access: "public", contentType: "application/pdf" },
    )
    return { url: blob.url }
  }
  const relKey = path.join("documents", `tcs-${Date.now()}-${filename}`)
  const abs = path.join(process.cwd(), "uploads", relKey)
  await fs.mkdir(path.dirname(abs), { recursive: true })
  await fs.writeFile(abs, buffer)
  return { url: `/uploads/${relKey.replace(/\\/g, "/")}` }
}

// ─── ENTRY POINT ─────────────────────────────────────────────────────────────

export interface OfferToUCResult {
  actions: SilentAction[]
  documentId: string | null
  envelopeId: string | null
  deadlineCount: number
}

/**
 * Orchestrate everything that happens when a TCS session lands on UNDER_CONTRACT.
 * Safe to call even if fields are incomplete — each step is defensive.
 */
export async function runOfferToUC(args: {
  sessionId: string
  userId: string
  transactionId: string
  answers: Record<string, unknown>
}): Promise<OfferToUCResult> {
  const actions: SilentAction[] = []
  let documentId: string | null = null
  let envelopeId: string | null = null
  let deadlineCount = 0

  const fields = mapAnswersToContractFields(args.answers)

  // ── Step 1: Draft the PA PDF ──────────────────────────────────────────────
  let pdfBuffer: Buffer | null = null
  let pdfFilename: string | null = null
  try {
    const result = await writeContract({
      formType: "lrec-101",
      fields,
      transactionId: args.transactionId,
      userId: args.userId,
    })
    if (result.pdfBuffer.length > 0) {
      pdfBuffer = result.pdfBuffer
      pdfFilename = result.filename
    } else {
      actions.push(
        await logAction(args.sessionId, {
          kind: "note",
          summary: `PA draft blocked — ${result.validation.errors[0] ?? "missing fields"}`,
        }),
      )
    }
  } catch (err) {
    console.error("[TCS/offer-to-uc] writeContract threw:", err)
    actions.push(
      await logAction(args.sessionId, {
        kind: "note",
        summary: `PA draft threw — ${err instanceof Error ? err.message : "unknown"}`,
      }),
    )
  }

  // ── Step 2: Persist PDF + Document row ────────────────────────────────────
  let documentUrl: string | null = null
  if (pdfBuffer && pdfFilename) {
    try {
      const persisted = await persistPdf(pdfBuffer, pdfFilename, args.userId)
      documentUrl = persisted.url
      const doc = await prisma.document.create({
        data: {
          transactionId: args.transactionId,
          name: pdfFilename,
          type: "purchase_agreement",
          category: "mandatory",
          templateId: "lrec-101",
          filledData: fields,
          fileUrl: documentUrl,
          fileSize: pdfBuffer.length,
          signatureStatus: "draft",
          checklistStatus: "uploaded",
        },
      })
      documentId = doc.id
      actions.push(
        await logAction(args.sessionId, {
          kind: "doc_drafted",
          summary: `Purchase Agreement drafted — ready to send for signatures`,
          payload: {
            documentId: doc.id,
            href: `/aire/transactions/${args.transactionId}`,
            filename: pdfFilename,
          },
        }),
      )
      // Canonical transaction advance: the PA document triggers ACTIVE→UNDER_CONTRACT
      // via the guard-protected workflow state machine.
      await onDocumentUploaded(
        args.transactionId,
        "purchase_agreement",
        args.userId,
      )
    } catch (err) {
      console.error("[TCS/offer-to-uc] persistPdf/Document threw:", err)
      actions.push(
        await logAction(args.sessionId, {
          kind: "note",
          summary: `PA persist failed — ${err instanceof Error ? err.message : "unknown"}`,
        }),
      )
    }
  }

  // ── Step 3: AirSign envelope in DRAFT ─────────────────────────────────────
  if (documentId && documentUrl && pdfFilename) {
    try {
      const tx = await prisma.transaction.findUnique({
        where: { id: args.transactionId },
        select: {
          propertyAddress: true,
          buyerName: true,
          buyerEmail: true,
          buyerPhone: true,
          sellerName: true,
          sellerEmail: true,
          sellerPhone: true,
        },
      })
      const signers: {
        name: string
        email: string
        phone?: string | null
        role: string
        order: number
        tokenExpiresAt: Date
      }[] = []
      if (tx?.buyerName && tx.buyerEmail) {
        signers.push({
          name: tx.buyerName,
          email: tx.buyerEmail,
          phone: tx.buyerPhone ?? null,
          role: "BUYER",
          order: 1,
          tokenExpiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        })
      }
      if (tx?.sellerName && tx.sellerEmail) {
        signers.push({
          name: tx.sellerName,
          email: tx.sellerEmail,
          phone: tx.sellerPhone ?? null,
          role: "SELLER",
          order: 2,
          tokenExpiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        })
      }

      const envelope = await prisma.airSignEnvelope.create({
        data: {
          userId: args.userId,
          name: `Purchase Agreement — ${tx?.propertyAddress ?? "unknown"}`,
          documentUrl,
          transactionId: args.transactionId,
          status: "DRAFT",
          signers: signers.length > 0 ? { create: signers } : undefined,
        },
        select: { id: true },
      })
      envelopeId = envelope.id

      await prisma.airSignAuditEvent.create({
        data: {
          envelopeId: envelope.id,
          action: "created",
          metadata: { source: "tcs", sessionId: args.sessionId },
        },
      })

      actions.push(
        await logAction(args.sessionId, {
          kind: "doc_drafted",
          summary: `AirSign envelope in DRAFT — one tap to send`,
          payload: {
            envelopeId: envelope.id,
            href: `/airsign/${envelope.id}`,
            signerCount: signers.length,
          },
        }),
      )
    } catch (err) {
      console.error("[TCS/offer-to-uc] envelope create threw:", err)
      actions.push(
        await logAction(args.sessionId, {
          kind: "note",
          summary: `AirSign draft failed — ${err instanceof Error ? err.message : "unknown"}`,
        }),
      )
    }
  }

  // ── Step 4: Auto-deadlines ────────────────────────────────────────────────
  try {
    const contractDate = new Date()
    const closingDate = args.answers["offer.closingDate"]
      ? new Date(String(args.answers["offer.closingDate"]))
      : undefined
    const inspectionDays = args.answers["offer.inspectionDays"]
      ? Number(String(args.answers["offer.inspectionDays"])) || undefined
      : undefined

    const deadlines = calculateDeadlines({
      contractDate,
      closingDate: closingDate && !Number.isNaN(closingDate.getTime()) ? closingDate : undefined,
      inspectionDays,
    })

    // Persist each as Deadline row; collect created ids
    const created = await prisma.$transaction(
      deadlines.map((d) =>
        prisma.deadline.create({
          data: {
            userId: args.userId,
            transactionId: args.transactionId,
            name: d.name,
            dueDate: d.dueDate,
            notes: d.description,
          },
          select: { id: true, name: true, dueDate: true },
        }),
      ),
    )
    deadlineCount = created.length

    // Pin contractDate onto the Transaction so downstream features (morning brief,
    // deadline alerts, compliance) can anchor from it
    await prisma.transaction.update({
      where: { id: args.transactionId },
      data: {
        contractDate,
        closingDate: closingDate && !Number.isNaN(closingDate.getTime()) ? closingDate : undefined,
      },
    })

    actions.push(
      await logAction(args.sessionId, {
        kind: "deadline_created",
        summary: `${deadlineCount} deadlines scheduled through closing`,
        payload: {
          href: `/aire/transactions/${args.transactionId}`,
          deadlineIds: created.map((c) => c.id),
        },
      }),
    )
  } catch (err) {
    console.error("[TCS/offer-to-uc] deadlines threw:", err)
    actions.push(
      await logAction(args.sessionId, {
        kind: "note",
        summary: `Deadline creation failed — ${err instanceof Error ? err.message : "unknown"}`,
      }),
    )
  }

  return { actions, documentId, envelopeId, deadlineCount }
}
