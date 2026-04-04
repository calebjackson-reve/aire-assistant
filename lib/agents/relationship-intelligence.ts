// lib/agents/relationship-intelligence.ts
//
// Relationship Intelligence Engine — 4 parallel agents + synthesis.
// Runs weekly. Scores every contact 0-100. Produces a ranked hit list
// of who to call, what to say, and why — this week.
//
// Agent A — Behavioral Signal Scanner (communication frequency)
// Agent B — Life Event Detector (language signals in past comms)
// Agent C — Market Timing Analyst (equity + neighborhood conditions)
// Agent D — Recency & Warmth Scorer (last contact, response rate)
// Synthesis — Weekly Hit List (top 10 contacts to reach this week)

import Anthropic from "@anthropic-ai/sdk"
import prisma from "@/lib/prisma"
import { consensusCheck, CONSENSUS_PRESETS } from "@/lib/agents/consensus"

const anthropic = new Anthropic()

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface ContactContext {
  id: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  type: string
  source: string | null
  neighborhood: string | null
  parish: string | null
  priceRange: string | null
  timeline: string | null
  lastContactedAt: Date | null
  lastResponseAt: Date | null
  contactCount: number
  responseCount: number
  tags: string[]
  notes: string | null
  convertedAt: Date | null
}

export interface AgentScore {
  score: number
  signals: string[]
  reasoning: string
}

export interface ScoredContact {
  contact: ContactContext
  behavioralScore: AgentScore
  lifeEventScore: AgentScore
  marketTimingScore: AgentScore
  recencyScore: AgentScore
  finalScore: number
  recommendation: string
  reasoning: string
  suggestedMessage: string
  channel: string
  priority: string
}

export interface RelationshipIntelResult {
  agentId: string
  runDate: Date
  totalContacts: number
  scoredContacts: ScoredContact[]
  hitList: ScoredContact[]
  processingMs: number
  logsWritten: number
}

// ─── SYSTEM PROMPTS ───────────────────────────────────────────────────────────

const BEHAVIORAL_PROMPT = `You are AIRE's Behavioral Signal Scanner for a Louisiana real estate agent.
Analyze this contact's communication behavior and score their likelihood of transacting soon.

Scoring factors:
- Increased contact frequency recently = high score
- Multiple touchpoints across channels = higher score
- Quick response times = higher score
- Initiated contact themselves = high score
- Long silence after prior engagement = lower score
- Never responded = low score

Return ONLY valid JSON:
{
  "score": number (0-100),
  "signals": ["signal 1", "signal 2"],
  "reasoning": "one sentence plain English"
}`

const LIFE_EVENT_PROMPT = `You are AIRE's Life Event Detector for a Louisiana real estate agent.
Analyze this contact's notes and communication history for life event signals.

High-value signals to look for:
- Job change or promotion language
- Marriage, divorce, new baby mentions
- Lease expiration hints ("my lease is up", "landlord is selling")
- Family size changes
- Relocation language ("moving to", "transferring")
- Retirement mentions
- "We've been thinking about" language

Return ONLY valid JSON:
{
  "score": number (0-100),
  "signals": ["signal 1", "signal 2"],
  "reasoning": "one sentence plain English"
}`

const MARKET_TIMING_PROMPT = `You are AIRE's Market Timing Analyst for a Louisiana real estate agent in Baton Rouge.
Analyze this contact's profile against current market conditions.

Scoring factors:
- Contact owns a home in a seller's market neighborhood = high equity opportunity
- First-time buyer who has been waiting = market conditions may now favor them
- Investor contact = current cap rates and inventory matter
- Renter in rising rent market = buying may now pencil out
- Contact mentioned a price range that now has good inventory
- Timeline they mentioned is approaching

Louisiana market context: Zachary, Central, Prairieville, Gonzales are active.
East Baton Rouge inventory is constrained. Interest rates affect first-time buyers most.

Return ONLY valid JSON:
{
  "score": number (0-100),
  "signals": ["signal 1", "signal 2"],
  "reasoning": "one sentence plain English"
}`

const RECENCY_WARMTH_PROMPT = `You are AIRE's Recency and Relationship Warmth Scorer for a Louisiana real estate agent.
Score this contact on relationship warmth and recency of engagement.

Scoring factors:
- Last contacted within 30 days = high recency score
- Last contacted 30-90 days ago = medium
- Last contacted 90-180 days ago = low — needs re-engagement
- Last contacted 180+ days ago = very low — cold
- High response rate (responded > 50% of touches) = warm relationship
- Referred someone = very warm
- Past client = high base warmth
- Source = referral = high warmth
- Never converted any contact = lower warmth

Return ONLY valid JSON:
{
  "score": number (0-100),
  "signals": ["signal 1", "signal 2"],
  "reasoning": "one sentence plain English"
}`

const SYNTHESIS_PROMPT = `You are AIRE's Relationship Intelligence Synthesizer for Caleb Jackson at Reve REALTORS, Baton Rouge, Louisiana.
You follow the Ninja Selling framework — relationships first, always provide value.

Given the 4 agent scores below, produce a contact recommendation.

Weighting:
- Behavioral Signal: 30%
- Life Event: 25%
- Market Timing: 25%
- Recency/Warmth: 20%

Channel selection:
- Score 80-100: Call — this person is ready
- Score 60-79: Text — warm touch, low friction
- Score 40-59: Email — nurture, provide value
- Score 0-39: Skip this week

Message tone: Ninja Selling style — never pushy, always value-first.
Reference something specific about them if signals allow.
Louisiana context: reference local market, parishes, neighborhoods naturally.

Return ONLY valid JSON:
{
  "finalScore": number (0-100),
  "recommendation": "Call" | "Text" | "Email" | "Skip",
  "channel": "call" | "text" | "email" | "skip",
  "priority": "urgent" | "high" | "normal" | "low",
  "reasoning": "2 sentence plain English — why this person, why this week",
  "suggestedMessage": "The actual opening message to send — natural, specific, value-first. Under 160 chars for text, 2 sentences for email/call opener."
}`

// ─── AGENT RUNNERS ────────────────────────────────────────────────────────────

async function runSingleAgent(
  systemPrompt: string,
  contactContext: string
): Promise<AgentScore> {
  try {
    const res = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 400,
      temperature: 0.2,
      system: systemPrompt,
      messages: [{ role: "user", content: contactContext }],
    })

    const text = res.content[0]?.type === "text" ? res.content[0].text : ""
    const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
    const parsed = JSON.parse(clean)

    return {
      score: Math.min(100, Math.max(0, Number(parsed.score) || 0)),
      signals: Array.isArray(parsed.signals) ? parsed.signals : [],
      reasoning: String(parsed.reasoning || ""),
    }
  } catch {
    return { score: 50, signals: [], reasoning: "Scoring unavailable" }
  }
}

// ─── SCORE ONE CONTACT ────────────────────────────────────────────────────────

async function scoreContact(
  contact: ContactContext,
  agentId: string
): Promise<ScoredContact> {
  const daysSinceContact = contact.lastContactedAt
    ? Math.floor((Date.now() - contact.lastContactedAt.getTime()) / 86400000)
    : 999

  const responseRate = contact.contactCount > 0
    ? Math.round((contact.responseCount / contact.contactCount) * 100)
    : 0

  const contactSummary = `
Contact: ${contact.firstName} ${contact.lastName}
Type: ${contact.type}
Source: ${contact.source || "Unknown"}
Neighborhood interest: ${contact.neighborhood || "Not specified"}
Parish: ${contact.parish || "Not specified"}
Price range: ${contact.priceRange || "Not specified"}
Timeline: ${contact.timeline || "Not specified"}
Tags: ${contact.tags.join(", ") || "None"}
Notes: ${contact.notes || "None"}
Last contacted: ${daysSinceContact === 999 ? "Never" : `${daysSinceContact} days ago`}
Last responded: ${contact.lastResponseAt ? Math.floor((Date.now() - contact.lastResponseAt.getTime()) / 86400000) + " days ago" : "Never"}
Total touches: ${contact.contactCount}
Response rate: ${responseRate}%
Is past client: ${contact.convertedAt ? "Yes" : "No"}
`.trim()

  // Run all 4 agents in parallel
  const [behavioral, lifeEvent, marketTiming, recency] = await Promise.all([
    runSingleAgent(BEHAVIORAL_PROMPT, contactSummary),
    runSingleAgent(LIFE_EVENT_PROMPT, contactSummary),
    runSingleAgent(MARKET_TIMING_PROMPT, contactSummary),
    runSingleAgent(RECENCY_WARMTH_PROMPT, contactSummary),
  ])

  const roughScore = Math.round(
    behavioral.score * 0.30 +
    lifeEvent.score * 0.25 +
    marketTiming.score * 0.25 +
    recency.score * 0.20
  )

  const synthesisInput = `
Contact summary:
${contactSummary}

Agent scores:
Behavioral Signal Score: ${behavioral.score}/100 — ${behavioral.reasoning}
Signals: ${behavioral.signals.join(", ") || "none"}

Life Event Score: ${lifeEvent.score}/100 — ${lifeEvent.reasoning}
Signals: ${lifeEvent.signals.join(", ") || "none"}

Market Timing Score: ${marketTiming.score}/100 — ${marketTiming.reasoning}
Signals: ${marketTiming.signals.join(", ") || "none"}

Recency/Warmth Score: ${recency.score}/100 — ${recency.reasoning}
Signals: ${recency.signals.join(", ") || "none"}

Rough weighted score: ${roughScore}/100
`.trim()

  let synthesis: Record<string, unknown>

  if (roughScore >= 60) {
    const consensusResult = await consensusCheck({
      feature: "custom",
      agentId,
      systemPrompt: SYNTHESIS_PROMPT,
      userContent: synthesisInput,
      ...CONSENSUS_PRESETS.voiceIntent,
      compareKey: "recommendation",
      maxTokens: 500,
    })
    synthesis = consensusResult.output || {}
  } else {
    try {
      const res = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        temperature: 0.2,
        system: SYNTHESIS_PROMPT,
        messages: [{ role: "user", content: synthesisInput }],
      })
      const text = res.content[0]?.type === "text" ? res.content[0].text : ""
      const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
      synthesis = JSON.parse(clean)
    } catch {
      synthesis = {
        finalScore: roughScore,
        recommendation: "Skip",
        channel: "skip",
        priority: "low",
        reasoning: "Scoring incomplete.",
        suggestedMessage: "",
      }
    }
  }

  return {
    contact,
    behavioralScore: behavioral,
    lifeEventScore: lifeEvent,
    marketTimingScore: marketTiming,
    recencyScore: recency,
    finalScore: Number(synthesis.finalScore) || roughScore,
    recommendation: String(synthesis.recommendation || "Skip"),
    reasoning: String(synthesis.reasoning || ""),
    suggestedMessage: String(synthesis.suggestedMessage || ""),
    channel: String(synthesis.channel || "skip"),
    priority: String(synthesis.priority || "low"),
  }
}

// ─── MAIN RUNNER ──────────────────────────────────────────────────────────────

export async function runRelationshipIntelligence({
  agentId,
  limit = 100,
}: {
  agentId: string
  limit?: number
}): Promise<RelationshipIntelResult> {
  const start = Date.now()
  const runDate = new Date()

  const contacts = await prisma.contact.findMany({
    where: {
      agentId,
      convertedAt: null,
      type: { not: "VENDOR" },
    },
    orderBy: { lastContactedAt: "asc" },
    take: limit,
  })

  if (contacts.length === 0) {
    return {
      agentId,
      runDate,
      totalContacts: 0,
      scoredContacts: [],
      hitList: [],
      processingMs: Date.now() - start,
      logsWritten: 0,
    }
  }

  const scoredContacts: ScoredContact[] = []
  const batchSize = 5

  for (let i = 0; i < contacts.length; i += batchSize) {
    const batch = contacts.slice(i, i + batchSize)
    const batchResults = await Promise.all(
      batch.map((c) => scoreContact(c as ContactContext, agentId))
    )
    scoredContacts.push(...batchResults)

    if (i + batchSize < contacts.length) {
      await new Promise((r) => setTimeout(r, 500))
    }
  }

  scoredContacts.sort((a, b) => b.finalScore - a.finalScore)

  const hitList = scoredContacts
    .filter((c) => c.recommendation !== "Skip")
    .slice(0, 10)

  let logsWritten = 0

  for (const scored of scoredContacts) {
    try {
      await prisma.relationshipIntelLog.create({
        data: {
          agentId,
          contactId: scored.contact.id,
          runDate,
          behavioralScore: scored.behavioralScore.score,
          lifeEventScore: scored.lifeEventScore.score,
          marketTimingScore: scored.marketTimingScore.score,
          recencyScore: scored.recencyScore.score,
          finalScore: scored.finalScore,
          recommendation: scored.recommendation,
          reasoning: scored.reasoning,
          suggestedMessage: scored.suggestedMessage,
          channel: scored.channel,
          priority: scored.priority,
          consensusAgreed: scored.finalScore >= 60,
        },
      })

      await prisma.contact.update({
        where: { id: scored.contact.id },
        data: {
          relationshipScore: scored.finalScore,
          lastScoredAt: runDate,
          scoreReason: scored.reasoning,
        },
      })

      logsWritten++
    } catch (err) {
      console.error(`[RelIntel] Failed to log contact ${scored.contact.id}:`, err)
    }
  }

  return {
    agentId,
    runDate,
    totalContacts: contacts.length,
    scoredContacts,
    hitList,
    processingMs: Date.now() - start,
    logsWritten,
  }
}
