// lib/agents/lrec-guardian.ts
//
// LREC Guardian — Team 3
// Audits transactions for Louisiana Real Estate Commission compliance.
// Checks document completeness, deadline compliance, and disclosure signatures.

import prisma from "@/lib/prisma"

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface DocumentCheckResult {
  category: string
  required: boolean
  present: boolean
  missing: string[]
}

interface DeadlineCheckResult {
  name: string
  dueDate: string
  completed: boolean
  overdue: boolean
}

interface DisclosureCheckResult {
  type: string
  signed: boolean
  signerName: string | null
}

export interface ComplianceAuditResult {
  transactionId: string
  propertyAddress: string
  documentCheck: DocumentCheckResult[]
  deadlineCheck: DeadlineCheckResult[]
  disclosureCheck: DisclosureCheckResult[]
  finalStatus: "green" | "yellow" | "red"
  blockers: string[]
  runDate: Date
}

// ─── REQUIRED DOCUMENT CATEGORIES ────────────────────────────────────────────

const CRITICAL_DOCS = [
  { type: "purchase_agreement", label: "Purchase Agreement", critical: true },
  { type: "property_disclosure", label: "Property Disclosure", critical: true },
  { type: "agency_disclosure", label: "Agency Disclosure", critical: true },
]

const CONDITIONAL_DOCS = [
  { type: "lead_paint", label: "Lead-Based Paint Disclosure", condition: "pre-1978" },
  { type: "inspection_response", label: "Inspection Report", critical: false },
  { type: "appraisal", label: "Appraisal Report", critical: false },
  { type: "title_commitment", label: "Title Commitment", critical: false },
]

const DISCLOSURE_TYPES = [
  "property_disclosure",
  "agency_disclosure",
  "lead_paint",
]

// ─── CHECK FUNCTIONS ──────────────────────────────────────────────────────────

function checkDocumentCompleteness(
  txn: { propertyAddress: string; contractDate: Date | null },
  docs: Array<{ type: string; category: string | null; name: string; signatureStatus: string | null }>
): DocumentCheckResult[] {
  const presentTypes = new Set(docs.map((d) => d.type))
  const results: DocumentCheckResult[] = []

  // Check critical docs
  for (const req of CRITICAL_DOCS) {
    results.push({
      category: req.label,
      required: true,
      present: presentTypes.has(req.type),
      missing: presentTypes.has(req.type) ? [] : [req.type],
    })
  }

  // Check conditional docs
  for (const cond of CONDITIONAL_DOCS) {
    let required = false
    if (cond.condition === "pre-1978") {
      // If built before 1978, lead paint is required
      // We can't always know, so flag as required if no contract date or pre-1978
      required = true // conservative: always flag lead paint
    }

    results.push({
      category: cond.label,
      required,
      present: presentTypes.has(cond.type),
      missing: presentTypes.has(cond.type) ? [] : [cond.type],
    })
  }

  return results
}

function checkDeadlineCompliance(
  deadlines: Array<{
    name: string
    dueDate: Date
    completedAt: Date | null
  }>
): DeadlineCheckResult[] {
  const now = new Date()

  return deadlines.map((d) => ({
    name: d.name,
    dueDate: d.dueDate.toISOString(),
    completed: d.completedAt !== null,
    overdue: d.completedAt === null && d.dueDate < now,
  }))
}

function checkDisclosures(
  docs: Array<{
    type: string
    name: string
    signatureStatus: string | null
    filledData: unknown
  }>
): DisclosureCheckResult[] {
  const results: DisclosureCheckResult[] = []

  for (const discType of DISCLOSURE_TYPES) {
    const doc = docs.find((d) => d.type === discType)

    if (!doc) {
      results.push({
        type: discType,
        signed: false,
        signerName: null,
      })
      continue
    }

    const signed = doc.signatureStatus === "signed" || doc.signatureStatus === "completed"
    let signerName: string | null = null

    if (doc.filledData && typeof doc.filledData === "object") {
      const data = doc.filledData as Record<string, unknown>
      signerName =
        (data.signerName as string) ||
        (data.buyerSignature as string) ||
        (data.sellerSignature as string) ||
        null
    }

    results.push({
      type: discType,
      signed,
      signerName,
    })
  }

  return results
}

// ─── DETERMINE FINAL STATUS ──────────────────────────────────────────────────

function determineFinalStatus(
  docCheck: DocumentCheckResult[],
  deadlineCheck: DeadlineCheckResult[],
  disclosureCheck: DisclosureCheckResult[]
): { finalStatus: "green" | "yellow" | "red"; blockers: string[] } {
  const blockers: string[] = []

  // Red: critical docs missing
  const criticalMissing = docCheck.filter(
    (d) => d.required && !d.present && CRITICAL_DOCS.some((c) => c.label === d.category)
  )
  for (const m of criticalMissing) {
    blockers.push(`Missing critical document: ${m.category}`)
  }

  // Red: overdue deadlines
  const overdueDeadlines = deadlineCheck.filter((d) => d.overdue)
  for (const d of overdueDeadlines) {
    blockers.push(`Overdue deadline: ${d.name} (was due ${d.dueDate})`)
  }

  // Red: unsigned required disclosures that exist
  const unsignedDisclosures = disclosureCheck.filter(
    (d) => !d.signed && DISCLOSURE_TYPES.includes(d.type)
  )
  for (const d of unsignedDisclosures) {
    // Only a blocker if the doc exists but is unsigned
    const docExists = docCheck.find(
      (dc) => dc.present && dc.category.toLowerCase().includes(d.type.replace("_", " "))
    )
    if (docExists) {
      blockers.push(`Unsigned disclosure: ${d.type}`)
    }
  }

  if (criticalMissing.length > 0 || overdueDeadlines.length > 0) {
    return { finalStatus: "red", blockers }
  }

  // Yellow: non-critical missing or upcoming deadlines
  const nonCriticalMissing = docCheck.filter((d) => d.required && !d.present)
  if (nonCriticalMissing.length > 0 || unsignedDisclosures.length > 0) {
    for (const m of nonCriticalMissing) {
      if (!blockers.some((b) => b.includes(m.category))) {
        blockers.push(`Missing document: ${m.category}`)
      }
    }
    return { finalStatus: "yellow", blockers }
  }

  return { finalStatus: "green", blockers: [] }
}

// ─── MAIN RUNNER ──────────────────────────────────────────────────────────────

export async function runComplianceAudit(
  userId: string,
  transactionId: string
): Promise<ComplianceAuditResult> {
  const runDate = new Date()

  const txn = await prisma.transaction.findFirstOrThrow({
    where: { id: transactionId, userId },
    include: {
      deadlines: {
        select: { name: true, dueDate: true, completedAt: true },
      },
      documents: {
        select: {
          type: true,
          category: true,
          name: true,
          signatureStatus: true,
          filledData: true,
        },
      },
    },
  })

  const documentCheck = checkDocumentCompleteness(txn, txn.documents)
  const deadlineCheck = checkDeadlineCompliance(txn.deadlines)
  const disclosureCheck = checkDisclosures(txn.documents)
  const { finalStatus, blockers } = determineFinalStatus(
    documentCheck,
    deadlineCheck,
    disclosureCheck
  )

  // Store ComplianceAuditLog
  try {
    await prisma.complianceAuditLog.create({
      data: {
        userId,
        transactionId,
        documentCheck: documentCheck as unknown as Record<string, unknown>[],
        deadlineCheck: deadlineCheck as unknown as Record<string, unknown>[],
        disclosureCheck: disclosureCheck as unknown as Record<string, unknown>[],
        finalStatus,
        blockers,
        runDate,
      },
    })
  } catch (err) {
    console.error(`[LRECGuardian] Failed to store audit log:`, err)
  }

  return {
    transactionId,
    propertyAddress: txn.propertyAddress,
    documentCheck,
    deadlineCheck,
    disclosureCheck,
    finalStatus,
    blockers,
    runDate,
  }
}
