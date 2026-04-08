import prisma from "@/lib/prisma"
import { type InboundMessage } from "./types"
import { logError } from "@/lib/learning/error-memory"

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

  // Refresh token if expired or expiring within 5 minutes
  let accessToken = account.accessToken
  if (account.tokenExpiry && account.tokenExpiry < new Date(Date.now() + 5 * 60 * 1000)) {
    if (account.refreshToken) {
      try {
        const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID || "",
            client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
            refresh_token: account.refreshToken,
            grant_type: "refresh_token",
          }),
        })
        if (refreshRes.ok) {
          const data = await refreshRes.json()
          accessToken = data.access_token
          await prisma.emailAccount.update({
            where: { id: account.id },
            data: {
              accessToken: data.access_token,
              tokenExpiry: new Date(Date.now() + data.expires_in * 1000),
            },
          })
        } else {
          console.error("[CommsMonitor] Token refresh failed:", refreshRes.status)
          return { inbound: [], outbound: [] }
        }
      } catch (err) {
        console.error("[CommsMonitor] Token refresh error:", err)
        return { inbound: [], outbound: [] }
      }
    } else {
      console.error("[CommsMonitor] Token expired and no refresh token available")
      return { inbound: [], outbound: [] }
    }
  }

  const userEmail = account.email
  const sinceEpoch = Math.floor((Date.now() - sinceMins * 60000) / 1000)
  const query = `after:${sinceEpoch}`

  // Fetch message list
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=50`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
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
      { headers: { Authorization: `Bearer ${accessToken}` } }
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
