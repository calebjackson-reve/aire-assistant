// app/api/airsign/sign/[token]/route.ts
// GET: Load envelope data for signer. POST: Submit signature values.
// No auth required — token IS the auth. Public endpoint for signers.

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { sealPdf, type SealField, type AuditEntry } from "@/lib/airsign/seal-pdf"
import { sendSigningInvitation, sendDeclineNotification } from "@/lib/airsign/email"

// GET — Load envelope for signing
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const signer = await prisma.airSignSigner.findUnique({
    where: { token },
    include: {
      envelope: {
        select: {
          id: true,
          name: true,
          status: true,
          documentUrl: true,
          pageCount: true,
          expiresAt: true,
        },
      },
    },
  })

  if (!signer) {
    return NextResponse.json({ error: "Invalid signing link" }, { status: 404 })
  }

  // Check envelope status
  if (signer.envelope.status === "VOIDED") {
    return NextResponse.json({ error: "This envelope has been voided" }, { status: 410 })
  }
  if (signer.envelope.status === "DECLINED") {
    return NextResponse.json({ error: "Signing has been paused — another signer declined this document" }, { status: 410 })
  }
  if (signer.envelope.status === "COMPLETED") {
    return NextResponse.json({ error: "This envelope is already completed" }, { status: 410 })
  }
  if (signer.envelope.expiresAt && new Date() > signer.envelope.expiresAt) {
    return NextResponse.json({ error: "This signing link has expired" }, { status: 410 })
  }
  if (signer.tokenExpiresAt && new Date() > signer.tokenExpiresAt) {
    return NextResponse.json({ error: "This signing link has expired" }, { status: 410 })
  }
  if (signer.signedAt) {
    return NextResponse.json({ error: "You have already signed this document" }, { status: 410 })
  }
  if (signer.declinedAt) {
    return NextResponse.json({ error: "You have declined to sign this document" }, { status: 410 })
  }

  // Log view event
  if (!signer.viewedAt) {
    await prisma.airSignSigner.update({
      where: { id: signer.id },
      data: { viewedAt: new Date() },
    })
    await prisma.airSignAuditEvent.create({
      data: {
        envelopeId: signer.envelope.id,
        signerId: signer.id,
        action: "viewed",
        ipAddress: req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? undefined,
        userAgent: req.headers.get("user-agent") ?? undefined,
      },
    })

    // Update envelope to IN_PROGRESS if still SENT
    if (signer.envelope.status === "SENT") {
      await prisma.airSignEnvelope.update({
        where: { id: signer.envelope.id },
        data: { status: "IN_PROGRESS" },
      })
    }
  }

  // Get fields assigned to this signer
  const fields = await prisma.airSignField.findMany({
    where: { envelopeId: signer.envelope.id, signerId: signer.id },
    orderBy: [{ page: "asc" }, { yPercent: "asc" }],
  })

  return NextResponse.json({
    envelope: {
      id: signer.envelope.id,
      name: signer.envelope.name,
      documentUrl: signer.envelope.documentUrl,
      pageCount: signer.envelope.pageCount,
    },
    signer: {
      id: signer.id,
      name: signer.name,
      email: signer.email,
      role: signer.role,
    },
    fields: fields.map((f) => ({
      id: f.id,
      type: f.type,
      label: f.label,
      required: f.required,
      page: f.page,
      xPercent: f.xPercent,
      yPercent: f.yPercent,
      widthPercent: f.widthPercent,
      heightPercent: f.heightPercent,
      value: f.value,
      filled: !!f.filledAt,
    })),
  })
}

// POST — Submit signatures
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? undefined
  const ua = req.headers.get("user-agent") ?? undefined

  const signer = await prisma.airSignSigner.findUnique({
    where: { token },
    include: {
      envelope: { include: { signers: true, fields: { include: { signer: true } }, auditEvents: true } },
    },
  })

  if (!signer) return NextResponse.json({ error: "Invalid signing link" }, { status: 404 })
  if (signer.signedAt) return NextResponse.json({ error: "Already signed" }, { status: 410 })
  if (signer.declinedAt) return NextResponse.json({ error: "Already declined" }, { status: 410 })
  if (signer.envelope.status === "VOIDED") return NextResponse.json({ error: "Envelope voided" }, { status: 410 })
  if (signer.envelope.status === "DECLINED") return NextResponse.json({ error: "Signing paused — another signer declined" }, { status: 410 })
  if (signer.envelope.status === "COMPLETED") return NextResponse.json({ error: "Envelope completed" }, { status: 410 })
  if (signer.envelope.expiresAt && new Date() > signer.envelope.expiresAt) {
    return NextResponse.json({ error: "Expired" }, { status: 410 })
  }
  if (signer.tokenExpiresAt && new Date() > signer.tokenExpiresAt) {
    return NextResponse.json({ error: "This signing link has expired" }, { status: 410 })
  }

  const body = await req.json() as {
    action: "sign" | "decline"
    fieldValues?: Record<string, string> // fieldId → value
    signatureImages?: Record<string, string> // fieldId → PNG data URL
    declineReason?: string
  }

  // Handle decline
  if (body.action === "decline") {
    const reason = (body.declineReason ?? "").trim()
    if (reason.length < 10) {
      return NextResponse.json({ error: "A decline reason of at least 10 characters is required" }, { status: 400 })
    }

    // Mark signer declined + set envelope status to DECLINED (blocks all other signers)
    await prisma.$transaction([
      prisma.airSignSigner.update({
        where: { id: signer.id },
        data: { declinedAt: new Date(), declineReason: reason, ipAddress: ip, userAgent: ua },
      }),
      prisma.airSignEnvelope.update({
        where: { id: signer.envelope.id },
        data: { status: "DECLINED" },
      }),
      prisma.airSignAuditEvent.create({
        data: {
          envelopeId: signer.envelope.id,
          signerId: signer.id,
          action: "declined",
          ipAddress: ip,
          userAgent: ua,
          metadata: { reason },
        },
      }),
    ])

    // Notify the envelope creator via Resend (best-effort; don't fail the decline if email fails)
    try {
      const creator = await prisma.user.findUnique({ where: { id: signer.envelope.userId } })
      if (creator?.email) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
        await sendDeclineNotification({
          creatorName: [creator.firstName, creator.lastName].filter(Boolean).join(" ") || creator.email,
          creatorEmail: creator.email,
          signerName: signer.name,
          envelopeName: signer.envelope.name,
          reason,
          envelopeUrl: `${appUrl}/airsign/${signer.envelope.id}`,
        })
      }
    } catch (err) {
      console.error("[AirSign] Decline notification email failed:", err)
    }

    return NextResponse.json({ success: true, action: "declined" })
  }

  // Handle sign
  if (body.action !== "sign" || !body.fieldValues) {
    return NextResponse.json({ error: "action 'sign' with fieldValues required" }, { status: 400 })
  }

  // Validate all required fields are filled
  const myFields = signer.envelope.fields.filter((f) => f.signerId === signer.id)
  const requiredMissing = myFields.filter((f) => f.required && !body.fieldValues?.[f.id])
  if (requiredMissing.length > 0) {
    return NextResponse.json({
      error: `${requiredMissing.length} required field(s) missing`,
      missingFields: requiredMissing.map((f) => f.id),
    }, { status: 422 })
  }

  // Save field values
  const now = new Date()
  for (const [fieldId, value] of Object.entries(body.fieldValues)) {
    const field = myFields.find((f) => f.id === fieldId)
    if (!field) continue
    await prisma.airSignField.update({
      where: { id: fieldId },
      data: { value, filledAt: now },
    })
  }

  // Mark signer as signed
  await prisma.airSignSigner.update({
    where: { id: signer.id },
    data: { signedAt: now, ipAddress: ip, userAgent: ua },
  })

  await prisma.airSignAuditEvent.create({
    data: {
      envelopeId: signer.envelope.id,
      signerId: signer.id,
      action: "signed",
      ipAddress: ip,
      userAgent: ua,
      metadata: JSON.parse(JSON.stringify({
        fieldsCompleted: Object.keys(body.fieldValues).length,
        signatureImages: body.signatureImages ?? {},
      })),
    },
  })

  // Check if current order group is done; if yes, either seal or invite the next group
  const allSigners = signer.envelope.signers
  const currentOrder = signer.order
  const currentGroup = allSigners.filter((s) => s.order === currentOrder)
  const currentGroupDone = currentGroup.every(
    (s) => s.id === signer.id ? true : (!!s.signedAt || !!s.declinedAt)
  )

  let allComplete = false
  if (currentGroupDone) {
    // Find next order group (not yet signed, not declined)
    const remaining = allSigners.filter((s) => s.order > currentOrder && !s.signedAt && !s.declinedAt)
    if (remaining.length > 0) {
      const nextOrder = Math.min(...remaining.map((s) => s.order))
      const nextGroup = remaining.filter((s) => s.order === nextOrder)

      // Send invitations to the next batch
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
      const expiresAt = signer.envelope.expiresAt ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      for (const nextSigner of nextGroup) {
        await sendSigningInvitation({
          signerName: nextSigner.name,
          signerEmail: nextSigner.email,
          envelopeName: signer.envelope.name,
          signingUrl: `${appUrl}/sign/${nextSigner.token}`,
          expiresAt,
        })
        await prisma.airSignAuditEvent.create({
          data: {
            envelopeId: signer.envelope.id,
            signerId: nextSigner.id,
            action: "invited",
            metadata: { order: nextSigner.order, reason: "sequential_advance" },
          },
        })
      }
      console.log(`[AirSign] Order ${currentOrder} done — invited ${nextGroup.length} signer(s) at order ${nextOrder}`)
    } else {
      // No more signers — all done, seal
      allComplete = true
      try {
        await sealEnvelope(signer.envelope.id)
      } catch (err) {
        console.error("[AirSign] Seal failed:", err)
      }
    }
  }

  return NextResponse.json({
    success: true,
    action: "signed",
    allComplete,
  })
}

async function sealEnvelope(envelopeId: string) {
  const envelope = await prisma.airSignEnvelope.findUnique({
    where: { id: envelopeId },
    include: {
      fields: { include: { signer: true } },
      auditEvents: { orderBy: { createdAt: "asc" }, include: { signer: true } },
    },
  })

  if (!envelope || !envelope.documentUrl) return

  // Fetch original PDF
  const pdfRes = await fetch(envelope.documentUrl)
  if (!pdfRes.ok) throw new Error(`Failed to fetch PDF: ${pdfRes.status}`)
  const pdfBytes = new Uint8Array(await pdfRes.arrayBuffer())

  // Collect signature images from all signers' audit events
  const sigImages: Record<string, string> = {}
  for (const event of envelope.auditEvents) {
    if (event.action === "signed" && event.metadata) {
      const meta = event.metadata as Record<string, unknown>
      const images = meta.signatureImages as Record<string, string> | undefined
      if (images) Object.assign(sigImages, images)
    }
  }
  // Signature images are already captured in audit events above

  // v2 extended FieldType with NAME/RADIO/STRIKETHROUGH/DROPDOWN; the legacy sealer
  // only knows the original 5. Narrow here — new types seal in a follow-up pass.
  const SEALABLE = ["SIGNATURE", "INITIALS", "DATE", "TEXT", "CHECKBOX"] as const
  type SealableType = (typeof SEALABLE)[number]
  const sealFields: SealField[] = envelope.fields
    .filter((f): f is typeof f & { type: SealableType } =>
      !!f.value && !!f.filledAt && (SEALABLE as readonly string[]).includes(f.type)
    )
    .map((f) => ({
      type: f.type as SealField["type"],
      page: f.page,
      xPercent: f.xPercent,
      yPercent: f.yPercent,
      widthPercent: f.widthPercent,
      heightPercent: f.heightPercent,
      value: f.value!,
      imageDataUrl: sigImages[f.id] || undefined,
      signerName: f.signer?.name,
    }))

  // Build audit entries
  const auditEntries: AuditEntry[] = envelope.auditEvents.map((e) => ({
    action: e.action,
    signerName: e.signer?.name ?? "System",
    timestamp: e.createdAt.toISOString(),
    ipAddress: e.ipAddress ?? undefined,
  }))

  const sealedBytes = await sealPdf(pdfBytes, sealFields, auditEntries, envelope.name)

  // Upload sealed PDF to Vercel Blob (if configured) or store as base64
  // For now, we'll use Vercel Blob if available
  let sealedUrl: string | null = null

  try {
    const { put } = await import("@vercel/blob")
    const blob = await put(`airsign/sealed/${envelopeId}.pdf`, Buffer.from(sealedBytes), {
      access: "public",
      contentType: "application/pdf",
    })
    sealedUrl = blob.url
  } catch {
    // Vercel Blob not configured — log but don't fail
    console.log("[AirSign] Vercel Blob not available, sealed PDF not stored externally")
  }

  // Mark envelope as completed
  await prisma.airSignEnvelope.update({
    where: { id: envelopeId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      ...(sealedUrl && { documentUrl: sealedUrl }),
    },
  })

  await prisma.airSignAuditEvent.create({
    data: {
      envelopeId,
      action: "completed",
      metadata: { sealedUrl, fieldCount: sealFields.length },
    },
  })

  console.log(`[AirSign] Envelope ${envelopeId} sealed and completed`)

  // Fire internal webhook for transaction integration
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    const secret = process.env.AIRSIGN_INTERNAL_SECRET
    await fetch(`${appUrl}/api/airsign/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
      },
      body: JSON.stringify({
        event: "envelope.completed",
        envelopeId,
        sealedUrl,
      }),
    })
  } catch (err) {
    // Non-fatal — webhook is best-effort
    console.warn("[AirSign] Webhook dispatch failed:", err)
  }
}
