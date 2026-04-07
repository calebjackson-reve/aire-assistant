"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { PDFViewer, type PageDimensions } from "@/components/airsign/PDFViewer"
import { FieldOverlay, type OverlayField } from "@/components/airsign/FieldOverlay"
import { FieldPlacer, type PlacedField } from "@/components/airsign/FieldPlacer"

interface Envelope {
  id: string
  name: string
  status: string
  documentUrl: string | null
  pageCount: number | null
  sentAt: string | null
  completedAt: string | null
  expiresAt: string | null
}

interface Signer {
  id: string
  name: string
  email: string
  role: string
  order: number
  token: string
  signedAt: string | null
  viewedAt: string | null
  declinedAt: string | null
  signingUrl: string
}

interface Field {
  id: string
  type: string
  label: string | null
  signerId: string | null
  required: boolean
  page: number
  xPercent: number
  yPercent: number
  widthPercent: number
  heightPercent: number
  value: string | null
  filledAt: string | null
}

interface AuditEvent {
  id: string
  action: string
  signerName: string | null
  ipAddress: string | null
  createdAt: string
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "text-cream-dim bg-brown-light",
  SENT: "text-warm bg-warm/10",
  IN_PROGRESS: "text-warm bg-warm/10",
  COMPLETED: "text-green-400 bg-green-400/10",
  VOIDED: "text-red-400 bg-red-400/10",
  EXPIRED: "text-cream-dim/50 bg-brown-light",
}

export function EnvelopeDetail({
  envelope,
  signers,
  fields,
  auditEvents,
}: {
  envelope: Envelope
  signers: Signer[]
  fields: Field[]
  auditEvents: AuditEvent[]
}) {
  const router = useRouter()
  const [currentPage, setCurrentPage] = useState(1)
  const [pageDims, setPageDims] = useState<PageDimensions>({ width: 800, height: 1035 })
  const [sending, setSending] = useState(false)
  const [savingFields, setSavingFields] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [resending, setResending] = useState<string | null>(null)
  const [confirmSend, setConfirmSend] = useState(false)

  const handlePageLoad = useCallback((_pageCount: number, dims: PageDimensions) => {
    setPageDims(dims)
  }, [])

  async function handleSend() {
    setSending(true)
    setError(null)
    try {
      const res = await fetch(`/api/airsign/envelopes/${envelope.id}/send`, { method: "POST" })
      if (res.ok) {
        router.refresh()
      } else {
        const err = await res.json()
        setError(err.details ? err.details.join(", ") : err.error)
      }
    } catch {
      setError("Network error")
    } finally {
      setSending(false)
    }
  }

  async function handleSaveFields(placedFields: PlacedField[]) {
    setSavingFields(true)
    setError(null)
    try {
      const res = await fetch(`/api/airsign/envelopes/${envelope.id}/fields`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: placedFields.map(f => ({
            signerId: f.signerId,
            type: f.type,
            label: f.label,
            required: f.required,
            page: f.page,
            xPercent: f.xPercent,
            yPercent: f.yPercent,
            widthPercent: f.widthPercent,
            heightPercent: f.heightPercent,
          })),
        }),
      })
      if (res.ok) {
        router.refresh()
      } else {
        const err = await res.json()
        setError(err.error || "Failed to save fields")
      }
    } catch {
      setError("Network error saving fields")
    } finally {
      setSavingFields(false)
    }
  }

  function copyLink(url: string, signerId: string) {
    navigator.clipboard.writeText(url)
    setCopied(signerId)
    setTimeout(() => setCopied(null), 2000)
  }

  const pageFields: OverlayField[] = fields
    .filter((f) => f.page === currentPage)
    .map((f) => ({
      id: f.id,
      type: f.type as OverlayField["type"],
      label: f.label,
      xPercent: f.xPercent,
      yPercent: f.yPercent,
      widthPercent: f.widthPercent,
      heightPercent: f.heightPercent,
      signerName: signers.find((s) => s.id === f.signerId)?.name,
      filled: !!f.filledAt,
      required: f.required,
    }))

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-warm text-sm tracking-wide mb-1">AirSign</p>
          <h1 className="font-[family-name:var(--font-cormorant)] italic text-cream text-2xl">{envelope.name}</h1>
        </div>
        <span className={`text-xs px-3 py-1 rounded ${STATUS_STYLES[envelope.status] || "text-cream-dim"}`}>
          {envelope.status.replace(/_/g, " ")}
        </span>
      </div>

      {error && (
        <div className="border border-red-500/30 rounded p-3 mb-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Field Placer for DRAFT envelopes */}
      {envelope.status === "DRAFT" && envelope.documentUrl && (
        <div className="mb-6">
          <p className="text-cream-dim text-xs tracking-wide mb-3">Place signature fields on the document</p>
          <FieldPlacer
            pdfUrl={envelope.documentUrl}
            signers={signers.map(s => ({ id: s.id, name: s.name, email: s.email, role: s.role }))}
            initialFields={fields.map(f => ({
              id: f.id,
              type: f.type as PlacedField["type"],
              label: f.label || "",
              signerId: f.signerId,
              required: f.required,
              page: f.page,
              xPercent: f.xPercent,
              yPercent: f.yPercent,
              widthPercent: f.widthPercent,
              heightPercent: f.heightPercent,
            }))}
            onSave={handleSaveFields}
            saving={savingFields}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: PDF viewer (non-DRAFT or no document) */}
        <div className="lg:col-span-2">
          {envelope.status !== "DRAFT" && envelope.documentUrl ? (
            <div className="relative">
              <PDFViewer
                pdfUrl={envelope.documentUrl}
                currentPage={currentPage}
                onPageLoad={handlePageLoad}
                scale={1.2}
              />
              <FieldOverlay
                fields={pageFields}
                pageWidth={pageDims.width}
                pageHeight={pageDims.height}
              />
              {(envelope.pageCount ?? 0) > 1 && (
                <div className="flex items-center justify-center gap-3 mt-3">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 text-sm border border-brown-border rounded-lg text-cream-dim hover:border-warm/30 hover:text-cream disabled:opacity-20 disabled:cursor-not-allowed transition focus:outline-none focus:ring-2 focus:ring-warm/30"
                  >
                    ← Prev
                  </button>
                  <span className="text-cream-dim/50 text-xs font-mono">
                    {currentPage} / {envelope.pageCount}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(envelope.pageCount ?? 1, p + 1))}
                    disabled={currentPage === (envelope.pageCount ?? 1)}
                    className="px-3 py-1.5 text-sm border border-brown-border rounded-lg text-cream-dim hover:border-warm/30 hover:text-cream disabled:opacity-20 disabled:cursor-not-allowed transition focus:outline-none focus:ring-2 focus:ring-warm/30"
                  >
                    Next →
                  </button>
                </div>
              )}
            </div>
          ) : !envelope.documentUrl ? (
            <div className="border border-brown-border rounded p-12 text-center">
              <p className="text-cream-dim text-sm">No document uploaded</p>
            </div>
          ) : null}
        </div>

        {/* Right: Signers + Actions + Audit */}
        <div className="space-y-4">
          {/* Send button (DRAFT only) */}
          {envelope.status === "DRAFT" && (
            <button
              onClick={() => setConfirmSend(true)}
              disabled={sending}
              className="w-full bg-warm text-brown font-medium py-3 rounded text-sm hover:brightness-110 disabled:opacity-50 transition focus:outline-none focus:ring-2 focus:ring-warm/50"
            >
              {sending ? "Sending..." : "Send for signing"}
            </button>
          )}

          {/* Send confirmation modal */}
          {confirmSend && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setConfirmSend(false)}>
              <div className="bg-forest-deep border border-brown-border rounded-xl p-6 max-w-sm mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-cream text-lg font-medium mb-2">Send for Signing?</h3>
                <p className="text-cream-dim text-sm mb-2">
                  This will send signing invitations to {signers.length} signer{signers.length !== 1 ? "s" : ""}:
                </p>
                <ul className="text-cream-dim/70 text-xs mb-6 space-y-1">
                  {signers.map(s => <li key={s.id}>• {s.name} ({s.email})</li>)}
                </ul>
                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmSend(false)}
                    className="flex-1 border border-brown-border text-cream-dim py-2.5 rounded-lg text-sm hover:border-warm/30 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => { setConfirmSend(false); handleSend() }}
                    className="flex-1 bg-warm text-brown py-2.5 rounded-lg text-sm font-medium hover:brightness-110 transition"
                  >
                    Send Now
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Signing Progress */}
          {envelope.status !== "DRAFT" && (
            <div className="border border-brown-border rounded p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-cream-dim text-xs tracking-wide">Progress</p>
                <span className="text-cream-dim/50 text-xs">
                  {signers.filter(s => s.signedAt).length} / {signers.length} signed
                </span>
              </div>
              <div className="h-1.5 bg-brown-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-warm rounded-full transition-all"
                  style={{ width: `${signers.length > 0 ? (signers.filter(s => s.signedAt).length / signers.length) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {/* Download Sealed PDF */}
          {envelope.status === "COMPLETED" && envelope.documentUrl && (
            <a
              href={envelope.documentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center bg-green-600/20 text-green-400 font-medium py-3 rounded text-sm hover:bg-green-600/30 transition"
            >
              Download Sealed PDF
            </a>
          )}

          {/* Signers */}
          <div className="border border-brown-border rounded p-4">
            <p className="text-cream-dim text-xs tracking-wide mb-3">Signers</p>
            <div className="space-y-2">
              {signers.map((s) => (
                <div key={s.id} className="border border-brown-border rounded p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-cream text-sm">{s.name}</p>
                    {s.signedAt && <span className="text-green-400 text-xs">Signed</span>}
                    {s.declinedAt && <span className="text-red-400 text-xs">Declined</span>}
                    {s.viewedAt && !s.signedAt && !s.declinedAt && <span className="text-warm text-xs">Viewed</span>}
                    {!s.viewedAt && !s.signedAt && envelope.status !== "DRAFT" && (
                      <span className="text-cream-dim/30 text-xs">Pending</span>
                    )}
                  </div>
                  <p className="text-cream-dim/50 text-xs">{s.email} · {s.role}</p>

                  {/* Show signing link + resend after sent */}
                  {envelope.status !== "DRAFT" && !s.signedAt && !s.declinedAt && (
                    <div className="flex items-center gap-3 mt-2">
                      <button
                        onClick={() => copyLink(s.signingUrl, s.id)}
                        className="text-warm text-xs hover:underline"
                      >
                        {copied === s.id ? "Copied!" : "Copy signing link"}
                      </button>
                      <button
                        disabled={resending === s.id}
                        onClick={async () => {
                          setResending(s.id)
                          try {
                            await fetch(`/api/airsign/envelopes/${envelope.id}/send`, { method: "POST" })
                          } catch { /* ignore */ }
                          finally { setResending(null) }
                        }}
                        className="text-cream-dim/50 text-xs hover:text-warm transition"
                      >
                        {resending === s.id ? "Sending..." : "Resend email"}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Fields summary */}
          <div className="border border-brown-border rounded p-4">
            <p className="text-cream-dim text-xs tracking-wide mb-2">Fields</p>
            <p className="text-cream text-sm">{fields.length} total</p>
            <p className="text-cream-dim/50 text-xs">
              {fields.filter((f) => f.filledAt).length} completed · {fields.filter((f) => !f.filledAt && f.required).length} pending
            </p>
          </div>

          {/* Audit trail */}
          {auditEvents.length > 0 && (
            <div className="border border-brown-border rounded p-4">
              <p className="text-cream-dim text-xs tracking-wide mb-3">Audit trail</p>
              <div className="space-y-1.5">
                {auditEvents.slice(0, 10).map((e) => (
                  <div key={e.id} className="text-xs">
                    <span className="text-cream-dim">{e.action}</span>
                    {e.signerName && <span className="text-cream-dim/50"> — {e.signerName}</span>}
                    <span className="text-cream-dim/30 ml-2">
                      {new Date(e.createdAt).toLocaleString("en-US", {
                        month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dates */}
          <div className="border border-brown-border rounded p-4 space-y-1">
            {envelope.sentAt && (
              <p className="text-cream-dim/50 text-xs">Sent: {new Date(envelope.sentAt).toLocaleDateString()}</p>
            )}
            {envelope.completedAt && (
              <p className="text-cream-dim/50 text-xs">Completed: {new Date(envelope.completedAt).toLocaleDateString()}</p>
            )}
            {envelope.expiresAt && (
              <p className="text-cream-dim/50 text-xs">Expires: {new Date(envelope.expiresAt).toLocaleDateString()}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
