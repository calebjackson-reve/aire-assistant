// lib/workflow/state-machine.ts
// Transaction lifecycle state machine for AIRE.
// Maps the existing TransactionStatus enum to allowed transitions,
// guard conditions, and auto-advance triggers.

import prisma from "@/lib/prisma"
import type { TransactionStatus } from "@prisma/client"

// ─── TRANSITION DEFINITIONS ──────────────────────────────────────────────────

export type WorkflowTrigger =
  | "document_uploaded"
  | "deadline_passed"
  | "deadline_completed"
  | "manual"
  | "voice_command"
  | "system"

interface TransitionRule {
  from: TransactionStatus
  to: TransactionStatus
  allowedTriggers: WorkflowTrigger[]
  guard?: (transactionId: string) => Promise<boolean>
  description: string
}

// All allowed state transitions. Any transition not listed here is rejected.
const TRANSITIONS: TransitionRule[] = [
  // DRAFT → ACTIVE: Agent starts working the deal
  {
    from: "DRAFT",
    to: "ACTIVE",
    allowedTriggers: ["manual", "voice_command", "document_uploaded"],
    description: "Activate a draft transaction",
  },
  // ACTIVE → UNDER_CONTRACT: Mutually signed PA, earnest money + disclosures in flight
  {
    from: "ACTIVE",
    to: "UNDER_CONTRACT",
    allowedTriggers: ["document_uploaded", "manual", "voice_command"],
    guard: async (txId) => {
      const contractDoc = await prisma.document.findFirst({
        where: {
          transactionId: txId,
          type: { in: ["purchase_agreement", "contract"] },
        },
      })
      return !!contractDoc
    },
    description: "Fully executed PA → under contract",
  },
  // UNDER_CONTRACT → PENDING_INSPECTION: Inspection window opens
  {
    from: "UNDER_CONTRACT",
    to: "PENDING_INSPECTION",
    allowedTriggers: ["document_uploaded", "manual", "voice_command", "deadline_completed"],
    description: "Open inspection period",
  },
  // Legacy direct ACTIVE → PENDING_INSPECTION kept for backward compat
  {
    from: "ACTIVE",
    to: "PENDING_INSPECTION",
    allowedTriggers: ["document_uploaded", "manual", "voice_command"],
    guard: async (txId) => {
      const contractDoc = await prisma.document.findFirst({
        where: {
          transactionId: txId,
          type: { in: ["purchase_agreement", "contract"] },
        },
      })
      return !!contractDoc
    },
    description: "Move to inspection period (requires signed contract)",
  },
  // PENDING_INSPECTION → PENDING_APPRAISAL: Inspection complete
  {
    from: "PENDING_INSPECTION",
    to: "PENDING_APPRAISAL",
    allowedTriggers: ["deadline_passed", "deadline_completed", "manual", "document_uploaded"],
    description: "Inspection period ended, move to appraisal",
  },
  // PENDING_APPRAISAL → PENDING_FINANCING: Appraisal received
  {
    from: "PENDING_APPRAISAL",
    to: "PENDING_FINANCING",
    allowedTriggers: ["deadline_completed", "document_uploaded", "manual"],
    description: "Appraisal complete, move to financing",
  },
  // PENDING_FINANCING → CLOSING: Financing approved, clear to close
  {
    from: "PENDING_FINANCING",
    to: "CLOSING",
    allowedTriggers: ["deadline_completed", "document_uploaded", "manual"],
    description: "Financing cleared, move to closing",
  },
  // CLOSING → CLOSED: Act of Sale executed
  {
    from: "CLOSING",
    to: "CLOSED",
    allowedTriggers: ["document_uploaded", "manual"],
    description: "Act of Sale complete — transaction closed",
  },
  // CLOSED → POST_CLOSE: 0–60 day post-close window (review, referral, nurture)
  {
    from: "CLOSED",
    to: "POST_CLOSE",
    allowedTriggers: ["manual", "system", "document_uploaded"],
    description: "Enter post-close nurture window",
  },
  // Any active status → CANCELLED
  {
    from: "DRAFT",
    to: "CANCELLED",
    allowedTriggers: ["manual", "voice_command"],
    description: "Cancel draft transaction",
  },
  {
    from: "ACTIVE",
    to: "CANCELLED",
    allowedTriggers: ["manual", "voice_command"],
    description: "Cancel active transaction",
  },
  {
    from: "PENDING_INSPECTION",
    to: "CANCELLED",
    allowedTriggers: ["manual", "voice_command"],
    description: "Cancel during inspection period",
  },
  {
    from: "PENDING_APPRAISAL",
    to: "CANCELLED",
    allowedTriggers: ["manual", "voice_command"],
    description: "Cancel during appraisal",
  },
  {
    from: "PENDING_FINANCING",
    to: "CANCELLED",
    allowedTriggers: ["manual", "voice_command"],
    description: "Cancel during financing",
  },
  {
    from: "CLOSING",
    to: "CANCELLED",
    allowedTriggers: ["manual", "voice_command"],
    description: "Cancel during closing",
  },
  {
    from: "UNDER_CONTRACT",
    to: "CANCELLED",
    allowedTriggers: ["manual", "voice_command"],
    description: "Cancel while under contract",
  },
]

// ─── STATE MACHINE ───────────────────────────────────────────────────────────

export interface AdvanceResult {
  success: boolean
  fromStatus: TransactionStatus
  toStatus: TransactionStatus | null
  eventId: string | null
  error?: string
}

/**
 * Advance a transaction to a new status.
 * Validates the transition is allowed, runs guard conditions,
 * updates the transaction, and logs a WorkflowEvent.
 */
export async function advanceTransaction({
  transactionId,
  toStatus,
  trigger,
  triggeredBy,
  metadata,
}: {
  transactionId: string
  toStatus: TransactionStatus
  trigger: WorkflowTrigger
  triggeredBy?: string
  metadata?: Record<string, unknown>
}): Promise<AdvanceResult> {
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    select: { status: true },
  })

  if (!transaction) {
    return { success: false, fromStatus: "DRAFT", toStatus: null, eventId: null, error: "Transaction not found" }
  }

  const fromStatus = transaction.status

  if (fromStatus === toStatus) {
    return { success: false, fromStatus, toStatus, eventId: null, error: "Already in this status" }
  }

  // Find a matching transition rule
  const rule = TRANSITIONS.find(
    (t) => t.from === fromStatus && t.to === toStatus && t.allowedTriggers.includes(trigger)
  )

  if (!rule) {
    return {
      success: false,
      fromStatus,
      toStatus,
      eventId: null,
      error: `Transition ${fromStatus} → ${toStatus} not allowed via "${trigger}"`,
    }
  }

  // Run guard condition if present
  if (rule.guard) {
    const guardPassed = await rule.guard(transactionId)
    if (!guardPassed) {
      return {
        success: false,
        fromStatus,
        toStatus,
        eventId: null,
        error: `Guard condition failed: ${rule.description}`,
      }
    }
  }

  // Execute transition + log in a transaction
  const [, event] = await prisma.$transaction([
    prisma.transaction.update({
      where: { id: transactionId },
      data: { status: toStatus, updatedAt: new Date() },
    }),
    prisma.workflowEvent.create({
      data: {
        transactionId,
        fromStatus,
        toStatus,
        trigger,
        triggeredBy: triggeredBy ?? "system",
        metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
      },
    }),
  ])

  console.log(`[Workflow] ${fromStatus} → ${toStatus} for ${transactionId} (trigger: ${trigger})`)

  return { success: true, fromStatus, toStatus, eventId: event.id }
}

// ─── QUERY HELPERS ───────────────────────────────────────────────────────────

/**
 * Get the full workflow history for a transaction, newest first.
 */
export async function getWorkflowHistory(transactionId: string) {
  return prisma.workflowEvent.findMany({
    where: { transactionId },
    orderBy: { createdAt: "desc" },
  })
}

/**
 * Get allowed next statuses for a transaction's current state.
 */
export function getAllowedTransitions(currentStatus: TransactionStatus): Array<{
  to: TransactionStatus
  triggers: WorkflowTrigger[]
  description: string
}> {
  return TRANSITIONS
    .filter((t) => t.from === currentStatus)
    .map((t) => ({ to: t.to, triggers: t.allowedTriggers, description: t.description }))
}

/**
 * Check if a specific transition is valid without executing it.
 */
export function isTransitionAllowed(
  from: TransactionStatus,
  to: TransactionStatus,
  trigger: WorkflowTrigger
): boolean {
  return TRANSITIONS.some(
    (t) => t.from === from && t.to === to && t.allowedTriggers.includes(trigger)
  )
}

// ─── AUTO-ADVANCE TRIGGERS ───────────────────────────────────────────────────

/**
 * Called when a document is uploaded to a transaction.
 * Checks if the upload should trigger a state advancement.
 */
export async function onDocumentUploaded(
  transactionId: string,
  documentType: string,
  triggeredBy?: string
): Promise<AdvanceResult | null> {
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    select: { status: true },
  })

  if (!transaction) return null

  const { status } = transaction

  // Contract uploaded while ACTIVE → move to UNDER_CONTRACT (TCS-era stage)
  if (
    status === "ACTIVE" &&
    ["purchase_agreement", "contract"].includes(documentType)
  ) {
    return advanceTransaction({
      transactionId,
      toStatus: "UNDER_CONTRACT",
      trigger: "document_uploaded",
      triggeredBy,
      metadata: { documentType, reason: "Purchase agreement executed" },
    })
  }

  // Earnest money or first disclosure while UNDER_CONTRACT → open inspection window
  if (
    status === "UNDER_CONTRACT" &&
    ["earnest_money_receipt", "property_disclosure", "lead_paint_disclosure"].includes(documentType)
  ) {
    return advanceTransaction({
      transactionId,
      toStatus: "PENDING_INSPECTION",
      trigger: "document_uploaded",
      triggeredBy,
      metadata: { documentType, reason: "EM / disclosures received — inspection opens" },
    })
  }

  // Inspection report uploaded during PENDING_INSPECTION → move to PENDING_APPRAISAL
  if (
    status === "PENDING_INSPECTION" &&
    ["inspection_response", "inspection"].includes(documentType)
  ) {
    return advanceTransaction({
      transactionId,
      toStatus: "PENDING_APPRAISAL",
      trigger: "document_uploaded",
      triggeredBy,
      metadata: { documentType, reason: "Inspection report uploaded" },
    })
  }

  // Appraisal uploaded during PENDING_APPRAISAL → move to PENDING_FINANCING
  if (status === "PENDING_APPRAISAL" && documentType === "appraisal") {
    return advanceTransaction({
      transactionId,
      toStatus: "PENDING_FINANCING",
      trigger: "document_uploaded",
      triggeredBy,
      metadata: { documentType, reason: "Appraisal uploaded" },
    })
  }

  // Clear to close document during PENDING_FINANCING → move to CLOSING
  if (
    status === "PENDING_FINANCING" &&
    ["clear_to_close", "commitment_letter"].includes(documentType)
  ) {
    return advanceTransaction({
      transactionId,
      toStatus: "CLOSING",
      trigger: "document_uploaded",
      triggeredBy,
      metadata: { documentType, reason: "Financing cleared" },
    })
  }

  // Act of Sale / closing docs uploaded during CLOSING → move to CLOSED
  if (
    status === "CLOSING" &&
    ["act_of_sale", "closing_disclosure", "settlement_statement"].includes(documentType)
  ) {
    return advanceTransaction({
      transactionId,
      toStatus: "CLOSED",
      trigger: "document_uploaded",
      triggeredBy,
      metadata: { documentType, reason: "Act of Sale executed" },
    })
  }

  return null
}

/**
 * Called when a deadline is marked complete.
 * Checks if this should trigger a state advancement.
 */
export async function onDeadlineCompleted(
  transactionId: string,
  deadlineName: string,
  triggeredBy?: string
): Promise<AdvanceResult | null> {
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    select: { status: true },
  })

  if (!transaction) return null

  const { status } = transaction
  const lowerName = deadlineName.toLowerCase()

  // Inspection deadline completed → advance from PENDING_INSPECTION
  if (status === "PENDING_INSPECTION" && lowerName.includes("inspection")) {
    return advanceTransaction({
      transactionId,
      toStatus: "PENDING_APPRAISAL",
      trigger: "deadline_completed",
      triggeredBy,
      metadata: { deadlineName, reason: "Inspection deadline completed" },
    })
  }

  // Appraisal deadline completed → advance from PENDING_APPRAISAL
  if (status === "PENDING_APPRAISAL" && lowerName.includes("appraisal")) {
    return advanceTransaction({
      transactionId,
      toStatus: "PENDING_FINANCING",
      trigger: "deadline_completed",
      triggeredBy,
      metadata: { deadlineName, reason: "Appraisal deadline completed" },
    })
  }

  // Financing deadline completed → advance from PENDING_FINANCING
  if (status === "PENDING_FINANCING" && lowerName.includes("financing")) {
    return advanceTransaction({
      transactionId,
      toStatus: "CLOSING",
      trigger: "deadline_completed",
      triggeredBy,
      metadata: { deadlineName, reason: "Financing deadline completed" },
    })
  }

  return null
}
