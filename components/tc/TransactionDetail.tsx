"use client"

import { useState, useRef, useCallback } from "react"
import { WorkflowTimeline } from "@/components/dashboard/WorkflowTimeline"
import { WorkflowAdvance } from "@/components/dashboard/WorkflowAdvance"
import { TransactionTimeline } from "@/components/tc/TransactionTimeline"
import { CopilotDrawer, CopilotTrigger } from "@/components/tc/CopilotDrawer"
import { HairlineDivider } from "@/components/ui/primitives"

// Local section label — matches DESIGN.md § Label / caption spec
function SubLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={`text-[10px] font-medium tracking-[0.15em] uppercase ${className}`}
      style={{ color: "#6b7d52", fontFamily: "var(--font-body)" }}
    >
      {children}
    </p>
  )
}
import { getSmartSuggestions, type SmartSuggestion } from "@/lib/tc/smart-suggestions"
import Link from "next/link"

// ── INTERFACES ────────────────────────────────────────────────────────────────

interface Deadline {
  id: string
  name: string
  dueDate: string
  completedAt: string | null
  notes: string | null
  alertSent: boolean
}

interface Document {
  id: string
  name: string
  type: string
  category: string | null
  checklistStatus: string | null
  fileUrl: string | null
  filledData: Record<string, unknown> | null
  pageCount: number | null
  createdAt: string
}

interface WorkflowEvent {
  id: string
  eventType: string
  createdAt: string
  notes?: string | null
}

interface UploadResult {
  id: string
  name: string
  type: string
  category: string | null
  fileUrl: string
  checklistStatus: string
  classification: {
    type: string
    category: string
    confidence: number
    lrecFormNumber?: string
  }
  extraction: {
    fields: Record<string, unknown>
    confidence: number
    warnings: string[]
    pageCount: number
    extractionMethod: string
  } | null
  autoFile: {
    transactionId: string
    propertyAddress: string
    confidence: number
    matchedOn: string[]
    applied: boolean
  } | null
}

interface InspectionItem {
  category: string
  description: string
  severity: "major" | "minor" | "cosmetic"
  estimatedCost?: number
}

interface InspectionAnalysis {
  items: InspectionItem[]
  totalEstimatedCost: number
  categories: Record<string, number>
}

interface Transaction {
  id: string
  propertyAddress: string
  propertyCity: string
  propertyState: string
  propertyZip: string | null
  propertyType: string | null
  mlsNumber: string | null
  status: string
  listPrice: number | null
  offerPrice: number | null
  acceptedPrice: number | null
  buyerName: string | null
  buyerEmail: string | null
  buyerPhone: string | null
  sellerName: string | null
  sellerEmail: string | null
  sellerPhone: string | null
  lenderName: string | null
  titleCompany: string | null
  contractDate: string | null
  closingDate: string | null
  createdAt: string
  updatedAt: string
  deadlines: Deadline[]
  documents: Document[]
  workflowEvents: WorkflowEvent[]
}

// ── CONSTANTS ─────────────────────────────────────────────────────────────────

const INSPECTION_CATEGORIES = ["structural", "electrical", "plumbing", "hvac", "roof", "cosmetic", "other"] as const

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft", ACTIVE: "Active", PENDING_INSPECTION: "Inspection",
  PENDING_APPRAISAL: "Appraisal", PENDING_FINANCING: "Financing",
  CLOSING: "Closing", CLOSED: "Closed", CANCELLED: "Cancelled",
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT:              "bg-[#6b7d52]/10 text-[#6b7d52]/60",
  ACTIVE:             "bg-[#9aab7e]/15 text-[#6b7d52]",
  PENDING_INSPECTION: "bg-[#b5956a]/12 text-[#b5956a]",
  PENDING_APPRAISAL:  "bg-[#b5956a]/12 text-[#b5956a]",
  PENDING_FINANCING:  "bg-[#b5956a]/12 text-[#b5956a]",
  CLOSING:            "bg-[#9aab7e]/20 text-[#6b7d52]",
  CLOSED:             "bg-[#6b7d52]/15 text-[#6b7d52]",
  CANCELLED:          "bg-[#c45c5c]/10 text-[#c45c5c]",
}

// 5-phase progress: maps status → phase index 0–4
const STATUS_TO_PHASE: Record<string, number> = {
  DRAFT: 0, ACTIVE: 0,
  PENDING_INSPECTION: 1,
  PENDING_APPRAISAL: 2,
  PENDING_FINANCING: 3,
  CLOSING: 4, CLOSED: 4,
  CANCELLED: -1,
}

const DEAL_PHASES = [
  { label: "Contract",   short: "Cntr" },
  { label: "Inspection", short: "Insp" },
  { label: "Appraisal",  short: "Appr" },
  { label: "Financing",  short: "Fin"  },
  { label: "Closing",    short: "Clsg" },
]

const DOC_FOLDERS = [
  { key: "contracts",   label: "Contracts",   icon: "📄", types: ["purchase_agreement", "contract", "amendment"] },
  { key: "disclosures", label: "Disclosures", icon: "📋", types: ["property_disclosure", "agency_disclosure", "lead_paint", "disclosure"] },
  { key: "inspections", label: "Inspections", icon: "🔍", types: ["inspection_response", "inspection", "inspection_report"] },
  { key: "addenda",     label: "Addenda",     icon: "📎", types: ["addendum"] },
  { key: "closing",     label: "Closing",     icon: "🏠", types: ["closing", "settlement", "title", "deed"] },
  { key: "other",       label: "Other",       icon: "📁", types: [] },
] as const

type Tab = "overview" | "deadlines" | "documents" | "communications"

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "overview",        label: "Overview",  icon: "⊙" },
  { key: "deadlines",       label: "Deadlines", icon: "◷" },
  { key: "documents",       label: "Documents", icon: "⊡" },
  { key: "communications",  label: "Comms",     icon: "✉" },
]

const COMM_TEMPLATES = [
  { key: "offer_accepted",     label: "Offer Accepted",     desc: "Notify all parties the offer has been accepted" },
  { key: "inspection_scheduled", label: "Inspection Scheduled", desc: "Send inspection date/time to buyer + agent" },
  { key: "inspection_complete", label: "Inspection Complete", desc: "Share inspection results with all parties" },
  { key: "repair_request",     label: "Repair Request",     desc: "Send repair request to seller + seller's agent" },
  { key: "appraisal_ordered",  label: "Appraisal Ordered",  desc: "Notify lender + buyer that appraisal is ordered" },
  { key: "appraisal_complete", label: "Appraisal Complete", desc: "Share appraisal value with all parties" },
  { key: "clear_to_close",     label: "Clear to Close",     desc: "Notify all parties + title company" },
  { key: "closing_scheduled",  label: "Closing Scheduled",  desc: "Send closing date, time, and location" },
  { key: "status_update",      label: "Deal Update",        desc: "Custom update to selected parties" },
  { key: "deadline_reminder",  label: "Deadline Reminder",  desc: "Remind responsible party of upcoming deadline" },
]

// ── HELPERS ───────────────────────────────────────────────────────────────────

function formatDate(d: string | null) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function formatCurrency(n: number | null) {
  if (!n) return "—"
  return `$${n.toLocaleString()}`
}

function getDocFolder(doc: Document): string {
  const t = doc.type?.toLowerCase() ?? ""
  const c = doc.category?.toLowerCase() ?? ""
  for (const folder of DOC_FOLDERS) {
    if (folder.key === "other") continue
    if (folder.types.some(ft => t.includes(ft) || c.includes(ft) || c === folder.key)) return folder.key
  }
  return "other"
}

function parseInspectionFields(fields: Record<string, unknown>): InspectionAnalysis {
  const items: InspectionItem[] = []
  const categories: Record<string, number> = {}
  const rawItems = (fields.issues || fields.findings || fields.items || fields.deficiencies || []) as Array<Record<string, unknown>>

  if (Array.isArray(rawItems) && rawItems.length > 0) {
    for (const item of rawItems) {
      const category = categorizeItem(String(item.category || item.type || item.system || "other"))
      const severity = parseSeverity(String(item.severity || item.priority || "minor"))
      const cost = Number(item.estimatedCost || item.cost || item.estimate || 0)
      items.push({ category, description: String(item.description || item.finding || item.issue || item.name || ""), severity, estimatedCost: cost || undefined })
      categories[category] = (categories[category] || 0) + 1
    }
  } else {
    for (const [key, value] of Object.entries(fields)) {
      const lk = key.toLowerCase()
      for (const cat of INSPECTION_CATEGORIES) {
        if (lk.includes(cat)) {
          const desc = typeof value === "string" ? value : JSON.stringify(value)
          if (desc && desc !== "null" && desc !== "N/A" && desc !== "none") {
            items.push({ category: cat, description: desc, severity: "minor" })
            categories[cat] = (categories[cat] || 0) + 1
          }
        }
      }
    }
    if (items.length === 0) {
      const fieldCount = Object.keys(fields).length
      if (fieldCount > 0) {
        items.push({ category: "other", description: `${fieldCount} field${fieldCount !== 1 ? "s" : ""} extracted from inspection report`, severity: "minor" })
        categories["other"] = fieldCount
      }
    }
  }
  const totalEstimatedCost = items.reduce((sum, item) => sum + (item.estimatedCost || 0), 0)
  return { items, totalEstimatedCost, categories }
}

function categorizeItem(raw: string): string {
  const lower = raw.toLowerCase()
  for (const cat of INSPECTION_CATEGORIES) { if (lower.includes(cat)) return cat }
  if (lower.includes("electric") || lower.includes("wiring")) return "electrical"
  if (lower.includes("pipe") || lower.includes("water") || lower.includes("drain")) return "plumbing"
  if (lower.includes("heat") || lower.includes("cool") || lower.includes("air")) return "hvac"
  if (lower.includes("foundation") || lower.includes("framing") || lower.includes("wall")) return "structural"
  if (lower.includes("shingle") || lower.includes("gutter")) return "roof"
  if (lower.includes("paint") || lower.includes("finish") || lower.includes("carpet")) return "cosmetic"
  return "other"
}

function parseSeverity(raw: string): "major" | "minor" | "cosmetic" {
  const lower = raw.toLowerCase()
  if (lower.includes("major") || lower.includes("critical") || lower.includes("safety") || lower.includes("urgent")) return "major"
  if (lower.includes("cosmetic") || lower.includes("minor cosmetic")) return "cosmetic"
  return "minor"
}

// Freshness score based on days since last update
function getFreshness(updatedAt: string): { label: string; color: string; dot: string } {
  const days = Math.floor((Date.now() - new Date(updatedAt).getTime()) / 86400000)
  if (days < 2)  return { label: "Fresh",     color: "rgba(107, 125, 82, 0.80)", dot: "#9aab7e" }
  if (days < 7)  return { label: "Active",    color: "rgba(181, 149, 106, 0.80)", dot: "#b5956a" }
  return          { label: "Follow up",  color: "rgba(196, 92, 92, 0.80)",  dot: "#c45c5c" }
}

// ── STICKY PHASE STRIP ────────────────────────────────────────────────────────

function StickyPhaseStrip({ status }: { status: string }) {
  const activePhase = STATUS_TO_PHASE[status] ?? -1
  const isCancelled = status === "CANCELLED"

  if (isCancelled) return null

  return (
    <div
      className="sticky top-0 z-20 px-4 py-2.5"
      style={{
        background: "rgba(245, 242, 234, 0.95)",
        backdropFilter: "blur(8px)",
        borderBottom: "1px solid rgba(154, 171, 126, 0.15)",
      }}
    >
      <div className="flex items-center justify-between max-w-full">
        {DEAL_PHASES.map((phase, i) => {
          const isCompleted = i < activePhase
          const isCurrent   = i === activePhase
          const isFuture    = i > activePhase

          return (
            <div key={phase.label} className="flex items-center flex-1">
              {/* Phase item */}
              <div className="flex flex-col items-center" style={{ minWidth: 40 }}>
                <div
                  className="transition-all"
                  style={{
                    width: isCurrent ? 10 : 8,
                    height: isCurrent ? 10 : 8,
                    borderRadius: "50%",
                    background: isCompleted
                      ? "#9aab7e"
                      : isCurrent
                      ? "#6b7d52"
                      : "rgba(154, 171, 126, 0.20)",
                    boxShadow: isCurrent ? "0 0 0 3px rgba(107, 125, 82, 0.18)" : "none",
                  }}
                />
                <p
                  className="hidden sm:block text-[9px] mt-1 font-medium"
                  style={{
                    color: isCurrent
                      ? "#1e2416"
                      : isFuture
                      ? "rgba(107, 125, 82, 0.30)"
                      : "rgba(107, 125, 82, 0.60)",
                    fontFamily: "var(--font-body)",
                    letterSpacing: "0.04em",
                  }}
                >
                  {phase.short}
                </p>
              </div>

              {/* Connector */}
              {i < DEAL_PHASES.length - 1 && (
                <div
                  className="flex-1 h-px mx-1"
                  style={{
                    background: i < activePhase
                      ? "#9aab7e"
                      : "rgba(154, 171, 126, 0.15)",
                  }}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────

export function TransactionDetail({ transaction: initial }: { transaction: Transaction }) {
  const [txn, setTxn] = useState(initial)
  const [completing, setCompleting] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>("overview")
  const [sending, setSending] = useState<string | null>(null)
  const [sendResult, setSendResult] = useState<{ key: string; ok: boolean; message: string } | null>(null)
  const [sendPreview, setSendPreview] = useState<string | null>(null)
  const [customMessage, setCustomMessage] = useState("")
  const [uploading, setUploading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [lastUploadResult, setLastUploadResult] = useState<UploadResult | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [folderFilter, setFolderFilter] = useState<string>("all")
  const [inspectionAnalysis, setInspectionAnalysis] = useState<InspectionAnalysis | null>(null)
  const [isCopilotOpen, setIsCopilotOpen] = useState(false)

  const now = new Date()
  const activeDeadlines = txn.deadlines.filter(d => !d.completedAt)
  const completedDeadlines = txn.deadlines.filter(d => d.completedAt)
  const overdueDeadlines = activeDeadlines.filter(d => new Date(d.dueDate) < now)
  const todayDeadlines = activeDeadlines.filter(d => new Date(d.dueDate).toDateString() === now.toDateString())
  const upcomingDeadlines = activeDeadlines.filter(d => {
    const due = new Date(d.dueDate)
    return due > now && due.toDateString() !== now.toDateString()
  })

  const suggestions = getSmartSuggestions(txn)
  const urgentSuggestions = suggestions.filter(s => s.priority === "urgent")
  const warningSuggestions = suggestions.filter(s => s.priority === "warning")
  const infoSuggestions = suggestions.filter(s => s.priority === "info")

  const startDate = txn.contractDate ? new Date(txn.contractDate) : null
  const endDate = txn.closingDate ? new Date(txn.closingDate) : null
  let dayNumber = 0, totalDays = 0, progressPercent = 0
  let daysToClose: number | null = null
  if (startDate && endDate) {
    totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000)
    dayNumber = Math.ceil((now.getTime() - startDate.getTime()) / 86400000)
    progressPercent = Math.min(100, Math.max(0, (dayNumber / totalDays) * 100))
    daysToClose = Math.ceil((endDate.getTime() - now.getTime()) / 86400000)
  }

  // Copilot context
  const copilotContext = {
    address: txn.propertyAddress,
    city: txn.propertyCity,
    state: txn.propertyState,
    status: txn.status,
    buyerName: txn.buyerName,
    sellerName: txn.sellerName,
    acceptedPrice: txn.acceptedPrice,
    closingDate: txn.closingDate,
    contractDate: txn.contractDate,
    overdueDeadlines: overdueDeadlines.length,
    upcomingDeadlines: upcomingDeadlines.length,
    documentCount: txn.documents.length,
  }

  async function completeDeadline(deadlineId: string) {
    setCompleting(deadlineId)
    try {
      const res = await fetch(`/api/transactions/${txn.id}/deadlines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete", deadlineId }),
      })
      if (res.ok) {
        const refreshed = await fetch(`/api/transactions/${txn.id}`)
        if (refreshed.ok) setTxn(await refreshed.json())
      }
    } catch (err) {
      console.error("Failed to complete deadline:", err)
    } finally {
      setCompleting(null)
    }
  }

  async function sendCommunication(templateKey: string) {
    setSending(templateKey)
    setSendResult(null)
    try {
      const res = await fetch("/api/tc/send-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: txn.id,
          template: templateKey,
          customMessage: templateKey === "status_update" ? customMessage : undefined,
        }),
      })
      const data = await res.json()
      setSendResult({ key: templateKey, ok: res.ok, message: res.ok ? "Sent successfully" : (data.error || "Failed to send") })
      setSendPreview(null)
      setCustomMessage("")
    } catch {
      setSendResult({ key: templateKey, ok: false, message: "Network error" })
    } finally {
      setSending(null)
    }
  }

  async function uploadFile(file: File) {
    setUploading(true)
    setExtracting(false)
    setUploadError(null)
    setLastUploadResult(null)
    try {
      const form = new FormData()
      form.append("file", file)
      form.append("transactionId", txn.id)
      setExtracting(true)
      const res = await fetch("/api/documents/upload", { method: "POST", body: form })
      setExtracting(false)
      if (!res.ok) {
        const data = await res.json()
        setUploadError(data.error || "Upload failed")
        return
      }
      const result: UploadResult = await res.json()
      setLastUploadResult(result)
      const classType = result.classification.type.toLowerCase()
      if (classType.includes("inspection") && result.extraction?.fields) {
        setInspectionAnalysis(parseInspectionFields(result.extraction.fields))
      } else {
        setInspectionAnalysis(null)
      }
      const refreshed = await fetch(`/api/transactions/${txn.id}`)
      if (refreshed.ok) setTxn(await refreshed.json())
    } catch {
      setUploadError("Network error")
      setExtracting(false)
    } finally {
      setUploading(false)
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    await uploadFile(file)
    e.target.value = ""
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) uploadFile(file)
  }

  return (
    <>
      {/* ── AI COPILOT DRAWER (mounted at root level) ── */}
      <CopilotDrawer
        context={copilotContext}
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
      />

      <div>
        {/* ===== COMMAND CENTER HEADER ===== */}
        <div className="card-glass !rounded-xl !p-5 mb-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h1
                className="italic text-2xl leading-tight"
                style={{
                  fontFamily: "var(--font-display, Cormorant Garamond, Georgia, serif)",
                  fontWeight: 500,
                  color: "#1e2416",
                  letterSpacing: "-0.01em",
                }}
              >
                {txn.propertyAddress}
              </h1>
              <p className="text-sm mt-0.5" style={{ color: "#6b7d52" }}>
                {txn.propertyCity}, {txn.propertyState} {txn.propertyZip || ""}
                {txn.mlsNumber && (
                  <span className="ml-2 font-mono text-[11px]" style={{ color: "rgba(107, 125, 82, 0.70)" }}>
                    MLS {txn.mlsNumber}
                  </span>
                )}
              </p>
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-full shrink-0 ml-3 ${STATUS_COLORS[txn.status] || ""}`}>
              {STATUS_LABELS[txn.status] || txn.status}
            </span>
          </div>

          {/* Key stats row */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm mb-3">
            {txn.buyerName && (
              <span style={{ color: "#6b7d52" }}>
                Buyer <span className="font-medium" style={{ color: "#1e2416" }}>{txn.buyerName}</span>
              </span>
            )}
            {txn.sellerName && (
              <span style={{ color: "#6b7d52" }}>
                Seller <span className="font-medium" style={{ color: "#1e2416" }}>{txn.sellerName}</span>
              </span>
            )}
            {txn.acceptedPrice && (
              <span style={{ color: "#6b7d52" }}>
                Price <span className="font-mono font-medium" style={{ color: "#1e2416" }}>{formatCurrency(txn.acceptedPrice)}</span>
              </span>
            )}
            {totalDays > 0 && (
              <span style={{ color: "#6b7d52" }}>
                Day <span className="font-mono font-medium" style={{ color: "#1e2416" }}>{Math.max(1, dayNumber)}</span> of {totalDays}
              </span>
            )}
            {daysToClose !== null && daysToClose >= 0 && (
              <span style={{ color: "#6b7d52" }}>
                Closing in <span className="font-mono font-medium" style={{ color: "#1e2416" }}>{daysToClose}</span> days
              </span>
            )}
            {daysToClose !== null && daysToClose < 0 && (
              <span className="font-medium" style={{ color: "#c45c5c" }}>
                Closing was <span className="font-mono">{Math.abs(daysToClose)}</span> days ago
              </span>
            )}
          </div>

          {/* Progress bar */}
          {totalDays > 0 && (
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "rgba(154, 171, 126, 0.10)" }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${progressPercent}%`,
                    background: progressPercent >= 100 ? "#6b7d52" : progressPercent >= 80 ? "#b5956a" : "#9aab7e",
                    transition: "width 600ms cubic-bezier(0.34, 1.56, 0.64, 1)",
                  }}
                />
              </div>
              <span className="font-mono text-[11px] shrink-0" style={{ color: "rgba(107, 125, 82, 0.40)" }}>
                {Math.round(progressPercent)}%
              </span>
            </div>
          )}
        </div>

        {/* ===== SMART ACTION CARDS ===== */}
        {suggestions.length > 0 && (
          <div className="space-y-2 mb-4">
            {urgentSuggestions.map(s => (
              <ActionCard key={s.id} suggestion={s} completing={completing} onComplete={completeDeadline} onTabSwitch={setActiveTab} />
            ))}
            {warningSuggestions.map(s => (
              <ActionCard key={s.id} suggestion={s} completing={completing} onComplete={completeDeadline} onTabSwitch={setActiveTab} />
            ))}
            {infoSuggestions.slice(0, 3).map(s => (
              <ActionCard key={s.id} suggestion={s} completing={completing} onComplete={completeDeadline} onTabSwitch={setActiveTab} />
            ))}
            {infoSuggestions.length > 3 && (
              <p className="text-xs text-center" style={{ color: "rgba(107, 125, 82, 0.30)" }}>
                +{infoSuggestions.length - 3} more suggestion{infoSuggestions.length - 3 !== 1 ? "s" : ""} in the tabs below
              </p>
            )}
          </div>
        )}

        {/* Pipeline + DNA Timeline */}
        <div className="mb-4">
          <TransactionTimeline
            status={txn.status}
            contractDate={txn.contractDate}
            closingDate={txn.closingDate}
            deadlines={txn.deadlines}
            workflowEvents={txn.workflowEvents}
          />
        </div>

        {/* ===== STICKY PHASE STRIP + TABS ===== */}
        <div className="sticky top-0 z-20 -mx-6 px-6" style={{ background: "rgba(245, 242, 234, 0.97)", backdropFilter: "blur(8px)" }}>
          {/* 5-phase progress dots */}
          <div className="pt-3 pb-2 border-b" style={{ borderColor: "rgba(154, 171, 126, 0.10)" }}>
            <div className="flex items-center">
              {DEAL_PHASES.map((phase, i) => {
                const activePhase = STATUS_TO_PHASE[txn.status] ?? -1
                const isCompleted = i < activePhase
                const isCurrent   = i === activePhase
                const isFuture    = i > activePhase

                return (
                  <div key={phase.label} className="flex items-center flex-1">
                    <div className="flex flex-col items-center" style={{ minWidth: 36 }}>
                      <div
                        style={{
                          width: isCurrent ? 10 : 7,
                          height: isCurrent ? 10 : 7,
                          borderRadius: "50%",
                          background: isCompleted ? "#9aab7e" : isCurrent ? "#6b7d52" : "rgba(154, 171, 126, 0.20)",
                          boxShadow: isCurrent ? "0 0 0 3px rgba(107, 125, 82, 0.18)" : "none",
                          transition: "all 300ms cubic-bezier(0.34, 1.56, 0.64, 1)",
                        }}
                      />
                      <p
                        className="hidden sm:block text-[9px] mt-1 font-medium"
                        style={{
                          fontFamily: "var(--font-body)",
                          letterSpacing: "0.04em",
                          color: isCurrent ? "#1e2416" : isFuture ? "rgba(107, 125, 82, 0.28)" : "rgba(107, 125, 82, 0.55)",
                        }}
                      >
                        {phase.short}
                      </p>
                    </div>
                    {i < DEAL_PHASES.length - 1 && (
                      <div
                        className="flex-1 h-px mx-1.5"
                        style={{ background: i < activePhase ? "#9aab7e" : "rgba(154, 171, 126, 0.14)" }}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Tab strip — desktop: shown here; mobile: hidden here, shown fixed at bottom */}
          <div className="hidden sm:flex gap-1 overflow-x-auto" style={{ borderBottom: "1px solid rgba(154, 171, 126, 0.12)" }}>
            {TABS.map(tab => {
              const badge =
                tab.key === "deadlines" && overdueDeadlines.length > 0 ? overdueDeadlines.length :
                tab.key === "documents" ? txn.documents.length : null
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className="px-4 py-2.5 text-sm whitespace-nowrap border-b-2 transition-all"
                  style={{
                    borderColor: activeTab === tab.key ? "#6b7d52" : "transparent",
                    color: activeTab === tab.key ? "#1e2416" : "rgba(107, 125, 82, 0.50)",
                    fontWeight: activeTab === tab.key ? 500 : 400,
                    fontFamily: "var(--font-body)",
                    outline: "none",
                  }}
                  onFocus={e => (e.currentTarget.style.boxShadow = "inset 0 0 0 2px rgba(107, 125, 82, 0.25)")}
                  onBlur={e => (e.currentTarget.style.boxShadow = "none")}
                >
                  {tab.label}
                  {badge !== null && badge > 0 && (
                    <span
                      className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full"
                      style={
                        tab.key === "deadlines"
                          ? { background: "rgba(196, 92, 92, 0.10)", color: "#c45c5c" }
                          : { background: "rgba(154, 171, 126, 0.15)", color: "#6b7d52" }
                      }
                    >
                      {badge}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Spacer to push content below sticky strip on mobile */}
        <div className="h-4 sm:h-6" />

        {/* ===== CONTENT GRID ===== */}
        {/* Extra bottom padding on mobile to clear the fixed bottom tab bar */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 pb-20 sm:pb-6">

          {/* LEFT — Tab content */}
          <div className="space-y-6">
            {activeTab === "overview" && (
              <>
                <div className="card-glass !rounded-xl !p-5">
                  <SubLabel>Deal Info</SubLabel>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm mt-3">
                    <InfoField label="List Price" value={formatCurrency(txn.listPrice)} />
                    <InfoField label="Offer" value={formatCurrency(txn.offerPrice)} />
                    <InfoField label="Accepted" value={formatCurrency(txn.acceptedPrice)} />
                    <InfoField label="Contract Date" value={formatDate(txn.contractDate)} />
                    <InfoField label="Closing Date" value={formatDate(txn.closingDate)} />
                    <InfoField label="Type" value={txn.propertyType || "—"} />
                  </div>
                </div>

                <div className="card-glass !rounded-xl !p-5">
                  <SubLabel>Parties</SubLabel>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm mt-3">
                    <PartyCard
                      label="Buyer" name={txn.buyerName} email={txn.buyerEmail}
                      phone={txn.buyerPhone} updatedAt={txn.updatedAt}
                    />
                    <PartyCard
                      label="Seller" name={txn.sellerName} email={txn.sellerEmail}
                      phone={txn.sellerPhone} updatedAt={txn.updatedAt}
                    />
                    {txn.lenderName && <InfoField label="Lender" value={txn.lenderName} />}
                    {txn.titleCompany && <InfoField label="Title Company" value={txn.titleCompany} />}
                  </div>
                </div>
              </>
            )}

            {activeTab === "deadlines" && (
              <div className="space-y-4">
                {overdueDeadlines.length > 0 && (
                  <DeadlineGroup title="Overdue" color="bg-[#c45c5c]" deadlines={overdueDeadlines} now={now} completing={completing} onComplete={completeDeadline} />
                )}
                {todayDeadlines.length > 0 && (
                  <DeadlineGroup title="Due Today" color="bg-[#b5956a]" deadlines={todayDeadlines} now={now} completing={completing} onComplete={completeDeadline} />
                )}
                {upcomingDeadlines.length > 0 && (
                  <DeadlineGroup title="Upcoming" color="bg-[#9aab7e]" deadlines={upcomingDeadlines} now={now} completing={completing} onComplete={completeDeadline} />
                )}
                {completedDeadlines.length > 0 && (
                  <div className="card-glass !rounded-xl !p-5">
                    <SubLabel>Completed ({completedDeadlines.length})</SubLabel>
                    <div className="space-y-1.5 mt-3">
                      {completedDeadlines.map(d => (
                        <div key={d.id} className="flex items-center gap-3 py-1 opacity-50">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: "rgba(107, 125, 82, 0.30)" }} />
                          <p className="text-sm flex-1 line-through" style={{ color: "#1e2416" }}>{d.name}</p>
                          <span className="font-mono text-[10px]" style={{ color: "rgba(107, 125, 82, 0.30)" }}>{formatDate(d.completedAt)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {activeDeadlines.length === 0 && completedDeadlines.length === 0 && (
                  <div className="card-glass !rounded-xl !p-8 text-center">
                    <p className="text-sm" style={{ color: "rgba(107, 125, 82, 0.40)" }}>No deadlines set</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "documents" && (
              <div className="card-glass !rounded-xl !p-0 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-[#9aab7e]/10">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-semibold" style={{ color: "#1e2416" }}>Documents</h3>
                    <span className="text-xs" style={{ color: "rgba(107, 125, 82, 0.40)" }}>{txn.documents.length} total</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/aire/transactions/${txn.id}/listing`}
                      className="text-xs px-3 py-1.5 rounded-lg border transition min-h-[36px] flex items-center font-medium gap-1.5"
                      style={{ borderColor: "rgba(154, 171, 126, 0.20)", color: "#6b7d52" }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                      </svg>
                      Listing Checklist
                    </Link>
                    <select
                      value={folderFilter}
                      onChange={e => setFolderFilter(e.target.value)}
                      className="text-xs px-2.5 py-1.5 rounded-lg border min-h-[36px] cursor-pointer focus:outline-none"
                      style={{ borderColor: "rgba(154, 171, 126, 0.20)", color: "#6b7d52", background: "rgba(245, 242, 234, 0.50)" }}
                    >
                      <option value="all">All Folders</option>
                      {DOC_FOLDERS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                    </select>
                    <label
                      className="text-xs px-3 py-1.5 rounded-lg transition cursor-pointer min-h-[36px] flex items-center font-medium"
                      style={{ background: "#6b7d52", color: "#f5f2ea" }}
                    >
                      {uploading ? (extracting ? "Classifying…" : "Uploading…") : "Upload"}
                      <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={handleFileUpload} disabled={uploading} className="hidden" />
                    </label>
                  </div>
                </div>

                <div className="px-5 py-2 border-b" style={{ background: "rgba(245, 242, 234, 0.30)", borderColor: "rgba(154, 171, 126, 0.05)" }}>
                  <p className="text-[10px]" style={{ color: "rgba(107, 125, 82, 0.40)" }}>Anything you upload is private until shared.</p>
                </div>

                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  className="mx-5 mt-3 mb-2 border-2 border-dashed rounded-lg p-4 text-center transition"
                  style={{ borderColor: dragOver ? "#9aab7e" : "rgba(154, 171, 126, 0.10)", background: dragOver ? "rgba(154, 171, 126, 0.05)" : "transparent" }}
                >
                  <p className="text-xs" style={{ color: "rgba(107, 125, 82, 0.30)" }}>
                    {dragOver ? "Drop file here" : "Drag and drop a PDF, PNG, or JPG"}
                  </p>
                </div>

                {uploadError && (
                  <div className="mx-5 mb-2 px-3 py-2 rounded-lg text-xs" style={{ background: "rgba(196, 92, 92, 0.10)", color: "#c45c5c" }}>
                    {uploadError}
                  </div>
                )}

                {lastUploadResult && (
                  <div className="mx-5 mb-3 px-4 py-3 rounded-lg border" style={{ background: "rgba(154, 171, 126, 0.05)", borderColor: "rgba(154, 171, 126, 0.15)" }}>
                    <p className="text-sm font-medium mb-1" style={{ color: "#6b7d52" }}>Uploaded: {lastUploadResult.name}</p>
                    <div className="text-xs space-y-0.5" style={{ color: "rgba(107, 125, 82, 0.60)" }}>
                      <p>Type: {lastUploadResult.classification.type.replace(/_/g, " ")}</p>
                      <p>Confidence: {(lastUploadResult.classification.confidence * 100).toFixed(0)}%</p>
                      {lastUploadResult.extraction && <p>Extracted {Object.keys(lastUploadResult.extraction.fields).length} fields</p>}
                      {lastUploadResult.autoFile?.applied && <p style={{ color: "#6b7d52" }}>Auto-linked to this transaction</p>}
                    </div>
                  </div>
                )}

                {inspectionAnalysis && lastUploadResult && (
                  <div className="mx-5 mb-3 px-4 py-4 rounded-lg border" style={{ background: "#f5f2ea", borderColor: "rgba(154, 171, 126, 0.20)" }}>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-semibold" style={{ color: "#1e2416" }}>Inspection Analysis</p>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(181, 149, 106, 0.10)", color: "#b5956a" }}>
                        {inspectionAnalysis.items.length} item{inspectionAnalysis.items.length !== 1 ? "s" : ""} flagged
                      </span>
                    </div>
                    {Object.keys(inspectionAnalysis.categories).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {Object.entries(inspectionAnalysis.categories).map(([cat, count]) => (
                          <span key={cat} className="text-[10px] px-2 py-1 rounded-md font-medium capitalize" style={{ background: "rgba(154, 171, 126, 0.10)", color: "#6b7d52" }}>
                            {cat} ({count})
                          </span>
                        ))}
                      </div>
                    )}
                    {inspectionAnalysis.items.length > 0 && (
                      <div className="space-y-1.5 mb-3">
                        {inspectionAnalysis.items.slice(0, 8).map((item, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs">
                            <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5" style={{
                              background: item.severity === "major" ? "#c45c5c" : item.severity === "cosmetic" ? "#9aab7e" : "#b5956a"
                            }} />
                            <span className="flex-1" style={{ color: "rgba(30, 36, 22, 0.80)" }}>{item.description}</span>
                            {item.estimatedCost ? <span className="font-mono shrink-0" style={{ color: "rgba(107, 125, 82, 0.60)" }}>${item.estimatedCost.toLocaleString()}</span> : null}
                          </div>
                        ))}
                        {inspectionAnalysis.items.length > 8 && (
                          <p className="text-[10px] pl-3.5" style={{ color: "rgba(107, 125, 82, 0.30)" }}>
                            +{inspectionAnalysis.items.length - 8} more items
                          </p>
                        )}
                      </div>
                    )}
                    {inspectionAnalysis.totalEstimatedCost > 0 && (
                      <div className="flex items-center justify-between px-3 py-2 rounded-md mb-3" style={{ background: "rgba(154, 171, 126, 0.05)" }}>
                        <span className="text-xs" style={{ color: "#6b7d52" }}>Estimated Repair Cost</span>
                        <span className="font-mono text-sm font-medium" style={{ color: "#1e2416" }}>${inspectionAnalysis.totalEstimatedCost.toLocaleString()}</span>
                      </div>
                    )}
                    <button
                      onClick={() => { setInspectionAnalysis(null); setActiveTab("communications"); setSendPreview("repair_request") }}
                      className="w-full text-xs px-3 py-2 rounded-lg font-medium transition"
                      style={{ background: "#6b7d52", color: "#f5f2ea" }}
                    >
                      Send repair request to seller
                    </button>
                  </div>
                )}

                {txn.documents.length === 0 ? (
                  <div className="px-5 py-8 text-center">
                    <p className="text-sm" style={{ color: "rgba(107, 125, 82, 0.30)" }}>No documents uploaded yet</p>
                  </div>
                ) : (
                  <div>
                    {DOC_FOLDERS
                      .filter(folder => folderFilter === "all" || folderFilter === folder.key)
                      .map(folder => {
                        const folderDocs = txn.documents.filter(doc => getDocFolder(doc) === folder.key)
                        if (folderDocs.length === 0 && folderFilter === "all") return null
                        return (
                          <div key={folder.key}>
                            <div className="flex items-center justify-between px-5 py-2.5 border-y" style={{ background: "rgba(245, 242, 234, 0.50)", borderColor: "rgba(154, 171, 126, 0.08)" }}>
                              <div className="flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: "rgba(107, 125, 82, 0.50)" }}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.06-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                                </svg>
                                <span className="text-xs font-semibold tracking-wide uppercase" style={{ color: "#6b7d52" }}>{folder.label}</span>
                              </div>
                              <span className="font-mono text-[10px]" style={{ color: "rgba(107, 125, 82, 0.30)" }}>{folderDocs.length} {folderDocs.length === 1 ? "doc" : "docs"}</span>
                            </div>
                            {folderDocs.length === 0 ? (
                              <div className="px-5 py-3">
                                <p className="text-xs pl-6" style={{ color: "rgba(107, 125, 82, 0.25)" }}>No documents in this folder</p>
                              </div>
                            ) : (
                              <div>
                                {folderDocs.map(doc => (
                                  <div key={doc.id} className="flex items-center gap-3 px-5 py-2.5 border-b group transition" style={{ borderColor: "rgba(154, 171, 126, 0.05)" }}>
                                    <span className="text-[10px] font-bold tracking-wide uppercase shrink-0 w-20 text-center"
                                      style={{ color: doc.checklistStatus === "verified" ? "#6b7d52" : doc.checklistStatus === "missing" ? "#c45c5c" : "#b5956a" }}>
                                      {doc.checklistStatus === "verified" ? "VERIFIED" : doc.checklistStatus === "missing" ? "REQUIRED" : "UPLOADED"}
                                    </span>
                                    <p className="text-sm flex-1 truncate" style={{ color: doc.fileUrl ? "#1e2416" : "rgba(107, 125, 82, 0.50)", fontWeight: doc.fileUrl ? 500 : 400 }}>{doc.name}</p>
                                    <span className="font-mono text-[10px]" style={{ color: "rgba(107, 125, 82, 0.25)" }}>
                                      {new Date(doc.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                    </span>
                                    {doc.fileUrl && (
                                      <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="transition opacity-0 group-hover:opacity-100" style={{ color: "rgba(107, 125, 82, 0.30)" }}>
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                                        </svg>
                                      </a>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                  </div>
                )}

                <div className="px-5 py-3 border-t" style={{ borderColor: "rgba(154, 171, 126, 0.08)" }}>
                  <Link href="/airsign/new" className="text-xs font-medium transition" style={{ color: "#6b7d52" }}>
                    Need signatures? Send via AirSign &rarr;
                  </Link>
                </div>
              </div>
            )}

            {activeTab === "communications" && (
              <div className="space-y-4">
                {sendPreview && (
                  <div className="card-glass !rounded-xl !p-5" style={{ borderColor: "rgba(154, 171, 126, 0.30)" }}>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-medium" style={{ color: "#1e2416" }}>
                        Send: {COMM_TEMPLATES.find(t => t.key === sendPreview)?.label}
                      </p>
                      <button onClick={() => setSendPreview(null)} className="text-xs transition" style={{ color: "rgba(107, 125, 82, 0.40)" }}>Cancel</button>
                    </div>
                    <p className="text-xs mb-3" style={{ color: "rgba(107, 125, 82, 0.50)" }}>
                      {COMM_TEMPLATES.find(t => t.key === sendPreview)?.desc}
                    </p>
                    <div className="rounded-lg p-3 mb-3 text-xs space-y-1" style={{ background: "#f5f2ea", color: "rgba(107, 125, 82, 0.60)" }}>
                      <p>Property: {txn.propertyAddress}</p>
                      <p>To: {[txn.buyerName, txn.sellerName].filter(Boolean).join(", ") || "No parties"}</p>
                      {txn.closingDate && <p>Closing: {formatDate(txn.closingDate)}</p>}
                    </div>
                    {sendPreview === "status_update" && (
                      <textarea
                        value={customMessage}
                        onChange={e => setCustomMessage(e.target.value)}
                        placeholder="Type your custom update message here…"
                        className="w-full rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none min-h-[80px]"
                        style={{ background: "#f5f2ea", border: "1px solid rgba(154, 171, 126, 0.25)", color: "#1e2416", resize: "vertical" }}
                      />
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => sendCommunication(sendPreview)}
                        disabled={sending !== null}
                        className="flex-1 py-2.5 rounded-lg text-sm font-medium transition disabled:opacity-40"
                        style={{ background: "#6b7d52", color: "#f5f2ea" }}
                      >
                        {sending ? "Sending…" : "Confirm & Send"}
                      </button>
                      <button
                        onClick={() => setSendPreview(null)}
                        className="px-4 py-2.5 rounded-lg text-sm border transition"
                        style={{ color: "#6b7d52", borderColor: "rgba(154, 171, 126, 0.20)" }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {!sendPreview && (
                  <div className="card-glass !rounded-xl !p-5">
                    <SubLabel>Send Communication</SubLabel>
                    <p className="text-xs mb-4 mt-1" style={{ color: "rgba(107, 125, 82, 0.40)" }}>
                      Pick a template. You can preview and edit before sending.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {COMM_TEMPLATES.map(tmpl => (
                        <button
                          key={tmpl.key}
                          onClick={() => setSendPreview(tmpl.key)}
                          className="flex flex-col items-start px-4 py-3 rounded-lg border text-left transition min-h-[56px]"
                          style={{ borderColor: "rgba(154, 171, 126, 0.20)" }}
                        >
                          <span className="text-sm" style={{ color: "#1e2416" }}>{tmpl.label}</span>
                          <span className="text-[10px] mt-0.5" style={{ color: "rgba(107, 125, 82, 0.40)" }}>{tmpl.desc}</span>
                        </button>
                      ))}
                    </div>
                    {sendResult && (
                      <div className="mt-3 px-3 py-2 rounded-lg text-sm" style={sendResult.ok
                        ? { background: "rgba(154, 171, 126, 0.10)", color: "#6b7d52" }
                        : { background: "rgba(196, 92, 92, 0.10)", color: "#c45c5c" }}>
                        {sendResult.message}
                      </div>
                    )}
                  </div>
                )}

                <div className="card-glass !rounded-xl !p-5">
                  <SubLabel>Party Contacts</SubLabel>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm mt-3">
                    <PartyCard label="Buyer" name={txn.buyerName} email={txn.buyerEmail} phone={txn.buyerPhone} updatedAt={txn.updatedAt} />
                    <PartyCard label="Seller" name={txn.sellerName} email={txn.sellerEmail} phone={txn.sellerPhone} updatedAt={txn.updatedAt} />
                    {txn.lenderName && <InfoField label="Lender" value={txn.lenderName} />}
                    {txn.titleCompany && <InfoField label="Title Company" value={txn.titleCompany} />}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT SIDEBAR */}
          <div className="space-y-4">
            {/* Copilot trigger */}
            <CopilotTrigger
              onClick={() => setIsCopilotOpen(true)}
              hasActivity={isCopilotOpen}
            />

            <HairlineDivider variant="light" />

            {!["CLOSED", "CANCELLED"].includes(txn.status) && (
              <div className="card-glass !rounded-xl !p-4">
                <SubLabel className="mb-2">Advance Status</SubLabel>
                <WorkflowAdvance
                  transactionId={txn.id}
                  onAdvanced={() => window.location.reload()}
                />
              </div>
            )}

            <WorkflowTimeline transactionId={txn.id} />

            <div className="card-glass !rounded-xl !p-4">
              <SubLabel className="mb-3">Quick Actions</SubLabel>
              <div className="space-y-2">
                <Link href="/airsign/new" className="block text-sm py-1 transition" style={{ color: "#6b7d52" }}>
                  Create &amp; send in AirSign
                </Link>
                <Link href="/aire/compliance" className="block text-sm py-1 transition" style={{ color: "#6b7d52" }}>
                  Run compliance scan
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== MOBILE BOTTOM TAB STRIP (fixed, only on small screens) ===== */}
      <div
        className="sm:hidden fixed bottom-0 left-0 right-0 z-30 flex"
        style={{
          background: "rgba(245, 242, 234, 0.97)",
          backdropFilter: "blur(12px)",
          borderTop: "1px solid rgba(154, 171, 126, 0.18)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        {TABS.map(tab => {
          const badge =
            tab.key === "deadlines" && overdueDeadlines.length > 0 ? overdueDeadlines.length :
            tab.key === "documents" ? txn.documents.length : null
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex-1 flex flex-col items-center justify-center py-2.5 transition-all relative"
              style={{ minHeight: 56, outline: "none" }}
            >
              {/* Active indicator bar at top */}
              <div
                className="absolute top-0 left-2 right-2 h-0.5 rounded-full transition-all"
                style={{ background: activeTab === tab.key ? "#6b7d52" : "transparent" }}
              />
              <span
                className="text-base leading-none mb-1"
                style={{ color: activeTab === tab.key ? "#6b7d52" : "rgba(107, 125, 82, 0.40)" }}
              >
                {tab.icon}
              </span>
              <span
                className="text-[10px] font-medium"
                style={{
                  color: activeTab === tab.key ? "#1e2416" : "rgba(107, 125, 82, 0.50)",
                  fontFamily: "var(--font-body)",
                }}
              >
                {tab.label}
              </span>
              {badge !== null && badge > 0 && (
                <span
                  className="absolute top-1.5 right-2.5 min-w-[16px] h-4 px-1 rounded-full text-[9px] flex items-center justify-center font-bold"
                  style={tab.key === "deadlines"
                    ? { background: "#c45c5c", color: "#f5f2ea" }
                    : { background: "rgba(154, 171, 126, 0.25)", color: "#6b7d52" }}
                >
                  {badge}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </>
  )
}

// ── SUB-COMPONENTS ────────────────────────────────────────────────────────────

function ActionCard({
  suggestion, completing, onComplete, onTabSwitch,
}: {
  suggestion: SmartSuggestion
  completing: string | null
  onComplete: (id: string) => void
  onTabSwitch: (tab: Tab) => void
}) {
  const colorMap: Record<string, { border: string; bg: string; iconBg: string; icon: string }> = {
    urgent:  { border: "rgba(196, 92, 92, 0.20)",  bg: "rgba(196, 92, 92, 0.05)",  iconBg: "#c45c5c",  icon: "!" },
    warning: { border: "rgba(181, 149, 106, 0.20)", bg: "rgba(181, 149, 106, 0.05)", iconBg: "#b5956a", icon: "!" },
    info:    { border: "rgba(154, 171, 126, 0.20)", bg: "rgba(154, 171, 126, 0.05)", iconBg: "rgba(154, 171, 126, 0.20)", icon: "i" },
    success: { border: "rgba(107, 125, 82, 0.20)",  bg: "rgba(107, 125, 82, 0.05)",  iconBg: "#6b7d52", icon: "✓" },
  }
  const colors = colorMap[suggestion.priority] || colorMap.info

  return (
    <div className="flex items-start gap-3 px-4 py-3 rounded-xl border" style={{ borderColor: colors.border, background: colors.bg }}>
      <span
        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5"
        style={{ background: colors.iconBg, color: "#f5f2ea" }}
      >
        {colors.icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium" style={{ color: "#1e2416" }}>{suggestion.title}</p>
        <p className="text-xs mt-0.5" style={{ color: "rgba(107, 125, 82, 0.50)" }}>{suggestion.description}</p>
      </div>
      <div className="flex gap-2 shrink-0">
        {suggestion.actions.map((action, i) => {
          if (action.type === "deadline_complete" && action.deadlineId) {
            return (
              <button
                key={i}
                onClick={() => onComplete(action.deadlineId!)}
                disabled={completing === action.deadlineId}
                className="text-[10px] px-3 py-1.5 rounded font-medium shadow-sm transition disabled:opacity-50 min-h-[32px]"
                style={{ background: "#6b7d52", color: "#f5f2ea" }}
              >
                {completing === action.deadlineId ? "…" : action.label}
              </button>
            )
          }
          if (action.type === "link" && action.href === "#documents") {
            return (
              <button
                key={i}
                onClick={() => onTabSwitch("documents")}
                className="text-[10px] px-3 py-1.5 rounded border transition min-h-[32px]"
                style={{ borderColor: "rgba(154, 171, 126, 0.20)", color: "#6b7d52" }}
              >
                {action.label}
              </button>
            )
          }
          return null
        })}
      </div>
    </div>
  )
}

function DeadlineGroup({
  title, color, deadlines, now, completing, onComplete,
}: {
  title: string; color: string
  deadlines: Deadline[]; now: Date
  completing: string | null; onComplete: (id: string) => void
}) {
  return (
    <div className="card-glass !rounded-xl !p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
        <p className="text-sm font-medium" style={{ color: "#1e2416" }}>{title}</p>
        <span className="text-xs" style={{ color: "rgba(107, 125, 82, 0.40)" }}>({deadlines.length})</span>
      </div>
      <div className="space-y-2">
        {deadlines.map(d => {
          const due = new Date(d.dueDate)
          const daysLeft = Math.ceil((due.getTime() - now.getTime()) / 86400000)
          const isOverdue = due < now
          const isToday = due.toDateString() === now.toDateString()
          return (
            <div key={d.id} className="flex items-center gap-3 py-1.5">
              <div className="flex-1 min-w-0">
                <p className="text-sm" style={{ color: "#1e2416" }}>{d.name}</p>
                <p className="text-xs" style={{ color: "rgba(107, 125, 82, 0.40)" }}>
                  {isOverdue ? `Overdue by ${Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? "s" : ""}` : isToday ? "Due today" : `${daysLeft} day${daysLeft !== 1 ? "s" : ""} left`}
                </p>
              </div>
              <span className="font-mono text-[11px]" style={{ color: "rgba(30, 36, 22, 0.40)" }}>
                {due.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
              <button
                onClick={() => onComplete(d.id)}
                disabled={completing === d.id}
                className="text-[10px] px-3 py-1.5 rounded font-semibold transition shrink-0 min-h-[44px] min-w-[70px]"
                style={{ background: "#9aab7e", color: "#1e2416" }}
                onMouseEnter={e => { e.currentTarget.style.background = "#6b7d52"; e.currentTarget.style.color = "#f5f2ea" }}
                onMouseLeave={e => { e.currentTarget.style.background = "#9aab7e"; e.currentTarget.style.color = "#1e2416" }}
              >
                {completing === d.id ? "…" : "Complete"}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] tracking-wider uppercase" style={{ color: "rgba(107, 125, 82, 0.50)" }}>{label}</p>
      <p className="text-sm mt-0.5" style={{ color: "#1e2416" }}>{value}</p>
    </div>
  )
}

/** Party card with C2 3D tilt on hover + freshness badge */
function PartyCard({
  label, name, email, phone, updatedAt,
}: {
  label: string; name: string | null; email: string | null; phone: string | null; updatedAt: string
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const freshness = getFreshness(updatedAt)

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width  - 0.5  // -0.5 → 0.5
    const y = (e.clientY - rect.top)  / rect.height - 0.5
    // max 4° per DESIGN.md
    el.style.transform = `perspective(600px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg) scale(1.01)`
  }, [])

  const handleMouseLeave = useCallback(() => {
    const el = cardRef.current
    if (!el) return
    el.style.transform = "perspective(600px) rotateY(0deg) rotateX(0deg) scale(1)"
  }, [])

  if (!name && !email && !phone) {
    return (
      <div>
        <p className="text-[10px] tracking-wider uppercase" style={{ color: "rgba(107, 125, 82, 0.50)" }}>{label}</p>
        <p className="text-sm mt-0.5" style={{ color: "rgba(107, 125, 82, 0.30)" }}>Not assigned</p>
      </div>
    )
  }

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="rounded-xl p-3 border"
      style={{
        background: "rgba(245, 242, 234, 0.50)",
        borderColor: "rgba(154, 171, 126, 0.15)",
        transition: "transform 120ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 120ms ease",
        transformStyle: "preserve-3d",
        willChange: "transform",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = "0 4px 16px rgba(30, 36, 22, 0.08), inset 0 1px 0 rgba(245, 242, 234, 0.60)"
        e.currentTarget.style.borderColor = "rgba(154, 171, 126, 0.28)"
      }}
    >
      {/* Label + freshness */}
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[10px] tracking-wider uppercase" style={{ color: "rgba(107, 125, 82, 0.50)" }}>{label}</p>
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: freshness.dot }} />
          <span className="text-[9px] font-medium" style={{ color: freshness.color, fontFamily: "var(--font-body)" }}>
            {freshness.label}
          </span>
        </div>
      </div>

      <p className="text-sm font-medium" style={{ color: "#1e2416" }}>{name || "—"}</p>
      {email && (
        <a href={`mailto:${email}`} className="text-xs hover:underline block mt-0.5 transition" style={{ color: "#6b7d52" }}>
          {email}
        </a>
      )}
      {phone && (
        <a href={`tel:${phone}`} className="text-xs hover:underline block transition" style={{ color: "rgba(107, 125, 82, 0.60)" }}>
          {phone}
        </a>
      )}
    </div>
  )
}
