import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import prisma from "@/lib/prisma"
import { recordConsent, revokeConsent, normalizePhone } from "@/lib/consent"

async function resolveUser() {
  const { userId: clerkId } = await auth()
  if (!clerkId) return null
  return prisma.user.findUnique({ where: { clerkId } })
}

// GET /api/consent?phone=+12255551234&channel=SMS  — check status
// GET /api/consent?transactionId=xyz              — list for transaction
// GET /api/consent                                — list all for user (recent first)
export async function GET(req: NextRequest) {
  const user = await resolveUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const phone = url.searchParams.get("phone")
  const channel = url.searchParams.get("channel") as "SMS" | "VOICE" | "EMAIL" | null
  const transactionId = url.searchParams.get("transactionId")

  if (phone && channel) {
    const normalized = normalizePhone(phone)
    if (!normalized) return NextResponse.json({ allowed: false, reason: "INVALID_PHONE" })
    const row = await prisma.clientConsent.findFirst({
      where: { userId: user.id, clientPhone: normalized, channel, revokedAt: null },
      orderBy: { consentedAt: "desc" },
    })
    return NextResponse.json({ allowed: !!row, consent: row })
  }

  const consents = await prisma.clientConsent.findMany({
    where: {
      userId: user.id,
      ...(transactionId ? { transactionId } : {}),
    },
    orderBy: { consentedAt: "desc" },
    take: 100,
  })
  return NextResponse.json({ consents })
}

// POST /api/consent — create a consent row
export async function POST(req: NextRequest) {
  const user = await resolveUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body?.clientName || !body?.channel) {
    return NextResponse.json({ error: "clientName and channel required" }, { status: 400 })
  }
  if (body.channel !== "SMS" && body.channel !== "VOICE" && body.channel !== "EMAIL") {
    return NextResponse.json({ error: "Invalid channel" }, { status: 400 })
  }

  try {
    const consent = await recordConsent({
      userId: user.id,
      transactionId: body.transactionId ?? null,
      clientName: body.clientName,
      clientPhone: body.clientPhone ?? null,
      clientEmail: body.clientEmail ?? null,
      channel: body.channel,
      method: body.method ?? "AGENT_ATTESTATION",
      agentAttestedBy: body.agentAttestedBy ?? user.email,
      notes: body.notes ?? null,
    })
    return NextResponse.json({ consent })
  } catch (err) {
    console.error("Create consent error:", err)
    return NextResponse.json({ error: "Failed to record consent" }, { status: 500 })
  }
}

// DELETE /api/consent?id=xyz — revoke (soft, sets revokedAt)
export async function DELETE(req: NextRequest) {
  const user = await resolveUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const id = url.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

  await revokeConsent(id, user.id)
  return NextResponse.json({ ok: true })
}
