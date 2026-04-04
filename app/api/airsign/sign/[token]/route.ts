// app/api/airsign/sign/[token]/route.ts
// GET: Load envelope data for signer. POST: Submit signature values.
// No auth required — token IS the auth. Public endpoint for signers.

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { sealPdf, type SealField, type AuditEntry } from "@/lib/airsign/seal-pdf"

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
  if (signer.envelope.status === "COMPLETED") {
    return NextResponse.json({ error: "This envelope is already completed" }, { status: 410 })
  }
  if (signer.envelope.expiresAt && new Date() > signer.envelope.expiresAt) {
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
  if (signer.envelope.status === "COMPLETED") return NextResponse.json({ error: "Envelope completed" }, { status: 410 })
  if (signer.envelope.expiresAt && new Date() > signer.envelope.expiresAt) {
    return NextResponse.json({ error: "Expired" }, { status: 410 })
  }

  const body = await req.json() as {
    action: "sign" | "decline"
    fieldValues?: Record<string, string> // fieldId → value
    declineReason?: string
  }

  // Handle decline
  if (body.action === "decline") {
    await prisma.airSignSigner.update({
      where: { id: signer.id },
      data: { declinedAt: new Date(), declineReason: body.declineReason ?? "Declined by signer", ipAddress: ip, userAgent: ua },
    })
    await prisma.airSignAuditEvent.create({
      data: {
        envelopeId: signer.envelope.id,
        signerId: signer.id,
        action: "declined",
        ipAddress: ip,
        userAgent: ua,
        metadata: { reason: body.declineReason },
      },
    })
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
      metadata: { fieldsCompleted: Object.keys(body.fieldValues).length },
    },
  })

  // Check if all signers have now signed → seal the PDF
  const allSigners = signer.envelope.signers
  const otherSigners = allSigners.filter((s) => s.id !== signer.id)
  const allOthersSigned = otherSigners.every((s) => s.signedAt)

  if (allOthersSigned) {
    // All signed — seal the envelope
    try {
      await sealEnvelope(signer.envelope.id)
    } catch (err) {
      console.error("[AirSign] Seal failed:", err)
      // Don't fail the signing — seal can be retried
    }
  }

  return NextResponse.json({
    success: true,
    action: "signed",
    allComplete: allOthersSigned,
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

  // Build seal fields from all filled fields
  const sealFields: SealField[] = envelope.fields
    .filter((f) => f.value && f.filledAt)
    .map((f) => ({
      type: f.type,
      page: f.page,
      xPercent: f.xPercent,
      yPercent: f.yPercent,
      widthPercent: f.widthPercent,
      heightPercent: f.heightPercent,
      value: f.value!,
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
}
