/**
 * Content Scheduler + Performance Tracker
 *
 * Manages the content calendar for social media posts.
 * Tracks scheduled vs published status and performance metrics.
 * Integrates with Meta Business Suite for real performance data.
 */

import prisma from "@/lib/prisma"
import { getWeeklyInsights, isMetaConfigured } from "@/lib/meta-business"

// ─── TYPES ──────────────────────────────────────────────────────

export interface ScheduledPost {
  id: string
  platform: "instagram" | "facebook" | "linkedin" | "email" | "sms"
  contentType: "photo" | "carousel" | "reel" | "story" | "text" | "video"
  scheduledFor: Date
  content: string
  mediaUrls: string[]
  hashtags: string[]
  status: "draft" | "scheduled" | "published" | "failed"
  campaignId?: string
  transactionId?: string
  performance?: PostPerformanceMetrics
}

export interface PostPerformanceMetrics {
  reach: number
  impressions: number
  likes: number
  comments: number
  shares: number
  saves: number
  engagementRate: number
}

export interface ContentCalendarWeek {
  monday: ScheduledPost[]
  tuesday: ScheduledPost[]
  wednesday: ScheduledPost[]
  thursday: ScheduledPost[]
  friday: ScheduledPost[]
  saturday: ScheduledPost[]
  sunday: ScheduledPost[]
  gaps: string[] // Days with no content
  totalScheduled: number
}

export interface ContentStrategy {
  recommendedTypes: { type: string; frequency: string; reason: string }[]
  bestTimes: { day: string; time: string }[]
  avoidTypes: { type: string; reason: string }[]
  weeklyGoal: number
}

// ─── SCHEDULE MANAGEMENT ────────────────────────────────────────

/**
 * Schedule a post for future publishing.
 */
export async function schedulePost(post: {
  userId: string
  platform: string
  contentType: string
  scheduledFor: Date
  content: string
  mediaUrls?: string[]
  hashtags?: string[]
  campaignId?: string
  transactionId?: string
}): Promise<{ id: string }> {
  const campaign = await prisma.contentCampaign.create({
    data: {
      userId: post.userId,
      propertyAddress: post.transactionId || "general",
      mlsDescription: post.content,
      instagramCaption: post.platform === "instagram" ? post.content : "",
      facebookPost: post.platform === "facebook" ? post.content : "",
      linkedinPost: post.platform === "linkedin" ? post.content : "",
      emailTemplate: post.platform === "email" ? post.content : "",
      smsTemplate: post.platform === "sms" ? post.content : "",
      status: "SCHEDULED",
      scheduledFor: post.scheduledFor,
    },
  })

  return { id: campaign.id }
}

/**
 * Get this week's content calendar.
 */
export async function getWeeklyCalendar(userId: string): Promise<ContentCalendarWeek> {
  const now = new Date()
  const monday = new Date(now)
  monday.setDate(now.getDate() - now.getDay() + 1)
  monday.setHours(0, 0, 0, 0)

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)

  const campaigns = await prisma.contentCampaign.findMany({
    where: {
      userId,
      scheduledFor: { gte: monday, lte: sunday },
    },
    orderBy: { scheduledFor: "asc" },
  })

  const days: Record<string, ScheduledPost[]> = {
    monday: [], tuesday: [], wednesday: [], thursday: [],
    friday: [], saturday: [], sunday: [],
  }

  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]

  for (const c of campaigns) {
    if (!c.scheduledFor) continue
    const dayName = dayNames[c.scheduledFor.getDay()]
    const platform = c.instagramCaption ? "instagram" : c.facebookPost ? "facebook" : "linkedin"

    days[dayName].push({
      id: c.id,
      platform: platform as ScheduledPost["platform"],
      contentType: "photo",
      scheduledFor: c.scheduledFor,
      content: c.instagramCaption || c.facebookPost || c.linkedinPost || c.mlsDescription || "",
      mediaUrls: [],
      hashtags: [],
      status: c.status === "PUBLISHED" ? "published" : "scheduled",
      campaignId: c.id,
    })
  }

  // Find gaps
  const gaps: string[] = []
  for (const [day, posts] of Object.entries(days)) {
    if (posts.length === 0) gaps.push(day)
  }

  const totalScheduled = Object.values(days).flat().length

  return { ...days, gaps, totalScheduled } as ContentCalendarWeek
}

// ─── PERFORMANCE TRACKING ───────────────────────────────────────

/**
 * Generate a content strategy based on real performance data.
 */
export async function generateContentStrategy(): Promise<ContentStrategy> {
  if (!isMetaConfigured()) {
    return {
      recommendedTypes: [
        { type: "listing_photos", frequency: "3x/week", reason: "Listing photos consistently perform well for real estate agents" },
        { type: "market_update_video", frequency: "1x/week", reason: "Video content gets 2x more engagement on average" },
        { type: "client_testimonial", frequency: "1x/week", reason: "Social proof builds trust with potential clients" },
      ],
      bestTimes: [
        { day: "Tuesday", time: "9:00 AM" },
        { day: "Thursday", time: "6:00 PM" },
        { day: "Saturday", time: "10:00 AM" },
      ],
      avoidTypes: [
        { type: "text_only", reason: "Text posts get 65% less engagement than visual content" },
      ],
      weeklyGoal: 5,
    }
  }

  const insights = await getWeeklyInsights()

  const recommendedTypes: ContentStrategy["recommendedTypes"] = []
  const avoidTypes: ContentStrategy["avoidTypes"] = []

  // Analyze what's working from real data
  if (insights.topPosts.length > 0) {
    const topTypes = new Set(insights.topPosts.map((p) => p.type))
    for (const type of topTypes) {
      const avgEngagement = insights.topPosts
        .filter((p) => p.type === type)
        .reduce((sum, p) => sum + p.engagement, 0) / insights.topPosts.filter((p) => p.type === type).length

      recommendedTypes.push({
        type,
        frequency: "2-3x/week",
        reason: `Averaging ${Math.round(avgEngagement)} engagements per post — your best performing type`,
      })
    }
  }

  if (insights.worstPosts.length > 0) {
    const worstTypes = new Set(insights.worstPosts.map((p) => p.type))
    for (const type of worstTypes) {
      if (!recommendedTypes.find((r) => r.type === type)) {
        avoidTypes.push({
          type,
          reason: "Consistently underperforming — reduce or redesign this content type",
        })
      }
    }
  }

  return {
    recommendedTypes: recommendedTypes.length > 0 ? recommendedTypes : [
      { type: "photo", frequency: "3x/week", reason: "Default recommendation — connect Meta to get personalized insights" },
    ],
    bestTimes: [
      { day: "Based on data", time: insights.bestPostTime || "9:00 AM" },
    ],
    avoidTypes,
    weeklyGoal: 5,
  }
}
