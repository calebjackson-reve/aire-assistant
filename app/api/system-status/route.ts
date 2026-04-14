import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/admin"
import { getSystemStatus } from "@/lib/ops/health"

export const dynamic = "force-dynamic"

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const status = await getSystemStatus()
  return NextResponse.json(status)
}
