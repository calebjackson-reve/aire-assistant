// app/api/airsign/envelopes/[id]/route.ts
// GET: Envelope details. PATCH: Update envelope. DELETE: Void envelope.

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import prisma from "@/lib/prisma"

async function getEnvelopeForUser(envelopeId: string, clerkId: string) {
  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) return null
  const envelope = await prisma.airSignEnvelope.findUnique({
    where: { id: envelopeId },
    include: {
      signers: true,
      fields: true,
      auditEvents: { orderBy: { createdAt: "desc" } },
    },
  })
  if (!envelope || envelope.userId !== user.id) return null
  return envelope
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const envelope = await getEnvelopeForUser(id, userId)
  if (!envelope) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json(envelope)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const envelope = await getEnvelopeForUser(id, userId)
  if (!envelope) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (envelope.status !== "DRAFT") {
    return NextResponse.json({ error: "Can only edit DRAFT envelopes" }, { status: 422 })
  }

  const body = await req.json() as {
    name?: string
    documentUrl?: string
    pageCount?: number
  }

  const updated = await prisma.airSignEnvelope.update({
    where: { id },
    data: {
      ...(body.name && { name: body.name }),
      ...(body.documentUrl && { documentUrl: body.documentUrl }),
      ...(body.pageCount !== undefined && { pageCount: body.pageCount }),
    },
  })

  return NextResponse.json(updated)
}

// DELETE — Void an envelope
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const envelope = await getEnvelopeForUser(id, userId)
  if (!envelope) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (envelope.status === "COMPLETED") {
    return NextResponse.json({ error: "Cannot void a completed envelope" }, { status: 422 })
  }

  const body = await req.json().catch(() => ({})) as { reason?: string }

  await prisma.airSignEnvelope.update({
    where: { id },
    data: { status: "VOIDED", voidedAt: new Date(), voidReason: body.reason ?? "Voided by sender" },
  })

  await prisma.airSignAuditEvent.create({
    data: { envelopeId: id, action: "voided", metadata: { reason: body.reason ?? "Voided by sender" } },
  })

  return NextResponse.json({ success: true, status: "VOIDED" })
}
