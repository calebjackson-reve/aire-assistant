import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import prisma from "@/lib/prisma"
import { submitAnswer } from "@/lib/tcs/conversation-engine"

// POST /api/tcs/answer
// body: { sessionId, questionKey, answer }
export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  let body: { sessionId?: string; questionKey?: string; answer?: unknown } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { sessionId, questionKey, answer } = body
  if (!sessionId || !questionKey) {
    return NextResponse.json({ error: "sessionId and questionKey required" }, { status: 400 })
  }

  // Ownership check
  const owner = await prisma.tCSSession.findFirst({
    where: { id: sessionId, userId: user.id },
    select: { id: true },
  })
  if (!owner) return NextResponse.json({ error: "Session not found" }, { status: 404 })

  try {
    const turn = await submitAnswer({
      sessionId,
      userId: user.id,
      questionKey,
      answer,
    })
    return NextResponse.json(turn)
  } catch (err) {
    console.error("[TCS /answer]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    )
  }
}
