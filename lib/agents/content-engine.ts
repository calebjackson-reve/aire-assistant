/**
 * AIRE Content Engine — Agent 5
 * Generates multi-format marketing content for listings.
 * Follows the 4-agent pattern from relationship-intelligence.ts.
 */

import Anthropic from "@anthropic-ai/sdk"
import prisma from "@/lib/prisma"

const anthropic = new Anthropic()

// --- Fair Housing Compliance Check ---
const FAIR_HOUSING_PATTERNS = [
  /\b(family|families|children|kids)\b.*\b(neighborhood|area|community)\b/i,
  /\b(church|mosque|synagogue|temple)\b.*\b(near|close|walk)\b/i,
  /\b(safe|dangerous|crime|sketchy)\b.*\b(neighborhood|area|street)\b/i,
  /\b(master)\s+(bedroom|suite|bath)/i,
  /\b(man cave|bachelor|single|couple)\b/i,
  /\b(walking distance|close to)\b.*\b(school|church|park)\b/i,
  /\b(no children|adults only|mature|seniors only)\b/i,
  /\b(exclusive|prestigious|upscale)\b.*\b(community|neighborhood)\b/i,
]

export function checkFairHousing(text: string): { passed: boolean; warnings: string[] } {
  const warnings: string[] = []
  for (const pattern of FAIR_HOUSING_PATTERNS) {
    const match = text.match(pattern)
    if (match) warnings.push(`Potential Fair Housing issue: "${match[0]}"`)
  }
  return { passed: warnings.length === 0, warnings }
}

// --- Content Generators ---
export interface PropertyContext {
  address: string
  city?: string
  price?: number
  bedrooms?: number
  bathrooms?: number
  sqft?: number
  yearBuilt?: number
  features?: string[]
  neighborhood?: string
  mlsDescription?: string
}

export async function generateContentCampaign(
  userId: string,
  property: PropertyContext,
  transactionId?: string
): Promise<string> {
  const prompt = `You are a luxury real estate content writer in Louisiana. Generate marketing content for:
Property: ${property.address}, ${property.city || "Baton Rouge"}, LA
Price: ${property.price ? "$" + property.price.toLocaleString() : "TBD"}
${property.bedrooms ? `Bedrooms: ${property.bedrooms}` : ""}
${property.bathrooms ? `Bathrooms: ${property.bathrooms}` : ""}
${property.sqft ? `Sqft: ${property.sqft.toLocaleString()}` : ""}
${property.yearBuilt ? `Year Built: ${property.yearBuilt}` : ""}
${property.features?.length ? `Features: ${property.features.join(", ")}` : ""}
${property.neighborhood ? `Neighborhood: ${property.neighborhood}` : ""}

Generate ALL of the following in JSON format:
{
  "mlsDescription": "Professional MLS description, 250 words max. Feature-rich, factual, no Fair Housing violations.",
  "instagramCaption": "Instagram caption with emojis, hashtags, call to action. Under 2200 chars.",
  "facebookPost": "Facebook post, conversational tone, neighborhood story angle. Include call to action.",
  "linkedinPost": "LinkedIn post, professional tone, market insight angle. 150 words max.",
  "emailTemplate": "Email template with subject line and body. Warm, personal, invitation to schedule showing.",
  "smsTemplate": "SMS text, under 160 chars. Casual, direct, include address."
}

IMPORTANT: Do NOT use Fair Housing violations (no references to demographics, religion, family status, race, national origin, disability, sex). Focus on PROPERTY FEATURES only.
Return ONLY valid JSON.`

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 3000,
    messages: [{ role: "user", content: prompt }],
  })

  const text = response.content[0].type === "text" ? response.content[0].text : ""
  let parsed: Record<string, string>
  try {
    parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, "").trim())
  } catch {
    parsed = { mlsDescription: text }
  }

  // Run Fair Housing check on all content
  const allContent = Object.values(parsed).join("\n")
  const fhCheck = checkFairHousing(allContent)

  // Store campaign
  const campaign = await prisma.contentCampaign.create({
    data: {
      userId,
      transactionId: transactionId || null,
      propertyAddress: property.address,
      mlsDescription: parsed.mlsDescription || null,
      instagramCaption: parsed.instagramCaption || null,
      facebookPost: parsed.facebookPost || null,
      linkedinPost: parsed.linkedinPost || null,
      emailTemplate: parsed.emailTemplate || null,
      smsTemplate: parsed.smsTemplate || null,
      status: fhCheck.passed ? "DRAFT" : "PENDING_REVIEW",
      fairHousingCheck: fhCheck,
    },
  })

  return campaign.id
}
