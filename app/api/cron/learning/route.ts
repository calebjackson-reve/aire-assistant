// app/api/cron/learning/route.ts
// Vercel Cron — runs weekly (Sunday 2 AM CT / 7 AM UTC).
// Analyzes feedback + error patterns across all AI features.
// Flags underperforming prompts and agents with high error rates.
//
// vercel.json: { "crons": [{ "path": "/api/cron/learning", "schedule": "0 7 * * 0" }] }

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getFeedbackSummary } from "@/lib/learning/feedback-engine"
import { getErrorPatterns } from "@/lib/learning/error-memory"

const CRON_SECRET = process.env.CRON_SECRET

const FEATURES = ["voice", "morning_brief", "contract", "document", "compliance", "email"]
const AGENTS = ["voice_classifier", "morning_brief", "contract_writer", "document_extractor", "compliance_scanner", "email_scanner"]

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const startedAt = new Date()
  const report: Record<string, unknown> = { timestamp: startedAt.toISOString() }

  try {
    // ── 1. Feedback analysis (last 7 days) ──
    const feedbackReport: Record<string, unknown> = {}
    const flaggedFeatures: string[] = []

    for (const feature of FEATURES) {
      const summary = await getFeedbackSummary(feature, 7)
      feedbackReport[feature] = summary

      // Flag features with <80% approval rate (minimum 5 ratings to be meaningful)
      if (summary.approvalRate !== null && summary.approvalRate < 80 && (summary.thumbsUp + summary.thumbsDown) >= 5) {
        flaggedFeatures.push(`${feature}: ${summary.approvalRate}% approval (${summary.thumbsDown} thumbs down)`)
      }
    }

    report.feedback = feedbackReport
    report.flaggedFeatures = flaggedFeatures

    // ── 2. Error pattern analysis ──
    const errorReport: Record<string, unknown> = {}
    const flaggedAgents: string[] = []

    for (const agent of AGENTS) {
      const patterns = await getErrorPatterns(agent, 3)
      const totalErrors = patterns.reduce((sum, p) => sum + p.occurrences, 0)

      errorReport[agent] = {
        patternCount: patterns.length,
        totalOccurrences: totalErrors,
        topErrors: patterns.slice(0, 3).map(p => ({
          message: p.errorMessage.slice(0, 100),
          type: p.errorType,
          occurrences: p.occurrences,
        })),
      }

      // Flag agents with >10 total error occurrences in recurring patterns
      if (totalErrors > 10) {
        flaggedAgents.push(`${agent}: ${totalErrors} recurring errors across ${patterns.length} patterns`)
      }
    }

    report.errors = errorReport
    report.flaggedAgents = flaggedAgents

    // ── 3. Prompt version health check ──
    const activePrompts = await prisma.promptVersion.findMany({
      where: { active: true },
      select: { agentName: true, version: true, metrics: true, createdAt: true },
    })

    report.activePrompts = activePrompts.map(p => ({
      agent: p.agentName,
      version: p.version,
      metrics: p.metrics,
      age: Math.round((Date.now() - p.createdAt.getTime()) / 86400000) + " days",
    }))

    // ── 4. Overall health score ──
    const totalFlagged = flaggedFeatures.length + flaggedAgents.length
    report.healthScore = totalFlagged === 0 ? "healthy" : totalFlagged <= 2 ? "needs_attention" : "degraded"
    report.recommendations = []

    if (flaggedFeatures.length > 0) {
      (report.recommendations as string[]).push(
        `Review prompts for: ${flaggedFeatures.map(f => f.split(":")[0]).join(", ")}`
      )
    }
    if (flaggedAgents.length > 0) {
      (report.recommendations as string[]).push(
        `Investigate errors in: ${flaggedAgents.map(a => a.split(":")[0]).join(", ")}`
      )
    }

    // ── 5. Log as AgentRun ──
    const completedAt = new Date()
    await prisma.agentRun.create({
      data: {
        agentName: "learning_cron",
        status: "success",
        startedAt,
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
        resultMetadata: JSON.parse(JSON.stringify(report)),
      },
    })

    return NextResponse.json(report)
  } catch (error) {
    const completedAt = new Date()
    const errorMessage = error instanceof Error ? error.message : String(error)

    await prisma.agentRun.create({
      data: {
        agentName: "learning_cron",
        status: "failed",
        startedAt,
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
        error: errorMessage,
      },
    }).catch(() => {}) // Don't fail on logging failure

    console.error("Learning cron error:", error)
    return NextResponse.json({ error: "Learning cron failed", details: errorMessage }, { status: 500 })
  }
}
