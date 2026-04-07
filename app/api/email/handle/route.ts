import { auth } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function POST(request: NextRequest) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const { logId, action } = (await request.json()) as { logId: string; action: "handled" | "link" }

  if (!logId) return NextResponse.json({ error: "logId required" }, { status: 400 })
  if (!action || !["handled", "link"].includes(action)) {
    return NextResponse.json({ error: "action must be 'handled' or 'link'" }, { status: 400 })
  }

  const log = await prisma.communicationLog.findFirst({
    where: { id: logId, userId: user.id },
  })
  if (!log) return NextResponse.json({ error: "Message not found" }, { status: 404 })

  if (action === "handled") {
    await prisma.communicationLog.update({
      where: { id: logId },
      data: { status: "replied", respondedAt: new Date() },
    })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 })
}
