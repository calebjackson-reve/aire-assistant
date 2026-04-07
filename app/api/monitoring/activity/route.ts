import { auth } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"
import { logActivity, getRecentActivity, getAgentActivity } from "@/lib/monitoring/activity-logger"

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const agent = req.nextUrl.searchParams.get("agent")
  const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "20")

  const activities = agent
    ? await getAgentActivity(agent, limit)
    : await getRecentActivity(limit)

  return NextResponse.json({ activities })
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { agent, action, message, phase, severity, metadata } = body

  if (!agent || !action || !message) {
    return NextResponse.json({ error: "agent, action, message required" }, { status: 400 })
  }

  const activity = await logActivity(agent, action, message, { phase, severity, metadata })
  return NextResponse.json(activity, { status: 201 })
}
