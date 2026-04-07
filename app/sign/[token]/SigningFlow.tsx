"use client"

import { useState, useEffect, useCallback } from "react"
import { PDFViewer, type PageDimensions } from "@/components/airsign/PDFViewer"
import { FieldOverlay, type OverlayField } from "@/components/airsign/FieldOverlay"
import { SignatureModal, type SignatureResult } from "@/components/airsign/SignatureModal"

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
  const [signatureModal, setSignatureModal] = useState<{ fieldId: string; mode: "signature" | "initials" } | null>(null)
  const [signatureImages, setSignatureImages] = useState<Record<string, string>>({}) // fieldId → dataUrl
  const [confirmAction, setConfirmAction] = useState<"sign" | "decline" | null>(null)
  const [declineReason, setDeclineReason] = useState("")

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
      // Open signature modal
      setSignatureModal({ fieldId, mode: "signature" })
    } else if (field.type === "INITIALS") {
      // Open initials modal
      setSignatureModal({ fieldId, mode: "initials" })
    } else if (field.type === "CHECKBOX") {
      setFieldValues((prev) => ({ ...prev, [fieldId]: prev[fieldId] === "true" ? "false" : "true" }))
    } else if (field.type === "DATE") {
      setFieldValues((prev) => ({ ...prev, [fieldId]: new Date().toLocaleDateString("en-US") }))
    }
  }

  function handleSignatureComplete(result: SignatureResult) {
    if (!signatureModal) return
    const { fieldId } = signatureModal
    // Store text value for the API + image for visual display
    const textValue = result.text || data?.signer.name || "Signed"
    setFieldValues((prev) => ({ ...prev, [fieldId]: textValue }))
    setSignatureImages((prev) => ({ ...prev, [fieldId]: result.dataUrl }))
    setSignatureModal(null)
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
        body: JSON.stringify({ action: "sign", fieldValues, signatureImages }),
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
    if (declineReason.trim().length < 10) {
      setError("Please provide a reason (at least 10 characters)")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/airsign/sign/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "decline", declineReason: declineReason.trim() }),
      })
      if (res.ok) setDeclined(true)
      else {
        const err = await res.json()
        setError(err.error ?? "Failed to decline")
      }
    } catch {
      setError("Network error")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="border border-[#9aab7e]/20 rounded-lg p-4">
          <div className="h-5 bg-[#e8e4d8]/10 rounded w-2/3 mb-2" />
          <div className="h-3 bg-[#e8e4d8]/5 rounded w-1/3" />
        </div>
        <div className="h-1.5 bg-[#e8e4d8]/10 rounded-full" />
        <div className="border border-[#9aab7e]/10 rounded-lg aspect-[8.5/11] bg-[#e8e4d8]/5 flex items-center justify-center">
          <p className="text-[#e8e4d8]/30 text-sm">Loading document...</p>
        </div>
        <div className="flex gap-3">
          <div className="flex-1 h-12 bg-[#9aab7e]/20 rounded-lg" />
          <div className="w-24 h-12 bg-[#e8e4d8]/5 rounded-lg" />
        </div>
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

  // Find the next unfilled required field
  const nextUnfilledField = data.fields.find((f) => f.required && !fieldValues[f.id])

  function goToNextField() {
    if (!nextUnfilledField) return
    if (nextUnfilledField.page !== currentPage) {
      setCurrentPage(nextUnfilledField.page)
    }
    handleFieldClick(nextUnfilledField.id)
  }

  return (
    <div className="pb-24">
      {/* Electronic signature consent */}
      <div className="bg-[#9aab7e]/10 border border-[#9aab7e]/20 rounded-lg p-3 mb-4">
        <p className="text-[#e8e4d8]/70 text-xs leading-relaxed">
          By proceeding, you consent to using electronic signatures, which are legally binding under the ESIGN Act and UETA.
        </p>
      </div>

      {/* Header */}
      <div className="border border-[#9aab7e]/20 rounded-lg p-4 mb-4">
        <h1 className="text-[#e8e4d8] text-lg font-medium">{data.envelope.name}</h1>
        <p className="text-[#e8e4d8]/50 text-sm mt-1">
          Signing as: {data.signer.name} ({data.signer.email})
        </p>
        {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
      </div>

      {/* Progress + Next button */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-1.5 bg-[#e8e4d8]/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#9aab7e] rounded-full transition-all"
            style={{ width: `${totalRequired > 0 ? (completedRequired / totalRequired) * 100 : 0}%` }}
          />
        </div>
        <span className="text-[#e8e4d8]/50 text-xs shrink-0">{completedRequired}/{totalRequired} fields</span>
        {nextUnfilledField && (
          <button
            onClick={goToNextField}
            className="shrink-0 bg-[#9aab7e] text-[#1e2416] text-xs font-semibold px-4 py-1.5 rounded-full hover:brightness-110 transition animate-pulse"
          >
            Next →
          </button>
        )}
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
        <div className="flex items-center justify-center gap-3 mb-4">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1.5 text-sm border border-[#9aab7e]/20 rounded-lg text-[#e8e4d8]/60 hover:border-[#9aab7e]/40 hover:text-[#e8e4d8] disabled:opacity-20 disabled:cursor-not-allowed transition focus:outline-none focus:ring-2 focus:ring-[#9aab7e]/30"
          >
            ← Prev
          </button>
          <span className="text-[#e8e4d8]/50 text-xs font-mono">
            {currentPage} / {data.envelope.pageCount}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(data.envelope.pageCount, p + 1))}
            disabled={currentPage === data.envelope.pageCount}
            className="px-3 py-1.5 text-sm border border-[#9aab7e]/20 rounded-lg text-[#e8e4d8]/60 hover:border-[#9aab7e]/40 hover:text-[#e8e4d8] disabled:opacity-20 disabled:cursor-not-allowed transition focus:outline-none focus:ring-2 focus:ring-[#9aab7e]/30"
          >
            Next →
          </button>
        </div>
      )}

      {/* Actions — sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#1e2416]/95 backdrop-blur-sm border-t border-[#9aab7e]/10 px-4 py-3 z-40">
      <div className="max-w-3xl mx-auto flex gap-3">
        <button
          onClick={() => setConfirmAction("sign")}
          disabled={submitting || completedRequired < totalRequired}
          className="flex-1 bg-[#9aab7e] text-[#1e2416] font-medium py-3 rounded-lg text-sm hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed transition focus:outline-none focus:ring-2 focus:ring-[#9aab7e]/50"
        >
          {submitting ? "Signing..." : "Sign document"}
        </button>
        <button
          onClick={() => setConfirmAction("decline")}
          disabled={submitting}
          className="border border-[#e8e4d8]/20 text-[#e8e4d8]/60 px-6 py-3 rounded-lg text-sm hover:text-[#e8e4d8] hover:border-[#e8e4d8]/40 disabled:opacity-50 transition focus:outline-none focus:ring-2 focus:ring-[#e8e4d8]/30"
        >
          Decline
        </button>
      </div>
      </div>

      {/* Confirmation modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => { setConfirmAction(null); setDeclineReason("") }}>
          <div className="bg-[#1e2416] border border-[#9aab7e]/20 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[#e8e4d8] text-lg font-medium mb-2">
              {confirmAction === "sign" ? "Confirm Signature" : "Decline Document"}
            </h3>
            <p className="text-[#e8e4d8]/50 text-sm mb-4">
              {confirmAction === "sign"
                ? "By signing, you agree to the terms in this document. This action cannot be undone."
                : "The sender will be notified and signing will be paused for all other signers."}
            </p>

            {confirmAction === "decline" && (
              <div className="mb-4">
                <label className="text-[#e8e4d8]/60 text-xs block mb-2">Reason for declining (required, min 10 characters)</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {[
                    "I need to make changes to the document",
                    "I'm not the right person to sign this",
                    "I don't agree with the terms",
                    "The information in this document is incorrect",
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setDeclineReason(preset)}
                      className="text-[10px] px-2 py-1 border border-[#9aab7e]/20 rounded-full text-[#e8e4d8]/60 hover:border-[#9aab7e]/40 hover:text-[#e8e4d8] transition"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <textarea
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  rows={3}
                  placeholder="Please explain why you are declining to sign..."
                  style={{ fontSize: 16 }}
                  className="w-full bg-[#0f1208] border border-[#9aab7e]/20 rounded px-3 py-2 text-[#e8e4d8] focus:outline-none focus:border-[#9aab7e]/50 resize-none"
                />
                <p className="text-[#e8e4d8]/30 text-[10px] mt-1">
                  {declineReason.trim().length}/10 characters minimum
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setConfirmAction(null); setDeclineReason(""); setError(null) }}
                className="flex-1 border border-[#e8e4d8]/20 text-[#e8e4d8]/60 py-2.5 rounded-lg text-sm hover:border-[#e8e4d8]/40 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (confirmAction === "sign") { setConfirmAction(null); handleSign() }
                  else {
                    if (declineReason.trim().length < 10) return
                    setConfirmAction(null)
                    handleDecline()
                  }
                }}
                disabled={confirmAction === "decline" && declineReason.trim().length < 10}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition disabled:opacity-30 disabled:cursor-not-allowed ${
                  confirmAction === "sign"
                    ? "bg-[#9aab7e] text-[#1e2416] hover:brightness-110"
                    : "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                }`}
              >
                {confirmAction === "sign" ? "Sign Now" : "Yes, Decline"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Signature capture modal */}
      {signatureModal && data && (
        <SignatureModal
          signerName={data.signer.name}
          mode={signatureModal.mode}
          onComplete={handleSignatureComplete}
          onCancel={() => setSignatureModal(null)}
        />
      )}
    </div>
  )
}
