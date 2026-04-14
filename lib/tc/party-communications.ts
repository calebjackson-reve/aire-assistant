/**
 * AIRE TC — Party Communication Templates & Dispatch
 * Deterministic email/SMS templates for standard transaction updates.
 * No AI calls — fast, consistent, compliant.
 *
 * Templates: listing confirmed, offer accepted, inspection scheduled,
 * deadline reminder, closing reminder, document request, status update.
 *
 * Dev mode: console.log. Prod: Resend email + Twilio SMS.
 */

// ─── TYPES ──────────────────────────────────────────────────────────────────

export type PartyRole = "buyer" | "seller" | "lender" | "title" | "agent"

export type TemplateType =
  | "listing_confirmed"
  | "offer_accepted"
  | "inspection_scheduled"
  | "inspection_complete"
  | "appraisal_ordered"
  | "financing_approved"
  | "closing_reminder"
  | "document_request"
  | "status_update"
  | "deadline_reminder"

export interface PartyInfo {
  name: string
  email?: string | null
  phone?: string | null
  role: PartyRole
}

export interface TemplateContext {
  propertyAddress: string
  agentName?: string
  buyerName?: string | null
  sellerName?: string | null
  price?: number | null
  date?: string | null
  deadlineName?: string | null
  documentName?: string | null
  status?: string | null
  notes?: string | null
}

export interface CommunicationMessage {
  to: PartyInfo
  subject: string
  body: string
  smsBody: string
  templateType: TemplateType
}

export interface SendResult {
  party: string
  role: PartyRole
  emailSent: boolean
  smsSent: boolean
  smsSkipped?: boolean
  smsSkipReason?: string
  emailError?: string
  smsError?: string
}

// ─── TEMPLATE LIBRARY ───────────────────────────────────────────────────────

function template(type: TemplateType, ctx: TemplateContext, to: PartyInfo): { subject: string; body: string; sms: string } {
  const agent = ctx.agentName || "Your AIRE agent"
  const addr = ctx.propertyAddress
  const price = ctx.price ? `$${ctx.price.toLocaleString()}` : ""

  switch (type) {
    case "listing_confirmed":
      return {
        subject: `Listing Confirmed — ${addr}`,
        body: `
          <p>Hello ${to.name},</p>
          <p>This is a confirmation that the listing for <strong>${addr}</strong> is now active${price ? ` at ${price}` : ""}.</p>
          <p>${agent} will keep you updated on showings, feedback, and any offers received.</p>
          <p>If you have questions, reply to this email or call us directly.</p>
          <p>Best regards,<br/>${agent}<br/>Reve Realtors — Baton Rouge, LA</p>
        `,
        sms: `AIRE: Listing confirmed for ${addr}${price ? ` at ${price}` : ""}. ${agent} will keep you posted. Reply STOP to opt out.`,
      }

    case "offer_accepted":
      return {
        subject: `Offer Accepted — ${addr}`,
        body: `
          <p>Hello ${to.name},</p>
          <p>Great news — the offer on <strong>${addr}</strong> has been accepted${price ? ` at ${price}` : ""}.</p>
          <p>Next steps include the inspection period, appraisal, and financing milestones. ${agent} will guide you through each deadline.</p>
          <p>We'll be in touch soon with the inspection scheduling details.</p>
          <p>Congratulations,<br/>${agent}<br/>Reve Realtors — Baton Rouge, LA</p>
        `,
        sms: `AIRE: Offer accepted on ${addr}${price ? ` at ${price}` : ""}! Next up: inspection scheduling. ${agent} will reach out soon.`,
      }

    case "inspection_scheduled":
      return {
        subject: `Inspection Scheduled — ${addr}`,
        body: `
          <p>Hello ${to.name},</p>
          <p>The property inspection for <strong>${addr}</strong> has been scheduled${ctx.date ? ` for <strong>${ctx.date}</strong>` : ""}.</p>
          <p>Please ensure the property is accessible. The inspection typically takes 2-4 hours.</p>
          <p>${agent} will share the inspection report once it's received.</p>
          <p>Best regards,<br/>${agent}<br/>Reve Realtors — Baton Rouge, LA</p>
        `,
        sms: `AIRE: Inspection for ${addr} scheduled${ctx.date ? ` on ${ctx.date}` : ""}. Please ensure access. ${agent}`,
      }

    case "inspection_complete":
      return {
        subject: `Inspection Complete — ${addr}`,
        body: `
          <p>Hello ${to.name},</p>
          <p>The inspection for <strong>${addr}</strong> has been completed.</p>
          <p>${ctx.notes || "The report is being reviewed. We'll be in touch with findings and next steps."}</p>
          <p>Best regards,<br/>${agent}<br/>Reve Realtors — Baton Rouge, LA</p>
        `,
        sms: `AIRE: Inspection complete for ${addr}. Report under review. ${agent} will follow up with details.`,
      }

    case "appraisal_ordered":
      return {
        subject: `Appraisal Ordered — ${addr}`,
        body: `
          <p>Hello ${to.name},</p>
          <p>The appraisal for <strong>${addr}</strong> has been ordered through the lender.</p>
          <p>The appraiser will contact you to schedule access. This typically takes 7-10 business days to complete.</p>
          <p>Best regards,<br/>${agent}<br/>Reve Realtors — Baton Rouge, LA</p>
        `,
        sms: `AIRE: Appraisal ordered for ${addr}. Appraiser will contact you to schedule. ${agent}`,
      }

    case "financing_approved":
      return {
        subject: `Financing Approved — ${addr}`,
        body: `
          <p>Hello ${to.name},</p>
          <p>Financing has been approved for <strong>${addr}</strong>. We are now clear to proceed toward the Act of Sale.</p>
          <p>${ctx.date ? `The closing is scheduled for <strong>${ctx.date}</strong>.` : "We'll confirm the closing date shortly."}</p>
          <p>Congratulations on reaching this milestone!</p>
          <p>Best regards,<br/>${agent}<br/>Reve Realtors — Baton Rouge, LA</p>
        `,
        sms: `AIRE: Financing approved for ${addr}! ${ctx.date ? `Closing scheduled ${ctx.date}.` : "Closing date coming soon."} ${agent}`,
      }

    case "closing_reminder":
      return {
        subject: `Closing Reminder — ${addr}${ctx.date ? ` on ${ctx.date}` : ""}`,
        body: `
          <p>Hello ${to.name},</p>
          <p>This is a reminder that the Act of Sale for <strong>${addr}</strong>${ctx.date ? ` is scheduled for <strong>${ctx.date}</strong>` : " is approaching"}.</p>
          <p>Please bring a valid photo ID and any required funds (certified check or wire transfer).</p>
          <p>If you have any last-minute questions, please don't hesitate to reach out.</p>
          <p>Best regards,<br/>${agent}<br/>Reve Realtors — Baton Rouge, LA</p>
        `,
        sms: `AIRE: Closing reminder for ${addr}${ctx.date ? ` on ${ctx.date}` : ""}. Bring ID and funds. Questions? Contact ${agent}.`,
      }

    case "document_request":
      return {
        subject: `Document Needed — ${ctx.documentName || "Required Document"} for ${addr}`,
        body: `
          <p>Hello ${to.name},</p>
          <p>We need the following document for the transaction at <strong>${addr}</strong>:</p>
          <p><strong>${ctx.documentName || "Required Document"}</strong></p>
          <p>${ctx.notes || "Please provide this at your earliest convenience to keep the transaction on track."}</p>
          <p>You can reply to this email with the document attached, or contact ${agent} for other delivery options.</p>
          <p>Best regards,<br/>${agent}<br/>Reve Realtors — Baton Rouge, LA</p>
        `,
        sms: `AIRE: Document needed for ${addr}: ${ctx.documentName || "Required document"}. Please submit ASAP. ${agent}`,
      }

    case "deadline_reminder":
      return {
        subject: `Deadline Approaching — ${ctx.deadlineName || "Important Deadline"} for ${addr}`,
        body: `
          <p>Hello ${to.name},</p>
          <p>A deadline is approaching for the transaction at <strong>${addr}</strong>:</p>
          <p><strong>${ctx.deadlineName}</strong>${ctx.date ? ` — due <strong>${ctx.date}</strong>` : ""}</p>
          <p>${ctx.notes || "Please ensure all required actions are completed before this date."}</p>
          <p>Best regards,<br/>${agent}<br/>Reve Realtors — Baton Rouge, LA</p>
        `,
        sms: `AIRE: Deadline for ${addr}: ${ctx.deadlineName}${ctx.date ? ` due ${ctx.date}` : ""}. Action needed. ${agent}`,
      }

    case "status_update":
      return {
        subject: `Transaction Update — ${addr}`,
        body: `
          <p>Hello ${to.name},</p>
          <p>Here's an update on the transaction at <strong>${addr}</strong>:</p>
          <p><strong>Status:</strong> ${ctx.status || "Updated"}</p>
          ${ctx.notes ? `<p>${ctx.notes}</p>` : ""}
          <p>${agent} is monitoring all deadlines and will keep you informed of next steps.</p>
          <p>Best regards,<br/>${agent}<br/>Reve Realtors — Baton Rouge, LA</p>
        `,
        sms: `AIRE: Update on ${addr} — ${ctx.status || "status updated"}. ${agent} will follow up with details.`,
      }
  }
}

// ─── EMAIL WRAPPER ──────────────────────────────────────────────────────────

function wrapEmailHtml(bodyHtml: string): string {
  return `
    <div style="font-family: 'Space Grotesk', Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1e2416;">
      <div style="background: #9aab7e; padding: 16px 24px; border-radius: 8px 8px 0 0;">
        <p style="margin: 0; color: #f5f2ea; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase;">AIRE Transaction Coordinator</p>
      </div>
      <div style="background: #f5f2ea; padding: 24px; border-radius: 0 0 8px 8px; font-size: 14px; line-height: 1.6;">
        ${bodyHtml}
      </div>
    </div>
  `.trim()
}

// ─── DISPATCH ───────────────────────────────────────────────────────────────

async function sendEmail(to: string, subject: string, html: string): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.log(`[TC Comms/Email-DEV] To: ${to} | Subject: ${subject}`)
    return { ok: true }
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "AIRE TC <tc@aireintel.org>", to, subject, html }),
    })
    if (!res.ok) return { ok: false, error: `Resend ${res.status}` }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

async function sendSms(to: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_PHONE_NUMBER

  if (!sid || !token || !from || !to) {
    console.log(`[TC Comms/SMS-DEV] To: ${to}\n${body}`)
    return { ok: true }
  }

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
    })
    if (!res.ok) return { ok: false, error: `Twilio ${res.status}` }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

// ─── PUBLIC API ─────────────────────────────────────────────────────────────

/**
 * Generate a communication message from a template.
 */
export function generateMessage(
  type: TemplateType,
  ctx: TemplateContext,
  to: PartyInfo
): CommunicationMessage {
  const t = template(type, ctx, to)
  return {
    to,
    subject: t.subject,
    body: wrapEmailHtml(t.body),
    smsBody: t.sms,
    templateType: type,
  }
}

/**
 * Send a templated communication to a party via email + SMS.
 *
 * TCPA note: when `userId` is supplied, SMS is routed through
 * `sendSmsWithConsent` and is silently skipped if no active ClientConsent row
 * exists for (userId, party.phone, SMS). Legacy callers without userId still
 * work for email, but SMS will be skipped with `smsSkipReason: "NO_USER_CTX"`.
 */
export async function sendPartyUpdate(
  type: TemplateType,
  ctx: TemplateContext,
  to: PartyInfo,
  transactionId?: string,
  userId?: string
): Promise<SendResult> {
  const msg = generateMessage(type, ctx, to)
  const result: SendResult = { party: to.name, role: to.role, emailSent: false, smsSent: false }

  if (to.email) {
    const emailRes = await sendEmail(to.email, msg.subject, msg.body)
    result.emailSent = emailRes.ok
    result.emailError = emailRes.error
  }

  if (to.phone) {
    if (!userId) {
      result.smsSkipped = true
      result.smsSkipReason = "NO_USER_CTX"
      console.warn(`[TC Comms] SMS skipped — no userId passed for consent check`)
    } else {
      const { sendSmsWithConsent } = await import("@/lib/consent")
      const smsRes = await sendSmsWithConsent({ userId, to: to.phone, body: msg.smsBody })
      if (smsRes.skipped) {
        result.smsSkipped = true
        result.smsSkipReason = smsRes.reason
      } else {
        result.smsSent = smsRes.ok
        result.smsError = smsRes.error
      }
    }
  }

  // Log to WorkflowEvent for transaction timeline
  if (transactionId) {
    try {
      const { default: prisma } = await import("@/lib/prisma")
      await prisma.workflowEvent.create({
        data: {
          transactionId,
          fromStatus: null,
          toStatus: "party_communication",
          trigger: "system",
          triggeredBy: "tc_agent",
          metadata: JSON.parse(JSON.stringify({
            templateType: type,
            recipientName: to.name,
            recipientRole: to.role,
            channel: [to.email ? "email" : null, to.phone ? "sms" : null].filter(Boolean),
            emailSent: result.emailSent,
            smsSent: result.smsSent,
          })),
        },
      })
    } catch {
      // Non-fatal — logging shouldn't block communication
    }
  }

  console.log(`[TC Comms] ${type} → ${to.name} (${to.role}): email=${result.emailSent}, sms=${result.smsSent}`)
  return result
}

/**
 * Send a transaction update to all relevant parties.
 */
export async function notifyAllParties(
  type: TemplateType,
  ctx: TemplateContext,
  parties: PartyInfo[],
  transactionId?: string,
  userId?: string
): Promise<SendResult[]> {
  const results: SendResult[] = []
  for (const party of parties) {
    const r = await sendPartyUpdate(type, ctx, party, transactionId, userId)
    results.push(r)
  }
  return results
}
