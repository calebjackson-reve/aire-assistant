import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getUnanswered } from "@/lib/comms"

export async function GET() {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  // Get unanswered messages (sorted by urgency)
  const unanswered = await getUnanswered(user.id)

  // Get recent inbound emails grouped by transaction link
  const recentInbound = await prisma.communicationLog.findMany({
    where: {
      userId: user.id,
      direction: "inbound",
      channel: "email",
      sentAt: { gte: new Date(Date.now() - 7 * 24 * 3600000) },
    },
    orderBy: { sentAt: "desc" },
    take: 50,
  })

  // Get missed calls
  const missedCalls = await prisma.missedCallLog.findMany({
    where: {
      userId: user.id,
      returned: false,
      callTime: { gte: new Date(Date.now() - 72 * 3600000) },
    },
    orderBy: { callTime: "desc" },
  })

  // Get last scan time
  const lastScan = await prisma.communicationLog.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  })

  // Get connected email accounts
  const accounts = await prisma.emailAccount.findMany({
    where: { userId: user.id, isActive: true },
    select: { id: true, email: true, provider: true, lastScan: true },
  })

  // Separate unanswered by urgency for UI sections
  const critical = unanswered.filter((m) => m.urgency === "critical")
  const high = unanswered.filter((m) => m.urgency === "high")
  const medium = unanswered.filter((m) => m.urgency === "medium")
  const low = unanswered.filter((m) => m.urgency === "low")

  // Categorize recent emails
  const transactionEmails = recentInbound.filter((e) => e.contactId)
  const otherEmails = recentInbound.filter((e) => !e.contactId)

  return NextResponse.json({
    unanswered: { critical, high, medium, low, total: unanswered.length },
    missedCalls: missedCalls.map((c) => ({
      id: c.id,
      callerPhone: c.callerPhone,
      callerName: c.callerName,
      callTime: c.callTime,
      hoursAgo: Math.round((Date.now() - c.callTime.getTime()) / 3600000 * 10) / 10,
    })),
    recentEmails: {
      transaction: transactionEmails.slice(0, 20),
      other: otherEmails.slice(0, 20),
    },
    accounts,
    lastScanAt: lastScan?.createdAt ?? null,
    stats: {
      totalUnanswered: unanswered.length,
      missedCallCount: missedCalls.length,
      criticalCount: critical.length,
    },
  })
}
