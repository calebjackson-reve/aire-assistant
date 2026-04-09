/**
 * Social Media Researcher — Morning Brief Module
 *
 * Pulls real Instagram/Facebook performance data from Meta Business Suite
 * and generates actionable insights for the morning brief.
 */

import { getWeeklyInsights, isMetaConfigured, type WeeklyInsights } from "@/lib/meta-business"

export interface SocialResearchResult {
  connected: boolean
  insights: WeeklyInsights | null
  recommendations: string[]
}

export async function researchSocial(): Promise<SocialResearchResult> {
  if (!isMetaConfigured()) {
    return {
      connected: false,
      insights: null,
      recommendations: ["Connect your Meta Business account in Settings to see social media performance."],
    }
  }

  try {
    const insights = await getWeeklyInsights()
    const recommendations: string[] = []

    // Generate data-driven recommendations
    if (insights.bestPostType && insights.bestPostType !== "unknown") {
      recommendations.push(`Your ${insights.bestPostType} posts perform best. Create more of these.`)
    }

    if (insights.bestPostTime && insights.bestPostTime !== "unknown") {
      recommendations.push(`Best posting time for your audience: ${insights.bestPostTime}.`)
    }

    if (insights.topPosts.length > 0) {
      const top = insights.topPosts[0]
      recommendations.push(`Top post this week: "${top.message}..." (${top.engagement} engagements).`)
    }

    if (insights.contentGaps.length > 0) {
      recommendations.push(insights.contentGaps[0])
    }

    return { connected: true, insights, recommendations }
  } catch (err) {
    console.error("[Social Researcher] Failed:", err)
    return {
      connected: false,
      insights: null,
      recommendations: ["Social media data temporarily unavailable."],
    }
  }
}
