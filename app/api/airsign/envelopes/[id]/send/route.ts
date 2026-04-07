// app/api/airsign/envelopes/[id]/send/route.ts
// POST: Send envelope for signing. Validates readiness, updates status, logs audit.
// In production, this would send emails via Resend. For now, returns signing URLs.

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import prisma from "@/lib/prisma"
import { sendSigningInvitation } from "@/lib/airsign/email"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { clerkId: userId } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const { id } = await params

  const envelope = await prisma.airSignEnvelope.findUnique({
    where: { id },
    include: { signers: true, fields: true },
  })

  if (!envelope || envelope.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  if (envelope.status !== "DRAFT") {
    return NextResponse.json({ error: `Cannot send envelope in ${envelope.status} status` }, { status: 422 })
  }

  // Validate readiness
  const errors: string[] = []
  if (!envelope.documentUrl) errors.push("No document uploaded")
  if (envelope.signers.length === 0) errors.push("No signers added")
  if (envelope.fields.length === 0) errors.push("No signature fields placed")

  // Check every required field has an assigned signer
  const unassigned = envelope.fields.filter((f) => f.required && !f.signerId)
  if (unassigned.length > 0) {
    errors.push(`${unassigned.length} required field(s) have no assigned signer`)
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: "Envelope not ready to send", details: errors }, { status: 422 })
  }

  try {
    // Set expiration (30 days from now)
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    // Update status to SENT
    await prisma.airSignEnvelope.update({
      where: { id },
      data: { status: "SENT", sentAt: new Date(), expiresAt },
    })

    // Log audit event
    await prisma.airSignAuditEvent.create({
      data: {
        envelopeId: id,
        action: "sent",
        metadata: {
          sentBy: user.id,
          signerCount: envelope.signers.length,
          fieldCount: envelope.fields.length,
        },
      },
    })

    // Sequential signing gate — only signers with the lowest signingOrder value
    // receive their invitation emails immediately. Higher-order signers are held
    // back ("WAITING") and will be invited automatically once the current group
    // finishes signing (handled in the POST /sign/[token] route).
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    const minOrder = Math.min(...envelope.signers.map((s) => s.signingOrder))
    const firstBatch = envelope.signers.filter((s) => s.signingOrder === minOrder)
    const waitingSigners = envelope.signers.filter((s) => s.signingOrder > minOrder)

    const signingLinks = firstBatch.map((s) => ({
      signerName: s.name,
      signerEmail: s.email,
      signingUrl: `${appUrl}/sign/${s.token}`,
      signingOrder: s.signingOrder,
    }))

    for (const s of waitingSigners) {
      console.log(`[AirSign] Signer ${s.name} (signingOrder ${s.signingOrder}) queued — WAITING until signingOrder ${minOrder} completes`)
    }

    // Send signing invitation emails via Resend (only to first-batch signers)
    const emailResults: Array<{ signer: string; status: string; error?: string }> = []
    for (const link of signingLinks) {
      try {
        const result = await sendSigningInvitation({
          signerName: link.signerName,
          signerEmail: link.signerEmail,
          envelopeName: envelope.name,
          signingUrl: link.signingUrl,
          expiresAt,
        })
        emailResults.push({ signer: link.signerName, status: result.status, error: result.error })
      } catch (emailError) {
        console.error(`[AirSign] Failed to send email to ${link.signerName}:`, emailError)
        emailResults.push({ signer: link.signerName, status: "error", error: "Email send failed" })
      }
    }

    console.log(`[AirSign] Envelope ${id} sent with ${signingLinks.length} signing links, ${emailResults.filter(e => e.status === "sent").length} emails delivered`)

    return NextResponse.json({
      success: true,
      status: "SENT",
      expiresAt: expiresAt.toISOString(),
      signingLinks,
      emailResults,
    })
  } catch (error) {
    console.error(`[AirSign] Failed to send envelope ${id}:`, error)
    return NextResponse.json({ error: "Failed to send envelope" }, { status: 500 })
  }
}
