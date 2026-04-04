"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { PDFViewer, type PageDimensions } from "@/components/airsign/PDFViewer"
import { FieldOverlay, type OverlayField } from "@/components/airsign/FieldOverlay"

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
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

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
          <h1 className="font-[family-name:var(--font-newsreader)] italic text-cream text-2xl">{envelope.name}</h1>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: PDF viewer */}
        <div className="lg:col-span-2">
          {envelope.documentUrl ? (
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
                <div className="flex items-center justify-center gap-4 mt-3">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="text-cream-dim text-sm disabled:opacity-30"
                  >
                    ← Prev
                  </button>
                  <span className="text-cream-dim/50 text-xs">
                    Page {currentPage} of {envelope.pageCount}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(envelope.pageCount ?? 1, p + 1))}
                    disabled={currentPage === (envelope.pageCount ?? 1)}
                    className="text-cream-dim text-sm disabled:opacity-30"
                  >
                    Next →
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="border border-brown-border rounded p-12 text-center">
              <p className="text-cream-dim text-sm">No document uploaded</p>
            </div>
          )}
        </div>

        {/* Right: Signers + Actions + Audit */}
        <div className="space-y-4">
          {/* Send button (DRAFT only) */}
          {envelope.status === "DRAFT" && (
            <button
              onClick={handleSend}
              disabled={sending}
              className="w-full bg-warm text-brown font-medium py-3 rounded text-sm hover:brightness-110 disabled:opacity-50 transition"
            >
              {sending ? "Sending..." : "Send for signing"}
            </button>
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

                  {/* Show signing link after sent */}
                  {envelope.status !== "DRAFT" && !s.signedAt && !s.declinedAt && (
                    <button
                      onClick={() => copyLink(s.signingUrl, s.id)}
                      className="mt-2 text-warm text-xs hover:underline"
                    >
                      {copied === s.id ? "Copied!" : "Copy signing link"}
                    </button>
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
