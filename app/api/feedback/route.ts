// app/api/feedback/route.ts
// POST: Log feedback on any AI feature output (thumbs up/down, corrections)
// GET: Get feedback summary for a feature (admin/analytics)

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import prisma from "@/lib/prisma"
import { logFeedback, getFeedbackSummary } from "@/lib/learning/feedback-engine"

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { clerkId } })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const body = await req.json()
    const { feature, rating, input, output, correction, dismissed, metadata } = body

    if (!feature) {
      return NextResponse.json({ error: "feature is required" }, { status: 400 })
    }

    const validFeatures = ["morning_brief", "voice", "contract", "compliance", "document", "email"]
    if (!validFeatures.includes(feature)) {
      return NextResponse.json({ error: `Invalid feature. Must be one of: ${validFeatures.join(", ")}` }, { status: 400 })
    }

    if (rating != null && rating !== 1 && rating !== 5) {
      return NextResponse.json({ error: "Rating must be 1 (thumbs down) or 5 (thumbs up)" }, { status: 400 })
    }

    const log = await logFeedback({
      userId: user.id,
      feature,
      rating,
      input,
      output,
      correction,
      dismissed,
      metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
    })

    return NextResponse.json({ id: log.id, logged: true })
  } catch (error) {
    console.error("Feedback log error:", error)
    return NextResponse.json({ error: "Failed to log feedback" }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const feature = req.nextUrl.searchParams.get("feature")
    const days = parseInt(req.nextUrl.searchParams.get("days") || "30", 10)

    if (!feature) {
      return NextResponse.json({ error: "feature query param is required" }, { status: 400 })
    }

    const summary = await getFeedbackSummary(feature, days)
    return NextResponse.json({ feature, days, ...summary })
  } catch (error) {
    console.error("Feedback summary error:", error)
    return NextResponse.json({ error: "Failed to get feedback summary" }, { status: 500 })
  }
}
