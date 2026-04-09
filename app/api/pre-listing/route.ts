import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { generateBriefForTransaction } from "@/lib/pre-listing-brief"

/**
 * POST /api/pre-listing
 * Generate a pre-listing brief from uploaded docs + agent voice updates.
 *
 * Body: { transactionId: string, agentUpdates?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { transactionId, agentUpdates } = await req.json()
    if (!transactionId) {
      return NextResponse.json({ error: "transactionId is required" }, { status: 400 })
    }

    const brief = await generateBriefForTransaction(transactionId, agentUpdates)

    return NextResponse.json({ brief })
  } catch (err) {
    console.error("[pre-listing] Error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    )
  }
}
