"use client"

import { useState, useEffect, useCallback } from "react"
import { PDFViewer, type PageDimensions } from "@/components/airsign/PDFViewer"
import { FieldOverlay, type OverlayField } from "@/components/airsign/FieldOverlay"

interface SigningField {
  id: string
  type: "SIGNATURE" | "INITIALS" | "DATE" | "TEXT" | "CHECKBOX"
  label: string | null
  required: boolean
  page: number
  xPercent: number
  yPercent: number
  widthPercent: number
  heightPercent: number
  value: string | null
  filled: boolean
}

interface EnvelopeData {
  envelope: { id: string; name: string; documentUrl: string; pageCount: number }
  signer: { id: string; name: string; email: string; role: string }
  fields: SigningField[]
}

export function SigningFlow({ token }: { token: string }) {
  const [data, setData] = useState<EnvelopeData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageDims, setPageDims] = useState<PageDimensions>({ width: 800, height: 1035 })
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [activeField, setActiveField] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [complete, setComplete] = useState(false)
  const [declined, setDeclined] = useState(false)

  useEffect(() => {
    fetch(`/api/airsign/sign/${token}`)
      .then(async (r) => {
        if (!r.ok) {
          const err = await r.json()
          setError(err.error ?? "Failed to load document")
          return
        }
        const d = await r.json()
        setData(d)
        // Pre-fill DATE fields with today's date
        const prefilled: Record<string, string> = {}
        for (const f of d.fields) {
          if (f.type === "DATE" && !f.value) {
            prefilled[f.id] = new Date().toLocaleDateString("en-US")
          }
          if (f.value) {
            prefilled[f.id] = f.value
          }
        }
        setFieldValues(prefilled)
      })
      .catch(() => setError("Network error"))
      .finally(() => setLoading(false))
  }, [token])

  const handlePageLoad = useCallback((pageCount: number, dims: PageDimensions) => {
    setPageDims(dims)
  }, [])

  function handleFieldClick(fieldId: string) {
    const field = data?.fields.find((f) => f.id === fieldId)
    if (!field || field.filled) return
    setActiveField(fieldId)

    if (field.type === "SIGNATURE") {
      // Auto-fill with signer name as typed signature
      setFieldValues((prev) => ({ ...prev, [fieldId]: data?.signer.name ?? "" }))
    } else if (field.type === "INITIALS") {
      const name = data?.signer.name ?? ""
      const initials = name.split(" ").map((w) => w[0]).join("").toUpperCase()
      setFieldValues((prev) => ({ ...prev, [fieldId]: initials }))
    } else if (field.type === "CHECKBOX") {
      setFieldValues((prev) => ({ ...prev, [fieldId]: prev[fieldId] === "true" ? "false" : "true" }))
    } else if (field.type === "DATE") {
      setFieldValues((prev) => ({ ...prev, [fieldId]: new Date().toLocaleDateString("en-US") }))
    }
  }

  async function handleSign() {
    if (!data) return
    setSubmitting(true)

    // Validate required
    const missing = data.fields.filter((f) => f.required && !fieldValues[f.id])
    if (missing.length > 0) {
      setError(`Please complete ${missing.length} required field(s)`)
      setSubmitting(false)
      return
    }

    try {
      const res = await fetch(`/api/airsign/sign/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sign", fieldValues }),
      })

      if (res.ok) {
        setComplete(true)
      } else {
        const err = await res.json()
        setError(err.error ?? "Signing failed")
      }
    } catch {
      setError("Network error")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDecline() {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/airsign/sign/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "decline", declineReason: "Signer declined" }),
      })
      if (res.ok) setDeclined(true)
      else setError("Failed to decline")
    } catch {
      setError("Network error")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="border border-[#9aab7e]/20 rounded-lg p-12 text-center">
        <p className="text-[#e8e4d8]/50 text-sm">Loading document...</p>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="border border-red-500/30 rounded-lg p-12 text-center">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    )
  }

  if (complete) {
    return (
      <div className="border border-[#9aab7e]/30 rounded-lg p-12 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#9aab7e]/20 flex items-center justify-center">
          <span className="text-[#9aab7e] text-2xl">&#10003;</span>
        </div>
        <h2 className="text-[#e8e4d8] text-xl font-medium mb-2">Document Signed</h2>
        <p className="text-[#e8e4d8]/50 text-sm">
          Thank you, {data?.signer.name}. Your signature has been recorded.
        </p>
        <p className="text-[#e8e4d8]/30 text-xs mt-4">You may close this window.</p>
      </div>
    )
  }

  if (declined) {
    return (
      <div className="border border-[#e8e4d8]/10 rounded-lg p-12 text-center">
        <h2 className="text-[#e8e4d8] text-xl font-medium mb-2">Signing Declined</h2>
        <p className="text-[#e8e4d8]/50 text-sm">The sender has been notified.</p>
      </div>
    )
  }

  if (!data) return null

  const pageFields = data.fields.filter((f) => f.page === currentPage)
  const overlayFields: OverlayField[] = pageFields.map((f) => ({
    id: f.id,
    type: f.type,
    label: f.label,
    xPercent: f.xPercent,
    yPercent: f.yPercent,
    widthPercent: f.widthPercent,
    heightPercent: f.heightPercent,
    signerName: data.signer.name,
    filled: !!fieldValues[f.id],
    required: f.required,
  }))

  const totalRequired = data.fields.filter((f) => f.required).length
  const completedRequired = data.fields.filter((f) => f.required && fieldValues[f.id]).length

  return (
    <div>
      {/* Header */}
      <div className="border border-[#9aab7e]/20 rounded-lg p-4 mb-4">
        <h1 className="text-[#e8e4d8] text-lg font-medium">{data.envelope.name}</h1>
        <p className="text-[#e8e4d8]/50 text-sm mt-1">
          Signing as: {data.signer.name} ({data.signer.email})
        </p>
        {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
      </div>

      {/* Progress */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-1.5 bg-[#e8e4d8]/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#9aab7e] rounded-full transition-all"
            style={{ width: `${totalRequired > 0 ? (completedRequired / totalRequired) * 100 : 0}%` }}
          />
        </div>
        <span className="text-[#e8e4d8]/50 text-xs">{completedRequired}/{totalRequired} fields</span>
      </div>

      {/* PDF + Fields */}
      <div className="relative mb-4">
        <PDFViewer
          pdfUrl={data.envelope.documentUrl}
          currentPage={currentPage}
          onPageLoad={handlePageLoad}
          scale={1.3}
        />
        <FieldOverlay
          fields={overlayFields}
          pageWidth={pageDims.width}
          pageHeight={pageDims.height}
          onFieldClick={handleFieldClick}
          selectedFieldId={activeField}
        />
      </div>

      {/* Active field input for TEXT fields */}
      {activeField && (() => {
        const f = data.fields.find((x) => x.id === activeField)
        if (!f || f.type !== "TEXT") return null
        return (
          <div className="border border-[#9aab7e]/20 rounded-lg p-3 mb-4">
            <label className="text-[#e8e4d8]/50 text-xs block mb-1">{f.label || "Text field"}</label>
            <input
              type="text"
              value={fieldValues[activeField] ?? ""}
              onChange={(e) => setFieldValues((prev) => ({ ...prev, [activeField]: e.target.value }))}
              className="w-full bg-[#1e2416] border border-[#9aab7e]/20 rounded px-3 py-2 text-[#e8e4d8] text-sm focus:outline-none focus:border-[#9aab7e]/50"
              autoFocus
            />
          </div>
        )
      })()}

      {/* Page nav */}
      {data.envelope.pageCount > 1 && (
        <div className="flex items-center justify-center gap-4 mb-4">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="text-[#e8e4d8]/50 text-sm disabled:opacity-30"
          >
            ← Prev
          </button>
          <span className="text-[#e8e4d8]/50 text-xs">
            Page {currentPage} of {data.envelope.pageCount}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(data.envelope.pageCount, p + 1))}
            disabled={currentPage === data.envelope.pageCount}
            className="text-[#e8e4d8]/50 text-sm disabled:opacity-30"
          >
            Next →
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleSign}
          disabled={submitting || completedRequired < totalRequired}
          className="flex-1 bg-[#9aab7e] text-[#1e2416] font-medium py-3 rounded-lg text-sm hover:brightness-110 disabled:opacity-50 transition"
        >
          {submitting ? "Signing..." : "Sign document"}
        </button>
        <button
          onClick={handleDecline}
          disabled={submitting}
          className="border border-[#e8e4d8]/10 text-[#e8e4d8]/50 px-6 py-3 rounded-lg text-sm hover:text-[#e8e4d8] hover:border-[#e8e4d8]/20 disabled:opacity-50 transition"
        >
          Decline
        </button>
      </div>
    </div>
  )
}
