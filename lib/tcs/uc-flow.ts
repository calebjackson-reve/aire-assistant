// lib/tcs/uc-flow.ts
// Day 9: Orchestrator for additional Under-Contract automations that run
// AFTER the Day 6 offer-to-uc pipeline (PA draft + PA envelope + deadlines +
// 5 auto-message drafts).
//
// Adds:
//   1. Inspector scheduling — upgrades the placeholder inspector draft with
//      the agent's preferred inspector from Vendor.
//   2. Earnest money envelope — mints an EM receipt PDF and creates an
//      AirSign DRAFT envelope addressed to the preferred title company.
//
// Both tools are idempotent and isolated: a failure in one does not block
// the other. Results are returned as SilentActions for the conversation rail.

import type { SilentAction } from "./stage-actions"
import { scheduleInspectorTool } from "./tools/schedule-inspector"
import { earnestMoneyToTitleTool } from "./tools/earnest-money-to-title"

export interface UcFlowInput {
  sessionId: string
  userId: string
  transactionId: string
  answers: Record<string, unknown>
}

export interface UcFlowResult {
  actions: SilentAction[]
  inspector: { communicationLogId: string | null; preferredUsed: boolean; ok: boolean }
  earnestMoney: { envelopeId: string | null; documentId: string | null; preferredUsed: boolean; ok: boolean }
}

export async function runUcFlow(input: UcFlowInput): Promise<UcFlowResult> {
  const { sessionId, userId, transactionId, answers } = input
  const actions: SilentAction[] = []

  // 1. Upgrade inspector draft
  let inspector: UcFlowResult["inspector"] = {
    communicationLogId: null,
    preferredUsed: false,
    ok: false,
  }
  try {
    const r = await scheduleInspectorTool({ sessionId, userId, transactionId })
    actions.push(r.action)
    inspector = {
      communicationLogId: r.communicationLogId,
      preferredUsed: r.preferredUsed,
      ok: r.ok,
    }
  } catch (err) {
    console.error("[TCS/uc-flow] schedule-inspector threw:", err)
  }

  // 2. Earnest money envelope
  let earnestMoney: UcFlowResult["earnestMoney"] = {
    envelopeId: null,
    documentId: null,
    preferredUsed: false,
    ok: false,
  }
  try {
    const r = await earnestMoneyToTitleTool({
      sessionId,
      userId,
      transactionId,
      earnestAmount: (answers["offer.earnestMoney"] as string | undefined) ?? null,
    })
    actions.push(r.action)
    earnestMoney = {
      envelopeId: r.envelopeId,
      documentId: r.documentId,
      preferredUsed: r.preferredUsed,
      ok: r.ok,
    }
  } catch (err) {
    console.error("[TCS/uc-flow] earnest-money threw:", err)
  }

  return { actions, inspector, earnestMoney }
}
