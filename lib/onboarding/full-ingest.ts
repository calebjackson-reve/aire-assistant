/**
 * AIRE Full Inbox Ingest — The "connect my Gmail and learn me" pipeline.
 *
 * Pulls 45 days of sent + received mail and:
 *   1. Classifies every email (deal_related / work_related / personal)
 *   2. Downloads PDF attachments → document classifier → Document records
 *   3. Extracts unique contacts from sender/recipient → Contact records
 *   4. Matches emails to existing Transactions where possible
 *   5. Extracts voice profile from sent-only emails
 *
 * Safe to re-run: skips contacts/docs that already exist.
 */

import prisma from "@/lib/prisma"
import { scanEmailAccount } from "@/lib/agents/email-scanner"
import { extractVoiceProfile } from "@/lib/onboarding/voice-profile-extractor"

const DAYS_BACK = 45
const MAX_SENT_FOR_VOICE = 30

interface IngestResult {
  userId: string
  emailsScanned: number
  attachmentsFound: number
  documentsCreated: number
  contactsCreated: number
  voiceProfileExtracted: boolean
  errors: string[]
  durationMs: number
}

export async function runFullIngest(userId: string): Promise<IngestResult> {
  const startedAt = Date.now()
  const errors: string[] = []
  let emailsScanned = 0
  let attachmentsFound = 0
  let documentsCreated = 0
  let contactsCreated = 0
  let voiceProfileExtracted = false

  console.log(`\n[FullIngest] user=${userId} starting 45-day ingest`)

  // 1. Find the active Gmail account
  const account = await prisma.emailAccount.findFirst({
    where: { userId, provider: "gmail", isActive: true },
    orderBy: { createdAt: "desc" },
  })

  if (!account) {
    errors.push("No active Gmail account found — user needs to complete OAuth first")
    return {
      userId,
      emailsScanned,
      attachmentsFound,
      documentsCreated,
      contactsCreated,
      voiceProfileExtracted,
      errors,
      durationMs: Date.now() - startedAt,
    }
  }

  console.log(`[FullIngest] account=${account.email}`)

  // 2. Run the full email scanner (classifier + attachment extraction + auto-file)
  try {
    const scanResult = await scanEmailAccount(account.id)
    emailsScanned = scanResult.emailsScanned || 0
    attachmentsFound = scanResult.attachmentsFound || 0
    documentsCreated = scanResult.documentsCreated || 0
    console.log(
      `[FullIngest] scanned=${emailsScanned} attachments=${attachmentsFound} docs=${documentsCreated}`
    )
  } catch (err) {
    console.error("[FullIngest] scanner failed:", err)
    errors.push(`scanner: ${err instanceof Error ? err.message : String(err)}`)
  }

  // 3. Pull sent emails for voice profile extraction (Gmail API direct call)
  try {
    const sentEmails = await fetchSentEmails(account.accessToken, MAX_SENT_FOR_VOICE, DAYS_BACK)
    if (sentEmails.length >= 3) {
      const profile = await extractVoiceProfile({ userId, sentEmails })
      if (profile) voiceProfileExtracted = true
    } else {
      console.log(`[FullIngest] skipping voice profile — only ${sentEmails.length} sent emails`)
    }
  } catch (err) {
    console.error("[FullIngest] voice profile failed:", err)
    errors.push(`voice: ${err instanceof Error ? err.message : String(err)}`)
  }

  // 4. Count new contacts created during this run (post-hoc, not part of scanner yet)
  const contactCount = await prisma.contact.count({
    where: { agentId: userId, source: { in: ["gmail_onboarding_scan", "gmail_ingest"] } },
  })
  contactsCreated = contactCount

  const durationMs = Date.now() - startedAt
  console.log(`[FullIngest] user=${userId} complete in ${durationMs}ms`)

  return {
    userId,
    emailsScanned,
    attachmentsFound,
    documentsCreated,
    contactsCreated,
    voiceProfileExtracted,
    errors,
    durationMs,
  }
}

// ─── Helper: fetch sent emails for voice profile ────────────────────────────

interface GmailHeader { name: string; value: string }
interface GmailPart {
  mimeType?: string
  body?: { data?: string }
  parts?: GmailPart[]
}
interface GmailMessageDetail {
  id: string
  payload?: {
    headers?: GmailHeader[]
    body?: { data?: string }
    parts?: GmailPart[]
  }
  snippet?: string
}

function decodeBase64Url(data: string): string {
  try {
    const normalized = data.replace(/-/g, "+").replace(/_/g, "/")
    return Buffer.from(normalized, "base64").toString("utf-8")
  } catch {
    return ""
  }
}

function extractTextBody(payload: GmailMessageDetail["payload"]): string {
  if (!payload) return ""
  // Prefer text/plain
  function walk(part: GmailPart): string | null {
    if (part.mimeType === "text/plain" && part.body?.data) {
      return decodeBase64Url(part.body.data)
    }
    if (part.parts) {
      for (const p of part.parts) {
        const found = walk(p)
        if (found) return found
      }
    }
    return null
  }
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data)
  }
  if (payload.parts) {
    for (const p of payload.parts) {
      const found = walk(p)
      if (found) return found
    }
  }
  return ""
}

async function fetchSentEmails(
  accessToken: string | null,
  max: number,
  daysBack: number
): Promise<{ subject: string; body: string }[]> {
  if (!accessToken) return []
  const after = Math.floor((Date.now() - daysBack * 86400000) / 1000)
  const q = encodeURIComponent(`in:sent after:${after}`)
  const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${q}&maxResults=${max}`

  const listRes = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!listRes.ok) return []
  const listData = (await listRes.json()) as { messages?: { id: string }[] }
  const ids = listData.messages || []

  const emails: { subject: string; body: string }[] = []
  for (const { id } of ids) {
    try {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      if (!msgRes.ok) continue
      const msg = (await msgRes.json()) as GmailMessageDetail
      const subject =
        msg.payload?.headers?.find((h) => h.name.toLowerCase() === "subject")?.value || "(no subject)"
      const body = extractTextBody(msg.payload)
      if (body.trim().length > 20) {
        emails.push({ subject, body: body.slice(0, 2000) })
      }
    } catch {
      // skip
    }
  }
  return emails
}
