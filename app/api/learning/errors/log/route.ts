import { NextRequest, NextResponse } from "next/server"
import { logError } from "@/lib/learning/error-memory"

export const dynamic = "force-dynamic"

/**
 * POST /api/learning/errors/log
 * Body: { agent: string, errorMessage: string, context?: object }
 *
 * Fire-and-forget endpoint used by client-side error boundaries. Intentionally
 * unauthenticated so any page crash gets captured, but the agent prefix must
 * be "ui:" to prevent abuse.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      agent?: string
      errorMessage?: string
      context?: Record<string, unknown>
    }

    if (!body.agent || !body.errorMessage) {
      return NextResponse.json({ error: "agent and errorMessage required" }, { status: 400 })
    }
    if (!body.agent.startsWith("ui:")) {
      return NextResponse.json({ error: "Only ui:* errors accepted here" }, { status: 400 })
    }

    await logError({
      agentName: body.agent,
      error: body.errorMessage,
      context: body.context,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("Error log endpoint failed:", err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
