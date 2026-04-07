import { auth } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"
import { getErrors } from "@/lib/monitoring/activity-logger"

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const since = req.nextUrl.searchParams.get("since")
  const errors = await getErrors(since ? new Date(since) : undefined)
  return NextResponse.json({ errors })
}
