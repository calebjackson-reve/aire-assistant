/**
 * Aggregated learning insights for /aire/learning.
 *
 * Pulls top error patterns across every known agent, then rolls up
 * feedback per feature over the last 30 days with a 7-day trend line.
 */

import prisma from "@/lib/prisma"

export interface ErrorPatternRow {
  id: string
  agentName: string
  errorType: string
  errorMessage: string
  occurrences: number
  lastSeenAt: string
  createdAt: string
  resolved: boolean
}

export interface FeatureFeedbackRow {
  feature: string
  total30d: number
  thumbsUp: number
  thumbsDown: number
  approvalRate: number | null
  corrections: number
  dismissed: number
  trend7d: { date: string; thumbsUp: number; thumbsDown: number }[]
  verdict: "love" | "neutral" | "flag" | "insufficient_data"
}

export interface LearningInsights {
  generatedAt: string
  errorPatterns: ErrorPatternRow[]
  features: FeatureFeedbackRow[]
  digest: {
    loved: string[]
    flagged: string[]
    generatedAt: string
  }
}

const FEATURES = [
  "morning_brief",
  "voice",
  "contract",
  "compliance",
  "document",
  "email",
] as const

export async function getTopErrorPatterns(limit = 10): Promise<ErrorPatternRow[]> {
  const rows: Array<{
    id: string
    agentName: string
    errorType: string
    errorMessage: string
    occurrences: number
    lastSeenAt: Date
    createdAt: Date
    resolved: boolean
  }> = await prisma.errorMemory.findMany({
    where: { resolved: false },
    orderBy: [{ occurrences: "desc" }, { lastSeenAt: "desc" }],
    take: limit,
  })
  return rows.map((r) => ({
    id: r.id,
    agentName: r.agentName,
    errorType: r.errorType,
    errorMessage: r.errorMessage,
    occurrences: r.occurrences,
    lastSeenAt: r.lastSeenAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
    resolved: r.resolved,
  }))
}

interface FeedbackSample {
  rating: number | null
  dismissed: boolean
  correction: unknown
  createdAt: Date
}

function bucketByDay(rows: FeedbackSample[], days: number) {
  const buckets = new Map<string, { thumbsUp: number; thumbsDown: number }>()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000)
    const key = d.toISOString().slice(0, 10)
    buckets.set(key, { thumbsUp: 0, thumbsDown: 0 })
  }
  for (const r of rows) {
    const key = r.createdAt.toISOString().slice(0, 10)
    const b = buckets.get(key)
    if (!b) continue
    if (r.rating === 5) b.thumbsUp += 1
    else if (r.rating === 1) b.thumbsDown += 1
  }
  return Array.from(buckets.entries()).map(([date, v]) => ({ date, ...v }))
}

export async function getFeatureFeedback(): Promise<FeatureFeedbackRow[]> {
  const since30 = new Date(Date.now() - 30 * 86_400_000)
  const since7 = new Date(Date.now() - 7 * 86_400_000)

  const rows: FeatureFeedbackRow[] = []

  for (const feature of FEATURES) {
    const logs: FeedbackSample[] = await prisma.feedbackLog.findMany({
      where: { feature, createdAt: { gte: since30 } },
      select: { rating: true, dismissed: true, correction: true, createdAt: true },
    })

    const rated = logs.filter((l: FeedbackSample) => l.rating != null)
    const thumbsUp = rated.filter((l: FeedbackSample) => l.rating === 5).length
    const thumbsDown = rated.filter((l: FeedbackSample) => l.rating === 1).length
    const total30d = logs.length
    const corrections = logs.filter((l: FeedbackSample) => l.correction != null).length
    const dismissed = logs.filter((l: FeedbackSample) => l.dismissed).length
    const approvalRate =
      rated.length > 0 ? Math.round((thumbsUp / rated.length) * 100) : null

    const trendSource = logs.filter((l: FeedbackSample) => l.createdAt >= since7)
    const trend7d = bucketByDay(trendSource, 7)

    let verdict: FeatureFeedbackRow["verdict"] = "insufficient_data"
    if (rated.length < 5) verdict = "insufficient_data"
    else if (approvalRate !== null && approvalRate >= 90) verdict = "love"
    else if (approvalRate !== null && approvalRate < 70) verdict = "flag"
    else verdict = "neutral"

    rows.push({
      feature,
      total30d,
      thumbsUp,
      thumbsDown,
      approvalRate,
      corrections,
      dismissed,
      trend7d,
      verdict,
    })
  }

  return rows
}

export async function getLearningInsights(): Promise<LearningInsights> {
  const [errorPatterns, features] = await Promise.all([
    getTopErrorPatterns(10),
    getFeatureFeedback(),
  ])

  const loved = features.filter((f) => f.verdict === "love").map((f) => f.feature)
  const flagged = features.filter((f) => f.verdict === "flag").map((f) => f.feature)

  return {
    generatedAt: new Date().toISOString(),
    errorPatterns,
    features,
    digest: {
      loved,
      flagged,
      generatedAt: new Date().toISOString(),
    },
  }
}
