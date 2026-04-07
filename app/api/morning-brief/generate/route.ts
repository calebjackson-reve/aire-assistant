// Authenticated endpoint for manual brief generation (not cron).
// Reuses the same researcher + synthesis pipeline as the cron job.

import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import Anthropic from "@anthropic-ai/sdk"
import prisma from "@/lib/prisma"
import { runResearchers } from "@/lib/agents/orchestrator"
import { researchDeadlines } from "@/lib/agents/morning-brief/researchers/deadline-researcher"
import { researchPipeline } from "@/lib/agents/morning-brief/researchers/pipeline-researcher"
import { researchContacts } from "@/lib/agents/morning-brief/researchers/contact-researcher"
import { validateBriefData } from "@/lib/agents/morning-brief/qa-validator"
import { researchComms } from "@/lib/agents/morning-brief/researchers/comms-researcher"
import { researchMarket } from "@/lib/agents/morning-brief/researchers/market-researcher"
import type { DeadlineResearchResult } from "@/lib/agents/morning-brief/researchers/deadline-researcher"
import type { PipelineResearchResult } from "@/lib/agents/morning-brief/researchers/pipeline-researcher"
import type { ContactResearchResult } from "@/lib/agents/morning-brief/researchers/contact-researcher"
import type { CommsResearchResult } from "@/lib/agents/morning-brief/researchers/comms-researcher"
import type { MarketResearchResult } from "@/lib/agents/morning-brief/researchers/market-researcher"

export async function POST() {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true, clerkId: true, firstName: true },
  })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  // Check if brief already exists for today
  const today = new Date()
  const briefDate = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const existing = await prisma.morningBrief.findUnique({
    where: { userId_briefDate: { userId: user.id, briefDate } },
  })
  if (existing) {
    return NextResponse.json({ message: "Brief already exists for today", briefId: existing.id })
  }

  try {
    // Run all researchers in parallel
    const researchResults = await runResearchers<unknown>([
      { name: "deadlines", fn: () => researchDeadlines(user.clerkId) },
      { name: "pipeline", fn: () => researchPipeline(user.clerkId) },
      { name: "contacts", fn: () => researchContacts(user.clerkId) },
      { name: "comms", fn: () => researchComms(user.id) },
      { name: "market", fn: () => researchMarket() },
    ])

    const deadlineData = (researchResults.find((r) => r.name === "deadlines")?.data ?? null) as DeadlineResearchResult | null
    const pipelineData = (researchResults.find((r) => r.name === "pipeline")?.data ?? null) as PipelineResearchResult | null
    const contactData = (researchResults.find((r) => r.name === "contacts")?.data ?? null) as ContactResearchResult | null
    const commsData = (researchResults.find((r) => r.name === "comms")?.data ?? null) as CommsResearchResult | null
    const marketData = (researchResults.find((r) => r.name === "market")?.data ?? null) as MarketResearchResult | null

    // Run QA validation
    const qaResult = validateBriefData(deadlineData, pipelineData, contactData)

    // Synthesize with Claude
    const anthropic = new Anthropic()
    const todayStr = today.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    })

    const synthesis = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: `You are AIRE, an AI assistant for Louisiana real estate agents. Generate a concise morning brief.

Rules:
- Use "Act of Sale" not "closing" (Louisiana term)
- Use "parish" not "county"
- Never suggest contacting clients about protected-class topics (Fair Housing Act)
- If QA flags are present, mention them prominently
- If there are unanswered messages or missed calls, lead with those FIRST — they are the most time-sensitive items
- Format: Start with a greeting using the agent's first name, then sections for Communications (if any), Deadlines, Pipeline, Intelligence Insights, and Outreach
- When AIRE intelligence data is available for deals, mention the AIRE estimate, confidence level, and PPS naturally
- If any deal has LOW confidence, flag it as needing manual review
- End with 3-5 specific action items as a numbered list
- Keep it under 600 words
- Be direct and actionable — this agent is busy`,
      messages: [
        {
          role: "user",
          content: `Generate the morning brief for ${user.firstName || "Agent"} on ${todayStr}.

DEADLINE DATA:
${JSON.stringify(deadlineData, null, 2)}

PIPELINE DATA:
${JSON.stringify(pipelineData, null, 2)}

CONTACT/OUTREACH DATA:
${JSON.stringify(contactData, null, 2)}

COMMUNICATIONS DATA (unanswered messages & missed calls):
${JSON.stringify(commsData?.stats ?? { totalUnanswered: 0, missedCallCount: 0 }, null, 2)}
${commsData && commsData.unanswered.length > 0 ? `\nTop unanswered:\n${commsData.unanswered.slice(0, 5).map(m => `- ${m.contactName ?? m.from} (${m.channel}, ${m.hoursUnanswered}h ago): ${m.subject ?? m.bodyPreview.slice(0, 80)}`).join("\n")}` : ""}
${commsData && commsData.missedCalls.length > 0 ? `\nMissed calls:\n${commsData.missedCalls.slice(0, 5).map(c => `- ${c.callerName ?? c.callerPhone} (${c.hoursAgo}h ago)`).join("\n")}` : ""}

MARKET INTELLIGENCE:
${marketData ? `Metro: Median $${marketData.metro.medianPrice.toLocaleString()} (${marketData.metro.medianPriceChange > 0 ? '+' : ''}${marketData.metro.medianPriceChange}% YoY), ${marketData.metro.dom} DOM, ${marketData.metro.monthsSupply} months supply
30-yr rate: ${marketData.mortgageRate}%
Hot neighborhoods: ${marketData.hotNeighborhoods.map(n => `${n.name} (${n.heatScore}/100, $${n.medianPrice.toLocaleString()}, ${n.dom} DOM)`).join('; ')}
${marketData.intelligenceStats ? `AIRE DB: ${marketData.intelligenceStats.totalProperties} properties, ${marketData.intelligenceStats.recentScores} scored this week` : ''}
${marketData.scoringHealth ? `Scoring health (7d): ${marketData.scoringHealth.highConfidence} HIGH / ${marketData.scoringHealth.mediumConfidence} MEDIUM / ${marketData.scoringHealth.lowConfidence} LOW confidence` : ''}` : 'Market data unavailable'}

QA FLAGS:
${JSON.stringify(qaResult.flags, null, 2)}

Generate the brief with actionable items. Include a structured action_items array at the end in this JSON format:
\`\`\`json
[{"action": "description", "priority": "high|medium|low", "category": "deadline|pipeline|outreach|compliance"}]
\`\`\``,
        },
      ],
    })

    const briefText = synthesis.content[0].type === "text" ? synthesis.content[0].text : ""

    // Extract action items JSON if present
    let actionItems: unknown[] = []
    const jsonMatch = briefText.match(/```json\n?([\s\S]*?)\n?```/)
    if (jsonMatch) {
      try {
        actionItems = JSON.parse(jsonMatch[1])
      } catch {
        console.error("Failed to parse action items JSON")
      }
    }

    // Remove the JSON block from the summary text
    const summary = briefText.replace(/```json\n?[\s\S]*?\n?```/, "").trim()

    // Store in DB
    const brief = await prisma.morningBrief.create({
      data: {
        userId: user.id,
        briefDate,
        status: "pending",
        deadlineData: deadlineData ? JSON.parse(JSON.stringify(deadlineData)) : null,
        pipelineData: pipelineData ? JSON.parse(JSON.stringify(pipelineData)) : null,
        contactData: contactData ? JSON.parse(JSON.stringify(contactData)) : null,
        qaFlags: JSON.parse(JSON.stringify(qaResult.flags)),
        qaPassedAt: qaResult.passed ? new Date() : null,
        summary,
        actionItems: JSON.parse(JSON.stringify(actionItems)),
      },
    })

    return NextResponse.json({ message: "Brief generated", briefId: brief.id })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("Manual brief generation failed:", msg)
    return NextResponse.json({ error: "Brief generation failed" }, { status: 500 })
  }
}
