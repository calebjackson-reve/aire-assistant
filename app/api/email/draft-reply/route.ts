import { auth } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { generateDraftReply } from "@/lib/comms"
import type { UnansweredMessage } from "@/lib/comms"

export async function POST(request: NextRequest) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const { logId } = (await request.json()) as { logId: string }
  if (!logId) return NextResponse.json({ error: "logId required" }, { status: 400 })

  const log = await prisma.communicationLog.findFirst({
    where: { id: logId, userId: user.id },
  })
  if (!log) return NextResponse.json({ error: "Message not found" }, { status: 404 })

  // If draft already exists, return it
  if (log.draftReply) {
    return NextResponse.json({ draft: log.draftReply, cached: true })
  }

  // Build UnansweredMessage shape for the draft generator
  const contact = log.contactId
    ? await prisma.contact.findUnique({ where: { id: log.contactId } })
    : null

  const msg: UnansweredMessage = {
    id: log.id,
    channel: log.channel as "email" | "sms" | "call",
    from: log.fromAddress,
    subject: log.subject ?? undefined,
    bodyPreview: log.bodyPreview ?? "",
    sentAt: log.sentAt,
    hoursUnanswered: (Date.now() - log.sentAt.getTime()) / 3600000,
    contactName: contact ? `${contact.firstName} ${contact.lastName}` : undefined,
    contactId: contact?.id,
    urgency: "high",
  }

  const draft = await generateDraftReply(msg, user.firstName ?? "Caleb")

  // Store on the log
  await prisma.communicationLog.update({
    where: { id: logId },
    data: { draftReply: draft },
  })

  return NextResponse.json({ draft, cached: false })
}
