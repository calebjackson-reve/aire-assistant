// lib/airsign/email.ts
// Shared AirSign email helpers — signing invitation + decline notification.

export function buildSigningEmailHtml(signerName: string, envelopeName: string, signingUrl: string, expiresAt: Date): string {
  const expStr = expiresAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
  return `
    <div style="font-family: 'Space Grotesk', Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #1e2416;">
      <div style="background: #6b7d52; padding: 20px 24px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0; color: #f5f2ea; font-family: 'Cormorant Garamond', Georgia, serif; font-size: 20px; font-style: italic;">
          AirSign — Signature Requested
        </h2>
      </div>
      <div style="background: #f5f2ea; padding: 24px; border-radius: 0 0 8px 8px; font-size: 14px; line-height: 1.6;">
        <p>Hello ${signerName},</p>
        <p>You have been asked to review and sign:</p>
        <p style="background: white; border-left: 3px solid #9aab7e; padding: 12px 16px; border-radius: 4px; font-weight: 500;">
          ${envelopeName}
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${signingUrl}" style="display: inline-block; background: #6b7d52; color: #f5f2ea; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
            Review &amp; Sign Document
          </a>
        </div>
        <p style="color: #6b7d52; font-size: 12px;">
          This link expires on ${expStr}. If you did not expect this request, you may safely ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #e8e4d8; margin: 20px 0;" />
        <p style="color: #6b7d52; font-size: 11px; text-align: center;">
          Powered by AirSign — AIRE Intelligence<br/>Baton Rouge, Louisiana
        </p>
      </div>
    </div>
  `.trim()
}

export function buildDeclineNotificationHtml(
  creatorName: string,
  signerName: string,
  envelopeName: string,
  reason: string,
  envelopeUrl: string
): string {
  return `
    <div style="font-family: 'Space Grotesk', Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #1e2416;">
      <div style="background: #6b7d52; padding: 20px 24px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0; color: #f5f2ea; font-family: 'Cormorant Garamond', Georgia, serif; font-size: 20px; font-style: italic;">
          AirSign — Signing Declined
        </h2>
      </div>
      <div style="background: #f5f2ea; padding: 24px; border-radius: 0 0 8px 8px; font-size: 14px; line-height: 1.6;">
        <p>Hello ${creatorName},</p>
        <p><strong>${signerName}</strong> has declined to sign:</p>
        <p style="background: white; border-left: 3px solid #c45c5c; padding: 12px 16px; border-radius: 4px; font-weight: 500;">
          ${envelopeName}
        </p>
        <p style="color: #6b7d52; font-size: 13px; margin-top: 16px;"><strong>Reason given:</strong></p>
        <p style="background: white; padding: 12px 16px; border-radius: 4px; font-style: italic;">
          ${reason.replace(/</g, "&lt;").replace(/>/g, "&gt;")}
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${envelopeUrl}" style="display: inline-block; background: #6b7d52; color: #f5f2ea; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
            View Envelope
          </a>
        </div>
        <p style="color: #6b7d52; font-size: 12px;">
          All other signers have been paused on this envelope. You can resend, replace the signer, or void the envelope from the detail page.
        </p>
        <hr style="border: none; border-top: 1px solid #e8e4d8; margin: 20px 0;" />
        <p style="color: #6b7d52; font-size: 11px; text-align: center;">
          Powered by AirSign — AIRE Intelligence<br/>Baton Rouge, Louisiana
        </p>
      </div>
    </div>
  `.trim()
}

interface SigningInvitationInput {
  signerName: string
  signerEmail: string
  envelopeName: string
  signingUrl: string
  expiresAt: Date
}

export async function sendSigningInvitation(input: SigningInvitationInput): Promise<{ status: "sent" | "dev_logged" | "failed"; error?: string }> {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    console.log(`[AirSign/Email-DEV] To: ${input.signerEmail} | ${input.signingUrl}`)
    return { status: "dev_logged" }
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "AirSign <signing@aireintel.org>",
        to: input.signerEmail,
        subject: `Signature Requested: ${input.envelopeName}`,
        html: buildSigningEmailHtml(input.signerName, input.envelopeName, input.signingUrl, input.expiresAt),
      }),
    })
    if (res.ok) return { status: "sent" }
    const errText = await res.text()
    return { status: "failed", error: `Resend ${res.status}: ${errText.slice(0, 120)}` }
  } catch (err) {
    return { status: "failed", error: String(err) }
  }
}

interface DeclineNotificationInput {
  creatorName: string
  creatorEmail: string
  signerName: string
  envelopeName: string
  reason: string
  envelopeUrl: string
}

export async function sendDeclineNotification(input: DeclineNotificationInput): Promise<{ status: "sent" | "dev_logged" | "failed"; error?: string }> {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    console.log(`[AirSign/Email-DEV] DECLINE notification to: ${input.creatorEmail} — ${input.signerName} declined "${input.envelopeName}": ${input.reason}`)
    return { status: "dev_logged" }
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "AirSign <signing@aireintel.org>",
        to: input.creatorEmail,
        subject: `Signing Declined: ${input.envelopeName}`,
        html: buildDeclineNotificationHtml(input.creatorName, input.signerName, input.envelopeName, input.reason, input.envelopeUrl),
      }),
    })
    if (res.ok) return { status: "sent" }
    const errText = await res.text()
    return { status: "failed", error: `Resend ${res.status}: ${errText.slice(0, 120)}` }
  } catch (err) {
    return { status: "failed", error: String(err) }
  }
}
