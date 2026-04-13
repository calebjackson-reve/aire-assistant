import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { sendOtpSms, verifySignerSecret } from "@/lib/airsign/v2/signer-auth"

/**
 * Public (token-gated) signer auth endpoint used by /sign/[token] pages.
 * No Clerk auth — the signer token IS the authentication handshake.
 *
 * POST { token, action: "SEND" | "VERIFY", code? }
 */
export async function POST(req: Request) {
  const body = await req.json()
  const { token, action, code } = body as { token: string; action: "SEND" | "VERIFY"; code?: string }
  if (!token || !action) return NextResponse.json({ error: "token and action required" }, { status: 400 })

  const signer = await prisma.airSignSigner.findUnique({ where: { token } })
  if (!signer) return NextResponse.json({ error: "Invalid token" }, { status: 404 })
  if (signer.tokenExpiresAt && signer.tokenExpiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "Token expired" }, { status: 410 })
  }

  if (action === "SEND") {
    if (signer.authMethod !== "SMS_OTP") {
      return NextResponse.json({ error: "Signer is not configured for SMS OTP" }, { status: 400 })
    }
    const result = await sendOtpSms(signer.id)
    await prisma.airSignAuditEvent.create({
      data: {
        envelopeId: signer.envelopeId,
        signerId: signer.id,
        action: "otp_sent",
        metadata: { phone: signer.phone, twilioSid: result.sid },
      },
    })
    return NextResponse.json({ ok: result.ok })
  }

  if (action === "VERIFY") {
    if (!code) return NextResponse.json({ error: "code required" }, { status: 400 })
    const result = await verifySignerSecret(signer.id, code)
    await prisma.airSignAuditEvent.create({
      data: {
        envelopeId: signer.envelopeId,
        signerId: signer.id,
        action: result.ok ? "auth_verified" : "auth_failed",
        metadata: { reason: result.reason },
      },
    })
    return NextResponse.json(result)
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}
