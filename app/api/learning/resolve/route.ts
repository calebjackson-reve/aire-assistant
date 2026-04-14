import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/admin"
import { resolveError } from "@/lib/learning/error-memory"
import prisma from "@/lib/prisma"

export const dynamic = "force-dynamic"

/**
 * POST /api/learning/resolve
 * Body: { errorId: string, action: "resolve" | "ignore", resolution?: string }
 *
 * Admin-only. Resolves or ignores an error pattern.
 * "ignore" sets resolved=true with a generic "ignored by admin" note,
 * so the pattern doesn't keep fighting for attention.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = (await req.json().catch(() => ({}))) as {
    errorId?: string
    action?: "resolve" | "ignore"
    resolution?: string
  }

  if (!body.errorId || !body.action) {
    return NextResponse.json(
      { error: "errorId and action are required" },
      { status: 400 }
    )
  }

  const pattern = await prisma.errorMemory.findUnique({ where: { id: body.errorId } })
  if (!pattern) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (body.action === "ignore") {
    const updated = await resolveError(
      body.errorId,
      `Ignored by ${admin.email} on ${new Date().toISOString()}`
    )
    return NextResponse.json({ id: updated.id, resolved: true, action: "ignore" })
  }

  const updated = await resolveError(body.errorId, body.resolution || "Resolved")
  return NextResponse.json({ id: updated.id, resolved: true, action: "resolve" })
}
