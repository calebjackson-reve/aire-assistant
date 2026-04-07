import prisma from "@/lib/prisma"
import { type InboundMessage } from "./types"

interface GmailMessage {
  id: string
  threadId: string
  labelIds?: string[]
  payload: {
    headers: Array<{ name: string; value: string }>
    body?: { data?: string }
    parts?: Array<{ mimeType: string; body?: { data?: string } }>
  }
  snippet: string
  internalDate: string
}

function getHeader(msg: GmailMessage, name: string): string {
  return msg.payload.headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? ""
}

/**
 * Scan Gmail for recent messages using stored OAuth tokens.
 * Fetches messages from the last `sinceMins` minutes and classifies as inbound/outbound.
 */
export async function scanGmail(userId: string, sinceMins = 30): Promise<{ inbound: InboundMessage[]; outbound: InboundMessage[] }> {
  const account = await prisma.emailAccount.findFirst({
    where: { userId, provider: "gmail", isActive: true },
  })
  if (!account?.accessToken) return { inbound: [], outbound: [] }

  const userEmail = account.email
  const sinceEpoch = Math.floor((Date.now() - sinceMins * 60000) / 1000)
  const query = `after:${sinceEpoch}`

  // Fetch message list
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=50`,
    { headers: { Authorization: `Bearer ${account.accessToken}` } }
  )
  if (!listRes.ok) {
    console.error("[CommsMonitor] Gmail list failed:", listRes.status)
    return { inbound: [], outbound: [] }
  }

  const listData = await listRes.json() as { messages?: Array<{ id: string }> }
  if (!listData.messages?.length) return { inbound: [], outbound: [] }

  // Fetch each message (batch of metadata)
  const inbound: InboundMessage[] = []
  const outbound: InboundMessage[] = []

  for (const { id } of listData.messages) {
    // Skip if already logged
    const existing = await prisma.communicationLog.findUnique({ where: { externalId: id } })
    if (existing) continue

    const msgRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject`,
      { headers: { Authorization: `Bearer ${account.accessToken}` } }
    )
    if (!msgRes.ok) continue

    const msg = await msgRes.json() as GmailMessage
    const from = getHeader(msg, "From")
    const to = getHeader(msg, "To")
    const subject = getHeader(msg, "Subject")
    const sentAt = new Date(parseInt(msg.internalDate))

    const isOutbound = from.toLowerCase().includes(userEmail.toLowerCase())

    const parsed: InboundMessage = {
      externalId: msg.id,
      threadId: msg.threadId,
      channel: "email",
      from,
      to,
      subject,
      bodyPreview: msg.snippet?.slice(0, 500) ?? "",
      sentAt,
    }

    if (isOutbound) {
      outbound.push(parsed)
    } else {
      inbound.push(parsed)
    }
  }

  return { inbound, outbound }
}
