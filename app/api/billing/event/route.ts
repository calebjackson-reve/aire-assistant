import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import prisma from "@/lib/prisma"

export const dynamic = "force-dynamic"

const ALLOWED_EVENTS = [
  "viewed_upgrade",
  "clicked_upgrade",
  "started_trial",
  "converted",
  "trial_expired",
] as const

type AllowedEvent = (typeof ALLOWED_EVENTS)[number]

/**
 * POST /api/billing/event — record a conversion funnel event.
 * Body: { event: AllowedEvent, feature?: string, tier?: string, metadata?: Json }
 * Fire-and-forget friendly: always returns 200 unless clearly malformed.
 */
export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth()

  const body = (await req.json().catch(() => ({}))) as {
    event?: string
    feature?: string
    tier?: string
    metadata?: Record<string, unknown>
  }

  if (!body.event || !ALLOWED_EVENTS.includes(body.event as AllowedEvent)) {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 })
  }

  let userId: string | null = null
  if (clerkId) {
    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    })
    userId = user?.id ?? null
  }

  await prisma.conversionEvent.create({
    data: {
      userId,
      event: body.event,
      feature: body.feature,
      tier: body.tier,
      metadata: body.metadata ? JSON.parse(JSON.stringify(body.metadata)) : undefined,
    },
  })

  return NextResponse.json({ ok: true })
}
