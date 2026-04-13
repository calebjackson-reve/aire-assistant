// lib/tcs/compliance-gate.ts
// Day 8: Gate stage advancement on compliance health. Before a TCS session
// moves to the next stage, run a three-part scan:
//   1. Overdue deadlines relevant to the current stage → severity by days overdue
//   2. Required documents missing for stage exit → HIGH (blocks advance)
//   3. Optional documents / vendor confirmations missing → MEDIUM (warns only)
//
// HIGH severity blocks the advance (blocked=true). MEDIUM/LOW surface in the
// silent-actions rail but allow the advance to proceed.

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

// ── Stage rules ─────────────────────────────────────────────────────────────

// Deadline-name substrings that must not be severely overdue before advancing
// OUT of that stage. Matched case-insensitive via String.includes.
const STAGE_RELEVANT_DEADLINES: Partial<Record<TCSStage, string[]>> = {
  UNDER_CONTRACT: ["earnest"],
  PENDING_INSPECTION: ["inspection"],
  PENDING_APPRAISAL: ["appraisal"],
  PENDING_FINANCING: ["financing"],
  CLOSING: ["closing", "walkthrough"],
}

// Document.type values required before the stage can exit. Missing → HIGH.
// Values come from the Document.type whitelist in prisma/schema.prisma.
const STAGE_REQUIRED_DOCS: Partial<Record<TCSStage, string[]>> = {
  DRAFT: ["agency_disclosure"],
  UNDER_CONTRACT: ["property_disclosure"],
  PENDING_INSPECTION: ["inspection_response"],
}

// Document.type values that SHOULD exist but don't block. Missing → MEDIUM.
const STAGE_OPTIONAL_DOCS: Partial<Record<TCSStage, string[]>> = {
  UNDER_CONTRACT: ["lead_paint"], // pre-1978 homes only; we warn universally
}

// Vendor.category values required before exit. Missing → MEDIUM.
const STAGE_VENDOR_REQUIREMENTS: Partial<Record<TCSStage, string[]>> = {
  UNDER_CONTRACT: ["inspector"],
}

const DAYS_OVERDUE_HIGH = 5 // >5 days past due with no completion → HIGH → block
const DAYS_OVERDUE_MEDIUM = 1 // >1 day past due → MEDIUM → warn

// ── Public API ──────────────────────────────────────────────────────────────

export async function evaluateStageGate(args: {
  transactionId: string
  fromStage: TCSStage
  userId?: string
}): Promise<GateResult> {
  const { transactionId, fromStage, userId } = args
  const issues: GateIssue[] = []

  // 1. Deadline check ────────────────────────────────────────────────────────
  const relevant = STAGE_RELEVANT_DEADLINES[fromStage]
  if (relevant && relevant.length > 0) {
    const deadlines = await prisma.deadline.findMany({
      where: { transactionId, completedAt: null },
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
      issues.push({
        severity,
        category: "deadline",
        title: `${d.name} ${daysOverdue}d overdue`,
        description: `"${d.name}" has been overdue for ${daysOverdue} days with no completion logged. Resolve before advancing past ${fromStage}.`,
        payload: { deadlineId: d.id, dueDate: d.dueDate, daysOverdue },
      })
    }
  }

  // 2. Required document check → HIGH ────────────────────────────────────────
  const requiredDocs = STAGE_REQUIRED_DOCS[fromStage] ?? []
  const optionalDocs = STAGE_OPTIONAL_DOCS[fromStage] ?? []
  if (requiredDocs.length > 0 || optionalDocs.length > 0) {
    const docs = await prisma.document.findMany({
      where: { transactionId, type: { in: [...requiredDocs, ...optionalDocs] } },
      select: { type: true },
    })
    const presentTypes = new Set(docs.map((d) => d.type))
    for (const required of requiredDocs) {
      if (!presentTypes.has(required)) {
        issues.push({
          severity: "HIGH",
          category: "document",
          title: `Missing ${humanize(required)}`,
          description: `${humanize(required)} is required before leaving ${fromStage}. Generate or upload it to advance.`,
          payload: { docType: required },
        })
      }
    }
    // 3. Optional doc check → MEDIUM ────────────────────────────────────────
    for (const optional of optionalDocs) {
      if (!presentTypes.has(optional)) {
        issues.push({
          severity: "MEDIUM",
          category: "document",
          title: `${humanize(optional)} not on file`,
          description: `${humanize(optional)} is recommended at ${fromStage} but not blocking. Confirm it isn't needed for this property.`,
          payload: { docType: optional },
        })
      }
    }
  }

  // 4. Vendor confirmation check → MEDIUM ────────────────────────────────────
  const requiredVendors = STAGE_VENDOR_REQUIREMENTS[fromStage] ?? []
  if (requiredVendors.length > 0 && userId) {
    const vendors = await prisma.vendor.findMany({
      where: { userId, category: { in: requiredVendors } },
      select: { category: true },
    })
    const presentCategories = new Set(vendors.map((v) => v.category))
    for (const cat of requiredVendors) {
      if (!presentCategories.has(cat)) {
        issues.push({
          severity: "MEDIUM",
          category: "data",
          title: `No ${cat} vendor confirmed`,
          description: `No ${cat} is saved in your vendor list. Add one so TCS can schedule without asking.`,
          payload: { vendorCategory: cat },
        })
      }
    }
  }

  const blocked = issues.some((i) => i.severity === "HIGH")
  return { blocked, issues }
}

/**
 * Format gate issues for the TCS silent-actions rail. Returns null when there
 * are no issues to surface (clean pass).
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

function humanize(docType: string): string {
  return docType
    .split("_")
    .map((part) => (part[0]?.toUpperCase() ?? "") + part.slice(1))
    .join(" ")
}
