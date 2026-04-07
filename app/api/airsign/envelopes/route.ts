// app/api/airsign/envelopes/route.ts
// POST: Create a new envelope. GET: List user's envelopes.

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import prisma from "@/lib/prisma"
import { classifyByPatterns } from "@/lib/document-classifier"
import { templateKeyForClassification, expandTemplate, FORM_TEMPLATES } from "@/lib/airsign/form-templates"

// POST — Create envelope
export async function POST(req: NextRequest) {
  const { requireFeature } = await import("@/lib/auth/subscription-gate")
  const gate = await requireFeature("airsign")
  if (gate) return gate

  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { clerkId: userId } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const body = await req.json() as {
    name: string
    documentUrl?: string
    pageCount?: number
    transactionId?: string
    formType?: string // optional explicit template key, e.g. "lrec-101"
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
              // Per-signer token expiration: 14 days from creation
              tokenExpiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
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

  // Auto-field-placement: classify and apply a template if we have signers + a document
  let autoPlaced: { templateKey: string; displayName: string; count: number } | null = null
  if (envelope.signers.length > 0 && envelope.documentUrl) {
    let templateKey: string | null = null
    if (body.formType && FORM_TEMPLATES[body.formType]) {
      templateKey = body.formType
    } else {
      // Classify by envelope name (often contains "Purchase Agreement" / "LREC-101")
      const classification = classifyByPatterns(body.name)
      templateKey = templateKeyForClassification(classification.type)
    }

    if (templateKey) {
      const fieldsToCreate = expandTemplate(
        templateKey,
        envelope.signers.map((s) => ({ id: s.id, name: s.name, role: s.role, order: s.order })),
        envelope.id,
        envelope.pageCount ?? undefined
      )
      if (fieldsToCreate.length > 0) {
        await prisma.airSignField.createMany({ data: fieldsToCreate })
        autoPlaced = {
          templateKey,
          displayName: FORM_TEMPLATES[templateKey].displayName,
          count: fieldsToCreate.length,
        }
        await prisma.airSignAuditEvent.create({
          data: {
            envelopeId: envelope.id,
            action: "auto_placed_fields",
            metadata: { templateKey, fieldCount: fieldsToCreate.length },
          },
        })
        console.log(`[AirSign] Auto-placed ${fieldsToCreate.length} fields from template ${templateKey} on envelope ${envelope.id}`)
      }
    }
  }

  return NextResponse.json({ ...envelope, autoPlaced }, { status: 201 })
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
