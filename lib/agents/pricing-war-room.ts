// lib/agents/pricing-war-room.ts
//
// Seller Pricing War Room — Team 4
// Generates 3-tier pricing analysis with DOM projections, net proceeds,
// and seller objection handling. Uses Claude for market intelligence.

import Anthropic from "@anthropic-ai/sdk"
import prisma from "@/lib/prisma"

const anthropic = new Anthropic()

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface PricePoint {
  label: string
  price: number
  domProjection: number
  netProceeds: number
  reasoning: string
}

interface Objection {
  objection: string
  response: string
}

export interface PricingAnalysisResult {
  userId: string
  propertyAddress: string
  contactId: string | null
  conservative: PricePoint
  target: PricePoint
  aggressive: PricePoint
  recommendedPrice: number
  objections: Objection[]
  runDate: Date
  processingMs: number
}

// ─── PRICING PROMPT ───────────────────────────────────────────────────────────

const PRICING_PROMPT = `You are AIRE's Seller Pricing War Room Analyst for a Louisiana real estate agent in the Baton Rouge metro area.

Given a property address, generate a comprehensive pricing analysis.

You must return ONLY valid JSON with this exact structure:
{
  "conservative": {
    "price": number,
    "domProjection": number (days on market),
    "netProceeds": number (after 6% commission + ~$3000 closing costs),
    "reasoning": "one sentence"
  },
  "target": {
    "price": number,
    "domProjection": number,
    "netProceeds": number,
    "reasoning": "one sentence"
  },
  "aggressive": {
    "price": number,
    "domProjection": number,
    "netProceeds": number,
    "reasoning": "one sentence"
  },
  "recommendedPrice": number,
  "objections": [
    {
      "objection": "Seller objection text",
      "response": "Agent response — empathetic, data-driven, Ninja Selling style"
    }
  ]
}

Pricing guidelines:
- Conservative: 90th percentile safety, quick sale in 10-20 DOM
- Target: Market-aligned, projected 30-45 DOM
- Aggressive: Stretch price, may sit 60+ days
- Net proceeds = price - (price * 0.06) - 3000
- Objections: Generate exactly 5 common seller objections with responses

Louisiana context:
- East Baton Rouge Parish median ~$250K
- Ascension Parish (Prairieville, Gonzales) median ~$280K
- Livingston Parish (Denham Springs, Walker) median ~$220K
- Central, Zachary premium areas
- Flood zone impacts pricing significantly
- Property taxes based on assessed value (10% of fair market)
`

// ─── MAIN RUNNER ──────────────────────────────────────────────────────────────

export async function runPricingAnalysis(
  userId: string,
  propertyAddress: string,
  contactId?: string
): Promise<PricingAnalysisResult> {
  const start = Date.now()
  const runDate = new Date()

  // Check for existing CMA data
  const existingCMA = await prisma.cMAAnalysis.findFirst({
    where: { userId, propertyAddress },
    orderBy: { createdAt: "desc" },
  })

  const cmaContext = existingCMA
    ? `\nExisting CMA estimate: $${existingCMA.cmaEstimate?.toLocaleString()}, confidence: ${existingCMA.confidence}\nComps: ${JSON.stringify(existingCMA.selectedComps)}`
    : ""

  const userPrompt = `Property Address: ${propertyAddress}${cmaContext}

Generate the 3-tier pricing analysis with DOM projections, net proceeds, and 5 seller objections with responses.`

  let analysis: {
    conservative: PricePoint
    target: PricePoint
    aggressive: PricePoint
    recommendedPrice: number
    objections: Objection[]
  }

  try {
    const res = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1200,
      temperature: 0.3,
      system: PRICING_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    })

    const text = res.content[0]?.type === "text" ? res.content[0].text : ""
    const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
    analysis = JSON.parse(clean)
  } catch (err) {
    console.error("[PricingWarRoom] Claude analysis failed:", err)
    // Fallback with placeholder
    const basePrice = 250000
    analysis = {
      conservative: {
        label: "Conservative",
        price: basePrice * 0.95,
        domProjection: 15,
        netProceeds: basePrice * 0.95 * 0.94 - 3000,
        reasoning: "Analysis unavailable — using market median estimate.",
      },
      target: {
        label: "Target",
        price: basePrice,
        domProjection: 35,
        netProceeds: basePrice * 0.94 - 3000,
        reasoning: "Analysis unavailable — using market median estimate.",
      },
      aggressive: {
        label: "Aggressive",
        price: basePrice * 1.05,
        domProjection: 65,
        netProceeds: basePrice * 1.05 * 0.94 - 3000,
        reasoning: "Analysis unavailable — using market median estimate.",
      },
      recommendedPrice: basePrice,
      objections: [
        {
          objection: "My neighbor's house sold for more.",
          response: "Let's look at the specific differences — condition, updates, and lot size all factor in.",
        },
      ],
    }
  }

  // Ensure labels
  analysis.conservative.label = "Conservative"
  analysis.target.label = "Target"
  analysis.aggressive.label = "Aggressive"

  // Store PricingAnalysisLog
  try {
    await prisma.pricingAnalysisLog.create({
      data: {
        userId,
        contactId: contactId || null,
        propertyAddress,
        cmaEstimate: existingCMA?.cmaEstimate || null,
        conservativePrice: analysis.conservative.price,
        targetPrice: analysis.target.price,
        aggressivePrice: analysis.aggressive.price,
        recommendedPrice: analysis.recommendedPrice,
        domProjection30: analysis.conservative.domProjection,
        domProjection60: analysis.target.domProjection,
        domProjection90: analysis.aggressive.domProjection,
        objections: JSON.parse(JSON.stringify(analysis.objections)),
      },
    })
  } catch (err) {
    console.error("[PricingWarRoom] Failed to store log:", err)
  }

  return {
    userId,
    propertyAddress,
    contactId: contactId || null,
    conservative: analysis.conservative,
    target: analysis.target,
    aggressive: analysis.aggressive,
    recommendedPrice: analysis.recommendedPrice,
    objections: analysis.objections,
    runDate,
    processingMs: Date.now() - start,
  }
}
