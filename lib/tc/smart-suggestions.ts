/**
 * AIRE TC — Smart Suggestions Engine
 * Takes a transaction + its deadlines/documents and returns prioritized action items.
 * Used in: transaction detail header, main dashboard, morning brief.
 */

interface Deadline {
  id: string
  name: string
  dueDate: string
  completedAt: string | null
  notes: string | null
}

interface Document {
  id: string
  name: string
  type: string
  category: string | null
}

interface Transaction {
  id: string
  propertyAddress: string
  status: string
  buyerName: string | null
  sellerName: string | null
  buyerEmail: string | null
  sellerEmail: string | null
  lenderName: string | null
  titleCompany: string | null
  contractDate: string | null
  closingDate: string | null
  deadlines: Deadline[]
  documents: Document[]
}

export type SuggestionPriority = "urgent" | "warning" | "info" | "success"

export interface SmartSuggestion {
  id: string
  priority: SuggestionPriority
  title: string
  description: string
  actions: SuggestionAction[]
  category: "deadline" | "document" | "communication" | "stage" | "general"
}

export interface SuggestionAction {
  label: string
  type: "link" | "api" | "deadline_complete"
  href?: string
  deadlineId?: string
}

const STATUS_ORDER: Record<string, number> = {
  DRAFT: 0,
  ACTIVE: 1,
  PENDING_INSPECTION: 2,
  PENDING_APPRAISAL: 3,
  PENDING_FINANCING: 4,
  CLOSING: 5,
  CLOSED: 6,
  CANCELLED: -1,
}

// Documents expected at each stage
const STAGE_DOCUMENTS: Record<string, string[]> = {
  ACTIVE: ["purchase_agreement", "earnest_money_receipt"],
  PENDING_INSPECTION: ["inspection_report"],
  PENDING_APPRAISAL: ["appraisal_report"],
  PENDING_FINANCING: ["loan_commitment", "pre_approval_letter"],
  CLOSING: ["title_commitment", "closing_disclosure", "homeowner_insurance"],
}

// Stage-based next-action suggestions
const STAGE_SUGGESTIONS: Record<string, { title: string; description: string }[]> = {
  ACTIVE: [
    { title: "Upload earnest money receipt", description: "Confirm earnest money has been deposited" },
    { title: "Schedule home inspection", description: "Book an inspector before the inspection deadline" },
  ],
  PENDING_INSPECTION: [
    { title: "Review inspection report", description: "Check findings and decide on repair requests" },
    { title: "Send repair request to seller", description: "Submit any repair requests based on inspection" },
  ],
  PENDING_APPRAISAL: [
    { title: "Check appraisal status with lender", description: "Confirm appraisal has been ordered and estimated completion date" },
    { title: "Verify appraisal meets contract price", description: "If appraisal comes in low, discuss options with client" },
  ],
  PENDING_FINANCING: [
    { title: "Follow up with lender on loan status", description: "Confirm underwriting is on track for clear-to-close" },
    { title: "Collect remaining lender conditions", description: "Check if the lender needs any additional documents" },
  ],
  CLOSING: [
    { title: "Schedule final walk-through", description: "Walk-through should happen 1-2 days before closing" },
    { title: "Confirm closing date and time with title company", description: "Make sure all parties have the closing details" },
    { title: "Verify title is clear", description: "Confirm no liens or issues from title search" },
  ],
}

export function getSmartSuggestions(transaction: Transaction): SmartSuggestion[] {
  const suggestions: SmartSuggestion[] = []
  const now = new Date()
  const { status, deadlines, documents } = transaction

  if (status === "CLOSED" || status === "CANCELLED") return suggestions

  // 1. Overdue deadlines — URGENT
  const overdueDeadlines = deadlines.filter(d =>
    !d.completedAt && new Date(d.dueDate) < now
  )
  for (const dl of overdueDeadlines) {
    const daysOverdue = Math.ceil((now.getTime() - new Date(dl.dueDate).getTime()) / 86400000)
    suggestions.push({
      id: `overdue-${dl.id}`,
      priority: "urgent",
      title: `${dl.name} is ${daysOverdue} day${daysOverdue !== 1 ? "s" : ""} overdue`,
      description: `This deadline passed on ${formatDate(dl.dueDate)}. Take action now.`,
      actions: [
        { label: "Mark Complete", type: "deadline_complete", deadlineId: dl.id },
      ],
      category: "deadline",
    })
  }

  // 2. Deadlines due within 3 days — WARNING
  const threeDays = new Date(now.getTime() + 3 * 86400000)
  const soonDeadlines = deadlines.filter(d =>
    !d.completedAt && new Date(d.dueDate) >= now && new Date(d.dueDate) <= threeDays
  )
  for (const dl of soonDeadlines) {
    const daysLeft = Math.ceil((new Date(dl.dueDate).getTime() - now.getTime()) / 86400000)
    const isToday = daysLeft === 0
    suggestions.push({
      id: `soon-${dl.id}`,
      priority: "warning",
      title: `${dl.name} ${isToday ? "is due today" : `in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`}`,
      description: `Due ${formatDate(dl.dueDate)}.`,
      actions: [
        { label: "Mark Complete", type: "deadline_complete", deadlineId: dl.id },
      ],
      category: "deadline",
    })
  }

  // 3. Deadlines due within 7 days — INFO
  const sevenDays = new Date(now.getTime() + 7 * 86400000)
  const upcomingDeadlines = deadlines.filter(d =>
    !d.completedAt && new Date(d.dueDate) > threeDays && new Date(d.dueDate) <= sevenDays
  )
  for (const dl of upcomingDeadlines) {
    const daysLeft = Math.ceil((new Date(dl.dueDate).getTime() - now.getTime()) / 86400000)
    suggestions.push({
      id: `upcoming-${dl.id}`,
      priority: "info",
      title: `${dl.name} coming up in ${daysLeft} days`,
      description: `Due ${formatDate(dl.dueDate)}. Plan ahead.`,
      actions: [
        { label: "Mark Complete", type: "deadline_complete", deadlineId: dl.id },
      ],
      category: "deadline",
    })
  }

  // 4. Missing documents for current stage
  const expectedDocs = STAGE_DOCUMENTS[status] || []
  const docTypes = documents.map(d => d.type.toLowerCase())
  for (const expected of expectedDocs) {
    const hasIt = docTypes.some(t => t.includes(expected.replace(/_/g, " ")) || t.includes(expected))
    if (!hasIt) {
      const readable = expected.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
      const isInspection = expected.includes("inspection")
      suggestions.push({
        id: `missing-doc-${expected}`,
        priority: status === "CLOSING" ? "warning" : "info",
        title: `Missing: ${readable}`,
        description: `This document is typically needed at the ${STATUS_LABELS[status] || status} stage.`,
        actions: [
          { label: isInspection ? "Upload Inspection" : "Upload Document", type: "link", href: "#documents" },
        ],
        category: "document",
      })
    }
  }

  // 5. Stage-based suggestions
  const stageSuggestions = STAGE_SUGGESTIONS[status] || []
  for (const ss of stageSuggestions) {
    suggestions.push({
      id: `stage-${status}-${ss.title.slice(0, 20)}`,
      priority: "info",
      title: ss.title,
      description: ss.description,
      actions: [],
      category: "stage",
    })
  }

  // 6. Missing party info
  if (!transaction.buyerEmail && transaction.buyerName) {
    suggestions.push({
      id: "missing-buyer-email",
      priority: "info",
      title: "Add buyer's email address",
      description: "Email is needed to send updates and documents to the buyer.",
      actions: [],
      category: "communication",
    })
  }
  if (!transaction.sellerEmail && transaction.sellerName) {
    suggestions.push({
      id: "missing-seller-email",
      priority: "info",
      title: "Add seller's email address",
      description: "Email is needed to send updates and documents to the seller.",
      actions: [],
      category: "communication",
    })
  }
  if (!transaction.lenderName && status !== "DRAFT") {
    suggestions.push({
      id: "missing-lender",
      priority: "info",
      title: "Add lender information",
      description: "A lender is needed for financing, appraisal coordination, and clear-to-close.",
      actions: [],
      category: "general",
    })
  }
  if (!transaction.titleCompany && STATUS_ORDER[status] >= 4) {
    suggestions.push({
      id: "missing-title",
      priority: "warning",
      title: "Add title company",
      description: "Title company is required for closing. Add it now to avoid delays.",
      actions: [],
      category: "general",
    })
  }

  // Sort: urgent first, then warning, then info
  const priorityOrder: Record<SuggestionPriority, number> = { urgent: 0, warning: 1, info: 2, success: 3 }
  suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

  return suggestions
}

/**
 * Get a summary of action items for the dashboard
 */
export function getDashboardAlerts(transactions: Transaction[]): {
  overdueCount: number
  dueSoonCount: number
  actionItemCount: number
  alerts: string[]
} {
  let overdueCount = 0
  let dueSoonCount = 0
  let actionItemCount = 0
  const alerts: string[] = []
  const now = new Date()
  const threeDays = new Date(now.getTime() + 3 * 86400000)

  for (const txn of transactions) {
    if (txn.status === "CLOSED" || txn.status === "CANCELLED") continue
    const suggestions = getSmartSuggestions(txn)
    const urgent = suggestions.filter(s => s.priority === "urgent")
    const warning = suggestions.filter(s => s.priority === "warning")

    overdueCount += urgent.filter(s => s.category === "deadline").length
    dueSoonCount += warning.filter(s => s.category === "deadline").length
    actionItemCount += suggestions.length

    if (urgent.length > 0) {
      alerts.push(`${txn.propertyAddress}: ${urgent.length} overdue item${urgent.length !== 1 ? "s" : ""}`)
    }
  }

  return { overdueCount, dueSoonCount, actionItemCount, alerts }
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  PENDING_INSPECTION: "Inspection",
  PENDING_APPRAISAL: "Appraisal",
  PENDING_FINANCING: "Financing",
  CLOSING: "Closing",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}
