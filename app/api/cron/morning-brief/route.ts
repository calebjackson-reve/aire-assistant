// app/api/cron/morning-brief/route.ts
// Vercel Cron — runs at 6:30 AM daily.
// Orchestrates 3 researchers in parallel, runs QA, synthesizes with Claude.
// Stores result in MorningBrief table. Never delivers to client without human approval.
//
// vercel.json: { "crons": [{ "path": "/api/cron/morning-brief", "schedule": "30 6 * * *" }] }

import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import prisma from "@/lib/prisma"
import { runResearchers } from "@/lib/agents/orchestrator"
import { researchDeadlines } from "@/lib/agents/morning-brief/researchers/deadline-researcher"
import { researchPipeline } from "@/lib/agents/morning-brief/researchers/pipeline-researcher"
import { researchContacts } from "@/lib/agents/morning-brief/researchers/contact-researcher"
import { validateBriefData } from "@/lib/agents/morning-brief/qa-validator"
import { researchComms } from "@/lib/agents/morning-brief/researchers/comms-researcher"
import { researchMarket } from "@/lib/agents/morning-brief/researchers/market-researcher"
import { researchCalendar } from "@/lib/agents/morning-brief/researchers/calendar-researcher"
import { researchSocial } from "@/lib/agents/morning-brief/researchers/social-researcher"
import type { DeadlineResearchResult } from "@/lib/agents/morning-brief/researchers/deadline-researcher"
import type { PipelineResearchResult } from "@/lib/agents/morning-brief/researchers/pipeline-researcher"
import type { ContactResearchResult } from "@/lib/agents/morning-brief/researchers/contact-researcher"
import type { CommsResearchResult } from "@/lib/agents/morning-brief/researchers/comms-researcher"
import type { MarketResearchResult } from "@/lib/agents/morning-brief/researchers/market-researcher"
import type { CalendarResearchResult } from "@/lib/agents/morning-brief/researchers/calendar-researcher"
import type { SocialResearchResult } from "@/lib/agents/morning-brief/researchers/social-researcher"

const CRON_SECRET = process.env.CRON_SECRET

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Get all users who have PRO or INVESTOR tier
    const users = await prisma.user.findMany({
      where: { tier: { in: ["PRO", "INVESTOR"] } },
      select: { id: true, clerkId: true, firstName: true },
    })

    if (users.length === 0) {
      return NextResponse.json({ message: "No eligible users", briefsCreated: 0 })
    }

    const results: Array<{ userId: string; status: string; briefId?: string }> = []

    for (const user of users) {
      try {
        // Check if brief already exists for today
        const today = new Date()
        const briefDate = new Date(today.getFullYear(), today.getMonth(), today.getDate())

        const existing = await prisma.morningBrief.findUnique({
          where: { userId_briefDate: { userId: user.id, briefDate } },
        })

        if (existing) {
          results.push({ userId: user.id, status: "already_exists", briefId: existing.id })
          continue
        }

        // Run all 7 researchers in parallel
        const researchResults = await runResearchers<unknown>([
          { name: "deadlines", fn: () => researchDeadlines(user.clerkId) },
          { name: "pipeline", fn: () => researchPipeline(user.clerkId) },
          { name: "contacts", fn: () => researchContacts(user.clerkId) },
          { name: "comms", fn: () => researchComms(user.id) },
          { name: "market", fn: () => researchMarket() },
          { name: "calendar", fn: () => researchCalendar(user.id) },
          { name: "social", fn: () => researchSocial() },
        ])

        const deadlineData = (researchResults.find((r) => r.name === "deadlines")?.data ?? null) as DeadlineResearchResult | null
        const pipelineData = (researchResults.find((r) => r.name === "pipeline")?.data ?? null) as PipelineResearchResult | null
        const contactData = (researchResults.find((r) => r.name === "contacts")?.data ?? null) as ContactResearchResult | null
        const commsData = (researchResults.find((r) => r.name === "comms")?.data ?? null) as CommsResearchResult | null
        const marketData = (researchResults.find((r) => r.name === "market")?.data ?? null) as MarketResearchResult | null
        const calendarData = (researchResults.find((r) => r.name === "calendar")?.data ?? null) as CalendarResearchResult | null
        const socialData = (researchResults.find((r) => r.name === "social")?.data ?? null) as SocialResearchResult | null

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
- If calendar events are available, show today's schedule with times and locations right after the greeting
- If social media data is available, include a brief Social section with top performing content and posting recommendations
- Format: Start with a greeting using the agent's first name, then sections for Calendar (if available), Communications (if any), Deadlines, Pipeline, Social Media (if available), Intelligence Insights, and Outreach
- When AIRE intelligence data is available for deals, mention the AIRE estimate, confidence level, and PPS (Pricing Position Score) naturally — e.g. "AIRE values 123 Main at $195K (HIGH confidence, PPS 82/100)"
- If any deal has LOW confidence, flag it as needing manual review — sources disagree significantly
- If scoring health data is available, note any overall quality trends (e.g. "72% of this week's scores are HIGH confidence")
- End with 3-5 specific action items as a numbered list
- Keep it under 600 words
- Be direct and actionable — this agent is busy`,
          messages: [
            {
              role: "user",
              content: `Generate the morning brief for ${user.firstName || "Agent"} on ${todayStr}.

TODAY'S CALENDAR:
${calendarData?.hasCalendar ? calendarData.events.map(e => `- ${e.time} — ${e.title}${e.location ? ` (${e.location})` : ''}${e.isNext ? ' ← NEXT' : ''}`).join('\n') || 'No events today' : 'Google Calendar not connected'}
${calendarData?.hasCalendar ? `Busy hours: ${calendarData.busyHours}h | Free slots: ${calendarData.freeSlots.length}` : ''}

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
${marketData.scoringHealth ? `Scoring health (7d): ${marketData.scoringHealth.highConfidence} HIGH / ${marketData.scoringHealth.mediumConfidence} MEDIUM / ${marketData.scoringHealth.lowConfidence} LOW confidence${marketData.scoringHealth.avgDisagreement != null ? `, avg disagreement ${(marketData.scoringHealth.avgDisagreement * 100).toFixed(1)}%` : ''}` : ''}
${marketData.lowConfidenceFlags.length > 0 ? `⚠ Low-confidence properties needing review:\n${marketData.lowConfidenceFlags.map(p => `  - ${p.address} (${(p.disagreementPct * 100).toFixed(1)}% disagreement${p.aireEstimate ? `, est $${p.aireEstimate.toLocaleString()}` : ''})`).join('\n')}` : ''}` : 'Market data unavailable'}

DEAL INTELLIGENCE:
${pipelineData?.activeDeals.filter(d => d.intelligence).map(d => `- ${d.propertyAddress}: AIRE est $${d.intelligence!.aireEstimate?.toLocaleString() ?? 'N/A'}, confidence ${d.intelligence!.confidenceTier ?? 'N/A'}${d.intelligence!.ppsTotal != null ? `, PPS ${d.intelligence!.ppsTotal}/100` : ''}${d.intelligence!.assessorGapPct != null ? `, assessor gap ${(d.intelligence!.assessorGapPct * 100).toFixed(1)}%` : ''}`).join('\n') || 'No AIRE scores available for active deals'}
${pipelineData && pipelineData.lowConfidenceDeals > 0 ? `⚠ ${pipelineData.lowConfidenceDeals} deal(s) have LOW confidence AIRE estimates — sources disagree significantly` : ''}

SOCIAL MEDIA PERFORMANCE:
${socialData?.connected ? `Best content type: ${socialData.insights?.bestPostType || 'unknown'}
Best posting time: ${socialData.insights?.bestPostTime || 'unknown'}
Top post: ${socialData.insights?.topPosts[0]?.message || 'N/A'} (${socialData.insights?.topPosts[0]?.engagement || 0} engagements)
Content gaps: ${socialData.insights?.contentGaps.join(', ') || 'None'}
Recommendations: ${socialData.recommendations.join('; ')}` : 'Social media not connected — recommend connecting Meta Business Suite in Settings'}

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

        // Store in DB — status "pending" means awaiting human approval
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

        results.push({ userId: user.id, status: "created", briefId: brief.id })
        console.log(`Morning brief created for ${user.firstName}: ${brief.id}`)
      } catch (userError) {
        const msg = userError instanceof Error ? userError.message : String(userError)
        console.error(`Morning brief failed for user ${user.id}:`, msg)
        results.push({ userId: user.id, status: `error: ${msg}` })
      }
    }

    return NextResponse.json({
      message: `Morning briefs processed for ${users.length} users`,
      results,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Morning brief cron error:", error)
    return NextResponse.json({ error: "Cron job failed" }, { status: 500 })
  }
}
