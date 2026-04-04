// app/api/airsign/envelopes/route.ts
// POST: Create a new envelope. GET: List user's envelopes.

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import prisma from "@/lib/prisma"

// POST — Create envelope
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { clerkId: userId } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const body = await req.json() as {
    name: string
    documentUrl?: string
    pageCount?: number
    transactionId?: string
    signers?: Array<{ name: string; email: string; phone?: string; role?: string; order?: number }>
  }

  if (!body.name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 })
  }

  const envelope = await prisma.airSignEnvelope.create({
    data: {
      userId: user.id,
      name: body.name,
      documentUrl: body.documentUrl ?? null,
      pageCount: body.pageCount ?? null,
      transactionId: body.transactionId ?? null,
      status: "DRAFT",
      signers: body.signers
        ? {
            create: body.signers.map((s, i) => ({
              name: s.name,
              email: s.email,
              phone: s.phone ?? null,
              role: s.role ?? "SIGNER",
              order: s.order ?? i + 1,
            })),
          }
        : undefined,
    },
    include: { signers: true },
  })

  // Log creation audit event
  await prisma.airSignAuditEvent.create({
    data: {
      envelopeId: envelope.id,
      action: "created",
      metadata: { createdBy: user.id, name: body.name },
    },
  })

  return NextResponse.json(envelope, { status: 201 })
}

// GET — List envelopes
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { clerkId: userId } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const envelopes = await prisma.airSignEnvelope.findMany({
    where: { userId: user.id },
    include: {
      signers: { select: { id: true, name: true, email: true, signedAt: true, role: true } },
      _count: { select: { fields: true } },
    },
    orderBy: { updatedAt: "desc" },
  })

  return NextResponse.json(envelopes)
}
