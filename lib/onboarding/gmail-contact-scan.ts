// Fire-and-forget Gmail contact scanner triggered after OAuth during onboarding.
// Scans the last 90 days of sent + inbox, extracts unique contacts, creates Contact records.
// If anything fails, logs and returns — never throws into the caller.

import prisma from "@/lib/prisma"

const GMAIL_LIST_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages"

interface GmailHeader { name: string; value: string }
interface GmailMessage {
  id: string
  payload?: { headers?: GmailHeader[] }
}

function parseAddress(raw: string): { name: string; email: string } | null {
  if (!raw) return null
  // "Jane Doe <jane@x.com>" or "jane@x.com"
  const match = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/)
  if (match) {
    return { name: match[1].trim(), email: match[2].trim().toLowerCase() }
  }
  const simple = raw.trim().toLowerCase()
  if (simple.includes("@")) return { name: "", email: simple }
  return null
}

function splitName(name: string, email: string): { first: string; last: string } {
  if (name) {
    const parts = name.split(/\s+/)
    return { first: parts[0] || "", last: parts.slice(1).join(" ") }
  }
  const localPart = email.split("@")[0]
  const parts = localPart.split(/[._-]/).filter(Boolean)
  return {
    first: (parts[0] || localPart).charAt(0).toUpperCase() + (parts[0] || localPart).slice(1),
    last: parts.length > 1 ? parts.slice(1).join(" ").replace(/^./, c => c.toUpperCase()) : "",
  }
}

export async function scanGmailForContacts(opts: {
  userId: string
  accessToken: string
  selfEmail: string
  daysBack?: number
  maxMessages?: number
}): Promise<{ scanned: number; created: number; error?: string }> {
  const daysBack = opts.daysBack ?? 90
  const maxMessages = opts.maxMessages ?? 200

  try {
    const after = Math.floor((Date.now() - daysBack * 86400000) / 1000)
    const q = encodeURIComponent(`after:${after}`)
    const listUrl = `${GMAIL_LIST_URL}?q=${q}&maxResults=${maxMessages}`

    const listRes = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${opts.accessToken}` },
    })
    if (!listRes.ok) {
      const txt = await listRes.text()
      console.warn("[Onboarding Gmail Scan] list failed:", txt.slice(0, 200))
      return { scanned: 0, created: 0, error: "list_failed" }
    }
    const listData = (await listRes.json()) as { messages?: { id: string }[] }
    const ids = (listData.messages || []).slice(0, maxMessages)

    const unique = new Map<string, { name: string; email: string }>()

    for (const { id } of ids) {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To`,
        { headers: { Authorization: `Bearer ${opts.accessToken}` } }
      )
      if (!msgRes.ok) continue
      const msg = (await msgRes.json()) as GmailMessage
      const headers = msg.payload?.headers || []
      for (const h of headers) {
        if (h.name.toLowerCase() !== "from" && h.name.toLowerCase() !== "to") continue
        // A To header may contain multiple comma-separated addresses
        for (const part of h.value.split(",")) {
          const parsed = parseAddress(part)
          if (!parsed) continue
          if (parsed.email === opts.selfEmail.toLowerCase()) continue
          if (!unique.has(parsed.email)) unique.set(parsed.email, parsed)
        }
      }
    }

    let created = 0
    for (const { name, email } of unique.values()) {
      const { first, last } = splitName(name, email)
      try {
        const exists = await prisma.contact.findFirst({
          where: { agentId: opts.userId, email },
        })
        if (exists) continue
        await prisma.contact.create({
          data: {
            agentId: opts.userId,
            firstName: first || "Unknown",
            lastName: last || "",
            email,
            type: "LEAD",
            source: "gmail_onboarding_scan",
            notes: "Imported from Gmail during onboarding",
          },
        })
        created++
      } catch (err) {
        console.warn("[Onboarding Gmail Scan] create contact failed:", err)
      }
    }

    console.log(
      `[Onboarding Gmail Scan] user=${opts.userId} scanned=${ids.length} unique=${unique.size} created=${created}`
    )
    return { scanned: ids.length, created }
  } catch (err) {
    console.error("[Onboarding Gmail Scan] fatal:", err)
    return { scanned: 0, created: 0, error: String(err) }
  }
}
