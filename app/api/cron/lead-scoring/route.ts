/**
 * GET /api/cron/lead-scoring
 *
 * Weekly lead scoring cron job. Scores all contacts for all users.
 * Vercel cron schedule: "0 8 * * 1" (8 UTC = 3 AM CT, Monday)
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { scoreLeads } from "@/lib/agents/intelligence-engine"

const CRON_SECRET = process.env.CRON_SECRET

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  console.log("[Cron:LeadScoring] Starting weekly lead scoring...")
  const start = Date.now()

  try {
    // Get all users with contacts
    const users = await prisma.user.findMany({
      where: { tier: { not: "FREE" } },
      select: { id: true, email: true },
    })

    let totalScored = 0
    const results: Array<{ userId: string; scored: number }> = []

    for (const user of users) {
      try {
        const scored = await scoreLeads(user.id)
        totalScored += scored
        results.push({ userId: user.id, scored })
        console.log(
          `[Cron:LeadScoring] Scored ${scored} contacts for ${user.email}`
        )
      } catch (err) {
        console.error(
          `[Cron:LeadScoring] Error scoring leads for ${user.email}:`,
          err
        )
        results.push({ userId: user.id, scored: 0 })
      }
    }

    const duration = Date.now() - start
    console.log(
      `[Cron:LeadScoring] Complete: ${totalScored} contacts scored across ${users.length} users in ${duration}ms`
    )

    return NextResponse.json({
      success: true,
      totalScored,
      usersProcessed: users.length,
      results,
      durationMs: duration,
    })
  } catch (err) {
    console.error("[Cron:LeadScoring] Fatal error:", err)
    return NextResponse.json(
      { error: "Lead scoring failed" },
      { status: 500 }
    )
  }
}
