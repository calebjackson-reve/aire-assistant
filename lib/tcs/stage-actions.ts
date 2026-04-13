// lib/tcs/stage-actions.ts
// Silent, per-stage side effects. Every answer can trigger MLS lookups, CMA runs,
// auto-doc drafts, auto-deadline creation, auto-message composition. Results are
// logged to TCSSession.silentActions for the UI to render.

import prisma from "@/lib/prisma"
import type { Prisma, TransactionStatus } from "@prisma/client"
import type { TCSStage } from "./stages"

export interface SilentAction {
  at: string              // ISO timestamp
  kind:
    | "data_pull"
    | "doc_drafted"
    | "deadline_created"
    | "message_drafted"
    | "transaction_created"
    | "stage_entered"
    | "note"
  summary: string
  payload?: Record<string, unknown>
}

/** Append a silent action to a TCS session. */
export async function logAction(sessionId: string, action: Omit<SilentAction, "at">) {
  const full: SilentAction = { ...action, at: new Date().toISOString() }
  const session = await prisma.tCSSession.findUnique({
    where: { id: sessionId },
    select: { silentActions: true },
  })
  const existing = (session?.silentActions as unknown as SilentAction[]) ?? []
  await prisma.tCSSession.update({
    where: { id: sessionId },
    data: { silentActions: [...existing, full] as unknown as Prisma.InputJsonValue },
  })
  return full
}

/** Update accumulated answers JSON on the session. */
export async function recordAnswer(sessionId: string, key: string, value: unknown) {
  const session = await prisma.tCSSession.findUnique({
    where: { id: sessionId },
    select: { answers: true, messages: true },
  })
  const answers = { ...((session?.answers as Record<string, unknown>) || {}), [key]: value }
  const messages = ((session?.messages as unknown as ChatMessage[]) || []).concat([
    { role: "user", at: new Date().toISOString(), content: formatAnswer(value) },
  ])
  await prisma.tCSSession.update({
    where: { id: sessionId },
    data: {
      answers: answers as Prisma.InputJsonValue,
      messages: messages as unknown as Prisma.InputJsonValue,
    },
  })
  return answers
}

export interface ChatMessage {
  role: "aire" | "user" | "system"
  at: string
  content: string
  questionKey?: string
}

export async function appendAireMessage(
  sessionId: string,
  content: string,
  questionKey?: string,
) {
  const session = await prisma.tCSSession.findUnique({
    where: { id: sessionId },
    select: { messages: true },
  })
  const messages = ((session?.messages as unknown as ChatMessage[]) || []).concat([
    { role: "aire", at: new Date().toISOString(), content, questionKey },
  ])
  await prisma.tCSSession.update({
    where: { id: sessionId },
    data: { messages: messages as unknown as Prisma.InputJsonValue },
  })
}

/**
 * Parse a freeform contact string like:
 *   "Jane Doe / jane@ex.com"
 *   "Jane Doe (jane@ex.com)"
 *   "Jane Doe - 225-555-1212"
 *   "Jane Doe jane@ex.com 225-555-1212"
 * into structured name/email/phone. Best-effort; anything not matched
 * is returned as the name.
 */
export function parseContact(raw: string): {
  name: string
  email: string | null
  phone: string | null
} {
  const s = raw.trim()
  if (!s) return { name: "", email: null, phone: null }
  const emailMatch = s.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)
  const phoneMatch = s.match(/\+?\d[\d\s().-]{8,}\d/)
  let name = s
  if (emailMatch) name = name.replace(emailMatch[0], "")
  if (phoneMatch) name = name.replace(phoneMatch[0], "")
  name = name.replace(/[/|\-()]+/g, " ").replace(/\s+/g, " ").trim()
  return {
    name,
    email: emailMatch?.[0] ?? null,
    phone: phoneMatch?.[0]?.replace(/[^\d+]/g, "") ?? null,
  }
}

function formatAnswer(v: unknown): string {
  if (v === null || v === undefined) return ""
  if (typeof v === "string") return v
  if (typeof v === "number") return String(v)
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

// ─── PER-ANSWER HANDLERS ─────────────────────────────────────────────────────
// Each handler inspects the answer, runs any silent side effect, and logs.
// Return any actions performed so the UI can render them as they happen.

type Handler = (args: {
  sessionId: string
  userId: string
  transactionId: string | null
  answer: unknown
  allAnswers: Record<string, unknown>
}) => Promise<SilentAction[]>

const HANDLERS: Record<string, Handler> = {
  "intake.address": async ({ sessionId, answer }) => {
    const address = String(answer ?? "").trim()
    if (!address) return []
    // Placeholder silent pulls. Real MLS/parish lookups already exist in
    // lib/paragon/* and lib/data/* — wiring those in is left for day 3.
    const actions: SilentAction[] = []
    actions.push(
      await logAction(sessionId, {
        kind: "data_pull",
        summary: `MLS lookup queued for ${address}`,
        payload: { address, source: "paragon" },
      }),
    )
    actions.push(
      await logAction(sessionId, {
        kind: "data_pull",
        summary: `Parish assessor + flood-zone check queued`,
        payload: { address, source: "parish_assessor" },
      }),
    )
    return actions
  },

  "intake.listPrice": async ({ sessionId, answer, allAnswers }) => {
    const price = Number(String(answer).replace(/[^0-9.]/g, ""))
    if (!price || !allAnswers["intake.address"]) return []
    return [
      await logAction(sessionId, {
        kind: "data_pull",
        summary: `CMA running — target band around $${price.toLocaleString()}`,
        payload: { target: price },
      }),
    ]
  },

  "intake.client": async ({ sessionId, answer }) => {
    const contact = String(answer ?? "")
    if (!contact) return []
    return [
      await logAction(sessionId, {
        kind: "data_pull",
        summary: `Contact match queued (${contact.slice(0, 40)})`,
        payload: { raw: contact },
      }),
    ]
  },

  "offer.price": async ({ sessionId, answer }) => {
    const price = Number(String(answer).replace(/[^0-9.]/g, ""))
    if (!price) return []
    return [
      await logAction(sessionId, {
        kind: "data_pull",
        summary: `Offer-gap analysis queued at $${price.toLocaleString()}`,
        payload: { offer: price },
      }),
    ]
  },

  "offer.closingDate": async ({ sessionId, answer }) => {
    return [
      await logAction(sessionId, {
        kind: "deadline_created",
        summary: `Closing date anchored — deadlines cascade from here`,
        payload: { closingDate: answer },
      }),
    ]
  },
}

/**
 * Route an answered question through the correct handler (if any).
 * Always returns the actions list (possibly empty).
 */
export async function runAnswerHandlers(args: {
  sessionId: string
  userId: string
  transactionId: string | null
  questionKey: string
  answer: unknown
  allAnswers: Record<string, unknown>
}): Promise<SilentAction[]> {
  const handler = HANDLERS[args.questionKey]
  if (!handler) return []
  try {
    return await handler(args)
  } catch (err) {
    console.error(`[TCS] Handler ${args.questionKey} threw:`, err)
    return [
      await logAction(args.sessionId, {
        kind: "note",
        summary: `Background lookup for ${args.questionKey} failed — continuing`,
        payload: { error: String(err) },
      }),
    ]
  }
}

// ─── STAGE-ENTRY HANDLERS ────────────────────────────────────────────────────
// Fire once when a stage becomes current. Creates Transaction rows, drafts LREC
// PAs, generates addenda, etc.

type StageEntryHandler = (args: {
  sessionId: string
  userId: string
  transactionId: string | null
  answers: Record<string, unknown>
}) => Promise<SilentAction[]>

const STAGE_ENTRY: Partial<Record<TCSStage, StageEntryHandler>> = {
  ACTIVE: async ({ sessionId, userId, transactionId, answers }) => {
    // First entry to Offer stage — ensure we have a Transaction row created
    // from the intake answers. If one already exists (resumed session), no-op.
    if (transactionId) return []
    const address = String(answers["intake.address"] ?? "").trim()
    if (!address) return []

    // Parse "Name / email@domain" or "Name (email@domain)" or "Name - phone"
    const clientRaw = String(answers["intake.client"] ?? "")
    const { name: clientName, email: clientEmail, phone: clientPhone } = parseContact(clientRaw)
    const side = String(answers["intake.side"] ?? "")

    const tx = await prisma.transaction.create({
      data: {
        userId,
        propertyAddress: address,
        status: "ACTIVE",
        buyerName:
          side === "BUYER" || side === "DUAL" ? clientName || null : null,
        buyerEmail:
          side === "BUYER" || side === "DUAL" ? clientEmail || null : null,
        buyerPhone:
          side === "BUYER" || side === "DUAL" ? clientPhone || null : null,
        sellerName:
          side === "LISTING" || side === "DUAL" ? clientName || null : null,
        sellerEmail:
          side === "LISTING" || side === "DUAL" ? clientEmail || null : null,
        sellerPhone:
          side === "LISTING" || side === "DUAL" ? clientPhone || null : null,
        listPrice: answers["intake.listPrice"]
          ? Number(String(answers["intake.listPrice"]).replace(/[^0-9.]/g, "")) || null
          : null,
      },
    })

    await prisma.tCSSession.update({
      where: { id: sessionId },
      data: { transactionId: tx.id },
    })

    return [
      await logAction(sessionId, {
        kind: "transaction_created",
        summary: `Transaction row created for ${address}`,
        payload: { transactionId: tx.id },
      }),
      await logAction(sessionId, {
        kind: "stage_entered",
        summary: `Offer stage — ready to draft the purchase agreement`,
      }),
    ]
  },

  UNDER_CONTRACT: async ({ sessionId, userId, transactionId, answers }) => {
    const actions: SilentAction[] = []
    actions.push(
      await logAction(sessionId, {
        kind: "stage_entered",
        summary: `Under contract — drafting PA, envelope, deadlines`,
      }),
    )
    if (!transactionId) {
      actions.push(
        await logAction(sessionId, {
          kind: "note",
          summary: `Cannot draft contract — transaction not yet linked`,
        }),
      )
      return actions
    }
    const { runOfferToUC } = await import("./offer-to-uc")
    const result = await runOfferToUC({ sessionId, userId, transactionId, answers })
    actions.push(...result.actions)
    return actions
  },

  PENDING_INSPECTION: async ({ sessionId }) => [
    await logAction(sessionId, {
      kind: "stage_entered",
      summary: `Inspection window open`,
    }),
  ],

  PENDING_APPRAISAL: async ({ sessionId }) => [
    await logAction(sessionId, {
      kind: "stage_entered",
      summary: `Appraisal stage`,
    }),
  ],

  PENDING_FINANCING: async ({ sessionId }) => [
    await logAction(sessionId, {
      kind: "stage_entered",
      summary: `Financing — tracking conditions + commitment`,
    }),
  ],

  CLOSING: async ({ sessionId }) => [
    await logAction(sessionId, {
      kind: "stage_entered",
      summary: `Closing — CD clock started`,
    }),
  ],

  POST_CLOSE: async ({ sessionId }) => [
    await logAction(sessionId, {
      kind: "stage_entered",
      summary: `Post-close — review + referral + anniversary queue`,
    }),
  ],
}

export async function runStageEntry(
  stage: TCSStage,
  args: Parameters<StageEntryHandler>[0],
): Promise<SilentAction[]> {
  const handler = STAGE_ENTRY[stage]
  if (!handler) return []
  try {
    return await handler(args)
  } catch (err) {
    console.error(`[TCS] Stage-entry ${stage} threw:`, err)
    return [
      await logAction(args.sessionId, {
        kind: "note",
        summary: `Stage-entry for ${stage} failed — continuing`,
        payload: { error: String(err) },
      }),
    ]
  }
}

/** Silence — used for transactions advanced without status bumps (cosmetic checks). */
export function typedStatus(s: TCSStage): TransactionStatus {
  return s as TransactionStatus
}
