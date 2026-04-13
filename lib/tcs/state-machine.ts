// lib/tcs/state-machine.ts
// TCS stage orchestrator. Wraps the lower-level workflow/state-machine.ts
// with conversational-UI semantics: advance by stage completion, run stage
// actions on entry, persist session state.

import prisma from "@/lib/prisma"
import { advanceTransaction, type WorkflowTrigger } from "@/lib/workflow/state-machine"
import {
  TCS_STAGE_ORDER,
  TCS_STAGES,
  type TCSStage,
  stageComplete,
  nextQuestion,
} from "./stages"

export interface StageAdvanceResult {
  advanced: boolean
  fromStage: TCSStage
  toStage: TCSStage | null
  error?: string
}

/**
 * Get the next stage in the TCS sequence.
 */
export function nextStage(current: TCSStage): TCSStage | null {
  const idx = TCS_STAGE_ORDER.indexOf(current)
  if (idx < 0 || idx >= TCS_STAGE_ORDER.length - 1) return null
  return TCS_STAGE_ORDER[idx + 1]
}

/**
 * Check if a TCS session's current stage is complete and, if so, advance it.
 * Persists the new stage, logs the workflow event (if a Transaction is linked),
 * and returns whether an advance happened.
 */
export async function maybeAdvanceStage(
  sessionId: string,
  triggeredBy: string,
): Promise<StageAdvanceResult> {
  const session = await prisma.tCSSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      userId: true,
      transactionId: true,
      currentStage: true,
      answers: true,
    },
  })

  if (!session) {
    return { advanced: false, fromStage: "DRAFT", toStage: null, error: "Session not found" }
  }

  const fromStage = session.currentStage as TCSStage
  const answered = new Set(Object.keys((session.answers as Record<string, unknown>) || {}))

  if (!stageComplete(fromStage, answered)) {
    return { advanced: false, fromStage, toStage: null, error: "Stage not complete" }
  }

  const toStage = nextStage(fromStage)
  if (!toStage) {
    // Final stage — mark session complete
    await prisma.tCSSession.update({
      where: { id: sessionId },
      data: { completedAt: new Date() },
    })
    return { advanced: false, fromStage, toStage: null, error: "Already at final stage" }
  }

  // If we have a linked Transaction, try to move it via the canonical workflow state machine
  let workflowAdvance: WorkflowTrigger = "system"
  if (session.transactionId) {
    const result = await advanceTransaction({
      transactionId: session.transactionId,
      toStatus: toStage,
      trigger: workflowAdvance,
      triggeredBy,
      metadata: { tcsSessionId: sessionId, reason: "Stage complete in TCS" },
    })
    // If direct transition not allowed, we still advance the TCS session's
    // internal stage pointer — the workflow may auto-advance on downstream triggers.
    if (!result.success) {
      console.warn(`[TCS] Workflow advance ${fromStage} → ${toStage} rejected: ${result.error}`)
    }
  }

  await prisma.tCSSession.update({
    where: { id: sessionId },
    data: { currentStage: toStage },
  })

  return { advanced: true, fromStage, toStage }
}

/**
 * Given a session, return the next question the user should answer.
 * Returns null when the current stage is complete (caller should maybeAdvanceStage).
 */
export async function getNextQuestion(sessionId: string) {
  const session = await prisma.tCSSession.findUnique({
    where: { id: sessionId },
    select: { currentStage: true, answers: true },
  })
  if (!session) return null
  const answered = new Set(Object.keys((session.answers as Record<string, unknown>) || {}))
  return nextQuestion(session.currentStage as TCSStage, answered)
}

/**
 * Stage metadata for rendering the rail. Returned as ordered array with
 * an `isCurrent` / `isComplete` flag derived from the session's current stage.
 */
export function railFor(current: TCSStage) {
  const currentIdx = TCS_STAGE_ORDER.indexOf(current)
  return TCS_STAGE_ORDER.map((key, idx) => ({
    ...TCS_STAGES[key],
    isCurrent: idx === currentIdx,
    isComplete: idx < currentIdx,
    isFuture: idx > currentIdx,
  }))
}
