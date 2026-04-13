import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import prisma from "@/lib/prisma"
import { earnestMoneyToTitleTool } from "@/lib/tcs/tools/earnest-money-to-title"

// POST /api/tcs/tools/earnest-money
// body: { sessionId, transactionId, earnestAmount? }
// Mints the Earnest Money receipt PDF + AirSign DRAFT envelope to the title co.
export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  let body: { sessionId?: string; transactionId?: string; earnestAmount?: string } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { sessionId, transactionId, earnestAmount } = body
  if (!sessionId || !transactionId) {
    return NextResponse.json(
      { error: "sessionId and transactionId required" },
      { status: 400 },
    )
  }

  const owner = await prisma.tCSSession.findFirst({
    where: { id: sessionId, userId: user.id, transactionId },
    select: { id: true, answers: true },
  })
  if (!owner) return NextResponse.json({ error: "Session not found" }, { status: 404 })

  const answersEarnest =
    (owner.answers as Record<string, unknown> | null)?.["offer.earnestMoney"] as
      | string
      | undefined

  try {
    const result = await earnestMoneyToTitleTool({
      sessionId,
      userId: user.id,
      transactionId,
      earnestAmount: earnestAmount ?? answersEarnest ?? null,
    })
    return NextResponse.json(result)
  } catch (err) {
    console.error("[TCS /tools/earnest-money]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    )
  }
}
