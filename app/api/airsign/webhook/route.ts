/**
 * AirSign Webhook — Internal event handler for envelope completion.
 * Called after all signers complete → triggers transaction workflow advancement,
 * party notifications, and audit logging.
 *
 * This is an internal webhook — called by the seal flow, not external services.
 * Auth: AIRSIGN_INTERNAL_SECRET or system-level calls.
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { onDocumentUploaded } from "@/lib/workflow/state-machine"
import { sendPartyUpdate } from "@/lib/tc/party-communications"

const INTERNAL_SECRET = process.env.AIRSIGN_INTERNAL_SECRET

export async function POST(req: NextRequest) {
  // Verify internal auth
  const authHeader = req.headers.get("authorization")
  if (INTERNAL_SECRET && authHeader !== `Bearer ${INTERNAL_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await req.json() as {
      event: "envelope.completed" | "envelope.declined" | "envelope.voided"
      envelopeId: string
      sealedUrl?: string
    }

    const { event, envelopeId, sealedUrl } = body

    if (!event || !envelopeId) {
      return NextResponse.json({ error: "event and envelopeId required" }, { status: 400 })
    }

    const envelope = await prisma.airSignEnvelope.findUnique({
      where: { id: envelopeId },
      include: {
        signers: true,
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    })

    if (!envelope) {
      return NextResponse.json({ error: "Envelope not found" }, { status: 404 })
    }

    const results: string[] = []

    if (event === "envelope.completed") {
      // Step 1: Create Document record (independent — failure does not block steps 2-3)
      if (envelope.transactionId && sealedUrl) {
        try {
          await prisma.document.create({
            data: {
              transactionId: envelope.transactionId,
              name: `Signed: ${envelope.name}`,
              type: "signed_document",
              category: "mandatory",
              fileUrl: sealedUrl,
              signatureStatus: "signed",
              checklistStatus: "verified",
            },
          })
          results.push("document_created")
        } catch (docErr) {
          console.error("[AirSign Webhook] Step 1 (document creation) failed:", docErr)
          results.push("document_create_failed")
        }

        // Step 2: Workflow auto-advance (independent — failure does not block step 3)
        try {
          const advanceResult = await onDocumentUploaded(
            envelope.transactionId,
            "signed_document",
            envelope.userId
          )
          if (advanceResult?.success) {
            results.push(`workflow_advanced:${advanceResult.fromStatus}→${advanceResult.toStatus}`)
          }
        } catch (wfErr) {
          console.error("[AirSign Webhook] Step 2 (workflow advance) failed:", wfErr)
          results.push("workflow_advance_failed")
        }
      }

      // Step 3: Notify parties (independent per signer — one failure does not block others)
      const agentName = [envelope.user.firstName, envelope.user.lastName].filter(Boolean).join(" ") || "AIRE Agent"
      for (const signer of envelope.signers) {
        if (signer.email && signer.signedAt) {
          try {
            await sendPartyUpdate("status_update", {
              propertyAddress: envelope.name,
              agentName,
              status: "All signatures collected — document sealed",
              notes: sealedUrl ? "The signed document has been sealed and is available for download." : undefined,
            }, {
              name: signer.name,
              email: signer.email,
              phone: signer.phone || undefined,
              role: "buyer",
            }, envelope.transactionId ?? undefined, envelope.userId)
            results.push(`notified:${signer.name}`)
          } catch (notifyErr) {
            console.error(`[AirSign Webhook] Step 3 (notify ${signer.name}) failed:`, notifyErr)
            results.push(`notify_failed:${signer.name}`)
          }
        }
      }

      console.log(`[AirSign Webhook] envelope.completed: ${envelopeId} — ${results.join(", ")}`)
    }

    if (event === "envelope.declined") {
      const declinedSigner = envelope.signers.find(s => s.declinedAt)
      console.log(`[AirSign Webhook] envelope.declined: ${envelopeId} by ${declinedSigner?.name}`)
      results.push(`declined_by:${declinedSigner?.name}`)
    }

    if (event === "envelope.voided") {
      console.log(`[AirSign Webhook] envelope.voided: ${envelopeId}`)
      results.push("voided")
    }

    return NextResponse.json({ success: true, event, envelopeId, results })
  } catch (error) {
    console.error("[AirSign Webhook] Error:", error)
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 })
  }
}
