/**
 * AIRE Self-Learning Engine — Feedback Capture & Analysis
 * Every AI output can receive feedback. Every correction is a training signal.
 */

import prisma from "@/lib/prisma"
import { createHash } from "crypto"

function hash(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 16)
}

/**
 * Log feedback on any AI feature output.
 * Called when user clicks thumbs up/down or makes a correction.
 */
export async function logFeedback(params: {
  userId: string
  feature: string
  rating?: number  // 1 = thumbs down, 5 = thumbs up
  input?: string   // the AI's input
  output?: string  // the AI's output
  correction?: Record<string, unknown>  // { field, before, after }
  dismissed?: boolean
  metadata?: Record<string, unknown>
}) {
  return prisma.feedbackLog.create({
    data: {
      userId: params.userId,
      feature: params.feature,
      rating: params.rating ?? null,
      inputHash: params.input ? hash(params.input) : null,
      outputHash: params.output ? hash(params.output) : null,
      correction: params.correction ? JSON.parse(JSON.stringify(params.correction)) : undefined,
      dismissed: params.dismissed ?? false,
      metadata: params.metadata ? JSON.parse(JSON.stringify(params.metadata)) : undefined,
    },
  })
}

/**
 * Get feedback summary for a feature over the last N days.
 * Used by the learning cron to identify underperforming prompts.
 */
export async function getFeedbackSummary(feature: string, days: number = 30) {
  const since = new Date(Date.now() - days * 86400000)

  const feedback = await prisma.feedbackLog.findMany({
    where: { feature, createdAt: { gte: since } },
    select: { rating: true, dismissed: true, correction: true },
  })

  const total = feedback.length
  const rated = feedback.filter(f => f.rating != null)
  const thumbsUp = rated.filter(f => f.rating === 5).length
  const thumbsDown = rated.filter(f => f.rating === 1).length
  const corrections = feedback.filter(f => f.correction != null).length
  const dismissed = feedback.filter(f => f.dismissed).length

  return {
    total,
    thumbsUp,
    thumbsDown,
    corrections,
    dismissed,
    approvalRate: rated.length > 0 ? Math.round((thumbsUp / rated.length) * 100) : null,
    correctionRate: total > 0 ? Math.round((corrections / total) * 100) : null,
    dismissalRate: total > 0 ? Math.round((dismissed / total) * 100) : null,
  }
}
