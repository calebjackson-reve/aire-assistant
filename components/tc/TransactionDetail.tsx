"use client"

import { useState } from "react"
import { WorkflowTimeline } from "@/components/dashboard/WorkflowTimeline"
import { WorkflowAdvance } from "@/components/dashboard/WorkflowAdvance"
import { TransactionTimeline } from "@/components/tc/TransactionTimeline"
import { getSmartSuggestions, type SmartSuggestion } from "@/lib/tc/smart-suggestions"
import Link from "next/link"

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

const INSPECTION_CATEGORIES = ["structural", "electrical", "plumbing", "hvac", "roof", "cosmetic", "other"] as const

function parseInspectionFields(fields: Record<string, unknown>): InspectionAnalysis {
  const items: InspectionItem[] = []
  const categories: Record<string, number> = {}

  // Parse extracted fields into inspection items
  // The extractor may return fields like "issues", "findings", "items", or individual category fields
  const rawItems = (fields.issues || fields.findings || fields.items || fields.deficiencies || []) as Array<Record<string, unknown>>

  if (Array.isArray(rawItems) && rawItems.length > 0) {
    for (const item of rawItems) {
      const category = categorizeItem(String(item.category || item.type || item.system || "other"))
      const severity = parseSeverity(String(item.severity || item.priority || "minor"))
      const cost = Number(item.estimatedCost || item.cost || item.estimate || 0)
      items.push({
        category,
        description: String(item.description || item.finding || item.issue || item.name || ""),
        severity,
        estimatedCost: cost || undefined,
      })
      categories[category] = (categories[category] || 0) + 1
    }
  } else {
    // Fallback: scan all fields for inspection-related content
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
    // If still nothing, count total extracted fields as a proxy
    if (items.length === 0) {
      const fieldCount = Object.keys(fields).length
      if (fieldCount > 0) {
        items.push({
          category: "other",
          description: `${fieldCount} field${fieldCount !== 1 ? "s" : ""} extracted from inspection report`,
          severity: "minor",
        })
        categories["other"] = fieldCount
      }
    }
  }

  const totalEstimatedCost = items.reduce((sum, item) => sum + (item.estimatedCost || 0), 0)

  return { items, totalEstimatedCost, categories }
}

function categorizeItem(raw: string): string {
  const lower = raw.toLowerCase()
  for (const cat of INSPECTION_CATEGORIES) {
    if (lower.includes(cat)) return cat
  }
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

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-[#6b7d52]/10 text-[#6b7d52]/60",
  ACTIVE: "bg-[#9aab7e]/15 text-[#6b7d52]",
  PENDING_INSPECTION: "bg-[#d4944c]/10 text-[#d4944c]",
  PENDING_APPRAISAL: "bg-[#d4944c]/10 text-[#d4944c]",
  PENDING_FINANCING: "bg-[#d4944c]/10 text-[#d4944c]",
  CLOSING: "bg-[#9aab7e]/20 text-[#6b7d52]",
  CLOSED: "bg-[#6b7d52]/15 text-[#6b7d52]",
  CANCELLED: "bg-[#c45c5c]/10 text-[#c45c5c]",
}

const DOC_FOLDERS = [
  { key: "contracts", label: "Contracts", icon: "📄", types: ["purchase_agreement", "contract", "amendment"] },
  { key: "disclosures", label: "Disclosures", icon: "📋", types: ["property_disclosure", "agency_disclosure", "lead_paint", "disclosure"] },
  { key: "inspections", label: "Inspections", icon: "🔍", types: ["inspection_response", "inspection", "inspection_report"] },
  { key: "addenda", label: "Addenda", icon: "📎", types: ["addendum"] },
  { key: "closing", label: "Closing", icon: "🏠", types: ["closing", "settlement", "title", "deed"] },
  { key: "other", label: "Other", icon: "📁", types: [] },
] as const

function getDocFolder(doc: Document): string {
  const t = doc.type?.toLowerCase() ?? ""
  const c = doc.category?.toLowerCase() ?? ""
  for (const folder of DOC_FOLDERS) {
    if (folder.key === "other") continue
    if (folder.types.some(ft => t.includes(ft) || c.includes(ft) || c === folder.key)) return folder.key
  }
  return "other"
}

type Tab = "overview" | "deadlines" | "documents" | "communications"

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "deadlines", label: "Deadlines" },
  { key: "documents", label: "Documents" },
  { key: "communications", label: "Comms" },
]

const COMM_TEMPLATES = [
  { key: "offer_accepted", label: "Offer Accepted", desc: "Notify all parties the offer has been accepted" },
  { key: "inspection_scheduled", label: "Inspection Scheduled", desc: "Send inspection date/time to buyer + agent" },
  { key: "inspection_complete", label: "Inspection Complete", desc: "Share inspection results with all parties" },
  { key: "repair_request", label: "Repair Request", desc: "Send repair request to seller + seller's agent" },
  { key: "appraisal_ordered", label: "Appraisal Ordered", desc: "Notify lender + buyer that appraisal is ordered" },
  { key: "appraisal_complete", label: "Appraisal Complete", desc: "Share appraisal value with all parties" },
  { key: "clear_to_close", label: "Clear to Close", desc: "Notify all parties + title company" },
  { key: "closing_scheduled", label: "Closing Scheduled", desc: "Send closing date, time, and location" },
  { key: "status_update", label: "Deal Update", desc: "Custom update to selected parties" },
  { key: "deadline_reminder", label: "Deadline Reminder", desc: "Remind responsible party of upcoming deadline" },
]

function formatDate(d: string | null) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function formatCurrency(n: number | null) {
  if (!n) return "—"
  return `$${n.toLocaleString()}`
}

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

  const now = new Date()
  const activeDeadlines = txn.deadlines.filter(d => !d.completedAt)
  const completedDeadlines = txn.deadlines.filter(d => d.completedAt)
  const overdueDeadlines = activeDeadlines.filter(d => new Date(d.dueDate) < now)
  const todayDeadlines = activeDeadlines.filter(d => new Date(d.dueDate).toDateString() === now.toDateString())
  const upcomingDeadlines = activeDeadlines.filter(d => {
    const due = new Date(d.dueDate)
    return due > now && due.toDateString() !== now.toDateString()
  })
  // Smart suggestions
  const suggestions = getSmartSuggestions(txn)
  const urgentSuggestions = suggestions.filter(s => s.priority === "urgent")
  const warningSuggestions = suggestions.filter(s => s.priority === "warning")
  const infoSuggestions = suggestions.filter(s => s.priority === "info")

  // Deal progress
  const startDate = txn.contractDate ? new Date(txn.contractDate) : null
  const endDate = txn.closingDate ? new Date(txn.closingDate) : null
  let dayNumber = 0
  let totalDays = 0
  let progressPercent = 0
  let daysToClose: number | null = null

  if (startDate && endDate) {
    totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000)
    dayNumber = Math.ceil((now.getTime() - startDate.getTime()) / 86400000)
    progressPercent = Math.min(100, Math.max(0, (dayNumber / totalDays) * 100))
    daysToClose = Math.ceil((endDate.getTime() - now.getTime()) / 86400000)
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
      setSendResult({
        key: templateKey,
        ok: res.ok,
        message: res.ok ? "Sent successfully" : (data.error || "Failed to send"),
      })
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

      // If inspection report, parse and show analysis
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
    <div>
      {/* ===== COMMAND CENTER HEADER ===== */}
      <div className="card-glass !rounded-xl !p-5 mb-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h1 className="font-[family-name:var(--font-cormorant)] italic text-[#1e2416] text-2xl">
              {txn.propertyAddress}
            </h1>
            <p className="text-[#6b7d52] text-sm mt-0.5">
              {txn.propertyCity}, {txn.propertyState} {txn.propertyZip || ""}
              {txn.mlsNumber && <span className="ml-2 font-mono text-[11px] text-[#6b7d52]/70">MLS {txn.mlsNumber}</span>}
            </p>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full ${STATUS_COLORS[txn.status] || ""}`}>
            {STATUS_LABELS[txn.status] || txn.status}
          </span>
        </div>

        {/* Key stats row — high contrast: labels olive, values deep forest */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm mb-3">
          {txn.buyerName && <span className="text-[#6b7d52]">Buyer <span className="text-[#1e2416] font-medium">{txn.buyerName}</span></span>}
          {txn.sellerName && <span className="text-[#6b7d52]">Seller <span className="text-[#1e2416] font-medium">{txn.sellerName}</span></span>}
          {txn.acceptedPrice && <span className="text-[#6b7d52]">Price <span className="font-mono text-[#1e2416] font-medium">{formatCurrency(txn.acceptedPrice)}</span></span>}
          {totalDays > 0 && (
            <span className="text-[#6b7d52]">Day <span className="font-mono text-[#1e2416] font-medium">{Math.max(1, dayNumber)}</span> of {totalDays}</span>
          )}
          {daysToClose !== null && daysToClose >= 0 && (
            <span className="text-[#6b7d52]">Closing in <span className="font-mono text-[#1e2416] font-medium">{daysToClose}</span> days</span>
          )}
          {daysToClose !== null && daysToClose < 0 && (
            <span className="text-[#c45c5c] font-medium">Closing was <span className="font-mono">{Math.abs(daysToClose)}</span> days ago</span>
          )}
        </div>

        {/* Progress bar */}
        {totalDays > 0 && (
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-[#9aab7e]/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  progressPercent >= 100 ? "bg-[#6b7d52]" : progressPercent >= 80 ? "bg-[#d4944c]" : "bg-[#9aab7e]"
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="font-mono text-[11px] text-[#6b7d52]/40 shrink-0">
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
            <p className="text-[#6b7d52]/30 text-xs text-center">
              +{infoSuggestions.length - 3} more suggestion{infoSuggestions.length - 3 !== 1 ? "s" : ""} in the tabs below
            </p>
          )}
        </div>
      )}

      {/* Pipeline Timeline */}
      <div className="mb-4">
        <TransactionTimeline
          status={txn.status}
          contractDate={txn.contractDate}
          closingDate={txn.closingDate}
          deadlines={txn.deadlines}
        />
      </div>

      {/* ===== TABS ===== */}
      <div className="flex gap-1 border-b border-[#9aab7e]/15 mb-6 overflow-x-auto">
        {TABS.map(tab => {
          const badge =
            tab.key === "deadlines" && overdueDeadlines.length > 0
              ? overdueDeadlines.length
              : tab.key === "documents"
              ? txn.documents.length
              : null
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm whitespace-nowrap border-b-2 transition ${
                activeTab === tab.key
                  ? "border-[#6b7d52] text-[#1e2416] font-medium"
                  : "border-transparent text-[#6b7d52]/50 hover:text-[#6b7d52]"
              }`}
            >
              {tab.label}
              {badge !== null && badge > 0 && (
                <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${
                  tab.key === "deadlines" ? "bg-[#c45c5c]/10 text-[#c45c5c]" : "bg-[#9aab7e]/15 text-[#6b7d52]"
                }`}>
                  {badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        {/* LEFT — Tab content */}
        <div className="space-y-6">
          {activeTab === "overview" && (
            <>
              <div className="card-glass !rounded-xl !p-5">
                <p className="text-[#6b7d52] text-[10px] font-medium tracking-[0.15em] uppercase mb-3">Deal Info</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                  <InfoField label="List Price" value={formatCurrency(txn.listPrice)} />
                  <InfoField label="Offer" value={formatCurrency(txn.offerPrice)} />
                  <InfoField label="Accepted" value={formatCurrency(txn.acceptedPrice)} />
                  <InfoField label="Contract Date" value={formatDate(txn.contractDate)} />
                  <InfoField label="Closing Date" value={formatDate(txn.closingDate)} />
                  <InfoField label="Type" value={txn.propertyType || "—"} />
                </div>
              </div>

              <div className="card-glass !rounded-xl !p-5">
                <p className="text-[#6b7d52] text-[10px] font-medium tracking-[0.15em] uppercase mb-3">Parties</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <PartyCard label="Buyer" name={txn.buyerName} email={txn.buyerEmail} phone={txn.buyerPhone} />
                  <PartyCard label="Seller" name={txn.sellerName} email={txn.sellerEmail} phone={txn.sellerPhone} />
                  <InfoField label="Lender" value={txn.lenderName || "—"} />
                  <InfoField label="Title Company" value={txn.titleCompany || "—"} />
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
                <DeadlineGroup title="Due Today" color="bg-[#d4944c]" deadlines={todayDeadlines} now={now} completing={completing} onComplete={completeDeadline} />
              )}
              {upcomingDeadlines.length > 0 && (
                <DeadlineGroup title="Upcoming" color="bg-[#9aab7e]" deadlines={upcomingDeadlines} now={now} completing={completing} onComplete={completeDeadline} />
              )}
              {completedDeadlines.length > 0 && (
                <div className="card-glass !rounded-xl !p-5">
                  <p className="text-[#6b7d52] text-[10px] font-medium tracking-[0.15em] uppercase mb-3">
                    Completed ({completedDeadlines.length})
                  </p>
                  <div className="space-y-1.5">
                    {completedDeadlines.map(d => (
                      <div key={d.id} className="flex items-center gap-3 py-1 opacity-50">
                        <span className="w-2 h-2 rounded-full shrink-0 bg-[#6b7d52]/30" />
                        <p className="text-[#1e2416] text-sm line-through flex-1">{d.name}</p>
                        <span className="font-mono text-[10px] text-[#6b7d52]/30">{formatDate(d.completedAt)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {activeDeadlines.length === 0 && completedDeadlines.length === 0 && (
                <div className="card-glass !rounded-xl !p-8 text-center">
                  <p className="text-[#6b7d52]/40 text-sm">No deadlines set</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "documents" && (
            <div className="card-glass !rounded-xl !p-0 overflow-hidden">
              {/* Header bar */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-[#9aab7e]/10">
                <div className="flex items-center gap-3">
                  <h3 className="text-[#1e2416] text-sm font-semibold">Documents</h3>
                  <span className="text-[#6b7d52]/40 text-xs">{txn.documents.length} total</span>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/aire/transactions/${txn.id}/listing`}
                    className="text-xs px-3 py-1.5 rounded-lg border border-[#9aab7e]/20 text-[#6b7d52] hover:bg-[#9aab7e]/5 transition min-h-[36px] flex items-center font-medium gap-1.5"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                    </svg>
                    Listing Checklist
                  </Link>
                  <select
                    value={folderFilter}
                    onChange={e => setFolderFilter(e.target.value)}
                    className="text-xs px-2.5 py-1.5 rounded-lg border border-[#9aab7e]/20 text-[#6b7d52] bg-[#f5f2ea]/50 min-h-[36px] cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#9aab7e]/30"
                  >
                    <option value="all">All Folders</option>
                    {DOC_FOLDERS.map(f => (
                      <option key={f.key} value={f.key}>{f.label}</option>
                    ))}
                  </select>
                  <label className="text-xs px-3 py-1.5 rounded-lg bg-[#6b7d52] text-white hover:bg-[#5a6c44] transition cursor-pointer min-h-[36px] flex items-center font-medium">
                    {uploading ? (extracting ? "Classifying..." : "Uploading...") : "Upload"}
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={handleFileUpload}
                      disabled={uploading}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Subheader: privacy note like Dotloop */}
              <div className="px-5 py-2 bg-[#f5f2ea]/30 border-b border-[#9aab7e]/5">
                <p className="text-[#6b7d52]/40 text-[10px]">Anything you upload is private until shared.</p>
              </div>

              {/* Drag-and-drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`mx-5 mt-3 mb-2 border-2 border-dashed rounded-lg p-4 text-center transition ${
                  dragOver ? "border-[#9aab7e] bg-[#9aab7e]/5" : "border-[#9aab7e]/10"
                }`}
              >
                <p className="text-[#6b7d52]/30 text-xs">
                  {dragOver ? "Drop file here" : "Drag and drop a PDF, PNG, or JPG"}
                </p>
              </div>

              {uploadError && (
                <div className="mx-5 mb-2 px-3 py-2 rounded-lg bg-[#c45c5c]/10 text-[#c45c5c] text-xs">
                  {uploadError}
                </div>
              )}

              {lastUploadResult && (
                <div className="mx-5 mb-3 px-4 py-3 rounded-lg bg-[#9aab7e]/5 border border-[#9aab7e]/15">
                  <p className="text-[#6b7d52] text-sm font-medium mb-1">Uploaded: {lastUploadResult.name}</p>
                  <div className="text-xs text-[#6b7d52]/60 space-y-0.5">
                    <p>Type: {lastUploadResult.classification.type.replace(/_/g, " ")}</p>
                    <p>Confidence: {(lastUploadResult.classification.confidence * 100).toFixed(0)}%</p>
                    {lastUploadResult.extraction && (
                      <p>Extracted {Object.keys(lastUploadResult.extraction.fields).length} fields</p>
                    )}
                    {lastUploadResult.autoFile?.applied && (
                      <p className="text-[#6b7d52]">Auto-linked to this transaction</p>
                    )}
                  </div>
                </div>
              )}

              {/* Inspection Analysis Card */}
              {inspectionAnalysis && lastUploadResult && (
                <div className="mx-5 mb-3 px-4 py-4 rounded-lg bg-[#f5f2ea] border border-[#9aab7e]/20">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[#1e2416] text-sm font-semibold">Inspection Analysis</p>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#d4944c]/10 text-[#d4944c] font-medium">
                      {inspectionAnalysis.items.length} item{inspectionAnalysis.items.length !== 1 ? "s" : ""} flagged
                    </span>
                  </div>

                  {/* Category breakdown */}
                  {Object.keys(inspectionAnalysis.categories).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {Object.entries(inspectionAnalysis.categories).map(([cat, count]) => (
                        <span key={cat} className="text-[10px] px-2 py-1 rounded-md bg-[#9aab7e]/10 text-[#6b7d52] font-medium capitalize">
                          {cat} ({count})
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Items list */}
                  {inspectionAnalysis.items.length > 0 && (
                    <div className="space-y-1.5 mb-3">
                      {inspectionAnalysis.items.slice(0, 8).map((item, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${
                            item.severity === "major" ? "bg-[#c45c5c]" :
                            item.severity === "cosmetic" ? "bg-[#9aab7e]" : "bg-[#d4944c]"
                          }`} />
                          <span className="text-[#1e2416]/80 flex-1">{item.description}</span>
                          {item.estimatedCost ? (
                            <span className="font-mono text-[#6b7d52]/60 shrink-0">${item.estimatedCost.toLocaleString()}</span>
                          ) : null}
                        </div>
                      ))}
                      {inspectionAnalysis.items.length > 8 && (
                        <p className="text-[#6b7d52]/30 text-[10px] pl-3.5">
                          +{inspectionAnalysis.items.length - 8} more items
                        </p>
                      )}
                    </div>
                  )}

                  {/* Estimated repair cost total */}
                  {inspectionAnalysis.totalEstimatedCost > 0 && (
                    <div className="flex items-center justify-between px-3 py-2 rounded-md bg-[#9aab7e]/5 mb-3">
                      <span className="text-xs text-[#6b7d52]">Estimated Repair Cost</span>
                      <span className="font-mono text-sm text-[#1e2416] font-medium">
                        ${inspectionAnalysis.totalEstimatedCost.toLocaleString()}
                      </span>
                    </div>
                  )}

                  {/* Send repair request action */}
                  <button
                    onClick={() => {
                      setInspectionAnalysis(null)
                      setActiveTab("communications")
                      setSendPreview("repair_request")
                    }}
                    className="w-full text-xs px-3 py-2 rounded-lg bg-[#6b7d52] text-[#f5f2ea] hover:bg-[#5a6c44] transition font-medium"
                  >
                    Send repair request to seller
                  </button>
                </div>
              )}

              {/* Folder list */}
              {txn.documents.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <p className="text-[#6b7d52]/30 text-sm">No documents uploaded yet</p>
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
                          {/* Folder header row — Dotloop style */}
                          <div className="flex items-center justify-between px-5 py-2.5 bg-[#f5f2ea]/50 border-y border-[#9aab7e]/8">
                            <div className="flex items-center gap-2">
                              <svg className="w-4 h-4 text-[#6b7d52]/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.06-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                              </svg>
                              <span className="text-[#6b7d52] text-xs font-semibold tracking-wide uppercase">{folder.label}</span>
                            </div>
                            <span className="text-[#6b7d52]/30 text-[10px] font-mono">{folderDocs.length} {folderDocs.length === 1 ? "doc" : "docs"}</span>
                          </div>
                          {/* Document rows */}
                          {folderDocs.length === 0 ? (
                            <div className="px-5 py-3">
                              <p className="text-[#6b7d52]/25 text-xs pl-6">No documents in this folder</p>
                            </div>
                          ) : (
                            <div>
                              {folderDocs.map(doc => (
                                <div key={doc.id} className="flex items-center gap-3 px-5 py-2.5 border-b border-[#9aab7e]/5 hover:bg-[#f5f2ea]/30 transition group">
                                  {/* Status badge — Dotloop style */}
                                  <span className={`text-[10px] font-bold tracking-wide uppercase shrink-0 w-20 text-center ${
                                    doc.checklistStatus === "verified"
                                      ? "text-[#6b7d52]"
                                      : doc.checklistStatus === "missing"
                                      ? "text-[#c45c5c]"
                                      : "text-[#d4944c]"
                                  }`}>
                                    {doc.checklistStatus === "verified" ? "VERIFIED" : doc.checklistStatus === "missing" ? "REQUIRED" : "UPLOADED"}
                                  </span>
                                  {/* Doc name */}
                                  <p className={`text-sm flex-1 truncate ${
                                    doc.fileUrl ? "text-[#1e2416] font-medium" : "text-[#6b7d52]/50"
                                  }`}>{doc.name}</p>
                                  {/* Right side meta */}
                                  <span className="font-mono text-[10px] text-[#6b7d52]/25">
                                    {new Date(doc.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                  </span>
                                  {doc.fileUrl && (
                                    <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="text-[#6b7d52]/30 hover:text-[#6b7d52] transition opacity-0 group-hover:opacity-100">
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

              {/* AirSign CTA */}
              <div className="px-5 py-3 border-t border-[#9aab7e]/8">
                <Link
                  href="/airsign/new"
                  className="text-xs text-[#6b7d52] hover:text-[#1e2416] font-medium transition"
                >
                  Need signatures? Send via AirSign &rarr;
                </Link>
              </div>
            </div>
          )}

          {activeTab === "communications" && (
            <div className="space-y-4">
              {/* Send preview modal */}
              {sendPreview && (
                <div className="card-glass !rounded-xl !p-5 border-[#9aab7e]/30">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[#1e2416] text-sm font-medium">
                      Send: {COMM_TEMPLATES.find(t => t.key === sendPreview)?.label}
                    </p>
                    <button onClick={() => setSendPreview(null)} className="text-[#6b7d52]/40 text-xs hover:text-[#6b7d52]">Cancel</button>
                  </div>
                  <p className="text-[#6b7d52]/50 text-xs mb-3">
                    {COMM_TEMPLATES.find(t => t.key === sendPreview)?.desc}
                  </p>
                  <div className="bg-[#f5f2ea] rounded-lg p-3 mb-3 text-xs text-[#6b7d52]/60 space-y-1">
                    <p>Property: {txn.propertyAddress}</p>
                    <p>To: {[txn.buyerName, txn.sellerName].filter(Boolean).join(", ") || "No parties"}</p>
                    {txn.closingDate && <p>Closing: {formatDate(txn.closingDate)}</p>}
                  </div>
                  {sendPreview === "status_update" && (
                    <textarea
                      value={customMessage}
                      onChange={e => setCustomMessage(e.target.value)}
                      placeholder="Type your custom update message here..."
                      className="w-full bg-white border border-[#9aab7e]/20 rounded-lg px-3 py-2 text-sm text-[#1e2416] mb-3 focus:outline-none focus:border-[#9aab7e]/50 placeholder:text-[#6b7d52]/20 min-h-[80px]"
                    />
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => sendCommunication(sendPreview)}
                      disabled={sending !== null}
                      className="flex-1 bg-[#6b7d52] text-[#f5f2ea] py-2.5 rounded-lg text-sm font-medium hover:bg-[#6b7d52]/90 disabled:opacity-40 transition"
                    >
                      {sending ? "Sending..." : "Confirm & Send"}
                    </button>
                    <button
                      onClick={() => setSendPreview(null)}
                      className="px-4 py-2.5 rounded-lg text-sm text-[#6b7d52] border border-[#9aab7e]/20 hover:bg-[#9aab7e]/5 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {!sendPreview && (
                <div className="card-glass !rounded-xl !p-5">
                  <p className="text-[#6b7d52] text-[10px] font-medium tracking-[0.15em] uppercase mb-1">
                    Send Communication
                  </p>
                  <p className="text-[#6b7d52]/40 text-xs mb-4">
                    Pick a template. You can preview and edit before sending.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {COMM_TEMPLATES.map(tmpl => (
                      <button
                        key={tmpl.key}
                        onClick={() => setSendPreview(tmpl.key)}
                        className="flex flex-col items-start px-4 py-3 rounded-lg border border-[#9aab7e]/20 text-left hover:bg-[#9aab7e]/5 transition min-h-[56px]"
                      >
                        <span className="text-[#1e2416] text-sm">{tmpl.label}</span>
                        <span className="text-[#6b7d52]/40 text-[10px] mt-0.5">{tmpl.desc}</span>
                      </button>
                    ))}
                  </div>
                  {sendResult && (
                    <div className={`mt-3 px-3 py-2 rounded-lg text-sm ${
                      sendResult.ok ? "bg-[#9aab7e]/10 text-[#6b7d52]" : "bg-[#c45c5c]/10 text-[#c45c5c]"
                    }`}>
                      {sendResult.message}
                    </div>
                  )}
                </div>
              )}

              <div className="card-glass !rounded-xl !p-5">
                <p className="text-[#6b7d52] text-[10px] font-medium tracking-[0.15em] uppercase mb-3">Party Contacts</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <PartyCard label="Buyer" name={txn.buyerName} email={txn.buyerEmail} phone={txn.buyerPhone} />
                  <PartyCard label="Seller" name={txn.sellerName} email={txn.sellerEmail} phone={txn.sellerPhone} />
                  {txn.lenderName && <InfoField label="Lender" value={txn.lenderName} />}
                  {txn.titleCompany && <InfoField label="Title Company" value={txn.titleCompany} />}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* RIGHT — Sidebar */}
        <div className="space-y-4">
          {!["CLOSED", "CANCELLED"].includes(txn.status) && (
            <div className="card-glass !rounded-xl !p-4">
              <p className="text-[#6b7d52] text-[10px] font-medium tracking-[0.15em] uppercase mb-2">
                Advance Status
              </p>
              <WorkflowAdvance
                transactionId={txn.id}
                onAdvanced={() => window.location.reload()}
              />
            </div>
          )}

          <WorkflowTimeline transactionId={txn.id} />

          {/* Quick links */}
          <div className="card-glass !rounded-xl !p-4">
            <p className="text-[#6b7d52] text-[10px] font-medium tracking-[0.15em] uppercase mb-3">Quick Actions</p>
            <div className="space-y-2">
              <Link href="/airsign/new" className="block text-sm text-[#6b7d52] hover:text-[#1e2416] transition py-1">
                Create & send in AirSign
              </Link>
              <Link href="/aire/compliance" className="block text-sm text-[#6b7d52] hover:text-[#1e2416] transition py-1">
                Run compliance scan
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ===== ACTION CARD COMPONENT ===== */
function ActionCard({
  suggestion,
  completing,
  onComplete,
  onTabSwitch,
}: {
  suggestion: SmartSuggestion
  completing: string | null
  onComplete: (id: string) => void
  onTabSwitch: (tab: Tab) => void
}) {
  const colorMap: Record<string, { border: string; bg: string; icon: string; iconBg: string }> = {
    urgent: { border: "border-[#c45c5c]/20", bg: "bg-[#c45c5c]/5", icon: "!", iconBg: "bg-[#c45c5c] text-white" },
    warning: { border: "border-[#d4944c]/20", bg: "bg-[#d4944c]/5", icon: "!", iconBg: "bg-[#d4944c] text-white" },
    info: { border: "border-[#9aab7e]/20", bg: "bg-[#9aab7e]/5", icon: "i", iconBg: "bg-[#9aab7e]/20 text-[#6b7d52]" },
    success: { border: "border-[#6b7d52]/20", bg: "bg-[#6b7d52]/5", icon: "✓", iconBg: "bg-[#6b7d52] text-white" },
  }

  const colors = colorMap[suggestion.priority] || colorMap.info

  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${colors.border} ${colors.bg}`}>
      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${colors.iconBg}`}>
        {colors.icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[#1e2416] text-sm font-medium">{suggestion.title}</p>
        <p className="text-[#6b7d52]/50 text-xs mt-0.5">{suggestion.description}</p>
      </div>
      <div className="flex gap-2 shrink-0">
        {suggestion.actions.map((action, i) => {
          if (action.type === "deadline_complete" && action.deadlineId) {
            return (
              <button
                key={i}
                onClick={() => onComplete(action.deadlineId!)}
                disabled={completing === action.deadlineId}
                className="text-[10px] px-3 py-1.5 rounded bg-[#6b7d52] text-[#f5f2ea] hover:bg-[#5a6c44] disabled:opacity-50 transition min-h-[32px] font-medium shadow-sm"
              >
                {completing === action.deadlineId ? "..." : action.label}
              </button>
            )
          }
          if (action.type === "link" && action.href === "#documents") {
            return (
              <button
                key={i}
                onClick={() => onTabSwitch("documents")}
                className="text-[10px] px-3 py-1.5 rounded border border-[#9aab7e]/20 text-[#6b7d52] hover:bg-[#9aab7e]/10 transition min-h-[32px]"
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

/* ===== HELPER COMPONENTS ===== */

function DeadlineGroup({
  title, color, deadlines, now, completing, onComplete,
}: {
  title: string
  color: string
  deadlines: Deadline[]
  now: Date
  completing: string | null
  onComplete: (id: string) => void
}) {
  return (
    <div className="card-glass !rounded-xl !p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
        <p className="text-[#1e2416] text-sm font-medium">{title}</p>
        <span className="text-[#6b7d52]/40 text-xs">({deadlines.length})</span>
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
                <p className="text-[#1e2416] text-sm">{d.name}</p>
                <p className="text-[#6b7d52]/40 text-xs">
                  {isOverdue
                    ? `Overdue by ${Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? "s" : ""}`
                    : isToday
                    ? "Due today"
                    : `${daysLeft} day${daysLeft !== 1 ? "s" : ""} left`}
                </p>
              </div>
              <span className="font-mono text-[11px] text-[#1e2416]/40">
                {due.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
              <button
                onClick={() => onComplete(d.id)}
                disabled={completing === d.id}
                className="text-[10px] px-3 py-1.5 rounded bg-[#9aab7e] text-[#1e2416] hover:bg-[#6b7d52] hover:text-[#f5f2ea] disabled:opacity-50 transition shrink-0 min-h-[44px] min-w-[70px] font-semibold"
              >
                {completing === d.id ? "..." : "Complete"}
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
      <p className="text-[#6b7d52]/50 text-[10px] tracking-wider uppercase">{label}</p>
      <p className="text-[#1e2416] text-sm mt-0.5">{value}</p>
    </div>
  )
}

function PartyCard({ label, name, email, phone }: { label: string; name: string | null; email: string | null; phone: string | null }) {
  return (
    <div>
      <p className="text-[#6b7d52]/50 text-[10px] tracking-wider uppercase">{label}</p>
      <p className="text-[#1e2416] text-sm mt-0.5">{name || "—"}</p>
      {email && <a href={`mailto:${email}`} className="text-[#6b7d52] text-xs hover:underline block">{email}</a>}
      {phone && <a href={`tel:${phone}`} className="text-[#6b7d52]/60 text-xs hover:underline block">{phone}</a>}
    </div>
  )
}
