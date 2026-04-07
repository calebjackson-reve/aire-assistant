import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { runCommsScan } from "@/lib/comms"

export async function POST() {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const result = await runCommsScan(user.id, 60) // scan last 60 minutes

  return NextResponse.json({
    scannedAt: result.scannedAt,
    newInbound: result.newInbound,
    newOutbound: result.newOutbound,
    unansweredCount: result.unansweredCount,
    missedCallCount: result.missedCallCount,
  })
}
