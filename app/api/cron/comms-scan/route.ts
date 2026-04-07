import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { runCommsScan } from "@/lib/comms"

/**
 * Cron: Scan all PRO/INVESTOR users' communications every 30 minutes.
 * Schedule: every 30 minutes (cron: 0,30 * * * *)
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const users = await prisma.user.findMany({
    where: { tier: { in: ["PRO", "INVESTOR"] } },
    select: { id: true, email: true },
  })

  const results = []

  for (const user of users) {
    try {
      const result = await runCommsScan(user.id, 30)
      results.push({
        userId: user.id,
        email: user.email,
        ...result,
        unanswered: undefined, // Don't include full messages in cron response
      })

      if (result.unansweredCount > 0) {
        console.log(`[CommsMonitor] ${user.email}: ${result.unansweredCount} unanswered, ${result.missedCallCount} missed calls`)
      }
    } catch (err) {
      console.error(`[CommsMonitor] Scan failed for ${user.email}:`, err)
      results.push({ userId: user.id, email: user.email, error: String(err) })
    }
  }

  return NextResponse.json({
    scannedAt: new Date().toISOString(),
    usersScanned: users.length,
    results,
  })
}
