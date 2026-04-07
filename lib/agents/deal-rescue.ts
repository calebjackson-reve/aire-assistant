// lib/agents/deal-rescue.ts
//
// Deal Rescue Engine — Team 2
// Scores active transactions on 4 dimensions: timeline, communication,
// documents, sentiment. Generates rescue briefs for at-risk deals.

import Anthropic from "@anthropic-ai/sdk"
import prisma from "@/lib/prisma"

const anthropic = new Anthropic()

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface TransactionWithRelations {
  id: string
  propertyAddress: string
  status: string
  listPrice: number | null
  offerPrice: number | null
  acceptedPrice: number | null
  buyerName: string | null
  sellerName: string | null
  contractDate: Date | null
  closingDate: Date | null
  deadlines: {
    id: string
    name: string
    dueDate: Date
    completedAt: Date | null
  }[]
  documents: {
    id: string
    type: string
    category: string | null
    name: string
  }[]
}

interface DealScore {
  timelineScore: number
  communicationScore: number
  documentScore: number
  sentimentScore: number
  finalHealthScore: number
  recommendation: string
  rescueBrief: string | null
}

export interface DealRescueResult {
  userId: string
  runDate: Date
  totalDeals: number
  scores: Array<{ transactionId: string; propertyAddress: string } & DealScore>
  atRiskCount: number
  processingMs: number
  logsWritten: number
}

// ─── SCORING FUNCTIONS ────────────────────────────────────────────────────────

function scoreTimeline(txn: TransactionWithRelations): number {
  if (txn.deadlines.length === 0) return 5 // no deadlines = neutral

  const now = Date.now()
  let score = 10
  let urgentIncomplete = 0

  for (const d of txn.deadlines) {
    if (d.completedAt) continue // completed, skip

    const hoursLeft = (d.dueDate.getTime() - now) / (1000 * 60 * 60)

    if (hoursLeft < 0) {
      // overdue
      score -= 3
      urgentIncomplete++
    } else if (hoursLeft < 72) {
      // within 72 hours
      score -= 2
      urgentIncomplete++
    } else if (hoursLeft < 168) {
      // within 1 week
      score -= 0.5
    }
  }

  if (urgentIncomplete >= 3) score -= 2 // cascade risk

  return Math.max(0, Math.min(10, Math.round(score * 10) / 10))
}

function scoreCommunication(
  txn: TransactionWithRelations,
  comms: Array<{
    direction: string
    sentAt: Date
    fromAddress: string
    toAddress: string
    status: string
  }>
): number {
  if (comms.length === 0) return 3 // no comms = concerning

  const now = Date.now()
  let score = 10

  // Check for silence from key parties
  const partyEmails = new Set<string>()
  if (txn.buyerName) {
    // we track by any buyer-related comms
  }

  // Check last communication age
  const lastComm = comms.reduce((latest, c) =>
    c.sentAt.getTime() > latest.sentAt.getTime() ? c : latest
  )
  const hoursSinceLastComm = (now - lastComm.sentAt.getTime()) / (1000 * 60 * 60)

  if (hoursSinceLastComm > 120) score -= 4     // 5+ days silence
  else if (hoursSinceLastComm > 72) score -= 2  // 3+ days silence
  else if (hoursSinceLastComm > 48) score -= 1  // 2+ days silence

  // Check for unanswered inbound
  const unanswered = comms.filter(
    (c) => c.direction === "inbound" && c.status === "unanswered"
  )
  score -= unanswered.length * 1.5

  // Check for balanced communication (not all one direction)
  const inbound = comms.filter((c) => c.direction === "inbound").length
  const outbound = comms.filter((c) => c.direction === "outbound").length
  if (outbound > 0 && inbound === 0 && comms.length > 3) {
    score -= 2 // all outbound, no responses
  }

  return Math.max(0, Math.min(10, Math.round(score * 10) / 10))
}

function scoreDocuments(
  txn: TransactionWithRelations,
  docs: Array<{ type: string; category: string | null }>
): number {
  // Required document categories for Louisiana real estate
  const requiredDocs = [
    "purchase_agreement",
    "property_disclosure",
    "agency_disclosure",
  ]

  // Conditionally required
  const contractYear = txn.contractDate?.getFullYear() ?? 2026
  if (contractYear >= 1978) {
    // lead paint required for pre-1978 — approximate check
  }

  const presentTypes = new Set(docs.map((d) => d.type))
  let score = 10

  const missing: string[] = []
  for (const req of requiredDocs) {
    if (!presentTypes.has(req)) {
      missing.push(req)
      score -= 2
    }
  }

  // Bonus docs that help deal health
  const bonusDocs = ["inspection_response", "appraisal", "title_commitment"]
  for (const bonus of bonusDocs) {
    if (presentTypes.has(bonus)) {
      score += 0.5
    }
  }

  // Fewer total docs = less prepared
  if (docs.length === 0) score -= 2
  else if (docs.length < 3) score -= 1

  return Math.max(0, Math.min(10, Math.round(score * 10) / 10))
}

async function scoreSentiment(
  comms: Array<{
    bodyPreview: string | null
    direction: string
    sentAt: Date
    subject: string | null
  }>
): Promise<number> {
  // Take last 5 comms with content
  const recentWithContent = comms
    .filter((c) => c.bodyPreview && c.bodyPreview.length > 10)
    .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime())
    .slice(0, 5)

  if (recentWithContent.length === 0) return 5 // neutral if no content

  const commText = recentWithContent
    .map(
      (c, i) =>
        `Message ${i + 1} (${c.direction}, ${c.sentAt.toLocaleDateString()}):\nSubject: ${c.subject || "none"}\n${c.bodyPreview}`
    )
    .join("\n\n")

  try {
    const res = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      temperature: 0.2,
      system: `You are a deal health sentiment analyzer for a Louisiana real estate transaction.
Analyze these communications and score the overall sentiment on a 0-10 scale.

Scoring:
- 8-10: Positive, cooperative, deal moving forward
- 5-7: Neutral, normal business tone
- 3-4: Some tension, delays mentioned, frustration signals
- 0-2: Hostile, threatening, deal-killing language

Return ONLY valid JSON:
{
  "score": number (0-10),
  "signals": ["signal 1", "signal 2"],
  "reasoning": "one sentence"
}`,
      messages: [{ role: "user", content: commText }],
    })

    const text = res.content[0]?.type === "text" ? res.content[0].text : ""
    const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
    const parsed = JSON.parse(clean)
    return Math.max(0, Math.min(10, Number(parsed.score) || 5))
  } catch {
    return 5 // neutral on failure
  }
}

// ─── RESCUE BRIEF GENERATOR ──────────────────────────────────────────────────

async function generateRescueBrief(
  txn: TransactionWithRelations,
  scores: {
    timelineScore: number
    communicationScore: number
    documentScore: number
    sentimentScore: number
    finalHealthScore: number
  }
): Promise<string> {
  const prompt = `You are AIRE's Deal Rescue Agent for a Louisiana real estate transaction.

Transaction: ${txn.propertyAddress}
Status: ${txn.status}
Buyer: ${txn.buyerName || "Unknown"}
Seller: ${txn.sellerName || "Unknown"}
Price: $${(txn.acceptedPrice || txn.offerPrice || txn.listPrice || 0).toLocaleString()}
Closing: ${txn.closingDate?.toLocaleDateString() || "Not set"}

Health Scores (0-10 scale):
- Timeline: ${scores.timelineScore}/10 ${scores.timelineScore < 5 ? "(CRITICAL)" : ""}
- Communication: ${scores.communicationScore}/10 ${scores.communicationScore < 5 ? "(CRITICAL)" : ""}
- Documents: ${scores.documentScore}/10 ${scores.documentScore < 5 ? "(CRITICAL)" : ""}
- Sentiment: ${scores.sentimentScore}/10 ${scores.sentimentScore < 5 ? "(CRITICAL)" : ""}
- Overall: ${scores.finalHealthScore}/10

Deadlines:
${txn.deadlines.map((d) => `- ${d.name}: ${d.dueDate.toLocaleDateString()} ${d.completedAt ? "(done)" : "(pending)"}`).join("\n") || "None set"}

Documents on file:
${txn.documents.map((d) => `- ${d.name} (${d.type})`).join("\n") || "None uploaded"}

Generate a rescue brief with:
1. Top 3 risks to this deal closing
2. Immediate actions (next 24 hours)
3. This week's action plan
4. Suggested message to send to the most critical party

Keep it concise and actionable. Louisiana real estate context.`

  try {
    const res = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 800,
      temperature: 0.3,
      messages: [{ role: "user", content: prompt }],
    })

    return res.content[0]?.type === "text" ? res.content[0].text : ""
  } catch {
    return "Rescue brief generation failed. Review deal manually."
  }
}

// ─── MAIN RUNNER ──────────────────────────────────────────────────────────────

export async function runDealRescue(userId: string): Promise<DealRescueResult> {
  const start = Date.now()
  const runDate = new Date()

  // Load active transactions with relations
  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      status: {
        in: [
          "ACTIVE",
          "PENDING_INSPECTION",
          "PENDING_APPRAISAL",
          "PENDING_FINANCING",
          "CLOSING",
        ],
      },
    },
    include: {
      deadlines: {
        select: { id: true, name: true, dueDate: true, completedAt: true },
      },
      documents: {
        select: { id: true, type: true, category: true, name: true },
      },
    },
  })

  if (transactions.length === 0) {
    return {
      userId,
      runDate,
      totalDeals: 0,
      scores: [],
      atRiskCount: 0,
      processingMs: Date.now() - start,
      logsWritten: 0,
    }
  }

  const scores: DealRescueResult["scores"] = []
  let logsWritten = 0

  for (const txn of transactions) {
    // Load communications for this transaction's parties
    const comms = await prisma.communicationLog.findMany({
      where: {
        userId,
        OR: [
          { subject: { contains: txn.propertyAddress } },
          ...(txn.buyerEmail
            ? [{ fromAddress: txn.buyerEmail }, { toAddress: txn.buyerEmail }]
            : []),
          ...(txn.sellerEmail
            ? [{ fromAddress: txn.sellerEmail }, { toAddress: txn.sellerEmail }]
            : []),
        ],
      },
      orderBy: { sentAt: "desc" },
      take: 20,
    })

    // Run all 4 scoring functions (sentiment is async)
    const [timelineScore, communicationScore, documentScore, sentimentScore] =
      await Promise.all([
        Promise.resolve(scoreTimeline(txn as TransactionWithRelations)),
        Promise.resolve(scoreCommunication(txn as TransactionWithRelations, comms)),
        Promise.resolve(scoreDocuments(txn as TransactionWithRelations, txn.documents)),
        scoreSentiment(comms),
      ])

    // Weighted average: 30% timeline + 25% comm + 25% docs + 20% sentiment
    const finalHealthScore = Math.round(
      (timelineScore * 0.3 +
        communicationScore * 0.25 +
        documentScore * 0.25 +
        sentimentScore * 0.2) *
        10
    ) / 10

    let recommendation: string
    if (finalHealthScore >= 8) recommendation = "healthy"
    else if (finalHealthScore >= 6) recommendation = "closing"
    else if (finalHealthScore >= 4) recommendation = "at_risk"
    else recommendation = "critical"

    // Generate rescue brief for at-risk deals
    let rescueBrief: string | null = null
    if (finalHealthScore < 6) {
      rescueBrief = await generateRescueBrief(txn as TransactionWithRelations, {
        timelineScore,
        communicationScore,
        documentScore,
        sentimentScore,
        finalHealthScore,
      })
    }

    const dealScore: DealScore = {
      timelineScore,
      communicationScore,
      documentScore,
      sentimentScore,
      finalHealthScore,
      recommendation,
      rescueBrief,
    }

    scores.push({
      transactionId: txn.id,
      propertyAddress: txn.propertyAddress,
      ...dealScore,
    })

    // Store DealHealthLog
    try {
      await prisma.dealHealthLog.create({
        data: {
          userId,
          transactionId: txn.id,
          timelineScore,
          communicationScore,
          documentScore,
          sentimentScore,
          finalHealthScore,
          recommendation,
          rescueBrief,
          runDate,
        },
      })
      logsWritten++
    } catch (err) {
      console.error(`[DealRescue] Failed to log txn ${txn.id}:`, err)
    }
  }

  const atRiskCount = scores.filter((s) => s.finalHealthScore < 6).length

  return {
    userId,
    runDate,
    totalDeals: transactions.length,
    scores,
    atRiskCount,
    processingMs: Date.now() - start,
    logsWritten,
  }
}
