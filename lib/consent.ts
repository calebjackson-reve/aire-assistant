/**
 * AIRE Client Consent Gate — TCPA-aware sender wrapper
 *
 * Any SMS or voice message sent to a real client phone number MUST pass through
 * `sendSmsWithConsent()`. The gate looks up ClientConsent rows matching
 * (userId, phone, channel) and refuses to send if no active consent exists.
 *
 * Revocation: setting `revokedAt` on the consent row disables sending without
 * deleting history. Reusing a previously-revoked consent requires a new row.
 */

import prisma from "@/lib/prisma"
import { sendSms as sendSmsRaw } from "@/lib/twilio"

// E.164-lite normalization — strips anything non-digit, prefixes +1 for 10-digit US numbers.
// Downstream comparisons are always on the normalized form.
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D+/g, "")
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`
  if (digits.length >= 10) return `+${digits}`
  return null
}

export type ConsentChannel = "SMS" | "VOICE" | "EMAIL"

export interface ConsentCheckResult {
  allowed: boolean
  reason?: "NO_CONSENT" | "REVOKED" | "INVALID_PHONE" | "OK"
  consentId?: string
}

export async function hasConsent(
  userId: string,
  phone: string,
  channel: ConsentChannel
): Promise<ConsentCheckResult> {
  const normalized = normalizePhone(phone)
  if (!normalized) return { allowed: false, reason: "INVALID_PHONE" }

  const row = await prisma.clientConsent.findFirst({
    where: {
      userId,
      clientPhone: normalized,
      channel,
      revokedAt: null,
    },
    orderBy: { consentedAt: "desc" },
    select: { id: true },
  })

  if (!row) return { allowed: false, reason: "NO_CONSENT" }
  return { allowed: true, reason: "OK", consentId: row.id }
}

export interface RecordConsentInput {
  userId: string
  transactionId?: string | null
  clientName: string
  clientPhone?: string | null
  clientEmail?: string | null
  channel: ConsentChannel
  method?: "VERBAL" | "WRITTEN" | "DIGITAL_CHECKBOX" | "AGENT_ATTESTATION"
  agentAttestedBy?: string | null
  notes?: string | null
}

export async function recordConsent(input: RecordConsentInput) {
  const normalizedPhone = normalizePhone(input.clientPhone)
  return prisma.clientConsent.create({
    data: {
      userId: input.userId,
      transactionId: input.transactionId ?? null,
      clientName: input.clientName,
      clientPhone: normalizedPhone,
      clientEmail: input.clientEmail ?? null,
      channel: input.channel,
      method: input.method ?? "AGENT_ATTESTATION",
      agentAttestedBy: input.agentAttestedBy ?? null,
      notes: input.notes ?? null,
    },
  })
}

export async function revokeConsent(consentId: string, userId: string) {
  return prisma.clientConsent.updateMany({
    where: { id: consentId, userId },
    data: { revokedAt: new Date() },
  })
}

export interface SendResult {
  ok: boolean
  sid?: string
  skipped?: boolean
  reason?: string
  error?: string
}

/**
 * Gated SMS sender. Returns `skipped: true` with `reason: NO_CONSENT`
 * when no active consent exists; caller can surface that to the UI
 * (e.g., nudge the agent to capture consent first).
 */
export async function sendSmsWithConsent(params: {
  userId: string
  to: string
  body: string
}): Promise<SendResult> {
  const check = await hasConsent(params.userId, params.to, "SMS")
  if (!check.allowed) {
    console.warn(
      `[consent] SMS blocked to ${params.to} (user=${params.userId}) — ${check.reason}`
    )
    return { ok: false, skipped: true, reason: check.reason }
  }
  const result = await sendSmsRaw(params.to, params.body)
  return { ok: result.ok, sid: result.sid, error: result.error }
}
