// app/api/airsign/envelopes/[id]/fields/route.ts
// GET: Fetch all fields. POST: Add fields to an envelope. PUT: Bulk replace all fields.

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import prisma from "@/lib/prisma"
import type { FieldType } from "@prisma/client"

interface FieldInput {
  signerId?: string
  type: FieldType
  label?: string
  required?: boolean
  page: number
  xPercent: number
  yPercent: number
  widthPercent: number
  heightPercent: number
  value?: string // pre-filled value for text/date fields (auto-fill)
}

async function verifyOwnership(envelopeId: string, clerkId: string) {
  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) return null
  const envelope = await prisma.airSignEnvelope.findUnique({ where: { id: envelopeId } })
  if (!envelope || envelope.userId !== user.id) return null
  return envelope
}

// GET — Fetch all fields for an envelope
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const envelope = await verifyOwnership(id, userId)
  if (!envelope) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const fields = await prisma.airSignField.findMany({
    where: { envelopeId: id },
    orderBy: [{ page: "asc" }, { yPercent: "asc" }],
  })

  return NextResponse.json({ fields })
}

// POST — Add fields
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const envelope = await verifyOwnership(id, userId)
  if (!envelope) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (envelope.status !== "DRAFT") {
    return NextResponse.json({ error: "Can only add fields to DRAFT envelopes" }, { status: 422 })
  }

  const body = await req.json() as { fields: FieldInput[] }
  if (!body.fields || !Array.isArray(body.fields) || body.fields.length === 0) {
    return NextResponse.json({ error: "fields array required" }, { status: 400 })
  }

  const created = await prisma.airSignField.createMany({
    data: body.fields.map((f) => ({
      envelopeId: id,
      signerId: f.signerId ?? null,
      type: f.type,
      label: f.label ?? null,
      required: f.required ?? true,
      page: f.page,
      xPercent: f.xPercent,
      yPercent: f.yPercent,
      widthPercent: f.widthPercent,
      heightPercent: f.heightPercent,
      ...(f.value ? { value: f.value, filledAt: new Date() } : {}),
    })),
  })

  return NextResponse.json({ created: created.count })
}

// PUT — Replace all fields
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const envelope = await verifyOwnership(id, userId)
  if (!envelope) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (envelope.status !== "DRAFT") {
    return NextResponse.json({ error: "Can only edit fields on DRAFT envelopes" }, { status: 422 })
  }

  const body = await req.json() as { fields: FieldInput[] }
  console.log("[AirSign Fields PUT]", { envelopeId: id, fieldCount: body.fields?.length ?? 0 })

  try {
    // Delete existing, create new — atomic
    const [deleted, created] = await prisma.$transaction([
      prisma.airSignField.deleteMany({ where: { envelopeId: id } }),
      prisma.airSignField.createMany({
        data: (body.fields ?? []).map((f) => ({
          envelopeId: id,
          signerId: f.signerId ?? null,
          type: f.type,
          label: f.label ?? null,
          required: f.required ?? true,
          page: f.page,
          xPercent: f.xPercent,
          yPercent: f.yPercent,
          widthPercent: f.widthPercent,
          heightPercent: f.heightPercent,
          ...(f.value ? { value: f.value, filledAt: new Date() } : {}),
        })),
      }),
    ])
    console.log("[AirSign Fields PUT] Success:", { deleted: deleted.count, created: created.count })

    const fields = await prisma.airSignField.findMany({ where: { envelopeId: id } })
    return NextResponse.json({ fields })
  } catch (err) {
    console.error("[AirSign Fields PUT] ERROR:", err)
    return NextResponse.json({ error: "Failed to save fields", details: String(err) }, { status: 500 })
  }
}
