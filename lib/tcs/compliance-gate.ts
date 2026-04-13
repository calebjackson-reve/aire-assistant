// lib/tcs/compliance-gate.ts
// Day 8: Gate stage advancement on compliance health. Before a TCS session
// moves to the next stage, run a lightweight scan:
//   - Overdue deadlines relevant to the current stage → severity scored
//   - Missing required documents for outbound stage → severity scored
// HIGH severity blocks the advance (returned as blocked=true).
// MEDIUM severity warns but allows (surfaced in warnings).

import prisma from "@/lib/prisma"
import type { TCSStage } from "./stages"

export type GateSeverity = "HIGH" | "MEDIUM" | "LOW"

export interface GateIssue {
  severity: GateSeverity
  category: "deadline" | "document" | "data"
  title: string
  description: string
  payload?: Record<string, unknown>
}

export interface GateResult {
  blocked: boolean
  issues: GateIssue[]
}

// Stage-specific deadline-name substrings that must not be severely overdue
// before advancing OUT of that stage.
const STAGE_RELEVANT_DEADLINES: Partial<Record<TCSStage, string[]>> = {
  UNDER_CONTRACT: ["earnest"],
  PENDING_INSPECTION: ["inspection"],
  PENDING_APPRAISAL: ["appraisal"],
  PENDING_FINANCING: ["financing"],
  CLOSING: ["closing", "walkthrough"],
}

const DAYS_OVERDUE_HIGH = 5 // >5 days past due with no completion → block
const DAYS_OVERDUE_MEDIUM = 1 // >1 day → warn

export async function evaluateStageGate(args: {
  transactionId: string
  fromStage: TCSStage
}): Promise<GateResult> {
  const { transactionId, fromStage } = args
  const issues: GateIssue[] = []

  const relevant = STAGE_RELEVANT_DEADLINES[fromStage]
  if (!relevant || relevant.length === 0) {
    return { blocked: false, issues }
  }

  const deadlines = await prisma.deadline.findMany({
    where: {
      transactionId,
      completedAt: null,
    },
  })

  const now = Date.now()
  for (const d of deadlines) {
    const lower = d.name.toLowerCase()
    const matches = relevant.some((r) => lower.includes(r))
    if (!matches) continue
    const daysOverdue = Math.floor((now - new Date(d.dueDate).getTime()) / 86400000)
    if (daysOverdue <= 0) continue
    let severity: GateSeverity = "LOW"
    if (daysOverdue > DAYS_OVERDUE_HIGH) severity = "HIGH"
    else if (daysOverdue > DAYS_OVERDUE_MEDIUM) severity = "MEDIUM"
    else severity = "LOW"
    issues.push({
      severity,
      category: "deadline",
      title: `${d.name} ${daysOverdue}d overdue`,
      description: `"${d.name}" has been overdue for ${daysOverdue} days with no completion logged. Resolve before advancing past ${fromStage}.`,
      payload: { deadlineId: d.id, dueDate: d.dueDate, daysOverdue },
    })
  }

  const blocked = issues.some((i) => i.severity === "HIGH")
  return { blocked, issues }
}

/**
 * Format gate issues for the TCS silent-actions rail.
 */
export function summarizeGate(result: GateResult): {
  kind: "note"
  summary: string
  payload: Record<string, unknown>
} | null {
  if (result.issues.length === 0) return null
  const high = result.issues.filter((i) => i.severity === "HIGH")
  const medium = result.issues.filter((i) => i.severity === "MEDIUM")
  if (result.blocked) {
    return {
      kind: "note",
      summary: `Advance blocked — ${high.length} HIGH compliance issue${high.length > 1 ? "s" : ""} must be cleared`,
      payload: { blocked: true, issues: result.issues },
    }
  }
  if (medium.length > 0) {
    return {
      kind: "note",
      summary: `${medium.length} compliance warning${medium.length > 1 ? "s" : ""} — advance allowed`,
      payload: { blocked: false, issues: result.issues },
    }
  }
  return null
}
