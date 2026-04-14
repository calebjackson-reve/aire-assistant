// lib/tcs/tools/earnest-money-to-title.ts
// Day 9: Create an AirSign envelope for the Earnest Money receipt addressed to
// the agent's preferred title company. Envelope is DRAFT — never auto-sent.
//
// Callable from:
//   - lib/tcs/uc-flow.ts on UC entry (after PA envelope exists)
//   - POST /api/tcs/tools/earnest-money from the chat surface
//
// Storage: Vercel Blob when BLOB_READ_WRITE_TOKEN is set; otherwise writes to
// local /uploads (matches offer-to-uc.ts persistPdf convention).

import prisma from "@/lib/prisma"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
import { put } from "@vercel/blob"
import fs from "fs/promises"
import path from "path"
import { getTopVendor } from "@/lib/tc/vendor-scheduler"
import { logAction, type SilentAction } from "../stage-actions"

export interface EarnestMoneyInput {
  sessionId: string
  userId: string
  transactionId: string
  earnestAmount?: string | null // from answers["offer.earnestMoney"]
}

export interface EarnestMoneyResult {
  ok: boolean
  envelopeId: string | null
  documentId: string | null
  titleVendorName: string | null
  preferredUsed: boolean
  action: SilentAction
}

export async function earnestMoneyToTitleTool(
  input: EarnestMoneyInput,
): Promise<EarnestMoneyResult> {
  const { sessionId, userId, transactionId, earnestAmount } = input

  const vendor = await getTopVendor("title_company", userId)

  if (!vendor || !vendor.email) {
    const action = await logAction(sessionId, {
      kind: "note",
      summary: vendor
        ? `Title company "${vendor.name}" has no email on file — add one to auto-send EM receipt`
        : `No title company on file — add one under Settings → Vendors to auto-create EM envelope`,
      payload: {
        reason: vendor ? "missing_email" : "no_vendor",
        href: "/aire/settings/vendors",
      },
    })
    return {
      ok: false,
      envelopeId: null,
      documentId: null,
      titleVendorName: vendor?.name ?? null,
      preferredUsed: false,
      action,
    }
  }

  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    select: {
      propertyAddress: true,
      buyerName: true,
      buyerEmail: true,
      buyerPhone: true,
      acceptedPrice: true,
      offerPrice: true,
      contractDate: true,
    },
  })

  if (!tx) {
    const action = await logAction(sessionId, {
      kind: "note",
      summary: "Cannot draft EM envelope — transaction not found",
    })
    return {
      ok: false,
      envelopeId: null,
      documentId: null,
      titleVendorName: vendor.name,
      preferredUsed: vendor.priority === 0,
      action,
    }
  }

  // 1. Generate a one-page Earnest Money receipt PDF in AIRE palette.
  const pdfBuffer = await buildEarnestMoneyReceiptPdf({
    propertyAddress: tx.propertyAddress,
    buyerName: tx.buyerName,
    titleCompany: vendor.company || vendor.name,
    earnestAmount: earnestAmount ?? null,
    contractDate: tx.contractDate ? tx.contractDate.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    purchasePrice: tx.acceptedPrice ?? tx.offerPrice ?? null,
  })

  const filename = `em-receipt-${transactionId}.pdf`

  // 2. Persist the PDF (Blob or local).
  const documentUrl = await persistPdf(pdfBuffer, filename, userId)

  // 3. Create Document row.
  const doc = await prisma.document.create({
    data: {
      transactionId,
      name: `Earnest Money Receipt — ${tx.propertyAddress}`,
      type: "earnest_money_receipt",
      category: "mandatory",
      fileUrl: documentUrl,
      fileSize: pdfBuffer.length,
      signatureStatus: "draft",
      checklistStatus: "uploaded",
    },
    select: { id: true },
  })

  // 4. Create AirSign envelope in DRAFT. Title company = signer; buyer = CC-style signer (optional).
  const signers: Array<{
    name: string
    email: string
    phone: string | null
    role: string
    order: number
    tokenExpiresAt: Date
  }> = [
    {
      name: vendor.name,
      email: vendor.email,
      phone: vendor.phone || null,
      role: "TITLE",
      order: 1,
      tokenExpiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  ]
  if (tx.buyerEmail && tx.buyerName) {
    signers.push({
      name: tx.buyerName,
      email: tx.buyerEmail,
      phone: tx.buyerPhone ?? null,
      role: "BUYER",
      order: 2,
      tokenExpiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    })
  }

  const envelope = await prisma.airSignEnvelope.create({
    data: {
      userId,
      name: `Earnest Money Receipt — ${tx.propertyAddress}`,
      documentUrl,
      transactionId,
      status: "DRAFT",
      signers: { create: signers },
    },
    select: { id: true },
  })

  await prisma.airSignAuditEvent.create({
    data: {
      envelopeId: envelope.id,
      action: "created",
      metadata: {
        source: "tcs",
        sessionId,
        tool: "earnest_money_to_title",
        vendorName: vendor.name,
      },
    },
  })

  const action = await logAction(sessionId, {
    kind: "doc_drafted",
    summary: `EM receipt envelope drafted for ${vendor.name}${vendor.priority === 0 ? " (preferred)" : ""}`,
    payload: {
      envelopeId: envelope.id,
      documentId: doc.id,
      titleVendor: vendor.name,
      preferred: vendor.priority === 0,
      href: `/airsign/${envelope.id}`,
      signerCount: signers.length,
    },
  })

  return {
    ok: true,
    envelopeId: envelope.id,
    documentId: doc.id,
    titleVendorName: vendor.name,
    preferredUsed: vendor.priority === 0,
    action,
  }
}

// ── PDF builder ─────────────────────────────────────────────────────────────
// Palette per CLAUDE.md: Cream #f5f2ea bg, Deep Forest #1e2416 body, Olive
// #6b7d52 headings, Sage #9aab7e accent.

async function buildEarnestMoneyReceiptPdf(args: {
  propertyAddress: string
  buyerName: string | null
  titleCompany: string
  earnestAmount: string | null
  contractDate: string
  purchasePrice: number | null
}): Promise<Buffer> {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([612, 792]) // Letter

  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

  const cream = rgb(0xf5 / 255, 0xf2 / 255, 0xea / 255)
  const deepForest = rgb(0x1e / 255, 0x24 / 255, 0x16 / 255)
  const olive = rgb(0x6b / 255, 0x7d / 255, 0x52 / 255)
  const sage = rgb(0x9a / 255, 0xab / 255, 0x7e / 255)

  // Cream background
  page.drawRectangle({ x: 0, y: 0, width: 612, height: 792, color: cream })

  // Olive heading bar
  page.drawRectangle({ x: 48, y: 720, width: 516, height: 2, color: olive })

  // Title
  page.drawText("EARNEST MONEY RECEIPT", {
    x: 48,
    y: 740,
    size: 18,
    font: bold,
    color: deepForest,
  })

  // Body rows
  const rows: Array<[string, string]> = [
    ["Property", args.propertyAddress],
    ["Buyer", args.buyerName ?? "(not provided)"],
    ["Title Company", args.titleCompany],
    ["Contract Date", args.contractDate],
    ["Purchase Price", args.purchasePrice ? `$${args.purchasePrice.toLocaleString()}` : "(see purchase agreement)"],
    ["Earnest Money", args.earnestAmount ? `$${Number(args.earnestAmount).toLocaleString()}` : "(see purchase agreement)"],
  ]

  let y = 680
  for (const [label, value] of rows) {
    page.drawText(label.toUpperCase(), { x: 48, y, size: 9, font: bold, color: olive })
    page.drawText(value, { x: 180, y, size: 11, font, color: deepForest })
    y -= 28
  }

  // Acknowledgement block
  y -= 30
  const ack =
    "The undersigned title company acknowledges receipt of the earnest money\n" +
    "deposit for the transaction above and will hold it in trust pending closing."
  for (const line of ack.split("\n")) {
    page.drawText(line, { x: 48, y, size: 11, font, color: deepForest })
    y -= 16
  }

  // Signature block
  y -= 40
  page.drawRectangle({ x: 48, y: y - 2, width: 220, height: 1, color: sage })
  page.drawText("Title Company Signature", { x: 48, y: y - 18, size: 9, font, color: olive })

  page.drawRectangle({ x: 320, y: y - 2, width: 150, height: 1, color: sage })
  page.drawText("Date", { x: 320, y: y - 18, size: 9, font, color: olive })

  // Footer
  page.drawText("Generated by AIRE — draft for review before dispatch.", {
    x: 48,
    y: 40,
    size: 8,
    font,
    color: olive,
  })

  const bytes = await pdf.save()
  return Buffer.from(bytes)
}

async function persistPdf(
  buffer: Buffer,
  filename: string,
  userId: string,
): Promise<string> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(
      `tcs/em-receipts/${userId}/${Date.now()}-${filename}`,
      buffer,
      { access: "public", contentType: "application/pdf" },
    )
    return blob.url
  }
  const relKey = path.join("em-receipts", `tcs-${Date.now()}-${filename}`)
  const abs = path.join(process.cwd(), "uploads", relKey)
  await fs.mkdir(path.dirname(abs), { recursive: true })
  await fs.writeFile(abs, buffer)
  return `/uploads/${relKey.replace(/\\/g, "/")}`
}
