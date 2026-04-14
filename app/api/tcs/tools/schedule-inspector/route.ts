import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import prisma from "@/lib/prisma"
import { scheduleInspectorTool } from "@/lib/tcs/tools/schedule-inspector"

// POST /api/tcs/tools/schedule-inspector
// body: { sessionId, transactionId }
// Callable from the conversation surface to (re)draft the inspector booking
// email using the agent's preferred inspector from the Vendor table.
export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  let body: { sessionId?: string; transactionId?: string } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { sessionId, transactionId } = body
  if (!sessionId || !transactionId) {
    return NextResponse.json(
      { error: "sessionId and transactionId required" },
      { status: 400 },
    )
  }

  const owner = await prisma.tCSSession.findFirst({
    where: { id: sessionId, userId: user.id, transactionId },
    select: { id: true },
  })
  if (!owner) return NextResponse.json({ error: "Session not found" }, { status: 404 })

  try {
    const result = await scheduleInspectorTool({
      sessionId,
      userId: user.id,
      transactionId,
    })
    return NextResponse.json(result)
  } catch (err) {
    console.error("[TCS /tools/schedule-inspector]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    )
  }
}
