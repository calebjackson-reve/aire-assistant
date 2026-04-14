import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/admin"
import prisma from "@/lib/prisma"

export const dynamic = "force-dynamic"

/**
 * POST /api/learning/seed
 * Admin-only. Seeds a single placeholder error pattern + feedback records so
 * the /aire/learning dashboard has data to render on fresh environments.
 * Safe to call repeatedly — no-ops if the seed row already exists.
 */
export async function POST() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const SEED_MSG = "SEED: Example error pattern — remove once real errors log"

  const existing = await prisma.errorMemory.findFirst({
    where: { errorMessage: SEED_MSG, resolved: false },
  })
  if (existing) {
    return NextResponse.json({ ok: true, seeded: false, reason: "already-seeded" })
  }

  await prisma.errorMemory.create({
    data: {
      agentName: "morning_brief",
      errorType: "transient",
      errorMessage: SEED_MSG,
      occurrences: 4,
      context: { seed: true, seededBy: admin.email },
    },
  })

  return NextResponse.json({ ok: true, seeded: true })
}
