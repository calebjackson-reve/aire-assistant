// lib/agents/negotiation-intelligence.ts
//
// Negotiation Intelligence — Team 6
// 4-agent analysis of incoming offers: anatomy, market position,
// motivation profiling, and scenario modeling.

import Anthropic from "@anthropic-ai/sdk"
import prisma from "@/lib/prisma"

const anthropic = new Anthropic()

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface IncomingOffer {
  price: number
  terms: Record<string, unknown>
}

interface Scenario {
  action: string
  counterPrice: number | null
  probability: number
  netProceeds: number
  reasoning: string
}

export interface NegotiationResult {
  transactionId: string
  recommendedAction: string
  recommendedCounter: number | null
  acceptanceProbability: number
  expectedClosingDays: number
  expectedNetProceeds: number
  scenarios: Scenario[]
  analysis: {
    offerAnatomy: string
    marketPosition: string
    motivationProfile: string
    scenarioModeling: string
  }
  processingMs: number
}

// ─── NEGOTIATION PROMPT ───────────────────────────────────────────────────────

const NEGOTIATION_PROMPT = `You are AIRE's Negotiation Intelligence Engine for a Louisiana real estate agent.

You run 4 parallel analyses on an incoming offer:

1. OFFER ANATOMY: Break down every term of the offer. Flag buried issues (inspection contingency too long, unusual earnest money, financing red flags, non-standard addenda).

2. MARKET POSITION: Compare the offer price to the listing price and any CMA data. Assess fairness as a percentage of list. Consider current DOM, market conditions, and comparable sales.

3. MOTIVATION PROFILE: Analyze prior communications for signals of buyer flexibility. Look for: pre-approval strength, timeline pressure, emotional attachment language, multiple-offer hints, "walk away" language.

4. SCENARIO MODELING: Generate exactly 3 counter scenarios:
   - Accept as-is: probability of closing + net proceeds
   - Counter Low: modest counter (2-3% above offer), probability + net proceeds
   - Counter High: aggressive counter (5-8% above offer), probability + net proceeds

Net proceeds = price - (price * 0.06) - 3000 (approximate closing costs)

Return ONLY valid JSON:
{
  "offerAnatomy": "2-3 sentence analysis of offer terms and flags",
  "marketPosition": "2-3 sentence analysis of price fairness",
  "motivationProfile": "2-3 sentence analysis of buyer flexibility signals",
  "scenarioModeling": "1 sentence summary of best path",
  "recommendedAction": "accept" | "counter" | "reject",
  "recommendedCounter": number or null,
  "acceptanceProbability": number (0-1),
  "expectedClosingDays": number,
  "expectedNetProceeds": number,
  "sellerMotivation": "flexible" | "firm" | "desperate" | "time_constrained",
  "scenarios": [
    {
      "action": "accept",
      "counterPrice": null,
      "probability": number (0-1),
      "netProceeds": number,
      "reasoning": "one sentence"
    },
    {
      "action": "counter_low",
      "counterPrice": number,
      "probability": number (0-1),
      "netProceeds": number,
      "reasoning": "one sentence"
    },
    {
      "action": "counter_high",
      "counterPrice": number,
      "probability": number (0-1),
      "netProceeds": number,
      "reasoning": "one sentence"
    }
  ]
}`

// ─── MAIN RUNNER ──────────────────────────────────────────────────────────────

export async function analyzeNegotiation(
  userId: string,
  transactionId: string,
  incomingOffer: IncomingOffer
): Promise<NegotiationResult> {
  const start = Date.now()

  // Load transaction
  const txn = await prisma.transaction.findFirstOrThrow({
    where: { id: transactionId, userId },
  })

  // Load communications for context
  const comms = await prisma.communicationLog.findMany({
    where: {
      userId,
      OR: [
        { subject: { contains: txn.propertyAddress } },
        ...(txn.buyerEmail
          ? [{ fromAddress: txn.buyerEmail }, { toAddress: txn.buyerEmail }]
          : []),
      ],
    },
    orderBy: { sentAt: "desc" },
    take: 10,
    select: {
      direction: true,
      bodyPreview: true,
      subject: true,
      sentAt: true,
      fromAddress: true,
    },
  })

  // Load CMA data if available
  const cma = await prisma.cMAAnalysis.findFirst({
    where: { userId, propertyAddress: txn.propertyAddress },
    orderBy: { createdAt: "desc" },
  })

  const commsSummary = comms.length > 0
    ? comms
        .map(
          (c) =>
            `[${c.direction}] ${c.sentAt.toLocaleDateString()} — ${c.subject || "no subject"}: ${c.bodyPreview?.slice(0, 200) || "no preview"}`
        )
        .join("\n")
    : "No prior communications on file."

  const userPrompt = `
Transaction: ${txn.propertyAddress}, ${txn.propertyCity}, ${txn.propertyState}
List Price: $${(txn.listPrice || 0).toLocaleString()}
Accepted Price: ${txn.acceptedPrice ? `$${txn.acceptedPrice.toLocaleString()}` : "None yet"}
Status: ${txn.status}
Buyer: ${txn.buyerName || "Unknown"}
Seller: ${txn.sellerName || "Unknown"}
Days on Market: ${txn.createdAt ? Math.floor((Date.now() - txn.createdAt.getTime()) / 86400000) : "Unknown"}
${cma ? `CMA Estimate: $${cma.cmaEstimate?.toLocaleString()}, Confidence: ${cma.confidence}` : "No CMA on file."}

INCOMING OFFER:
Price: $${incomingOffer.price.toLocaleString()}
Percentage of List: ${txn.listPrice ? ((incomingOffer.price / txn.listPrice) * 100).toFixed(1) + "%" : "N/A"}
Terms: ${JSON.stringify(incomingOffer.terms, null, 2)}

PRIOR COMMUNICATIONS:
${commsSummary}

Run all 4 analyses and provide your recommendation.
`.trim()

  let analysis: Record<string, unknown>

  try {
    const res = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      temperature: 0.2,
      system: NEGOTIATION_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    })

    const text = res.content[0]?.type === "text" ? res.content[0].text : ""
    const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
    analysis = JSON.parse(clean)
  } catch (err) {
    console.error("[NegotiationIntel] Analysis failed:", err)
    throw new Error("Negotiation analysis failed")
  }

  const scenarios = (Array.isArray(analysis.scenarios) ? analysis.scenarios : []) as Scenario[]

  // Store NegotiationLog
  try {
    await prisma.negotiationLog.create({
      data: {
        userId,
        transactionId,
        incomingOfferPrice: incomingOffer.price,
        incomingTerms: incomingOffer.terms as Record<string, unknown>,
        marketAnalysis: {
          cmaEstimate: cma?.cmaEstimate || null,
          offerVsList: txn.listPrice
            ? ((incomingOffer.price / txn.listPrice) * 100).toFixed(1) + "%"
            : null,
          fairness: String(analysis.marketPosition || ""),
        },
        sellerMotivation: String(analysis.sellerMotivation || "flexible"),
        recommendedAction: String(analysis.recommendedAction || "counter"),
        recommendedCounter:
          typeof analysis.recommendedCounter === "number"
            ? analysis.recommendedCounter
            : null,
        acceptanceProbability:
          typeof analysis.acceptanceProbability === "number"
            ? analysis.acceptanceProbability
            : null,
        expectedClosingDays:
          typeof analysis.expectedClosingDays === "number"
            ? analysis.expectedClosingDays
            : null,
        expectedNetProceeds:
          typeof analysis.expectedNetProceeds === "number"
            ? analysis.expectedNetProceeds
            : null,
        scenarios: scenarios as unknown as Record<string, unknown>[],
      },
    })
  } catch (err) {
    console.error("[NegotiationIntel] Failed to store log:", err)
  }

  return {
    transactionId,
    recommendedAction: String(analysis.recommendedAction || "counter"),
    recommendedCounter:
      typeof analysis.recommendedCounter === "number"
        ? analysis.recommendedCounter
        : null,
    acceptanceProbability:
      typeof analysis.acceptanceProbability === "number"
        ? analysis.acceptanceProbability
        : 0.5,
    expectedClosingDays:
      typeof analysis.expectedClosingDays === "number"
        ? analysis.expectedClosingDays
        : 30,
    expectedNetProceeds:
      typeof analysis.expectedNetProceeds === "number"
        ? analysis.expectedNetProceeds
        : 0,
    scenarios,
    analysis: {
      offerAnatomy: String(analysis.offerAnatomy || ""),
      marketPosition: String(analysis.marketPosition || ""),
      motivationProfile: String(analysis.motivationProfile || ""),
      scenarioModeling: String(analysis.scenarioModeling || ""),
    },
    processingMs: Date.now() - start,
  }
}
