'use client'

import { useState, useEffect, useCallback } from 'react'
import type { ChecklistItem } from '@/lib/tc/listing-checklist'

interface ChecklistRow extends ChecklistItem {
  status: string
  documentId: string | null
  fileUrl: string | null
  signatureStatus: string | null
  uploadedAt: string | null
}

interface ChecklistData {
  transaction: {
    id: string
    propertyAddress: string
    sellerName: string | null
    sellerEmail: string | null
  }
  checklist: ChecklistRow[]
  autoFill: Record<string, string>
}

export function ListingChecklist({ transactionId }: { transactionId: string }) {
  const [data, setData] = useState<ChecklistData | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)
  const [sending, setSending] = useState<string | null>(null)

  const fetchChecklist = useCallback(async () => {
    const res = await fetch(`/api/transactions/${transactionId}/listing-checklist`)
    if (res.ok) {
      setData(await res.json())
    }
    setLoading(false)
  }, [transactionId])

  useEffect(() => {
    fetchChecklist()
  }, [fetchChecklist])

  const handleUpload = async (itemId: string, file: File) => {
    setUploading(itemId)
    const formData = new FormData()
    formData.append("file", file)
    formData.append("transactionId", transactionId)
    formData.append("documentType", itemId)

    const res = await fetch("/api/documents/upload", {
      method: "POST",
      body: formData,
    })

    if (res.ok) {
      await fetchChecklist()
    }
    setUploading(null)
  }

  const handleSendForSignature = async (item: ChecklistRow) => {
    if (!item.documentId || !data?.transaction.sellerEmail) return
    setSending(item.id)

    // Create AirSign envelope with this document
    const res = await fetch("/api/airsign/envelopes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: item.name,
        transactionId,
        documentIds: [item.documentId],
        signers: item.signers
          .filter((s) => s !== "agent") // agent signs separately
          .map((role) => ({
            name: role === "seller" ? data.transaction.sellerName || "Seller" : "Buyer",
            email: role === "seller" ? data.transaction.sellerEmail : "",
            role,
          }))
          .filter((s) => s.email),
      }),
    })

    if (res.ok) {
      const envelope = await res.json()
      // Send the envelope
      await fetch(`/api/airsign/envelopes/${envelope.id}/send`, {
        method: "POST",
      })
      await fetchChecklist()
    }
    setSending(null)
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 bg-champagne-light/30 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  if (!data) {
    return <p className="text-ink-muted text-sm">Failed to load checklist.</p>
  }

  const required = data.checklist.filter((i) => i.requirement === "required")
  const optional = data.checklist.filter((i) => i.requirement !== "required")
  const completedCount = data.checklist.filter(
    (i) => i.status !== "missing"
  ).length
  const requiredComplete = required.filter((i) => i.status !== "missing").length

  return (
    <div>
      {/* Progress header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-[family-name:var(--font-cormorant)] text-xl italic text-ink">
            Listing Documents
          </h2>
          <p className="text-ink-muted text-xs mt-1">
            Anything you add is private until shared.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-ink font-[family-name:var(--font-mono)] text-lg">
              {completedCount}/{data.checklist.length}
            </p>
            <p className="text-ink-faint text-[10px] uppercase tracking-wider">
              Documents
            </p>
          </div>
          {/* Progress ring */}
          <div className="relative w-12 h-12">
            <svg viewBox="0 0 36 36" className="w-12 h-12 -rotate-90">
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="#d4c8b8" strokeWidth="2" />
              <circle
                cx="18" cy="18" r="15.5" fill="none"
                stroke={requiredComplete === required.length ? "#6b7d52" : "#9aab7e"}
                strokeWidth="2"
                strokeDasharray={`${(completedCount / data.checklist.length) * 97.4} 97.4`}
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Required section */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <p className="text-[10px] tracking-[0.15em] uppercase text-sage font-[family-name:var(--font-label)]">
            Required
          </p>
          <span className="text-[10px] text-ink-faint">
            {requiredComplete}/{required.length} complete
          </span>
        </div>
        <div className="bg-white border border-champagne-light rounded-lg overflow-hidden">
          {required.map((item, i) => (
            <DocumentRow
              key={item.id}
              item={item}
              isLast={i === required.length - 1}
              uploading={uploading === item.id}
              sending={sending === item.id}
              onUpload={(file) => handleUpload(item.id, file)}
              onSend={() => handleSendForSignature(item)}
              hasSellerEmail={!!data.transaction.sellerEmail}
            />
          ))}
        </div>
      </div>

      {/* Optional section */}
      {optional.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <p className="text-[10px] tracking-[0.15em] uppercase text-ink-faint font-[family-name:var(--font-label)]">
              Optional
            </p>
          </div>
          <div className="bg-white border border-champagne-light rounded-lg overflow-hidden">
            {optional.map((item, i) => (
              <DocumentRow
                key={item.id}
                item={item}
                isLast={i === optional.length - 1}
                uploading={uploading === item.id}
                sending={sending === item.id}
                onUpload={(file) => handleUpload(item.id, file)}
                onSend={() => handleSendForSignature(item)}
                hasSellerEmail={!!data.transaction.sellerEmail}
              />
            ))}
          </div>
        </div>
      )}

      {/* Auto-fill info */}
      <div className="mt-8 p-4 bg-sage/5 border border-sage/10 rounded-lg">
        <p className="text-[10px] tracking-wider uppercase text-sage font-[family-name:var(--font-label)] mb-2">
          Auto-fill available
        </p>
        <p className="text-ink-muted text-xs leading-relaxed">
          When you upload documents, AIRE will auto-fill known fields: property address,
          seller name, agent info, brokerage, and dates. Missing fields will be highlighted
          for you to complete.
        </p>
      </div>
    </div>
  )
}

/* ── Individual document row ── */
function DocumentRow({
  item,
  isLast,
  uploading,
  sending,
  onUpload,
  onSend,
  hasSellerEmail,
}: {
  item: ChecklistRow
  isLast: boolean
  uploading: boolean
  sending: boolean
  onUpload: (file: File) => void
  onSend: () => void
  hasSellerEmail: boolean
}) {
  const statusConfig = getStatusConfig(item.status, item.signatureStatus)

  return (
    <div
      className={`flex items-center gap-4 px-5 py-4 ${
        !isLast ? "border-b border-champagne-light/60" : ""
      } hover:bg-cream-cool/30 transition-colors`}
    >
      {/* Status badge */}
      <div className="w-20 shrink-0">
        <span
          className={`inline-flex items-center px-2 py-0.5 text-[9px] font-bold tracking-wide uppercase ${statusConfig.className}`}
        >
          {statusConfig.label}
        </span>
      </div>

      {/* Document name */}
      <div className="flex-1 min-w-0">
        <p className="text-ink text-sm font-medium truncate">{item.name}</p>
        {item.condition && (
          <p className="text-ink-faint text-[10px] mt-0.5">{item.condition}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {item.status === "missing" ? (
          <>
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) onUpload(file)
                }}
              />
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-sage border border-sage/20 rounded-md hover:bg-sage/5 transition-colors">
                {uploading ? (
                  <span className="w-3 h-3 border-2 border-sage/30 border-t-sage rounded-full animate-spin" />
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                )}
                Upload
              </span>
            </label>
          </>
        ) : (
          <>
            {/* Signer count */}
            {item.signers.length > 0 && (
              <span className="flex items-center gap-1 text-ink-faint text-[10px]">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2" />
                  <circle cx="9" cy="7" r="4" />
                </svg>
                {item.signers.length}
              </span>
            )}

            {/* Send for signature */}
            {item.signatureStatus !== "signed" && item.signers.length > 0 && hasSellerEmail && (
              <button
                onClick={onSend}
                disabled={sending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-olive border border-olive/20 rounded-md hover:bg-olive/5 transition-colors disabled:opacity-50"
              >
                {sending ? (
                  <span className="w-3 h-3 border-2 border-olive/30 border-t-olive rounded-full animate-spin" />
                ) : (
                  "Send"
                )}
              </button>
            )}

            {/* Signature status */}
            {item.signatureStatus === "signed" && (
              <span className="text-[10px] font-bold text-sage uppercase tracking-wide">
                Signed
              </span>
            )}

            {item.signatureStatus === "sent" && (
              <span className="text-[10px] font-bold text-[#d4944c] uppercase tracking-wide">
                Pending
              </span>
            )}

            {!item.signatureStatus && item.status !== "missing" && (
              <span className="text-[10px] font-bold text-ink-faint uppercase tracking-wide">
                Not Shared
              </span>
            )}
          </>
        )}

        {/* More menu dot */}
        <button className="p-1 text-ink-faint hover:text-ink transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="1.5" />
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="12" cy="19" r="1.5" />
          </svg>
        </button>
      </div>
    </div>
  )
}

function getStatusConfig(status: string, signatureStatus: string | null) {
  if (signatureStatus === "signed") {
    return { label: "Approved", className: "text-[#1e2416] font-bold" }
  }
  if (status === "uploaded" || status === "sent") {
    return { label: "Uploaded", className: "text-[#d4944c] font-bold" }
  }
  return { label: "Optional", className: "text-ink-faint" }
}
