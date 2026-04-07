"use client"

/**
 * AirSign Layer 2 — Field Placement Editor
 * Drag-drop signature fields onto PDF pages.
 * Click to place, drag to reposition, handles to resize.
 * Assigns fields to signers.
 */

import { useState, useRef, useCallback, useEffect } from "react"
import { PDFViewer, type PageDimensions } from "./PDFViewer"
import type { OverlayField } from "./FieldOverlay"
import { FORM_REGISTRY } from "@/lib/contracts/lrec-fields"

type FieldType = "SIGNATURE" | "INITIALS" | "DATE" | "TEXT" | "CHECKBOX"

export interface PlacedField {
  id: string
  type: FieldType
  label: string
  signerId: string | null
  required: boolean
  page: number
  xPercent: number
  yPercent: number
  widthPercent: number
  heightPercent: number
}

interface Signer {
  id: string
  name: string
  email: string
  role: string
}

interface FieldPlacerProps {
  pdfUrl: string
  signers: Signer[]
  initialFields?: PlacedField[]
  onSave: (fields: PlacedField[]) => Promise<void>
  saving?: boolean
  formType?: string  // "lrec-101", "lrec-102", etc. for smart placement
}

const FIELD_DEFAULTS: Record<FieldType, { widthPercent: number; heightPercent: number; label: string }> = {
  SIGNATURE: { widthPercent: 15, heightPercent: 3, label: "Signature" },
  INITIALS: { widthPercent: 6, heightPercent: 2.5, label: "Initials" },
  DATE: { widthPercent: 12, heightPercent: 2.5, label: "Date" },
  TEXT: { widthPercent: 20, heightPercent: 2.5, label: "Text" },
  CHECKBOX: { widthPercent: 2.5, heightPercent: 2.5, label: "Check" },
}

const TYPE_COLORS: Record<FieldType, string> = {
  SIGNATURE: "border-blue-500 bg-blue-500/20 text-blue-400",
  INITIALS: "border-purple-500 bg-purple-500/20 text-purple-400",
  DATE: "border-amber-500 bg-amber-500/20 text-amber-400",
  TEXT: "border-emerald-500 bg-emerald-500/20 text-emerald-400",
  CHECKBOX: "border-zinc-400 bg-zinc-400/20 text-zinc-400",
}

let fieldIdCounter = 0
function newFieldId() {
  return `field_${Date.now()}_${++fieldIdCounter}`
}

export function FieldPlacer({ pdfUrl, signers, initialFields = [], onSave, saving = false, formType }: FieldPlacerProps) {
  const [fields, setFields] = useState<PlacedField[]>(initialFields)

  // Sync local fields when parent passes fresh initialFields (e.g. after save + router.refresh()).
  // Compare by stable signature (ids + count) so user-in-progress placements aren't clobbered mid-edit.
  const initialFieldsSignature = initialFields.map(f => f.id).join(",") + ":" + initialFields.length
  useEffect(() => {
    setFields(initialFields)
    setSelectedId(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFieldsSignature])
  const [currentPage, setCurrentPage] = useState(1)
  const [pageCount, setPageCount] = useState(0)
  const [pageDims, setPageDims] = useState<PageDimensions>({ width: 800, height: 1000 })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [placingType, setPlacingType] = useState<FieldType | null>(null)
  const [placingSigner, setPlacingSigner] = useState<string | null>(signers[0]?.id || null)
  const [dragging, setDragging] = useState<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null)
  const pdfContainerRef = useRef<HTMLDivElement>(null)

  const handlePageLoad = useCallback((count: number, dims: PageDimensions) => {
    setPageCount(count)
    setPageDims(dims)
  }, [])

  // Escape key exits placement mode
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setPlacingType(null)
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const pageFields = fields.filter(f => f.page === currentPage)
  const selectedField = fields.find(f => f.id === selectedId)

  // Click on PDF to place a new field
  function handlePdfClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!placingType) return
    const rect = pdfContainerRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const xPercent = (x / pageDims.width) * 100
    const yPercent = (y / pageDims.height) * 100

    const defaults = FIELD_DEFAULTS[placingType]
    // Auto-populate date label with today's date and time
    let label = defaults.label
    if (placingType === "DATE") {
      const now = new Date()
      label = now.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }) +
        " " + now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
    }
    // Center the field on the click position
    const centeredX = xPercent - defaults.widthPercent / 2
    const centeredY = yPercent - defaults.heightPercent / 2
    const field: PlacedField = {
      id: newFieldId(),
      type: placingType,
      label,
      signerId: placingSigner,
      required: true,
      page: currentPage,
      xPercent: Math.max(0, Math.min(100 - defaults.widthPercent, centeredX)),
      yPercent: Math.max(0, Math.min(100 - defaults.heightPercent, centeredY)),
      widthPercent: defaults.widthPercent,
      heightPercent: defaults.heightPercent,
    }

    setFields(prev => [...prev, field])
    setSelectedId(field.id)
    // Keep placement mode active — user can keep clicking to place more of the same type.
    // Press Escape or click the toggle again to exit placement mode.
  }

  // Start dragging an existing field
  function handleFieldMouseDown(e: React.MouseEvent, fieldId: string) {
    e.stopPropagation()
    const f = fields.find(ff => ff.id === fieldId)
    if (!f) return
    setDragging({ id: fieldId, startX: e.clientX, startY: e.clientY, origX: f.xPercent, origY: f.yPercent })
    setSelectedId(fieldId)
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!dragging) return
    const dx = e.clientX - dragging.startX
    const dy = e.clientY - dragging.startY
    const dxPercent = (dx / pageDims.width) * 100
    const dyPercent = (dy / pageDims.height) * 100

    setFields(prev => prev.map(f => {
      if (f.id !== dragging.id) return f
      return {
        ...f,
        xPercent: Math.max(0, Math.min(100 - f.widthPercent, dragging.origX + dxPercent)),
        yPercent: Math.max(0, Math.min(100 - f.heightPercent, dragging.origY + dyPercent)),
      }
    }))
  }

  function handleMouseUp() {
    setDragging(null)
  }

  function deleteField(id: string) {
    setFields(prev => prev.filter(f => f.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  function smartPlace() {
    if (!formType) return
    const formDef = FORM_REGISTRY[formType]
    if (!formDef) return

    // Get signature/initials/date fields from the LREC form definition
    const sigFields = formDef.fields.filter(f => f.type === "signature" || f.type === "date" && f.section === "signatures")
    if (sigFields.length === 0) return

    const newFields: PlacedField[] = sigFields.map((f, i) => {
      // Assign to signers in round-robin if multiple signers
      const signerIdx = f.label.toLowerCase().includes("seller") ? 1 : 0
      const signer = signers[Math.min(signerIdx, signers.length - 1)]

      return {
        id: newFieldId(),
        type: f.type === "signature" ? "SIGNATURE" : f.type === "date" ? "DATE" : "TEXT",
        label: f.label,
        signerId: signer?.id || null,
        required: f.required,
        page: f.page,
        xPercent: f.xPercent,
        yPercent: f.yPercent,
        widthPercent: f.widthPercent,
        heightPercent: f.heightPercent,
      }
    })

    setFields(prev => [...prev, ...newFields])
  }

  function updateField(id: string, updates: Partial<PlacedField>) {
    setFields(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f))
  }

  return (
    <div className="flex gap-4">
      {/* Left: PDF + Fields */}
      <div className="flex-1 min-w-0">
        {/* Toolbar */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-[#6b7d52] text-[10px] font-medium tracking-[0.12em] uppercase">Place Field:</span>
          {(Object.keys(FIELD_DEFAULTS) as FieldType[]).map(type => (
            <button
              key={type}
              onClick={() => setPlacingType(placingType === type ? null : type)}
              className={`text-xs px-2.5 py-1 rounded border transition ${
                placingType === type
                  ? TYPE_COLORS[type] + " border-current"
                  : "border-[#9aab7e]/20 text-[#6b7d52]/60 hover:border-[#9aab7e]/40"
              }`}
            >
              {type.charAt(0) + type.slice(1).toLowerCase()}
            </button>
          ))}
          {formType && FORM_REGISTRY[formType] && (
            <button
              onClick={smartPlace}
              className="text-xs px-2.5 py-1 rounded border border-[#9aab7e]/40 text-[#6b7d52] bg-[#9aab7e]/10 hover:bg-[#9aab7e]/20 transition"
            >
              Smart Place
            </button>
          )}
          {placingType && (
            <span className="text-[#d4944c] text-xs animate-pulse">
              Placing {placingType.toLowerCase()}s — click anywhere on PDF · Esc to stop
            </span>
          )}
        </div>

        {/* Signer selector for placement */}
        {signers.length > 0 && (
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[#6b7d52] text-[10px] font-medium tracking-[0.12em] uppercase">Assign to:</span>
            {signers.map(s => (
              <button
                key={s.id}
                onClick={() => setPlacingSigner(s.id)}
                className={`text-xs px-2.5 py-1 rounded border transition ${
                  placingSigner === s.id
                    ? "border-[#6b7d52] bg-[#9aab7e]/15 text-[#6b7d52]"
                    : "border-[#9aab7e]/20 text-[#6b7d52]/50 hover:border-[#9aab7e]/40"
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}

        {/* Page navigation — sticky above PDF */}
        {pageCount > 1 && (
          <div className="flex items-center justify-between mb-3 bg-[#f5f2ea] border border-[#9aab7e]/20 rounded-lg px-4 py-2 sticky top-0 z-20">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="text-sm px-4 py-1.5 bg-[#6b7d52] text-white rounded-lg disabled:opacity-30 hover:bg-[#5c6e2e] transition font-medium"
            >
              ← Previous
            </button>
            <div className="flex items-center gap-2">
              {Array.from({ length: Math.min(pageCount, 11) }, (_, i) => {
                // Show pages around current page
                let pageNum: number
                if (pageCount <= 11) {
                  pageNum = i + 1
                } else if (currentPage <= 6) {
                  pageNum = i + 1
                } else if (currentPage >= pageCount - 5) {
                  pageNum = pageCount - 10 + i
                } else {
                  pageNum = currentPage - 5 + i
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 rounded-lg text-xs font-medium transition ${
                      currentPage === pageNum
                        ? "bg-[#6b7d52] text-white"
                        : "text-[#6b7d52] hover:bg-[#9aab7e]/15"
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              })}
            </div>
            <button
              onClick={() => setCurrentPage(p => Math.min(pageCount, p + 1))}
              disabled={currentPage >= pageCount}
              className="text-sm px-4 py-1.5 bg-[#6b7d52] text-white rounded-lg disabled:opacity-30 hover:bg-[#5c6e2e] transition font-medium"
            >
              Next →
            </button>
          </div>
        )}

        {/* PDF container */}
        <div
          ref={pdfContainerRef}
          className={`relative inline-block ${placingType ? "cursor-crosshair" : ""}`}
          onClick={handlePdfClick}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <PDFViewer
            pdfUrl={pdfUrl}
            currentPage={currentPage}
            onPageLoad={handlePageLoad}
            scale={1.3}
          />

          {/* Field overlays (draggable) */}
          <div className="absolute top-0 left-0" style={{ width: pageDims.width, height: pageDims.height }}>
            {pageFields.map(field => {
              const colors = TYPE_COLORS[field.type]
              const isSelected = selectedId === field.id
              const left = (field.xPercent / 100) * pageDims.width
              const top = (field.yPercent / 100) * pageDims.height
              const width = (field.widthPercent / 100) * pageDims.width
              const height = (field.heightPercent / 100) * pageDims.height
              const signer = signers.find(s => s.id === field.signerId)

              return (
                <div
                  key={field.id}
                  onMouseDown={(e) => handleFieldMouseDown(e, field.id)}
                  onClick={(e) => { e.stopPropagation(); setSelectedId(field.id) }}
                  className={`absolute border-2 rounded cursor-move select-none transition-shadow ${colors}
                    ${isSelected ? "ring-2 ring-white/40 shadow-lg z-10" : "hover:shadow-md"}
                  `}
                  style={{ left, top, width, height }}
                >
                  <span className="absolute inset-0 flex items-center justify-center text-[9px] font-semibold uppercase tracking-wide truncate px-1">
                    {field.label}
                    {signer && <span className="opacity-50 ml-1">({signer.name.split(" ")[0]})</span>}
                  </span>
                  {isSelected && (
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteField(field.id) }}
                      className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 text-white rounded-full text-[8px] flex items-center justify-center hover:bg-red-400 z-20"
                    >
                      ×
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Bottom page indicator */}
        {pageCount > 1 && (
          <div className="flex items-center justify-center mt-3">
            <span className="font-mono text-xs text-[#6b7d52]/50">
              Page {currentPage} of {pageCount} · {fields.filter(f => f.page === currentPage).length} fields on this page
            </span>
          </div>
        )}
      </div>

      {/* Right: Field Properties Panel */}
      <div className="w-64 shrink-0 space-y-3">
        <div className="card-glass !rounded-xl !p-4">
          <p className="text-[#6b7d52] text-[10px] font-medium tracking-[0.12em] uppercase mb-2">
            Fields ({fields.length})
          </p>
          {fields.length === 0 ? (
            <p className="text-[#6b7d52]/40 text-xs">No fields placed yet. Select a type above and click on the PDF.</p>
          ) : (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {fields.map(f => {
                const signer = signers.find(s => s.id === f.signerId)
                return (
                  <div
                    key={f.id}
                    onClick={() => { setSelectedId(f.id); setCurrentPage(f.page) }}
                    className={`flex items-center gap-2 px-2 py-1 rounded text-xs cursor-pointer transition ${
                      selectedId === f.id ? "bg-[#9aab7e]/15" : "hover:bg-[#9aab7e]/5"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      f.type === "SIGNATURE" ? "bg-blue-500" :
                      f.type === "INITIALS" ? "bg-purple-500" :
                      f.type === "DATE" ? "bg-amber-500" :
                      f.type === "TEXT" ? "bg-emerald-500" : "bg-zinc-400"
                    }`} />
                    <span className="text-[#1e2416] truncate flex-1">{f.label}</span>
                    <span className="text-[#6b7d52]/30 text-[9px]">p{f.page}</span>
                    {signer && <span className="text-[#6b7d52]/30 text-[9px] truncate max-w-[60px]">{signer.name.split(" ")[0]}</span>}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Selected field editor */}
        {selectedField && (
          <div className="card-glass !rounded-xl !p-4">
            <p className="text-[#6b7d52] text-[10px] font-medium tracking-[0.12em] uppercase mb-2">Edit Field</p>
            <div className="space-y-2">
              <div>
                <label className="text-[#6b7d52]/50 text-[9px] uppercase">Label</label>
                <input
                  type="text"
                  value={selectedField.label}
                  onChange={(e) => updateField(selectedField.id, { label: e.target.value })}
                  className="w-full text-xs bg-transparent border border-[#9aab7e]/20 rounded px-2 py-1 text-[#1e2416] focus:outline-none focus:border-[#9aab7e]/40"
                />
              </div>
              <div>
                <label className="text-[#6b7d52]/50 text-[9px] uppercase">Signer</label>
                <select
                  value={selectedField.signerId || ""}
                  onChange={(e) => updateField(selectedField.id, { signerId: e.target.value || null })}
                  className="w-full text-xs bg-transparent border border-[#9aab7e]/20 rounded px-2 py-1 text-[#1e2416] focus:outline-none"
                >
                  <option value="">Unassigned</option>
                  {signers.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-xs text-[#6b7d52]/70">
                <input
                  type="checkbox"
                  checked={selectedField.required}
                  onChange={(e) => updateField(selectedField.id, { required: e.target.checked })}
                  className="rounded border-[#9aab7e]/30"
                />
                Required
              </label>
              <button
                onClick={() => deleteField(selectedField.id)}
                className="w-full text-xs py-1 text-[#c45c5c] border border-[#c45c5c]/20 rounded hover:bg-[#c45c5c]/10 transition"
              >
                Delete Field
              </button>
            </div>
          </div>
        )}

        {/* Save button */}
        <button
          onClick={() => onSave(fields)}
          disabled={saving || fields.length === 0}
          className="w-full text-sm py-2.5 bg-[#6b7d52] text-[#f5f2ea] rounded-lg hover:bg-[#6b7d52]/90 disabled:opacity-40 transition font-medium"
        >
          {saving ? "Saving..." : `Save ${fields.length} Field${fields.length !== 1 ? "s" : ""}`}
        </button>
      </div>
    </div>
  )
}
