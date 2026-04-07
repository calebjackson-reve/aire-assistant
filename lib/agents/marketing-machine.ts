// lib/agents/marketing-machine.ts
//
// Marketing Machine — Team 5
// Generates multi-format content campaigns for listings.
// Runs 4 agents in a single Claude prompt: story extraction, content matrix,
// Fair Housing check, and 30-day posting calendar.

import Anthropic from "@anthropic-ai/sdk"
import prisma from "@/lib/prisma"

const anthropic = new Anthropic()

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface CalendarEntry {
  day: number
  platform: string
  contentType: string
  caption: string
}

export interface MarketingCampaignResult {
  campaignId: string
  transactionId: string
  propertyAddress: string
  story: {
    topFeatures: string[]
    idealBuyer: string
  }
  content: {
    mls: string
    instagram: string
    facebook: string
    linkedin: string
    email: string
    sms: string
  }
  fairHousingCheck: {
    passed: boolean
    warnings: string[]
  }
  calendar: CalendarEntry[]
  processingMs: number
}

// ─── MARKETING PROMPT ─────────────────────────────────────────────────────────

const MARKETING_PROMPT = `You are AIRE's Marketing Machine for a Louisiana real estate agent in the Baton Rouge metro area.

Given a property listing, generate a complete marketing campaign by running 4 analyses:

1. STORY EXTRACTION: Identify the 3 most compelling features and the ideal buyer persona.
2. CONTENT MATRIX: Generate content for all 6 platforms.
3. FAIR HOUSING CHECK: Scan all generated content for Fair Housing Act violations.
4. CALENDAR: Create a 30-day posting schedule.

FAIR HOUSING RULES (CRITICAL):
- NEVER mention: race, color, religion, sex, handicap, familial status, national origin
- NEVER use: "family-friendly", "walking distance to church", "perfect for young professionals", "bachelor pad", "man cave", "master bedroom" (use "primary bedroom")
- NEVER describe neighborhoods by demographics
- DO describe: features, amenities, location, architecture, condition

Return ONLY valid JSON:
{
  "story": {
    "topFeatures": ["feature 1", "feature 2", "feature 3"],
    "idealBuyer": "Description of ideal buyer by lifestyle/needs, not demographics"
  },
  "content": {
    "mls": "Professional MLS description, 250-400 words, feature-rich, no Fair Housing violations",
    "instagram": "Engaging caption under 2200 chars with hashtags, emoji-forward, Louisiana flair",
    "facebook": "Conversational post, 150-300 words, community-focused, shareable",
    "linkedin": "Professional tone, investment angle, market context, 150-250 words",
    "email": "Email body (no subject line), warm personal tone, CTA to schedule showing, 200-300 words",
    "sms": "Under 160 chars, urgent but not pushy, includes address"
  },
  "fairHousingCheck": {
    "passed": boolean,
    "warnings": ["any flagged phrases or concerns"]
  },
  "calendar": [
    {
      "day": 1,
      "platform": "Instagram",
      "contentType": "Photo carousel",
      "caption": "Short preview of what to post"
    }
  ]
}

Calendar guidelines:
- 30 entries, one per day
- Mix platforms: Instagram (10x), Facebook (8x), LinkedIn (4x), Email (4x), SMS (2x), Cross-post (2x)
- Vary content types: photos, video tours, neighborhood highlights, price drops, open house
- Front-load first week with daily posts, taper to every-other-day by week 4

Louisiana context: Reference parishes, local landmarks, cuisine culture, festivals, school districts (by name only, no demographic claims).`

// ─── MAIN RUNNER ──────────────────────────────────────────────────────────────

export async function runMarketingCampaign(
  userId: string,
  transactionId: string
): Promise<MarketingCampaignResult> {
  const start = Date.now()

  // Load transaction
  const txn = await prisma.transaction.findFirstOrThrow({
    where: { id: transactionId, userId },
  })

  const propertyDetails = `
Property: ${txn.propertyAddress}, ${txn.propertyCity}, ${txn.propertyState} ${txn.propertyZip || ""}
Type: ${txn.propertyType || "Residential"}
List Price: $${(txn.listPrice || 0).toLocaleString()}
MLS#: ${txn.mlsNumber || "Pending"}
`.trim()

  let campaign: {
    story: { topFeatures: string[]; idealBuyer: string }
    content: {
      mls: string
      instagram: string
      facebook: string
      linkedin: string
      email: string
      sms: string
    }
    fairHousingCheck: { passed: boolean; warnings: string[] }
    calendar: CalendarEntry[]
  }

  try {
    const res = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      temperature: 0.4,
      system: MARKETING_PROMPT,
      messages: [
        {
          role: "user",
          content: `Generate a complete marketing campaign for this listing:\n\n${propertyDetails}`,
        },
      ],
    })

    const text = res.content[0]?.type === "text" ? res.content[0].text : ""
    const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
    campaign = JSON.parse(clean)
  } catch (err) {
    console.error("[MarketingMachine] Campaign generation failed:", err)
    throw new Error("Marketing campaign generation failed")
  }

  // Store ContentCampaign
  let campaignId: string
  try {
    const record = await prisma.contentCampaign.create({
      data: {
        userId,
        transactionId,
        propertyAddress: txn.propertyAddress,
        mlsNumber: txn.mlsNumber,
        mlsDescription: campaign.content.mls,
        instagramCaption: campaign.content.instagram,
        facebookPost: campaign.content.facebook,
        linkedinPost: campaign.content.linkedin,
        emailTemplate: campaign.content.email,
        smsTemplate: campaign.content.sms,
        status: campaign.fairHousingCheck.passed ? "PENDING_REVIEW" : "DRAFT",
        fairHousingCheck: campaign.fairHousingCheck as unknown as Record<string, unknown>,
        calendarDays: campaign.calendar as unknown as Record<string, unknown>[],
      },
    })
    campaignId = record.id
  } catch (err) {
    console.error("[MarketingMachine] Failed to store campaign:", err)
    throw new Error("Failed to store marketing campaign")
  }

  return {
    campaignId,
    transactionId,
    propertyAddress: txn.propertyAddress,
    story: campaign.story,
    content: campaign.content,
    fairHousingCheck: campaign.fairHousingCheck,
    calendar: campaign.calendar,
    processingMs: Date.now() - start,
  }
}
