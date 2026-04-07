// app/api/cron/relationship-intelligence/route.ts
//
// Weekly cron job — runs every Monday at 6:00 AM CST.
// Add to vercel.json: { "path": "/api/cron/relationship-intelligence", "schedule": "0 11 * * 1" }

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { runRelationshipIntelligence } from "@/lib/agents/relationship-intelligence"

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const start = Date.now()

  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  const isVercelCron = authHeader === `Bearer ${cronSecret}`
  const isManualTest = req.headers.get("x-aire-internal") === cronSecret

  if (!cronSecret || (!isVercelCron && !isManualTest)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { agentId?: string } = {}
  try {
    body = await req.json()
  } catch {
    // empty body — run for all
  }

  try {
    // Current schema uses User, not Agent — query users with active subscriptions
    const users = body.agentId
      ? await prisma.user.findMany({ where: { id: body.agentId } })
      : await prisma.user.findMany({ where: { tier: { not: "FREE" } } })

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
        const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email
        console.log(`[RelIntel] Running for user: ${name} (${user.id})`)

        const result = await runRelationshipIntelligence({
          agentId: user.id,
          limit: 100,
        })

        results.push({
          agentId: user.id,
          agentName: name,
          totalContacts: result.totalContacts,
          hitListCount: result.hitList.length,
          logsWritten: result.logsWritten,
          processingMs: result.processingMs,
        })

        console.log(
          `[RelIntel] Done — ${name}: ${result.hitList.length} contacts in hit list, ` +
          `${result.logsWritten} logs written in ${result.processingMs}ms`
        )
      } catch (err) {
        console.error(`[RelIntel] Failed for user ${user.id}:`, err)
        results.push({ agentId: user.id, error: String(err) })
      }
    }

    return NextResponse.json({
      success: true,
      usersProcessed: users.length,
      results,
      totalProcessingMs: Date.now() - start,
    })
  } catch (err) {
    console.error("[RelIntel] Cron job failed:", err)
    return NextResponse.json(
      { error: "Relationship intelligence run failed", details: String(err) },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get("agentId")

  if (!agentId) {
    return NextResponse.json({ error: "agentId required" }, { status: 400 })
  }

  try {
    const latestRun = await prisma.relationshipIntelLog.findFirst({
      where: { agentId },
      orderBy: { runDate: "desc" },
      select: { runDate: true },
    })

    if (!latestRun) {
      return NextResponse.json({ hitList: [], lastRun: null })
    }

    const hitList = await prisma.relationshipIntelLog.findMany({
      where: {
        agentId,
        runDate: latestRun.runDate,
        recommendation: { not: "Skip" },
      },
      include: { contact: true },
      orderBy: { finalScore: "desc" },
      take: 10,
    })

    return NextResponse.json({
      hitList,
      lastRun: latestRun.runDate,
      totalScored: await prisma.relationshipIntelLog.count({
        where: { agentId, runDate: latestRun.runDate },
      }),
    })
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch hit list", details: String(err) },
      { status: 500 }
    )
  }
}
