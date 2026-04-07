import { auth } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"
import { logMetric, getMetrics } from "@/lib/monitoring/activity-logger"

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const name = req.nextUrl.searchParams.get("name")
  if (!name) return NextResponse.json({ error: "name param required" }, { status: 400 })

  const since = req.nextUrl.searchParams.get("since")
  const metrics = await getMetrics(name, since ? new Date(since) : undefined)
  return NextResponse.json({ metrics })
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { name, value, agent, metadata } = body

  if (!name || value === undefined) {
    return NextResponse.json({ error: "name, value required" }, { status: 400 })
  }

  const metric = await logMetric(name, value, agent, metadata)
  return NextResponse.json(metric, { status: 201 })
}
