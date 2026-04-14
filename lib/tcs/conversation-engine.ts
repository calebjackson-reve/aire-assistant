// lib/tcs/conversation-engine.ts
// The brain of TCS. Given a session + an answered question, this function:
//   1. Persists the answer and a chat message
//   2. Runs the per-answer silent action handler
//   3. Checks if the stage is complete; if so, advances + runs stage-entry
//   4. Picks the next question (from the new stage if we advanced)
//   5. Returns the next question, newly-logged actions, and stage info

import prisma from "@/lib/prisma"
import {
  maybeAdvanceStage,
  getNextQuestion,
  railFor,
} from "./state-machine"
import {
  recordAnswer,
  runAnswerHandlers,
  runStageEntry,
  appendAireMessage,
  type SilentAction,
} from "./stage-actions"
import { getQuestion, type TCSStage } from "./stages"

export interface AnswerTurn {
  session: {
    id: string
    transactionId: string | null
    currentStage: TCSStage
  }
  actions: SilentAction[]
  stageAdvanced: boolean
  fromStage: TCSStage
  nextQuestion: {
    key: string
    prompt: string
    helperHint?: string
    quickReplies?: { label: string; value: string }[] | null
  } | null
  complete: boolean
  rail: ReturnType<typeof railFor>
}

export async function submitAnswer(args: {
  sessionId: string
  userId: string
  questionKey: string
  answer: unknown
}): Promise<AnswerTurn> {
  const question = getQuestion(args.questionKey)
  if (!question) {
    throw new Error(`Unknown question key: ${args.questionKey}`)
  }

  const sessionBefore = await prisma.tCSSession.findUnique({
    where: { id: args.sessionId },
    select: { currentStage: true, transactionId: true },
  })
  if (!sessionBefore) throw new Error("Session not found")

  const fromStage = sessionBefore.currentStage as TCSStage

  // Guard — user answered a question out of current stage
  if (question.stage !== fromStage) {
    console.warn(
      `[TCS] Answer for ${args.questionKey} (stage ${question.stage}) submitted while session is in ${fromStage}`,
    )
  }

  // 1. Persist the answer
  const allAnswers = await recordAnswer(args.sessionId, args.questionKey, args.answer)

  // 2. Run per-answer side effects
  const actions = await runAnswerHandlers({
    sessionId: args.sessionId,
    userId: args.userId,
    transactionId: sessionBefore.transactionId,
    questionKey: args.questionKey,
    answer: args.answer,
    allAnswers,
  })

  // 3. Try to advance the stage if this answer completed it
  const advanceResult = await maybeAdvanceStage(args.sessionId, args.userId)

  if (advanceResult.advanced && advanceResult.toStage) {
    // Refresh session to read the freshly-linked transactionId after stage entry
    const entryActions = await runStageEntry(advanceResult.toStage, {
      sessionId: args.sessionId,
      userId: args.userId,
      transactionId: sessionBefore.transactionId,
      answers: allAnswers,
    })
    actions.push(...entryActions)
  }

  // 4. Pick next question
  const next = await getNextQuestion(args.sessionId)

  if (next) {
    await appendAireMessage(args.sessionId, next.prompt, next.key)
  }

  // 5. Reload session final state
  const sessionAfter = await prisma.tCSSession.findUnique({
    where: { id: args.sessionId },
    select: { id: true, transactionId: true, currentStage: true },
  })
  if (!sessionAfter) throw new Error("Session disappeared")

  return {
    session: {
      id: sessionAfter.id,
      transactionId: sessionAfter.transactionId,
      currentStage: sessionAfter.currentStage as TCSStage,
    },
    actions,
    stageAdvanced: advanceResult.advanced,
    fromStage,
    nextQuestion: next
      ? {
          key: next.key,
          prompt: next.prompt,
          helperHint: next.helperHint,
          quickReplies: next.quickReplies ?? null,
        }
      : null,
    complete: !next && sessionAfter.currentStage === "POST_CLOSE",
    rail: railFor(sessionAfter.currentStage as TCSStage),
  }
}

/**
 * Create a fresh TCS session for a user. Seeds with the first AIRE opening message.
 */
export async function createSession(userId: string, side?: string) {
  const session = await prisma.tCSSession.create({
    data: {
      userId,
      side: side ?? "BUYER",
      currentStage: "DRAFT",
      messages: [
        {
          role: "aire",
          at: new Date().toISOString(),
          content:
            "Let's walk through this deal together. I'll ask a few questions — everything else I'll handle in the background.",
        },
      ],
    },
    select: { id: true, currentStage: true, messages: true },
  })
  const first = await getNextQuestion(session.id)
  if (first) {
    await appendAireMessage(session.id, first.prompt, first.key)
  }
  return {
    sessionId: session.id,
    currentStage: session.currentStage as TCSStage,
    firstQuestion: first
      ? {
          key: first.key,
          prompt: first.prompt,
          helperHint: first.helperHint,
          quickReplies: first.quickReplies ?? null,
        }
      : null,
    rail: railFor(session.currentStage as TCSStage),
  }
}
