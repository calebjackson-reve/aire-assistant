// lib/agents/morning-brief/researchers/pipeline-researcher.ts
// Queries Transaction table for active deals + AIRE intelligence scores.

import prisma from "@/lib/prisma"
import { normalizeAddress } from "@/lib/data/engines/normalize"
import { getLatestScore } from "@/lib/data/db/queries/scores"
import { TCS_STAGES, type TCSStage, nextQuestion } from "@/lib/tcs/stages"

export interface DealIntelligence {
  aireEstimate: number | null
  confidenceTier: 'HIGH' | 'MEDIUM' | 'LOW' | null
  disagreementPct: number | null
  ppsTotal: number | null
  assessorGapPct: number | null
  scoredAt: string | null
}

export interface PipelineTCSSummary {
  sessionId: string
  stage: TCSStage
  stageLabel: string
  nextActionPrompt: string | null
  nextActionKey: string | null
  updatedAt: Date
}

export interface PipelineDeal {
  id: string
  propertyAddress: string
  status: string
  buyerName: string | null
  sellerName: string | null
  acceptedPrice: number | null
  closingDate: Date | null
  daysUntilClosing: number | null
  missingDocCount: number
  pendingDeadlineCount: number
  needsAttention: boolean
  attentionReason: string | null
  intelligence: DealIntelligence | null
  tcs: PipelineTCSSummary | null
}

export interface PipelineResearchResult {
  activeDeals: PipelineDeal[]
  totalActive: number
  closingSoon: number   // closing within 14 days
  needsAttention: number
  lowConfidenceDeals: number  // deals where AIRE estimate confidence is LOW
  tcsInFlight: number         // deals with an open TCS walkthrough
}

export async function researchPipeline(userId: string): Promise<PipelineResearchResult> {
  const user = await prisma.user.findUnique({ where: { clerkId: userId } })
  if (!user) throw new Error(`User not found for clerkId: ${userId}`)

  const now = new Date()
  const fourteenDays = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)

  const transactions = await prisma.transaction.findMany({
    where: {
      userId: user.id,
      status: { notIn: ["CLOSED", "CANCELLED"] },
    },
    include: {
      deadlines: {
        where: { completedAt: null },
      },
      documents: {
        select: { checklistStatus: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  })

  // Pull in-flight TCS sessions for this user — one per transaction (most-recent)
  const tcsSessions = await prisma.tCSSession.findMany({
    where: {
      userId: user.id,
      completedAt: null,
      transactionId: { in: transactions.map((t) => t.id) },
    },
    orderBy: { updatedAt: "desc" },
  })
  const tcsByTransactionId = new Map<string, PipelineTCSSummary>()
  for (const s of tcsSessions) {
    if (!s.transactionId) continue
    if (tcsByTransactionId.has(s.transactionId)) continue // keep most-recent
    const answered = new Set(Object.keys((s.answers as Record<string, unknown>) || {}))
    const q = nextQuestion(s.currentStage as TCSStage, answered)
    tcsByTransactionId.set(s.transactionId, {
      sessionId: s.id,
      stage: s.currentStage as TCSStage,
      stageLabel: TCS_STAGES[s.currentStage as TCSStage]?.label ?? s.currentStage,
      nextActionPrompt: q?.prompt ?? null,
      nextActionKey: q?.key ?? null,
      updatedAt: s.updatedAt,
    })
  }

  // Look up AIRE scores for each deal's property (parallel, fault-tolerant)
  const scoreMap = new Map<string, DealIntelligence>()
  try {
    const lookups = transactions.map(async (t) => {
      const normalized = normalizeAddress(t.propertyAddress)
      if (!normalized) return
      const score = await getLatestScore(normalized.property_id)
      if (!score) return
      scoreMap.set(t.id, {
        aireEstimate: score.aire_estimate,
        confidenceTier: score.confidence_tier,
        disagreementPct: score.source_disagreement_pct,
        ppsTotal: score.pps_total,
        assessorGapPct: score.assessor_gap_pct,
        scoredAt: score.score_date,
      })
    })
    await Promise.allSettled(lookups)
  } catch {
    // Intelligence tables may not have data yet — continue without scores
  }

  const deals = transactions.map((t): PipelineDeal => {
    const daysUntilClosing = t.closingDate
      ? Math.floor((new Date(t.closingDate).getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
      : null

    const missingDocCount = t.documents.filter(
      (d) => d.checklistStatus === "missing"
    ).length
    const pendingDeadlineCount = t.deadlines.length

    // Determine if deal needs attention
    let needsAttention = false
    let attentionReason: string | null = null

    if (daysUntilClosing !== null && daysUntilClosing <= 7 && missingDocCount > 0) {
      needsAttention = true
      attentionReason = `Closing in ${daysUntilClosing} days with ${missingDocCount} missing docs`
    } else if (pendingDeadlineCount > 0 && t.deadlines.some((d) => new Date(d.dueDate) <= now)) {
      needsAttention = true
      attentionReason = "Has overdue deadlines"
    } else if (t.status === "DRAFT" && new Date(t.updatedAt).getTime() < now.getTime() - 7 * 24 * 60 * 60 * 1000) {
      needsAttention = true
      attentionReason = "Draft transaction stale for 7+ days"
    }

    const intelligence = scoreMap.get(t.id) ?? null
    const tcs = tcsByTransactionId.get(t.id) ?? null

    // Flag low-confidence estimates as needing attention
    if (intelligence?.confidenceTier === 'LOW' && !needsAttention) {
      needsAttention = true
      attentionReason = `AIRE estimate confidence is LOW (${(intelligence.disagreementPct ?? 0 * 100).toFixed(1)}% source disagreement)`
    }

    // TCS in-flight takes precedence as the top card on this deal:
    // surface the stage + next action in natural language.
    if (tcs) {
      needsAttention = true
      const stageLabel = tcs.stageLabel.toLowerCase()
      if (tcs.nextActionPrompt) {
        attentionReason = `${t.propertyAddress} — ${stageLabel}: ${tcs.nextActionPrompt}`
      } else {
        attentionReason = `${t.propertyAddress} — awaiting ${stageLabel} response`
      }
    }

    return {
      id: t.id,
      propertyAddress: t.propertyAddress,
      status: t.status,
      buyerName: t.buyerName,
      sellerName: t.sellerName,
      acceptedPrice: t.acceptedPrice,
      closingDate: t.closingDate,
      daysUntilClosing,
      missingDocCount,
      pendingDeadlineCount,
      needsAttention,
      attentionReason,
      intelligence,
      tcs,
    }
  })

  return {
    activeDeals: deals,
    totalActive: deals.length,
    closingSoon: deals.filter((d) => d.daysUntilClosing !== null && d.daysUntilClosing <= 14).length,
    needsAttention: deals.filter((d) => d.needsAttention).length,
    lowConfidenceDeals: deals.filter((d) => d.intelligence?.confidenceTier === 'LOW').length,
    tcsInFlight: deals.filter((d) => !!d.tcs).length,
  }
}
