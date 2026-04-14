// lib/tcs/stages.ts
// The 8-stage TCS model. Single source of truth for stage metadata, ordering,
// quick-reply chips, question keys, and auto-doc expectations per stage.

import type { TransactionStatus } from "@prisma/client"

export type TCSStage =
  | "DRAFT"             // 1. Intake
  | "ACTIVE"            // 2. Offer
  | "UNDER_CONTRACT"    // 3. Under Contract
  | "PENDING_INSPECTION" // 4. Inspection
  | "PENDING_APPRAISAL"  // 5. Appraisal
  | "PENDING_FINANCING"  // 6. Financing
  | "CLOSING"            // 7. Closing
  | "POST_CLOSE"         // 8. Post-Close

export const TCS_STAGE_ORDER: TCSStage[] = [
  "DRAFT",
  "ACTIVE",
  "UNDER_CONTRACT",
  "PENDING_INSPECTION",
  "PENDING_APPRAISAL",
  "PENDING_FINANCING",
  "CLOSING",
  "POST_CLOSE",
]

export interface StageMeta {
  key: TCSStage
  label: string
  shortLabel: string
  description: string
  rail: number
}

export const TCS_STAGES: Record<TCSStage, StageMeta> = {
  DRAFT:              { key: "DRAFT",              label: "Intake",        shortLabel: "Intake",  description: "Capture the lead, property, parties.",           rail: 1 },
  ACTIVE:             { key: "ACTIVE",             label: "Offer",         shortLabel: "Offer",   description: "Draft and submit the purchase agreement.",       rail: 2 },
  UNDER_CONTRACT:     { key: "UNDER_CONTRACT",     label: "Under Contract", shortLabel: "UC",      description: "EM, disclosures, open inspection window.",      rail: 3 },
  PENDING_INSPECTION: { key: "PENDING_INSPECTION", label: "Inspection",    shortLabel: "Insp",    description: "Inspect, respond, negotiate repairs/credits.",  rail: 4 },
  PENDING_APPRAISAL:  { key: "PENDING_APPRAISAL",  label: "Appraisal",     shortLabel: "Apprl",   description: "Order, receive, handle value gaps.",             rail: 5 },
  PENDING_FINANCING:  { key: "PENDING_FINANCING",  label: "Financing",     shortLabel: "Fin",     description: "Conditions → commitment → clear to close.",      rail: 6 },
  CLOSING:            { key: "CLOSING",            label: "Closing",       shortLabel: "Close",   description: "CD, walk-through, Act of Sale.",                 rail: 7 },
  POST_CLOSE:         { key: "POST_CLOSE",         label: "Post-Close",    shortLabel: "Post",    description: "Review, referral, nurture, anniversary.",        rail: 8 },
}

export function stageRail(stage: TCSStage): number {
  return TCS_STAGES[stage].rail
}

export function isTCSStage(s: TransactionStatus): s is TCSStage {
  return TCS_STAGE_ORDER.includes(s as TCSStage)
}

// ─── QUESTION BANK ──────────────────────────────────────────────────────────
// Each question is the conversational prompt. Templates use {{var}} interpolation
// against prior answers. quickReplies are tappable chips; when null, a text input
// is shown. When `requires` lists prior answer keys, we gate the question until met.

export interface QuestionDef {
  key: string
  stage: TCSStage
  prompt: string
  helperHint?: string
  quickReplies?: { label: string; value: string }[] | null
  requires?: string[]
  orderHint: number
}

export const TCS_QUESTIONS: QuestionDef[] = [
  // ─── STAGE 1: INTAKE ─────────────────────────────────────────────────────
  {
    key: "intake.side",
    stage: "DRAFT",
    prompt: "Is this a buyer you're representing, or a listing you're taking?",
    quickReplies: [
      { label: "Buyer side", value: "BUYER" },
      { label: "Listing side", value: "LISTING" },
      { label: "Dual", value: "DUAL" },
    ],
    orderHint: 10,
  },
  {
    key: "intake.address",
    stage: "DRAFT",
    prompt: "What's the property address? I'll pull the MLS and parish records while we talk.",
    helperHint: "Start typing — I'll autocomplete from Paragon.",
    orderHint: 20,
  },
  {
    key: "intake.client",
    stage: "DRAFT",
    prompt: "Who's the client? Name plus phone or email — I'll match against your contacts.",
    orderHint: 30,
  },
  {
    key: "intake.competing",
    stage: "DRAFT",
    prompt: "Any other agent already on this, or are we first in?",
    quickReplies: [
      { label: "First in", value: "first" },
      { label: "Competing", value: "competing" },
      { label: "Unknown", value: "unknown" },
    ],
    orderHint: 40,
  },
  {
    key: "intake.listPrice",
    stage: "DRAFT",
    prompt: "What price are we thinking? I'll run a CMA in the background.",
    helperHint: "Round number is fine — I'll give you a band.",
    requires: ["intake.side"],
    orderHint: 50,
  },

  // ─── STAGE 2: OFFER ──────────────────────────────────────────────────────
  {
    key: "offer.price",
    stage: "ACTIVE",
    prompt: "What price are we offering?",
    orderHint: 10,
  },
  {
    key: "offer.financing",
    stage: "ACTIVE",
    prompt: "How's it funded?",
    quickReplies: [
      { label: "Cash", value: "CASH" },
      { label: "Conventional", value: "CONVENTIONAL" },
      { label: "FHA", value: "FHA" },
      { label: "VA", value: "VA" },
      { label: "USDA", value: "USDA" },
    ],
    orderHint: 20,
  },
  {
    key: "offer.earnestMoney",
    stage: "ACTIVE",
    prompt: "What earnest money amount, and when does it go hard?",
    helperHint: "E.g. $2,500 — becomes non-refundable after inspection.",
    orderHint: 30,
  },
  {
    key: "offer.inspectionDays",
    stage: "ACTIVE",
    prompt: "Inspection window — standard 10 days, or different?",
    quickReplies: [
      { label: "10 days", value: "10" },
      { label: "7 days", value: "7" },
      { label: "14 days", value: "14" },
      { label: "Waived", value: "0" },
    ],
    orderHint: 40,
  },
  {
    key: "offer.closingDate",
    stage: "ACTIVE",
    prompt: "Target closing date?",
    helperHint: "I'll make sure the financing timeline works.",
    orderHint: 50,
  },

  // ─── STAGE 3: UNDER CONTRACT ─────────────────────────────────────────────
  {
    key: "uc.titleCompany",
    stage: "UNDER_CONTRACT",
    prompt: "Which title company? I'll send wire instructions + EM receipt request.",
    orderHint: 10,
  },
  {
    key: "uc.disclosures",
    stage: "UNDER_CONTRACT",
    prompt: "Do we have property disclosures yet, or should I chase the listing agent?",
    quickReplies: [
      { label: "Have them", value: "have" },
      { label: "Chase them", value: "chase" },
    ],
    orderHint: 20,
  },
  {
    key: "uc.inspector",
    stage: "UNDER_CONTRACT",
    prompt: "Which inspector — yours or mine? I can book immediately.",
    orderHint: 30,
  },
  {
    key: "uc.lenderSent",
    stage: "UNDER_CONTRACT",
    prompt: "Has the lender received the executed PA + disclosures?",
    quickReplies: [
      { label: "Send it now", value: "send" },
      { label: "Already done", value: "done" },
    ],
    orderHint: 40,
  },

  // ─── STAGE 4: INSPECTION ─────────────────────────────────────────────────
  {
    key: "insp.outcome",
    stage: "PENDING_INSPECTION",
    prompt: "Inspection's done. Deal-breakers, or mostly cosmetic?",
    quickReplies: [
      { label: "Clean", value: "clean" },
      { label: "Minor", value: "minor" },
      { label: "Major issues", value: "major" },
    ],
    orderHint: 10,
  },
  {
    key: "insp.response",
    stage: "PENDING_INSPECTION",
    prompt: "Repairs, credit, or walk?",
    quickReplies: [
      { label: "Request repairs", value: "repairs" },
      { label: "Credit instead", value: "credit" },
      { label: "Walk", value: "walk" },
      { label: "Accept as-is", value: "accept" },
    ],
    requires: ["insp.outcome"],
    orderHint: 20,
  },
  {
    key: "insp.amount",
    stage: "PENDING_INSPECTION",
    prompt: "What number are we asking for?",
    requires: ["insp.response"],
    orderHint: 30,
  },
  {
    key: "insp.send",
    stage: "PENDING_INSPECTION",
    prompt: "Send the response addendum to the listing agent now, or wait?",
    quickReplies: [
      { label: "Send now", value: "now" },
      { label: "Wait — let me review", value: "wait" },
    ],
    orderHint: 40,
  },

  // ─── STAGE 5: APPRAISAL ──────────────────────────────────────────────────
  {
    key: "apprl.outcome",
    stage: "PENDING_APPRAISAL",
    prompt: "Did the appraisal come in at value, low, or high?",
    quickReplies: [
      { label: "At value", value: "at" },
      { label: "Low", value: "low" },
      { label: "High", value: "high" },
    ],
    orderHint: 10,
  },
  {
    key: "apprl.response",
    stage: "PENDING_APPRAISAL",
    prompt: "Renegotiate, pay the gap, or kill it?",
    quickReplies: [
      { label: "Renegotiate", value: "renegotiate" },
      { label: "Pay the gap", value: "gap" },
      { label: "Kill", value: "kill" },
    ],
    requires: ["apprl.outcome"],
    orderHint: 20,
  },
  {
    key: "apprl.lender",
    stage: "PENDING_APPRAISAL",
    prompt: "Lender okay to proceed without modification?",
    quickReplies: [
      { label: "Yes, proceed", value: "yes" },
      { label: "Needs amendment", value: "amend" },
    ],
    orderHint: 30,
  },

  // ─── STAGE 6: FINANCING ──────────────────────────────────────────────────
  {
    key: "fin.outstanding",
    stage: "PENDING_FINANCING",
    prompt: "Lender needs anything else — tax returns, bank statements, explanation letters?",
    orderHint: 10,
  },
  {
    key: "fin.commitment",
    stage: "PENDING_FINANCING",
    prompt: "Commitment letter status?",
    quickReplies: [
      { label: "In hand", value: "in_hand" },
      { label: "Pending", value: "pending" },
    ],
    orderHint: 20,
  },
  {
    key: "fin.risks",
    stage: "PENDING_FINANCING",
    prompt: "Any red flags — job change, new credit inquiry, gifts?",
    quickReplies: [
      { label: "None", value: "none" },
      { label: "Flag something", value: "flag" },
    ],
    orderHint: 30,
  },

  // ─── STAGE 7: CLOSING ────────────────────────────────────────────────────
  {
    key: "close.cdDelivered",
    stage: "CLOSING",
    prompt: "Closing Disclosure received by client? CFPB requires 3 business days before closing.",
    quickReplies: [
      { label: "Yes — confirmed", value: "yes" },
      { label: "Not yet", value: "no" },
    ],
    orderHint: 10,
  },
  {
    key: "close.walkthrough",
    stage: "CLOSING",
    prompt: "Walk-through — morning of closing or day before?",
    quickReplies: [
      { label: "Morning of", value: "morning" },
      { label: "Day before", value: "day_before" },
    ],
    orderHint: 20,
  },
  {
    key: "close.funds",
    stage: "CLOSING",
    prompt: "Client bringing certified funds or wiring?",
    quickReplies: [
      { label: "Certified check", value: "check" },
      { label: "Wire", value: "wire" },
    ],
    orderHint: 30,
  },
  {
    key: "close.utilities",
    stage: "CLOSING",
    prompt: "Utilities transferred yet? I can send the parish-specific checklist.",
    quickReplies: [
      { label: "Send checklist", value: "send" },
      { label: "Already done", value: "done" },
    ],
    orderHint: 40,
  },

  // ─── STAGE 8: POST-CLOSE ─────────────────────────────────────────────────
  {
    key: "post.satisfaction",
    stage: "POST_CLOSE",
    prompt: "Client happy? Any issues at the table?",
    quickReplies: [
      { label: "Thrilled", value: "great" },
      { label: "Okay", value: "ok" },
      { label: "Issues", value: "issues" },
    ],
    orderHint: 10,
  },
  {
    key: "post.review",
    stage: "POST_CLOSE",
    prompt: "Ask for a review now, or wait a week?",
    quickReplies: [
      { label: "Ask now", value: "now" },
      { label: "Wait a week", value: "week" },
      { label: "Skip", value: "skip" },
    ],
    orderHint: 20,
  },
  {
    key: "post.referrals",
    stage: "POST_CLOSE",
    prompt: "Any referrals they mentioned?",
    quickReplies: [
      { label: "None yet", value: "none" },
      { label: "Capture names", value: "capture" },
    ],
    orderHint: 30,
  },
]

export function questionsForStage(stage: TCSStage): QuestionDef[] {
  return TCS_QUESTIONS.filter((q) => q.stage === stage).sort((a, b) => a.orderHint - b.orderHint)
}

export function getQuestion(key: string): QuestionDef | undefined {
  return TCS_QUESTIONS.find((q) => q.key === key)
}

/**
 * Given the set of answered question keys for this session + current stage,
 * return the next unanswered question whose `requires` are met, or null.
 */
export function nextQuestion(
  stage: TCSStage,
  answered: Set<string>,
): QuestionDef | null {
  const stageQs = questionsForStage(stage)
  for (const q of stageQs) {
    if (answered.has(q.key)) continue
    if (q.requires && !q.requires.every((r) => answered.has(r))) continue
    return q
  }
  return null
}

/**
 * Has the current stage collected every question's answer?
 * All stage questions are treated as required. Optional questions
 * would need an explicit `optional: true` on QuestionDef — not yet used.
 */
export function stageComplete(stage: TCSStage, answered: Set<string>): boolean {
  return questionsForStage(stage).every((q) => answered.has(q.key))
}
