import prisma from "@/lib/prisma"
import { createHash, randomInt, timingSafeEqual } from "node:crypto"

/**
 * Signer authentication — upgrades beyond EMAIL_LINK:
 *   SMS_OTP       — 6-digit code via Twilio, 10-minute window, 5 attempts max
 *   ACCESS_CODE   — static 8-char code set by agent, conveyed off-channel
 *   KBA           — Persona/Jumio ID verification (stubbed, GA'd behind Q3 feature flag)
 *
 * All secrets are stored as SHA-256 hashes. Sessions expire after 30 minutes.
 */

const OTP_WINDOW_MS = 10 * 60 * 1000
const SESSION_WINDOW_MS = 30 * 60 * 1000
const MAX_OTP_ATTEMPTS = 5

export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex")
}

export function constantTimeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

export function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0")
}

export function generateAccessCode(): string {
  const alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"
  let out = ""
  for (let i = 0; i < 8; i++) out += alphabet[randomInt(0, alphabet.length)]
  return out
}

export async function setAccessCode(signerId: string, code: string): Promise<void> {
  await prisma.airSignSigner.update({
    where: { id: signerId },
    data: {
      authMethod: "ACCESS_CODE",
      authSecret: hashSecret(code),
      authVerifiedAt: null,
      otpAttempts: 0,
    },
  })
}

/**
 * Issue an SMS OTP for a signer. Returns the plaintext code so the caller can dispatch
 * via Twilio (see sendOtpSms() convenience). The secret is stored hashed with a timestamp
 * so verification can check recency.
 */
export async function issueSmsOtp(signerId: string): Promise<string> {
  const signer = await prisma.airSignSigner.findUnique({ where: { id: signerId } })
  if (!signer) throw new Error("Signer not found")
  if (!signer.phone) throw new Error("Signer has no phone on file")

  const code = generateOtp()
  const hashed = hashSecret(`${code}:${Date.now()}`)

  await prisma.airSignSigner.update({
    where: { id: signerId },
    data: {
      authMethod: "SMS_OTP",
      authSecret: hashed,
      authVerifiedAt: null,
      otpAttempts: 0,
    },
  })

  return code
}

/**
 * Verify an access code or OTP supplied by a signer.
 * Increments otpAttempts; after MAX_OTP_ATTEMPTS the signer must request a new code.
 */
export async function verifySignerSecret(
  signerId: string,
  supplied: string
): Promise<{ ok: boolean; reason?: "wrong" | "exhausted" | "expired" | "no-secret" }> {
  const signer = await prisma.airSignSigner.findUnique({ where: { id: signerId } })
  if (!signer) return { ok: false, reason: "no-secret" }
  if (!signer.authSecret) return { ok: false, reason: "no-secret" }
  if (signer.otpAttempts >= MAX_OTP_ATTEMPTS) return { ok: false, reason: "exhausted" }

  if (signer.authMethod === "ACCESS_CODE") {
    const ok = constantTimeEq(signer.authSecret, hashSecret(supplied))
    await prisma.airSignSigner.update({
      where: { id: signerId },
      data: {
        otpAttempts: ok ? 0 : signer.otpAttempts + 1,
        authVerifiedAt: ok ? new Date() : null,
      },
    })
    return ok ? { ok: true } : { ok: false, reason: "wrong" }
  }

  if (signer.authMethod === "SMS_OTP") {
    const windowStart = Date.now() - OTP_WINDOW_MS
    let ok = false
    // Scan a 1-second-resolution sliding window back to windowStart.
    // This costs at most 600 hashes — negligible.
    for (let t = Math.floor(Date.now() / 1000) * 1000; t >= windowStart; t -= 1000) {
      if (constantTimeEq(signer.authSecret, hashSecret(`${supplied}:${t}`))) {
        ok = true
        break
      }
    }
    await prisma.airSignSigner.update({
      where: { id: signerId },
      data: {
        otpAttempts: ok ? 0 : signer.otpAttempts + 1,
        authVerifiedAt: ok ? new Date() : null,
      },
    })
    return ok ? { ok: true } : { ok: false, reason: "wrong" }
  }

  return { ok: false, reason: "no-secret" }
}

export async function isSessionValid(signerId: string): Promise<boolean> {
  const signer = await prisma.airSignSigner.findUnique({
    where: { id: signerId },
    select: { authMethod: true, authVerifiedAt: true },
  })
  if (!signer) return false
  if (signer.authMethod === "EMAIL_LINK") return true
  if (!signer.authVerifiedAt) return false
  return Date.now() - signer.authVerifiedAt.getTime() < SESSION_WINDOW_MS
}

/**
 * Send OTP via Twilio. Dev fallback: logs the code to console without sending.
 */
export async function sendOtpSms(signerId: string): Promise<{ ok: boolean; sid?: string; error?: string }> {
  const signer = await prisma.airSignSigner.findUnique({ where: { id: signerId } })
  if (!signer) throw new Error("Signer not found")
  if (!signer.phone) throw new Error("Signer has no phone")

  const code = await issueSmsOtp(signerId)

  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_PHONE_NUMBER
  if (!sid || !token || !from) {
    console.log(`[dev] SMS OTP for ${signer.name} (${signer.phone}): ${code}`)
    return { ok: true, sid: "DEV-" + Date.now() }
  }

  const body = `Your AIRESIGN verification code is ${code}. Valid for 10 minutes. Do not share.`

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: signer.phone, From: from, Body: body }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error("[airsign-v2] Twilio OTP send failed:", err)
    return { ok: false, error: err }
  }
  const json = await res.json()
  return { ok: true, sid: json.sid }
}

/**
 * KBA stub — wired behind Q3 feature flag. In prod, this will create a Persona/Jumio
 * inquiry, store the reference, and callback via /api/airsign/signer-auth/kba-callback.
 */
export async function startKbaInquiry(signerId: string): Promise<{ ok: boolean; inquiryId?: string; redirectUrl?: string; error?: string }> {
  const signer = await prisma.airSignSigner.findUnique({ where: { id: signerId } })
  if (!signer) throw new Error("Signer not found")

  if (!process.env.PERSONA_API_KEY) {
    console.log(`[dev] KBA stub invoked for ${signer.name}`)
    return { ok: false, error: "KBA provider not configured" }
  }
  return { ok: false, error: "KBA provider integration not yet enabled" }
}
