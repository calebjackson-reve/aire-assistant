import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { getMonitoringSnapshot } from "@/lib/monitoring/snapshot"

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const snapshot = await getMonitoringSnapshot()
  return NextResponse.json(snapshot)
}
