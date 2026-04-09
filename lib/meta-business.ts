/**
 * Meta Business Suite API Integration
 *
 * Pulls real Instagram and Facebook performance data for the AIRE Marketing Agent.
 * Used by morning brief and content strategy engine.
 *
 * Required env vars:
 *   META_ACCESS_TOKEN — Long-lived page access token
 *   META_PAGE_ID — Facebook page ID
 *   META_IG_USER_ID — Instagram Business account ID
 *
 * Scopes needed: pages_read_engagement, instagram_basic, instagram_manage_insights
 */

const META_API = "https://graph.facebook.com/v21.0"

interface MetaConfig {
  accessToken: string
  pageId: string
  igUserId: string | null
}

function getConfig(): MetaConfig | null {
  const accessToken = process.env.META_ACCESS_TOKEN
  const pageId = process.env.META_PAGE_ID
  if (!accessToken || !pageId) return null
  return {
    accessToken,
    pageId,
    igUserId: process.env.META_IG_USER_ID || null,
  }
}

export function isMetaConfigured(): boolean {
  return getConfig() !== null
}

// ─── TYPES ──────────────────────────────────────────────────────

export interface PostPerformance {
  id: string
  message: string
  createdTime: string
  type: "photo" | "video" | "link" | "status" | "reel" | "carousel"
  reach: number
  impressions: number
  engagement: number
  likes: number
  comments: number
  shares: number
  saves: number
  clicks: number
}

export interface WeeklyInsights {
  followerCount: number
  followerGrowth: number
  totalReach: number
  totalImpressions: number
  avgEngagementRate: number
  topPosts: PostPerformance[]
  worstPosts: PostPerformance[]
  bestPostType: string
  bestPostTime: string
  contentGaps: string[]
}

// ─── FACEBOOK PAGE INSIGHTS ─────────────────────────────────────

/**
 * Fetch recent Facebook page posts with engagement metrics.
 */
export async function getFacebookPosts(days = 7): Promise<PostPerformance[]> {
  const config = getConfig()
  if (!config) return []

  const since = Math.floor((Date.now() - days * 86400000) / 1000)

  const res = await fetch(
    `${META_API}/${config.pageId}/posts?fields=id,message,created_time,type,insights.metric(post_impressions,post_engaged_users,post_clicks,post_reactions_by_type_total)&since=${since}&limit=50&access_token=${config.accessToken}`
  )

  if (!res.ok) {
    console.error("[Meta] Facebook posts fetch failed:", res.status)
    return []
  }

  const data = await res.json()
  return (data.data || []).map((post: Record<string, unknown>) => {
    const insights = (post.insights as Record<string, unknown[]>)?.data || []
    const getMetric = (name: string) => {
      const m = insights.find((i: Record<string, unknown>) => i.name === name) as Record<string, unknown> | undefined
      const values = m?.values as Record<string, unknown>[] | undefined
      return (values?.[0]?.value as number) || 0
    }

    return {
      id: post.id as string,
      message: ((post.message as string) || "").slice(0, 120),
      createdTime: post.created_time as string,
      type: post.type as string || "status",
      reach: 0,
      impressions: getMetric("post_impressions"),
      engagement: getMetric("post_engaged_users"),
      likes: 0,
      comments: 0,
      shares: 0,
      saves: 0,
      clicks: getMetric("post_clicks"),
    }
  })
}

// ─── INSTAGRAM INSIGHTS ─────────────────────────────────────────

/**
 * Fetch recent Instagram media with engagement metrics.
 */
export async function getInstagramPosts(days = 7): Promise<PostPerformance[]> {
  const config = getConfig()
  if (!config?.igUserId) return []

  const since = new Date(Date.now() - days * 86400000).toISOString()

  const res = await fetch(
    `${META_API}/${config.igUserId}/media?fields=id,caption,timestamp,media_type,like_count,comments_count,insights.metric(impressions,reach,saved,shares)&limit=50&access_token=${config.accessToken}`
  )

  if (!res.ok) {
    console.error("[Meta] Instagram posts fetch failed:", res.status)
    return []
  }

  const data = await res.json()
  return (data.data || [])
    .filter((post: Record<string, unknown>) => new Date(post.timestamp as string) >= new Date(since))
    .map((post: Record<string, unknown>) => {
      const insights = (post.insights as Record<string, unknown[]>)?.data || []
      const getMetric = (name: string) => {
        const m = insights.find((i: Record<string, unknown>) => i.name === name) as Record<string, unknown> | undefined
        const values = m?.values as Record<string, unknown>[] | undefined
        return (values?.[0]?.value as number) || 0
      }

      const mediaType = post.media_type as string
      const type = mediaType === "VIDEO" ? "reel" : mediaType === "CAROUSEL_ALBUM" ? "carousel" : "photo"

      return {
        id: post.id as string,
        message: ((post.caption as string) || "").slice(0, 120),
        createdTime: post.timestamp as string,
        type,
        reach: getMetric("reach"),
        impressions: getMetric("impressions"),
        engagement: (post.like_count as number || 0) + (post.comments_count as number || 0),
        likes: post.like_count as number || 0,
        comments: post.comments_count as number || 0,
        shares: getMetric("shares"),
        saves: getMetric("saved"),
        clicks: 0,
      }
    })
}

// ─── WEEKLY ANALYSIS ────────────────────────────────────────────

/**
 * Generate a weekly social media performance analysis.
 * Used by the morning brief social researcher.
 */
export async function getWeeklyInsights(): Promise<WeeklyInsights> {
  const [fbPosts, igPosts] = await Promise.all([
    getFacebookPosts(7),
    getInstagramPosts(7),
  ])

  const allPosts = [...fbPosts, ...igPosts]

  if (allPosts.length === 0) {
    return {
      followerCount: 0,
      followerGrowth: 0,
      totalReach: 0,
      totalImpressions: 0,
      avgEngagementRate: 0,
      topPosts: [],
      worstPosts: [],
      bestPostType: "unknown",
      bestPostTime: "unknown",
      contentGaps: ["No social accounts connected. Connect Facebook/Instagram in Settings."],
    }
  }

  // Sort by engagement
  const sorted = [...allPosts].sort((a, b) => b.engagement - a.engagement)
  const topPosts = sorted.slice(0, 3)
  const worstPosts = sorted.slice(-3).reverse()

  // Best content type
  const typeEngagement: Record<string, { total: number; count: number }> = {}
  for (const post of allPosts) {
    if (!typeEngagement[post.type]) typeEngagement[post.type] = { total: 0, count: 0 }
    typeEngagement[post.type].total += post.engagement
    typeEngagement[post.type].count++
  }
  const bestType = Object.entries(typeEngagement)
    .sort(([, a], [, b]) => (b.total / b.count) - (a.total / a.count))[0]
  const bestPostType = bestType ? bestType[0] : "unknown"

  // Best posting time
  const hourEngagement: Record<number, { total: number; count: number }> = {}
  for (const post of allPosts) {
    const hour = new Date(post.createdTime).getHours()
    if (!hourEngagement[hour]) hourEngagement[hour] = { total: 0, count: 0 }
    hourEngagement[hour].total += post.engagement
    hourEngagement[hour].count++
  }
  const bestHour = Object.entries(hourEngagement)
    .sort(([, a], [, b]) => (b.total / b.count) - (a.total / a.count))[0]
  const bestPostTime = bestHour ? `${parseInt(bestHour[0]) % 12 || 12}${parseInt(bestHour[0]) >= 12 ? "PM" : "AM"}` : "unknown"

  // Content gaps: check for missing days
  const postedDays = new Set(allPosts.map((p) => new Date(p.createdTime).toDateString()))
  const gaps: string[] = []
  for (let i = 0; i < 7; i++) {
    const day = new Date(Date.now() - i * 86400000)
    if (!postedDays.has(day.toDateString()) && day < new Date()) {
      gaps.push(day.toLocaleDateString("en-US", { weekday: "long" }))
    }
  }
  if (gaps.length > 0) {
    gaps.unshift(`No posts on: ${gaps.splice(0, gaps.length).join(", ")}`)
  }

  const totalReach = allPosts.reduce((sum, p) => sum + p.reach, 0)
  const totalImpressions = allPosts.reduce((sum, p) => sum + p.impressions, 0)
  const avgEngagement = allPosts.length > 0
    ? allPosts.reduce((sum, p) => sum + p.engagement, 0) / allPosts.length
    : 0

  return {
    followerCount: 0, // Requires separate API call
    followerGrowth: 0,
    totalReach,
    totalImpressions,
    avgEngagementRate: Math.round(avgEngagement * 100) / 100,
    topPosts,
    worstPosts,
    bestPostType,
    bestPostTime,
    contentGaps: gaps,
  }
}
