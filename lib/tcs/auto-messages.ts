// lib/tcs/auto-messages.ts
// Day 6: On UNDER_CONTRACT entry, draft the 5 canonical outbound messages a
// competent TC would send. Every draft is a CommunicationLog row with
// status="draft" — NEVER auto-sent. Agent one-taps approve to dispatch.
//
// The 5 drafts:
//   1. Buyer offer summary (what was offered, what happens next)
//   2. Listing agent intro (cover letter / competing-offer positioning)
//   3. Three-way title intro (buyer + agent + title company)
//   4. Three-way lender intro (buyer + agent + lender)
//   5. Inspector booking request (property access, dates)

import prisma from "@/lib/prisma"
import { logAction, type SilentAction } from "./stage-actions"

// ─── Types ──────────────────────────────────────────────────────────────────

export type TCSMessageKind =
  | "buyer_offer_summary"
  | "listing_agent_intro"
  | "title_intro"
  | "lender_intro"
  | "inspector_booking"

interface DraftInput {
  kind: TCSMessageKind
  toAddress: string // "email" or "email1, email2" for 3-way; always store human-readable
  subject: string
  bodyPreview: string // first 280 chars
  body: string // full HTML
}

interface Ctx {
  propertyAddress: string
  agentName: string
  agentEmail: string
  buyerName: string | null
  buyerEmail: string | null
  sellerName: string | null
  sellerEmail: string | null
  lenderName: string | null
  lenderEmail: string | null
  titleCompany: string | null
  titleEmail: string | null
  offerPrice: number | null
  earnestMoney: string | null
  closingDate: string | null
  inspectionDays: string | null
  financingType: string | null
}

// ─── Draft builders ─────────────────────────────────────────────────────────

function draftBuyerOfferSummary(c: Ctx): DraftInput | null {
  if (!c.buyerEmail) return null
  const priceLine = c.offerPrice ? `$${c.offerPrice.toLocaleString()}` : "the agreed price"
  const closeLine = c.closingDate ? ` and we're targeting closing on ${c.closingDate}` : ""
  const body = `
    <p>Hi ${c.buyerName ?? "there"},</p>
    <p>Congrats — we're officially under contract on <strong>${c.propertyAddress}</strong> at ${priceLine}${closeLine}.</p>
    <p>Here's what happens in the next ${c.inspectionDays ?? "10"} days:</p>
    <ul>
      <li>Earnest money delivered to the title company within 2 business days</li>
      <li>Property inspection scheduled and completed within ${c.inspectionDays ?? "10"} calendar days</li>
      <li>Any repair negotiations wrapped within 3 days of the inspection report</li>
    </ul>
    <p>I'll drive the coordination. You just need to approve decisions when they come up.</p>
    <p>— ${c.agentName}</p>
  `.trim()
  return {
    kind: "buyer_offer_summary",
    toAddress: c.buyerEmail,
    subject: `Under contract — ${c.propertyAddress}`,
    bodyPreview: `We're under contract at ${priceLine}${closeLine}. Inspection period opens now; earnest money in 2 business days.`.slice(0, 280),
    body,
  }
}

function draftListingAgentIntro(c: Ctx): DraftInput | null {
  // If we have a seller email we address it; otherwise draft addressed to
  // the agent as a placeholder — agent retargets before send.
  const to = c.sellerEmail ?? c.agentEmail ?? "listing-agent@placeholder.local"
  const body = `
    <p>Hello,</p>
    <p>Confirming we're executed on <strong>${c.propertyAddress}</strong>. A few housekeeping items:</p>
    <ul>
      <li>Earnest money will be delivered to the title company within 2 business days</li>
      <li>Inspection window is ${c.inspectionDays ?? "10"} days from today</li>
      <li>Target closing: ${c.closingDate ?? "TBD"}</li>
      ${c.financingType ? `<li>Financing: ${c.financingType.toUpperCase()}</li>` : ""}
    </ul>
    <p>Please forward property disclosures (or confirm if they've already been delivered) and any HOA documents at your earliest.</p>
    <p>Thanks,<br/>${c.agentName}</p>
  `.trim()
  return {
    kind: "listing_agent_intro",
    toAddress: to,
    subject: `Under contract — ${c.propertyAddress} — housekeeping`,
    bodyPreview: `Executed. EM in 2 days, ${c.inspectionDays ?? "10"}-day inspection, close ${c.closingDate ?? "TBD"}. Need disclosures + HOA docs.`.slice(0, 280),
    body,
  }
}

function draftTitleIntro(c: Ctx): DraftInput | null {
  if (!c.buyerEmail) return null
  const titleLine = c.titleCompany
    ? `the title company we've selected: <strong>${c.titleCompany}</strong>`
    : "the title company we'll be using"
  const to = c.titleEmail ? `${c.buyerEmail}, ${c.titleEmail}` : c.buyerEmail
  const body = `
    <p>Hi everyone,</p>
    <p>Introducing ${c.buyerName ?? "our buyer"} and ${titleLine}.</p>
    <p>Subject property: <strong>${c.propertyAddress}</strong>. Target closing ${c.closingDate ?? "TBD"}.</p>
    <p>Title team — when you have a chance, please send wire instructions for the earnest money deposit and confirm your title commitment timeline.</p>
    <p>${c.buyerName ?? "Buyer"} — any questions on the process, ping me or reply-all here.</p>
    <p>Thanks,<br/>${c.agentName}</p>
  `.trim()
  return {
    kind: "title_intro",
    toAddress: to,
    subject: `Intro — ${c.propertyAddress} — buyer + title`,
    bodyPreview: `Intro between buyer and title. Need wire instructions + commitment timeline. Closing ${c.closingDate ?? "TBD"}.`.slice(0, 280),
    body,
  }
}

function draftLenderIntro(c: Ctx): DraftInput | null {
  if (!c.buyerEmail) return null
  const lenderLine = c.lenderName ? `<strong>${c.lenderName}</strong>` : "the lender"
  const to = c.lenderEmail ? `${c.buyerEmail}, ${c.lenderEmail}` : c.buyerEmail
  const body = `
    <p>Hi everyone,</p>
    <p>Looping in ${lenderLine} now that we're under contract on <strong>${c.propertyAddress}</strong>.</p>
    <p>Key numbers for the lender file:</p>
    <ul>
      <li>Contract price: ${c.offerPrice ? `$${c.offerPrice.toLocaleString()}` : "see PA"}</li>
      <li>Target closing: ${c.closingDate ?? "TBD"}</li>
      ${c.financingType ? `<li>Loan type: ${c.financingType.toUpperCase()}</li>` : ""}
      <li>Inspection window: ${c.inspectionDays ?? "10"} days</li>
    </ul>
    <p>Lender — please confirm the commitment timeline and what you need from the buyer this week.</p>
    <p>Thanks,<br/>${c.agentName}</p>
  `.trim()
  return {
    kind: "lender_intro",
    toAddress: to,
    subject: `Intro — ${c.propertyAddress} — buyer + lender`,
    bodyPreview: `Looping lender in. Contract ${c.offerPrice ? "$" + c.offerPrice.toLocaleString() : ""}, close ${c.closingDate ?? "TBD"}. Need commitment timeline.`.slice(0, 280),
    body,
  }
}

function draftInspectorBooking(c: Ctx): DraftInput | null {
  const body = `
    <p>Hi,</p>
    <p>Requesting inspection booking for <strong>${c.propertyAddress}</strong>.</p>
    <ul>
      <li>Inspection window: ${c.inspectionDays ?? "10"} days from today (target completion earliest possible)</li>
      <li>Client: ${c.buyerName ?? "TBD"}</li>
      <li>Access: I'll coordinate through the listing side — let me know your earliest available slot and I'll lock it in</li>
    </ul>
    <p>Full inspection please (structure + systems + roof + termite if offered). Report as PDF at your usual turnaround.</p>
    <p>Thanks,<br/>${c.agentName}</p>
  `.trim()
  // Address is the agent's own email — inspector's address goes in the
  // review step. We use the agent's address as a placeholder "to" so the
  // draft appears in the outbox; the agent can retarget it on send.
  return {
    kind: "inspector_booking",
    toAddress: c.agentEmail || "inspector@placeholder.local",
    subject: `Inspection request — ${c.propertyAddress}`,
    bodyPreview: `Inspection request for ${c.propertyAddress}. ${c.inspectionDays ?? "10"}-day window, client ${c.buyerName ?? "TBD"}. Awaiting slot.`.slice(0, 280),
    body,
  }
}

// ─── Orchestrator ───────────────────────────────────────────────────────────

export interface AutoMessagesResult {
  actions: SilentAction[]
  draftedCount: number
  communicationLogIds: string[]
}

export async function runAutoMessages(args: {
  sessionId: string
  userId: string
  transactionId: string
  answers: Record<string, unknown>
}): Promise<AutoMessagesResult> {
  const actions: SilentAction[] = []
  const communicationLogIds: string[] = []

  const tx = await prisma.transaction.findUnique({
    where: { id: args.transactionId },
    select: {
      propertyAddress: true,
      buyerName: true,
      buyerEmail: true,
      sellerName: true,
      sellerEmail: true,
      lenderName: true,
      titleCompany: true,
      offerPrice: true,
      user: { select: { firstName: true, lastName: true, email: true } },
    },
  })
  if (!tx) {
    actions.push(
      await logAction(args.sessionId, {
        kind: "note",
        summary: "Cannot draft auto-messages — transaction not found",
      }),
    )
    return { actions, draftedCount: 0, communicationLogIds }
  }

  const ctx: Ctx = {
    propertyAddress: tx.propertyAddress,
    agentName:
      [tx.user?.firstName, tx.user?.lastName].filter(Boolean).join(" ").trim() ||
      "Your AIRE agent",
    agentEmail: tx.user?.email ?? "agent@aireintel.org",
    buyerName: tx.buyerName,
    buyerEmail: tx.buyerEmail,
    sellerName: tx.sellerName,
    sellerEmail: tx.sellerEmail,
    lenderName: tx.lenderName,
    lenderEmail: null, // Transaction doesn't carry lenderEmail yet
    titleCompany: tx.titleCompany,
    titleEmail: null, // Transaction doesn't carry titleEmail yet
    offerPrice: tx.offerPrice,
    earnestMoney: (args.answers["offer.earnestMoney"] as string | undefined) ?? null,
    closingDate: (args.answers["offer.closingDate"] as string | undefined) ?? null,
    inspectionDays: (args.answers["offer.inspectionDays"] as string | undefined) ?? null,
    financingType: (args.answers["offer.financing"] as string | undefined) ?? null,
  }

  const drafts: DraftInput[] = []
  const buyer = draftBuyerOfferSummary(ctx); if (buyer) drafts.push(buyer)
  const listing = draftListingAgentIntro(ctx); if (listing) drafts.push(listing)
  const title = draftTitleIntro(ctx); if (title) drafts.push(title)
  const lender = draftLenderIntro(ctx); if (lender) drafts.push(lender)
  const inspector = draftInspectorBooking(ctx); if (inspector) drafts.push(inspector)

  // Persist each as CommunicationLog with status="draft"
  for (const d of drafts) {
    try {
      const log = await prisma.communicationLog.create({
        data: {
          userId: args.userId,
          channel: "email",
          direction: "outbound",
          fromAddress: ctx.agentEmail,
          toAddress: d.toAddress,
          subject: d.subject,
          bodyPreview: d.bodyPreview,
          sentAt: new Date(),
          status: "draft",
          draftReply: d.body,
          metadata: {
            source: "tcs",
            tcsMessageKind: d.kind,
            transactionId: args.transactionId,
            sessionId: args.sessionId,
          },
        },
        select: { id: true },
      })
      communicationLogIds.push(log.id)
    } catch (err) {
      console.error(`[TCS/auto-messages] draft ${d.kind} failed:`, err)
    }
  }

  if (communicationLogIds.length > 0) {
    actions.push(
      await logAction(args.sessionId, {
        kind: "message_drafted",
        summary: `${communicationLogIds.length} messages drafted — review and send`,
        payload: {
          href: `/aire/communications?filter=drafts&transactionId=${args.transactionId}`,
          kinds: drafts.map((d) => d.kind),
          logIds: communicationLogIds,
        },
      }),
    )
  }

  return {
    actions,
    draftedCount: communicationLogIds.length,
    communicationLogIds,
  }
}
