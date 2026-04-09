/**
 * Pre-Listing Brief Generator
 *
 * Extracts data from old listings, appraisals, and tax records
 * then generates a comprehensive pre-listing brief for the agent.
 *
 * Uses existing multi-pass extractor + MLS autofill + market data.
 */

import Anthropic from "@anthropic-ai/sdk"
import { extractMLSFields, type MLSAutoFillResult } from "@/lib/paragon/mls-autofill"
import prisma from "@/lib/prisma"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface PreListingSource {
  type: "old_listing" | "appraisal" | "tax_record" | "mls_history"
  text: string
  extractedAt?: Date
}

export interface PreListingBrief {
  address: string
  summary: string
  propertyDetails: {
    beds?: number
    baths?: number
    sqft?: number
    lotSize?: string
    yearBuilt?: number
    style?: string
    features: string[]
    improvements: string[]
    condition: string
  }
  priorListing?: {
    date: string
    price: number
    agent: string
    brokerage: string
    dom: number
    soldPrice?: number
    soldDate?: string
  }
  mlsFields: MLSAutoFillResult | null
  marketContext: {
    priceChangeSinceLastSale: string
    recommendedRange: string
    neighborhoodTrend: string
  }
  agentNotes: string
}

/**
 * Generate a pre-listing brief from multiple document sources.
 */
export async function generatePreListingBrief(
  address: string,
  sources: PreListingSource[],
  agentUpdates?: string
): Promise<PreListingBrief> {
  // Combine all source texts
  const sourceText = sources
    .map((s) => `--- ${s.type.toUpperCase()} ---\n${s.text}`)
    .join("\n\n")

  // Extract MLS fields from the best source (prefer appraisal, then old listing)
  const bestSource = sources.find((s) => s.type === "appraisal") || sources.find((s) => s.type === "old_listing")
  let mlsFields: MLSAutoFillResult | null = null
  if (bestSource) {
    try {
      const docType = bestSource.type === "tax_record" || bestSource.type === "mls_history" ? "other" as const : bestSource.type
      mlsFields = await extractMLSFields(bestSource.text, docType)
    } catch {
      console.error("[PreListing] MLS field extraction failed")
    }
  }

  // Use Claude to synthesize a comprehensive brief
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: `You are an expert Louisiana real estate listing agent preparing a pre-listing brief.

Analyze these document sources for the property at ${address} and generate a comprehensive pre-listing summary.

${agentUpdates ? `AGENT'S RECENT UPDATES (from today's visit):\n${agentUpdates}\n\n` : ""}
DOCUMENT SOURCES:
${sourceText}

Respond with ONLY valid JSON:
{
  "summary": "2-3 sentence executive summary of the property",
  "propertyDetails": {
    "beds": number or null,
    "baths": number or null,
    "sqft": number or null,
    "lotSize": "string or null",
    "yearBuilt": number or null,
    "style": "string or null",
    "features": ["list of features extracted from sources"],
    "improvements": ["list of improvements/upgrades mentioned"],
    "condition": "Good/Fair/Excellent/etc based on sources"
  },
  "priorListing": {
    "date": "date string or null",
    "price": number or null,
    "agent": "name or null",
    "brokerage": "name or null",
    "dom": number or null,
    "soldPrice": number or null,
    "soldDate": "date string or null"
  },
  "marketContext": {
    "priceChangeSinceLastSale": "e.g. +6.2% based on similar homes",
    "recommendedRange": "$XXX,XXX - $XXX,XXX",
    "neighborhoodTrend": "Brief trend description"
  },
  "agentNotes": "Key things for the agent to verify at the property"
}`,
      },
    ],
  })

  const text = response.content[0].type === "text" ? response.content[0].text : ""
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error("Failed to parse pre-listing brief")

  const parsed = JSON.parse(jsonMatch[0])

  return {
    address,
    summary: parsed.summary,
    propertyDetails: parsed.propertyDetails,
    priorListing: parsed.priorListing,
    mlsFields,
    marketContext: parsed.marketContext,
    agentNotes: parsed.agentNotes,
  }
}

/**
 * Generate a pre-listing brief for a transaction using uploaded documents.
 */
export async function generateBriefForTransaction(
  transactionId: string,
  agentUpdates?: string
): Promise<PreListingBrief> {
  const txn = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: { documents: { orderBy: { createdAt: "desc" } } },
  })

  if (!txn) throw new Error("Transaction not found")

  // Collect document sources
  const sources: PreListingSource[] = []

  for (const doc of txn.documents) {
    if (!doc.filledData) continue
    const data = doc.filledData as Record<string, unknown>
    const text = data.rawText || JSON.stringify(data)

    if (doc.type?.toLowerCase().includes("appraisal")) {
      sources.push({ type: "appraisal", text: String(text) })
    } else if (doc.type?.toLowerCase().includes("listing")) {
      sources.push({ type: "old_listing", text: String(text) })
    } else {
      sources.push({ type: "tax_record", text: String(text) })
    }
  }

  if (sources.length === 0) {
    throw new Error("No extracted document data found. Upload an appraisal or old listing first.")
  }

  return generatePreListingBrief(txn.propertyAddress, sources, agentUpdates)
}
