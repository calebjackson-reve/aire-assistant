// app/api/cron/learning/route.ts
// Vercel Cron — runs weekly (Sunday 2 AM CT / 7 AM UTC).
// Analyzes feedback + error patterns across all AI features.
// Flags underperforming prompts and agents with high error rates.
//
// vercel.json: { "crons": [{ "path": "/api/cron/learning", "schedule": "0 7 * * 0" }] }

import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
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

    // ── 5. Auto-prompt improvement for worst-performing feature ──
    const featureSummaries = Object.entries(feedbackReport as Record<string, { approvalRate: number | null; thumbsUp: number; thumbsDown: number }>)
      .filter(([, s]) => s.approvalRate !== null && (s.thumbsUp + s.thumbsDown) >= 5)
      .map(([name, s]) => ({ name, approvalRate: s.approvalRate! }))
      .sort((a, b) => a.approvalRate - b.approvalRate)

    const worstFeature = featureSummaries.length > 0 ? featureSummaries[0] : null

    if (worstFeature && worstFeature.approvalRate < 80) {
      try {
        const badFeedback = await prisma.feedbackLog.findMany({
          where: { feature: worstFeature.name, rating: 1 },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { correction: true, metadata: true, createdAt: true },
        })

        if (badFeedback.length >= 3) {
          // Get current active prompt version
          const currentPrompt = await prisma.promptVersion.findFirst({
            where: { agentName: worstFeature.name, active: true },
            orderBy: { version: "desc" },
          })

          const promptText = currentPrompt?.promptText || "No prompt version stored yet"
          const corrections = badFeedback.map(f => JSON.stringify(f.correction || f.metadata)).join("\n")

          const anthropic = new Anthropic()
          const improvement = await anthropic.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 2000,
            messages: [{
              role: "user",
              content: `You are improving an AI prompt for the "${worstFeature.name}" feature. Here are 5 cases where it produced bad results:\n\n${corrections}\n\nCurrent prompt:\n${promptText}\n\nGenerate an improved prompt that addresses these failures. Return ONLY the improved prompt text.`
            }],
          })

          const improvedText = improvement.content[0].type === "text" ? improvement.content[0].text : ""

          if (improvedText) {
            const nextVersion = (currentPrompt?.version || 0) + 1
            await prisma.promptVersion.create({
              data: {
                agentName: worstFeature.name,
                version: nextVersion,
                promptText: improvedText,
                active: false, // Draft — needs human review
                notes: `Auto-generated from ${badFeedback.length} negative feedback records`,
              },
            })

            report.promptImprovement = {
              feature: worstFeature.name,
              approvalRate: worstFeature.approvalRate,
              feedbackCount: badFeedback.length,
              newVersion: nextVersion,
              status: "draft_created",
            }
          }
        } else {
          report.promptImprovement = {
            feature: worstFeature.name,
            approvalRate: worstFeature.approvalRate,
            status: "skipped_insufficient_feedback",
            feedbackCount: badFeedback.length,
          }
        }
      } catch (promptError) {
        report.promptImprovement = {
          feature: worstFeature.name,
          status: "failed",
          error: promptError instanceof Error ? promptError.message : String(promptError),
        }
      }
    } else {
      report.promptImprovement = { status: "not_needed", reason: "All features above 80% approval or insufficient data" }
    }

    // ── 6. Log as AgentRun ──
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
