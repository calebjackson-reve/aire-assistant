// app/api/cron/content-suggestions/route.ts
//
// Content Writer Agent — runs weekly (Mondays 8 AM CT).
// Analyzes recent transactions, market activity, and calendar to generate
// a week's worth of Instagram post suggestions and email campaign ideas.

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export const maxDuration = 60

interface ContentSuggestion {
  type: "instagram" | "email"
  template: string
  headline: string
  body: string
  dataPoints: string[]
  priority: "high" | "medium" | "low"
  suggestedDate: string
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  const isVercelCron = authHeader === `Bearer ${cronSecret}`
  const isManualTest = req.headers.get("x-aire-internal") === cronSecret

  if (!cronSecret || (!isVercelCron && !isManualTest)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const start = Date.now()
  const suggestions: ContentSuggestion[] = []
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1) // Monday

  try {
    // 1. Check for recently closed deals (SOLD posts)
    const recentlyClosed = await prisma.transaction.findMany({
      where: {
        status: "CLOSED",
        updatedAt: { gte: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000) },
      },
    })

    for (const deal of recentlyClosed) {
      suggestions.push({
        type: "instagram",
        template: "SOLD Card",
        headline: `SOLD — ${deal.propertyAddress}`,
        body: `Another one closed. ${deal.acceptedPrice ? `$${(deal.acceptedPrice / 1000).toFixed(0)}K` : ""} in ${deal.propertyAddress?.split(",")[1]?.trim() || "Baton Rouge"}.`,
        dataPoints: [
          deal.acceptedPrice ? `Sale price: $${deal.acceptedPrice.toLocaleString()}` : "",
          deal.contractDate && deal.closingDate
            ? `Days to close: ${Math.ceil((new Date(deal.closingDate).getTime() - new Date(deal.contractDate).getTime()) / (1000 * 60 * 60 * 24))}`
            : "",
        ].filter(Boolean),
        priority: "high",
        suggestedDate: getNextPostDate(weekStart, 1), // Tuesday
      })
    }

    // 2. Pipeline stats post (weekly)
    const activeDeals = await prisma.transaction.findMany({
      where: { status: { notIn: ["CLOSED", "CANCELLED", "TERMINATED"] } },
    })

    if (activeDeals.length > 0) {
      const pipelineValue = activeDeals.reduce(
        (sum, d) => sum + (d.acceptedPrice || d.offerPrice || d.listPrice || 0),
        0
      )
      suggestions.push({
        type: "instagram",
        template: "Stats Card",
        headline: "This Week in Numbers",
        body: `${activeDeals.length} active deals. $${(pipelineValue / 1_000_000).toFixed(2)}M in the pipeline.`,
        dataPoints: [
          `Active deals: ${activeDeals.length}`,
          `Pipeline value: $${(pipelineValue / 1_000_000).toFixed(2)}M`,
        ],
        priority: "medium",
        suggestedDate: getNextPostDate(weekStart, 3), // Thursday
      })
    }

    // 3. Upcoming closings (excitement post)
    const upcomingClosings = await prisma.transaction.findMany({
      where: {
        status: "UNDER_CONTRACT",
        closingDate: {
          gte: now,
          lte: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
        },
      },
    })

    if (upcomingClosings.length > 0) {
      suggestions.push({
        type: "instagram",
        template: "Market Insight",
        headline: `${upcomingClosings.length} Closing${upcomingClosings.length > 1 ? "s" : ""} This Week`,
        body: `Keys changing hands in Baton Rouge. Another chapter begins.`,
        dataPoints: upcomingClosings.map(
          d => `${d.propertyAddress?.split(",")[0]} — closing ${new Date(d.closingDate!).toLocaleDateString()}`
        ),
        priority: "medium",
        suggestedDate: getNextPostDate(weekStart, 0), // Monday
      })
    }

    // 4. Weekly market quote
    suggestions.push({
      type: "instagram",
      template: "Quote Card",
      headline: "Weekly Insight",
      body: getWeeklyQuote(),
      dataPoints: [],
      priority: "low",
      suggestedDate: getNextPostDate(weekStart, 5), // Saturday
    })

    // 5. Email campaign — weekly market update
    suggestions.push({
      type: "email",
      template: "Weekly Market Brief",
      headline: `Baton Rouge Market Update — Week of ${weekStart.toLocaleDateString()}`,
      body: `Active deals: ${activeDeals.length}. Recently closed: ${recentlyClosed.length}. Upcoming: ${upcomingClosings.length}.`,
      dataPoints: [
        `Pipeline: $${(activeDeals.reduce((s, d) => s + (d.acceptedPrice || d.listPrice || 0), 0) / 1_000_000).toFixed(2)}M`,
      ],
      priority: "medium",
      suggestedDate: getNextPostDate(weekStart, 2), // Wednesday
    })

    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 }
    suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

    // Log agent run
    try {
      const adminUser = await prisma.user.findFirst({ where: { tier: "INVESTOR" } })
      if (adminUser) {
        await prisma.agentRun.create({
          data: {
            userId: adminUser.id,
            agentName: "content_writer",
            status: "success",
            completedAt: new Date(),
            durationMs: Date.now() - start,
            resultMetadata: {
              totalSuggestions: suggestions.length,
              instagram: suggestions.filter(s => s.type === "instagram").length,
              email: suggestions.filter(s => s.type === "email").length,
            },
          },
        })
      }
    } catch {
      // Best effort
    }

    const summary = {
      agent: "content-writer",
      timestamp: new Date().toISOString(),
      weekOf: weekStart.toISOString().split("T")[0],
      totalSuggestions: suggestions.length,
      suggestions,
      processingMs: Date.now() - start,
    }

    console.log(
      `[CONTENT-WRITER] Generated ${suggestions.length} suggestions for week of ${summary.weekOf} in ${summary.processingMs}ms`
    )

    return NextResponse.json(summary)
  } catch (err) {
    console.error("[CONTENT-WRITER] Failed:", err)
    return NextResponse.json(
      { error: "Content suggestions failed", details: String(err) },
      { status: 500 }
    )
  }
}

function getNextPostDate(weekStart: Date, dayOffset: number): string {
  const d = new Date(weekStart)
  d.setDate(d.getDate() + dayOffset)
  return d.toISOString().split("T")[0]
}

const QUOTES = [
  "The best time to buy was yesterday. The second best time is when the numbers make sense.",
  "Real estate isn't about timing the market. It's about time in the market.",
  "Every property tells a story. My job is making sure yours has a happy ending.",
  "Data doesn't lie. But it takes someone who knows the market to read it right.",
  "In Baton Rouge, the best deals aren't found — they're engineered.",
  "Your home isn't just an asset. It's the return on the life you're building.",
  "Most agents sell houses. I solve problems that happen to involve real estate.",
  "The difference between a good deal and a great deal is about 72 hours of preparation.",
]

function getWeeklyQuote(): string {
  const weekNum = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000))
  return QUOTES[weekNum % QUOTES.length]
}
