/**
 * GET /api/cron/kpi-tracker
 *
 * Monthly KPI tracking cron job. Calculates KPIs for all active users.
 * Vercel cron schedule: "0 7 1 * *" (7 UTC = 2 AM CT, 1st of month)
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { trackKPIs } from "@/lib/agents/intelligence-engine"

const CRON_SECRET = process.env.CRON_SECRET

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  console.log("[Cron:KPITracker] Starting monthly KPI tracking...")
  const start = Date.now()

  try {
    // Get all paid users
    const users = await prisma.user.findMany({
      where: { tier: { not: "FREE" } },
      select: { id: true, email: true },
    })

    let tracked = 0
    const results: Array<{ userId: string; kpiId: string | null }> = []

    for (const user of users) {
      try {
        const kpiId = await trackKPIs(user.id)
        tracked++
        results.push({ userId: user.id, kpiId })
        console.log(`[Cron:KPITracker] Tracked KPIs for ${user.email}`)
      } catch (err) {
        console.error(
          `[Cron:KPITracker] Error tracking KPIs for ${user.email}:`,
          err
        )
        results.push({ userId: user.id, kpiId: null })
      }
    }

    const duration = Date.now() - start
    console.log(
      `[Cron:KPITracker] Complete: ${tracked}/${users.length} users tracked in ${duration}ms`
    )

    return NextResponse.json({
      success: true,
      tracked,
      usersProcessed: users.length,
      results,
      durationMs: duration,
    })
  } catch (err) {
    console.error("[Cron:KPITracker] Fatal error:", err)
    return NextResponse.json(
      { error: "KPI tracking failed" },
      { status: 500 }
    )
  }
}
