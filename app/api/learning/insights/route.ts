import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/admin"
import { getLearningInsights } from "@/lib/ops/learning-insights"

export const dynamic = "force-dynamic"

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const insights = await getLearningInsights()
  return NextResponse.json(insights)
}
