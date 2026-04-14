import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import prisma from "@/lib/prisma"
import { createSession } from "@/lib/tcs/conversation-engine"
import { railFor } from "@/lib/tcs/state-machine"
import type { TCSStage } from "@/lib/tcs/stages"

// POST /api/tcs/session — start a new TCS walkthrough
export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const side = typeof body.side === "string" ? body.side : undefined

  const session = await createSession(user.id, side)
  return NextResponse.json(session)
}

// GET /api/tcs/session?id=... — read session state for rehydration
export async function GET(req: NextRequest) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const id = req.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

  const session = await prisma.tCSSession.findFirst({
    where: { id, userId: user.id },
  })
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json({
    session,
    rail: railFor(session.currentStage as TCSStage),
  })
}
