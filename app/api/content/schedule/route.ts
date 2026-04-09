import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import prisma from "@/lib/prisma"
import { schedulePost, getWeeklyCalendar, generateContentStrategy } from "@/lib/content-scheduler"

/**
 * GET /api/content/schedule
 * Get this week's content calendar + strategy recommendations.
 */
export async function GET() {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = await prisma.user.findUnique({ where: { clerkId } })
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

    const [calendar, strategy] = await Promise.all([
      getWeeklyCalendar(user.id),
      generateContentStrategy(),
    ])

    return NextResponse.json({ calendar, strategy })
  } catch (err) {
    console.error("[content/schedule] Error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/content/schedule
 * Schedule a new post.
 *
 * Body: { platform, contentType, scheduledFor, content, mediaUrls?, hashtags?, transactionId? }
 */
export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = await prisma.user.findUnique({ where: { clerkId } })
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

    const body = await req.json()
    const { platform, contentType, scheduledFor, content } = body

    if (!platform || !content || !scheduledFor) {
      return NextResponse.json(
        { error: "platform, content, and scheduledFor are required" },
        { status: 400 }
      )
    }

    const result = await schedulePost({
      userId: user.id,
      platform,
      contentType: contentType || "photo",
      scheduledFor: new Date(scheduledFor),
      content,
      mediaUrls: body.mediaUrls,
      hashtags: body.hashtags,
      campaignId: body.campaignId,
      transactionId: body.transactionId,
    })

    return NextResponse.json({ scheduled: result })
  } catch (err) {
    console.error("[content/schedule] Error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    )
  }
}
