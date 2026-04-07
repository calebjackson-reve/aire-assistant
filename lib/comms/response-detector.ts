import prisma from "@/lib/prisma"
import { type InboundMessage, type UnansweredMessage, classifyUrgency } from "./types"

/**
 * Ingest scanned messages into CommunicationLog and detect response pairs.
 */
export async function ingestMessages(
  userId: string,
  inbound: InboundMessage[],
  outbound: InboundMessage[]
) {
  // Log outbound first (so we can match replies)
  for (const msg of outbound) {
    await prisma.communicationLog.upsert({
      where: { externalId: msg.externalId },
      update: {},
      create: {
        userId,
        channel: msg.channel,
        direction: "outbound",
        externalId: msg.externalId,
        threadId: msg.threadId,
        fromAddress: msg.from,
        toAddress: msg.to,
        subject: msg.subject,
        bodyPreview: msg.bodyPreview,
        sentAt: msg.sentAt,
        status: "delivered",
      },
    })
  }

  // Log inbound and try to match as responses to outbound
  for (const msg of inbound) {
    // Try to find a Contact by email/phone
    const contact = await findContact(userId, msg.from, msg.channel)

    // Check if this is a reply to an outbound message (same thread or same contact)
    const outboundMatch = msg.threadId
      ? await prisma.communicationLog.findFirst({
          where: { userId, threadId: msg.threadId, direction: "outbound" },
          orderBy: { sentAt: "desc" },
        })
      : await prisma.communicationLog.findFirst({
          where: {
            userId,
            direction: "outbound",
            toAddress: { contains: extractAddress(msg.from) },
            status: { in: ["delivered", "unanswered"] },
          },
          orderBy: { sentAt: "desc" },
        })

    const log = await prisma.communicationLog.upsert({
      where: { externalId: msg.externalId },
      update: {},
      create: {
        userId,
        contactId: contact?.id,
        channel: msg.channel,
        direction: "inbound",
        externalId: msg.externalId,
        threadId: msg.threadId,
        fromAddress: msg.from,
        toAddress: msg.to,
        subject: msg.subject,
        bodyPreview: msg.bodyPreview,
        sentAt: msg.sentAt,
        status: "delivered",
      },
    })

    // Mark the outbound message as "replied" if this is a response
    if (outboundMatch) {
      await prisma.communicationLog.update({
        where: { id: outboundMatch.id },
        data: { status: "replied", respondedAt: msg.sentAt, responseLogId: log.id },
      })
    }

    // Update Contact response tracking
    if (contact) {
      await prisma.contact.update({
        where: { id: contact.id },
        data: {
          lastResponseAt: msg.sentAt,
          responseCount: { increment: 1 },
        },
      })
    }
  }
}

/**
 * Find all unanswered inbound messages for a user.
 */
export async function getUnanswered(userId: string): Promise<UnansweredMessage[]> {
  // Inbound messages that have no outbound reply in the same thread
  const unansweredInbound = await prisma.communicationLog.findMany({
    where: {
      userId,
      direction: "inbound",
      sentAt: { gte: new Date(Date.now() - 72 * 3600000) }, // last 72 hours
    },
    orderBy: { sentAt: "desc" },
  })

  const results: UnansweredMessage[] = []

  for (const msg of unansweredInbound) {
    // Check if agent replied (outbound in same thread after this message)
    const replied = msg.threadId
      ? await prisma.communicationLog.findFirst({
          where: {
            userId,
            direction: "outbound",
            threadId: msg.threadId,
            sentAt: { gt: msg.sentAt },
          },
        })
      : await prisma.communicationLog.findFirst({
          where: {
            userId,
            direction: "outbound",
            toAddress: { contains: extractAddress(msg.fromAddress) },
            sentAt: { gt: msg.sentAt },
          },
        })

    if (replied) continue

    const hoursUnanswered = (Date.now() - msg.sentAt.getTime()) / 3600000
    const contact = msg.contactId
      ? await prisma.contact.findUnique({ where: { id: msg.contactId } })
      : null

    results.push({
      id: msg.id,
      channel: msg.channel as "email" | "sms" | "call",
      from: msg.fromAddress,
      subject: msg.subject ?? undefined,
      bodyPreview: msg.bodyPreview ?? "",
      sentAt: msg.sentAt,
      hoursUnanswered: Math.round(hoursUnanswered * 10) / 10,
      contactName: contact ? `${contact.firstName} ${contact.lastName}` : undefined,
      contactId: contact?.id,
      urgency: classifyUrgency(hoursUnanswered, msg.channel),
    })
  }

  return results.sort((a, b) => {
    const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    return urgencyOrder[a.urgency] - urgencyOrder[b.urgency]
  })
}

/**
 * Mark outbound messages older than threshold as "unanswered".
 */
export async function markUnanswered(userId: string, thresholdHours = 24) {
  const cutoff = new Date(Date.now() - thresholdHours * 3600000)

  await prisma.communicationLog.updateMany({
    where: {
      userId,
      direction: "outbound",
      status: "delivered",
      sentAt: { lt: cutoff },
      respondedAt: null,
    },
    data: { status: "unanswered" },
  })
}

function extractAddress(raw: string): string {
  const match = raw.match(/<([^>]+)>/)
  return match ? match[1] : raw.replace(/^.*<|>.*$/g, "").trim()
}

async function findContact(userId: string, from: string, channel: string) {
  const address = extractAddress(from)
  if (channel === "email") {
    return prisma.contact.findFirst({ where: { agentId: userId, email: { contains: address } } })
  }
  // For SMS, match by phone
  const digits = address.replace(/\D/g, "").slice(-10)
  if (digits.length < 10) return null
  return prisma.contact.findFirst({ where: { agentId: userId, phone: { contains: digits } } })
}
