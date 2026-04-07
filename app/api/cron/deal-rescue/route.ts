// app/api/cron/deal-rescue/route.ts
//
// Cron job — runs daily at 7:00 AM CST.
// Add to vercel.json: { "path": "/api/cron/deal-rescue", "schedule": "0 12 * * *" }

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { runDealRescue } from "@/lib/agents/deal-rescue"

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const start = Date.now()

  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  const isVercelCron = authHeader === `Bearer ${cronSecret}`
  const isManualTest = req.headers.get("x-aire-internal") === cronSecret

  if (!cronSecret || (!isVercelCron && !isManualTest)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Run for all PRO/INVESTOR users
    const users = await prisma.user.findMany({
      where: { tier: { in: ["PRO", "INVESTOR"] } },
    })

    if (users.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No eligible users found",
        processingMs: Date.now() - start,
      })
    }

    const results = []

    for (const user of users) {
      try {
        const name =
          [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email
        console.log(`[DealRescue] Running for user: ${name} (${user.id})`)

        const result = await runDealRescue(user.id)

        // Log agent run
        await prisma.agentRun.create({
          data: {
            userId: user.id,
            agentName: "deal_rescue",
            status: "success",
            completedAt: new Date(),
            durationMs: result.processingMs,
            resultMetadata: {
              totalDeals: result.totalDeals,
              atRiskCount: result.atRiskCount,
              logsWritten: result.logsWritten,
            },
          },
        })

        results.push({
          userId: user.id,
          userName: name,
          totalDeals: result.totalDeals,
          atRiskCount: result.atRiskCount,
          logsWritten: result.logsWritten,
          processingMs: result.processingMs,
        })

        console.log(
          `[DealRescue] Done — ${name}: ${result.atRiskCount} at-risk deals ` +
            `out of ${result.totalDeals}, ${result.logsWritten} logs in ${result.processingMs}ms`
        )
      } catch (err) {
        console.error(`[DealRescue] Failed for user ${user.id}:`, err)

        await prisma.agentRun.create({
          data: {
            userId: user.id,
            agentName: "deal_rescue",
            status: "failed",
            completedAt: new Date(),
            error: String(err),
          },
        })

        results.push({ userId: user.id, error: String(err) })
      }
    }

    return NextResponse.json({
      success: true,
      usersProcessed: users.length,
      results,
      totalProcessingMs: Date.now() - start,
    })
  } catch (err) {
    console.error("[DealRescue] Cron job failed:", err)
    return NextResponse.json(
      { error: "Deal rescue run failed", details: String(err) },
      { status: 500 }
    )
  }
}
