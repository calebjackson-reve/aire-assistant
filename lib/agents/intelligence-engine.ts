/**
 * AIRE Intelligence Engine — Agent 6
 * CMA analysis, lead scoring, DOM projection, KPI tracking.
 */

import Anthropic from "@anthropic-ai/sdk"
import { Prisma } from "@prisma/client"
import prisma from "@/lib/prisma"
import { withCircuitBreaker } from "@/lib/learning/circuit-breaker"
import { logError } from "@/lib/learning/error-memory"

const anthropic = new Anthropic()

// --- CMA Engine ---
export async function runCMAAnalysis(
  userId: string,
  propertyAddress: string,
  transactionId?: string
): Promise<string> {
  // Query scored properties for comps
  const allProps = (await prisma.$queryRawUnsafe(`
    SELECT address, sold_price, sold_date, sqft, bedrooms, bathrooms, year_built, lot_size,
           pool, waterfront, garage_spaces, aire_score
    FROM properties_clean
    WHERE sold_price IS NOT NULL AND sold_date > NOW() - INTERVAL '6 months'
    ORDER BY sold_date DESC
    LIMIT 100
  `)) as Record<string, unknown>[]

  // Use Claude to select best comps and make adjustments
  const prompt = `You are a Louisiana real estate appraiser. Select the 3-5 best comparable properties for:
Subject: ${propertyAddress}

Available comps (JSON):
${JSON.stringify(allProps.slice(0, 20), null, 2)}

For each selected comp, provide adjustments for:
- Location (same subdivision = 0, nearby = -2% to +2%)
- Size (per sqft difference x $80-120)
- Age (per year x $500-1500)
- Pool (+$7,000-25,000)
- Waterfront (+$25,000-100,000)
- Garage ($5,000-15,000 per space)
- Condition (estimate from AIRE score)

Return JSON:
{
  "selectedComps": [{ "address": "...", "soldPrice": N, "soldDate": "...", "adjustments": [{ "factor": "...", "amount": N }], "adjustedPrice": N }],
  "estimatedValue": N,
  "confidenceRange": { "low": N, "high": N },
  "confidence": 0.XX
}
Return ONLY valid JSON.`

  const cbResult = await withCircuitBreaker(
    () => anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    }),
    { agentName: "cma", maxRetries: 2 }
  )

  let parsed: Record<string, unknown>
  if ("error" in cbResult) {
    await logError({ agentName: "cma", error: cbResult.error, context: { userId, propertyAddress } }).catch(() => {})
    parsed = { estimatedValue: null, confidence: 0 }
  } else {
    const text = cbResult.result.content[0].type === "text" ? cbResult.result.content[0].text : "{}"
    try {
      parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, "").trim())
    } catch {
      parsed = { estimatedValue: null, confidence: 0 }
    }
  }

  const selectedComps = parsed.selectedComps as
    | Array<{ adjustments?: Array<{ factor: string; amount: number }> }>
    | undefined

  const cma = await prisma.cMAAnalysis.create({
    data: {
      userId,
      transactionId: transactionId || null,
      propertyAddress,
      selectedComps: (parsed.selectedComps as object) || null,
      cmaEstimate: (parsed.estimatedValue as number) || null,
      confidence: (parsed.confidence as number) || null,
      adjustments:
        (selectedComps?.flatMap((c) => c.adjustments || []) as Prisma.InputJsonValue) ??
        Prisma.JsonNull,
    },
  })

  return cma.id
}

// --- Lead Scoring (4-agent pattern) ---
export async function scoreLeads(userId: string): Promise<number> {
  const contacts = await prisma.contact.findMany({
    where: { agentId: userId },
    include: { intelLogs: { orderBy: { runDate: "desc" }, take: 1 } },
  })

  let scored = 0
  for (const contact of contacts) {
    // Communication frequency (from CommunicationLog)
    const commCount = await prisma.communicationLog.count({
      where: {
        userId,
        contactId: contact.id,
        sentAt: { gte: new Date(Date.now() - 90 * 86400000) },
      },
    })
    const commScore = Math.min(commCount / 10, 1) * 100

    // Recency (days since last contact)
    const daysSinceContact = contact.lastContactedAt
      ? (Date.now() - contact.lastContactedAt.getTime()) / 86400000
      : 365
    const recencyScore = Math.max(0, 100 - daysSinceContact * 2)

    // Response rate
    const responseRate =
      contact.contactCount > 0
        ? (contact.responseCount / contact.contactCount) * 100
        : 50

    // Market timing (use relationship score as proxy)
    const marketScore = contact.relationshipScore

    const finalScore = Math.round(
      commScore * 0.3 +
        recencyScore * 0.2 +
        responseRate * 0.25 +
        marketScore * 0.25
    )

    const recommendation =
      finalScore >= 70
        ? "high"
        : finalScore >= 50
          ? "warm"
          : finalScore >= 30
            ? "cool"
            : "dormant"

    await prisma.leadScoreLog.create({
      data: {
        userId,
        contactId: contact.id,
        communicationFrequency: commScore,
        lifeEventSignals: marketScore,
        marketTiming: responseRate,
        recencyWarmth: recencyScore,
        finalScore,
        recommendation,
      },
    })
    scored++
  }

  return scored
}

// --- DOM Projection ---
export async function projectDOM(transactionId: string): Promise<string> {
  const txn = await prisma.transaction.findUnique({
    where: { id: transactionId },
  })
  if (!txn?.listPrice) return ""

  const listPrice = Number(txn.listPrice)
  // Simple DOM model based on price position
  const baseDOM = 30
  const priceToMedianRatio = listPrice / 250000 // Baton Rouge median ~$250K
  const domMultiplier =
    priceToMedianRatio > 1.2 ? 1.5 : priceToMedianRatio > 0.8 ? 1.0 : 0.7

  const dom30 = Math.round(baseDOM * domMultiplier)
  const dom60 = Math.round(dom30 * 1.3)
  const dom90 = Math.round(dom30 * 1.6)

  const commissionRate = 0.06
  const monthlyHoldingCost = listPrice * 0.005 // ~0.5% per month

  const proj = await prisma.dOMProjection.create({
    data: {
      transactionId,
      listPrice,
      projectedDOM30: dom30,
      projectedDOM60: dom60,
      projectedDOM90: dom90,
      netProceeds30:
        listPrice * (1 - commissionRate) - monthlyHoldingCost,
      netProceeds60:
        listPrice * 0.97 * (1 - commissionRate) - monthlyHoldingCost * 2,
      netProceeds90:
        listPrice * 0.94 * (1 - commissionRate) - monthlyHoldingCost * 3,
    },
  })

  return proj.id
}

// --- KPI Tracker ---
export async function trackKPIs(userId: string): Promise<string> {
  const now = new Date()
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  const closedTxns = await prisma.transaction.findMany({
    where: {
      userId,
      status: "CLOSED",
      closingDate: { gte: monthStart, lt: monthEnd },
    },
  })

  const activeTxns = await prisma.transaction.count({
    where: { userId, status: { notIn: ["CLOSED", "CANCELLED"] } },
  })

  const pipeline = await prisma.transaction.aggregate({
    where: { userId, status: { notIn: ["CLOSED", "CANCELLED"] } },
    _sum: { acceptedPrice: true },
  })

  const avgDays =
    closedTxns.length > 0
      ? closedTxns.reduce((sum, t) => {
          const start = t.contractDate || t.createdAt
          const end = t.closingDate || t.updatedAt
          return sum + (end.getTime() - start.getTime()) / 86400000
        }, 0) / closedTxns.length
      : null

  const totalCommission = closedTxns.reduce((sum, t) => {
    const price = Number(t.acceptedPrice || t.listPrice || 0)
    return sum + price * 0.03 // assume 3% agent side
  }, 0)

  const kpi = await prisma.kPILog.upsert({
    where: { userId_period: { userId, period } },
    update: {
      closedTransactions: closedTxns.length,
      avgDaysToClose: avgDays,
      totalCommission,
      avgCommission:
        closedTxns.length > 0 ? totalCommission / closedTxns.length : null,
      pipelineValue: Number(pipeline._sum.acceptedPrice || 0),
      activeDeals: activeTxns,
    },
    create: {
      userId,
      period,
      closedTransactions: closedTxns.length,
      avgDaysToClose: avgDays,
      totalCommission,
      avgCommission:
        closedTxns.length > 0 ? totalCommission / closedTxns.length : null,
      pipelineValue: Number(pipeline._sum.acceptedPrice || 0),
      activeDeals: activeTxns,
    },
  })

  return kpi.id
}
