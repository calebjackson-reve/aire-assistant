// app/api/morning-brief/action/route.ts
// Handles approve/dismiss actions for morning briefs.
// Human approval gate — AIRE never acts without agent OK.

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import prisma from "@/lib/prisma"

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { briefId, action } = await req.json() as { briefId: string; action: string }

  if (!briefId || !["approve", "dismiss"].includes(action)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { clerkId: userId } })
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  // Verify the brief belongs to this user
  const brief = await prisma.morningBrief.findUnique({ where: { id: briefId } })
  if (!brief || brief.userId !== user.id) {
    return NextResponse.json({ error: "Brief not found" }, { status: 404 })
  }

  if (action === "approve") {
    await prisma.morningBrief.update({
      where: { id: briefId },
      data: {
        status: "approved",
        approvedAt: new Date(),
        approvedBy: userId,
      },
    })
  } else {
    await prisma.morningBrief.update({
      where: { id: briefId },
      data: {
        status: "dismissed",
        dismissedAt: new Date(),
      },
    })
  }

  return NextResponse.json({ success: true, status: action === "approve" ? "approved" : "dismissed" })
}
