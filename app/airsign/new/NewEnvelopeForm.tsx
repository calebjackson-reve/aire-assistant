"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

interface SignerInput {
  name: string
  email: string
  role: string
  order: number
}

// ─── Document Template Library ────────────────────────────────────
const TEMPLATE_CATEGORIES = [
  {
    name: "Purchase & Sale",
    templates: [
      { id: "lrec-rpa", name: "Residential Purchase Agreement", desc: "LREC standard purchase agreement for residential property", pages: 12, lrec: "RPA" },
      { id: "lrec-counter", name: "Counter Offer", desc: "Counter to an existing purchase offer", pages: 2, lrec: "CO" },
      { id: "lrec-addendum", name: "General Addendum", desc: "Addendum to any existing contract", pages: 1, lrec: "GA" },
      { id: "lrec-amendment", name: "Amendment to Purchase Agreement", desc: "Modify terms of an executed purchase agreement", pages: 2, lrec: "APA" },
      { id: "lrec-extension", name: "Extension of Time", desc: "Extend deadlines on purchase agreement", pages: 1, lrec: "EOT" },
      { id: "lrec-cancellation", name: "Cancellation & Release", desc: "Mutual cancellation and earnest money release", pages: 1, lrec: "CR" },
    ],
  },
  {
    name: "Listing & Agency",
    templates: [
      { id: "lrec-ela", name: "Exclusive Listing Agreement", desc: "Exclusive right to sell listing contract", pages: 6, lrec: "ELA" },
      { id: "lrec-bra", name: "Buyer Representation Agreement", desc: "Exclusive buyer agency agreement", pages: 4, lrec: "BRA" },
      { id: "lrec-dual-agency", name: "Dual Agency Disclosure", desc: "Consent to dual agency representation", pages: 2, lrec: "DAD" },
      { id: "lrec-spd", name: "Seller Property Disclosure", desc: "Louisiana seller property disclosure form", pages: 4, lrec: "SPD" },
    ],
  },
  {
    name: "Disclosures & Compliance",
    templates: [
      { id: "lrec-lead", name: "Lead-Based Paint Disclosure", desc: "Required for pre-1978 properties", pages: 2, lrec: "LBP" },
      { id: "lrec-flood", name: "Flood Zone Disclosure", desc: "Louisiana flood zone notification", pages: 1, lrec: "FZD" },
      { id: "lrec-property-condition", name: "Property Condition Disclosure", desc: "Detailed property condition statement", pages: 3, lrec: "PCD" },
      { id: "lrec-wire-fraud", name: "Wire Fraud Advisory", desc: "Wire transfer fraud warning notice", pages: 1, lrec: "WFA" },
      { id: "lrec-agency-disclosure", name: "Agency Disclosure", desc: "Louisiana agency relationship disclosure", pages: 1, lrec: "AD" },
    ],
  },
  {
    name: "Closing & Inspection",
    templates: [
      { id: "lrec-inspection", name: "Inspection Response", desc: "Buyer request for repairs after inspection", pages: 2, lrec: "IR" },
      { id: "lrec-inspection-waiver", name: "Inspection Waiver", desc: "Waiver of inspection contingency", pages: 1, lrec: "IW" },
      { id: "lrec-earnest-money", name: "Earnest Money Receipt", desc: "Receipt and deposit of earnest money", pages: 1, lrec: "EMR" },
      { id: "lrec-closing-instructions", name: "Closing Instructions", desc: "Instructions to title company for closing", pages: 2, lrec: "CI" },
      { id: "lrec-bill-of-sale", name: "Bill of Sale", desc: "Transfer of personal property at closing", pages: 1, lrec: "BOS" },
    ],
  },
  {
    name: "Lease & Rental",
    templates: [
      { id: "lrec-lease", name: "Residential Lease Agreement", desc: "Standard residential lease contract", pages: 8, lrec: "RLA" },
      { id: "lrec-lease-addendum", name: "Lease Addendum", desc: "Addendum to existing lease agreement", pages: 1, lrec: "LA" },
      { id: "lrec-lease-renewal", name: "Lease Renewal", desc: "Extension or renewal of lease terms", pages: 1, lrec: "LR" },
    ],
  },
]

export function NewEnvelopeForm() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [documentUrl, setDocumentUrl] = useState("")
  const [fileName, setFileName] = useState("")
  const [pageCount, setPageCount] = useState<number | null>(null)
  const [signers, setSigners] = useState<SignerInput[]>([
    { name: "", email: "", role: "SIGNER", order: 1 },
  ])
  const [parallel, setParallel] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [autoPlacedNotice, setAutoPlacedNotice] = useState<string | null>(null)
  const [showTemplates, setShowTemplates] = useState(true)
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [templateSearch, setTemplateSearch] = useState("")
  const [expandedCategory, setExpandedCategory] = useState<string | null>("Purchase & Sale")

  function addSigner() {
    const nextOrder = parallel ? 1 : signers.length + 1
    setSigners([...signers, { name: "", email: "", role: "SIGNER", order: nextOrder }])
  }

  function updateSigner(index: number, field: keyof SignerInput, value: string | number) {
    setSigners(signers.map((s, i) => (i === index ? { ...s, [field]: value } : s)))
  }

  function toggleParallel(next: boolean) {
    setParallel(next)
    // When toggling, reset orders: parallel = all 1, sequential = 1,2,3...
    setSigners((prev) => prev.map((s, i) => ({ ...s, order: next ? 1 : i + 1 })))
  }

  function removeSigner(index: number) {
    if (signers.length <= 1) return
    setSigners(signers.filter((_, i) => i !== index))
  }

  async function handleTemplateSelect(tmpl: { id: string; name: string; pages: number; lrec: string }) {
    setSelectedTemplate(tmpl.id)
    setName(tmpl.name)
    setUploading(true)
    setError(null)

    try {
      // Generate a blank template PDF via the contract writing engine
      const res = await fetch("/api/contracts/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formType: tmpl.lrec,
          prompt: `Generate a blank ${tmpl.name} template ready for signing`,
          fields: {},
        }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.pdfBase64) {
          // Upload the generated PDF to blob storage
          const pdfBlob = new Blob(
            [Uint8Array.from(atob(data.pdfBase64), (c) => c.charCodeAt(0))],
            { type: "application/pdf" }
          )
          const uploadRes = await fetch(
            `/api/airsign/upload?filename=${encodeURIComponent(tmpl.name + ".pdf")}`,
            { method: "POST", body: pdfBlob }
          )
          if (uploadRes.ok) {
            const uploadData = await uploadRes.json()
            setDocumentUrl(uploadData.url)
            setFileName(tmpl.name + ".pdf")
            setPageCount(uploadData.pageCount || tmpl.pages)
          } else {
            setError("Failed to upload generated template")
            setSelectedTemplate(null)
          }
        } else if (data.documentUrl) {
          setDocumentUrl(data.documentUrl)
          setFileName(tmpl.name + ".pdf")
          setPageCount(tmpl.pages)
        } else {
          setError("Template generation returned no document")
          setSelectedTemplate(null)
        }
      } else {
        // If contract engine isn't available, create a placeholder
        setError("Template generation is not available yet. Upload your own PDF instead.")
        setSelectedTemplate(null)
        setShowTemplates(false)
      }
    } catch {
      setError("Failed to generate template")
      setSelectedTemplate(null)
    } finally {
      setUploading(false)
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !file.name.endsWith(".pdf")) {
      setError("Please upload a PDF file")
      return
    }

    setUploading(true)
    setError(null)

    try {
      // Upload to Vercel Blob
      const res = await fetch(`/api/airsign/upload?filename=${encodeURIComponent(file.name)}`, {
        method: "POST",
        body: file,
      })

      if (res.ok) {
        const data = await res.json()
        setDocumentUrl(data.url)
        setFileName(data.filename || file.name)
        if (data.pageCount) setPageCount(data.pageCount)
        // Auto-fill envelope name from PDF title or filename
        if (data.suggestedName && !name.trim()) {
          setName(data.suggestedName)
        }
      } else {
        setError("Upload failed. Check that BLOB_READ_WRITE_TOKEN is configured.")
      }
    } catch {
      setError("Upload failed")
    } finally {
      setUploading(false)
    }
  }

  async function handleCreate() {
    if (!name.trim()) { setError("Envelope name is required"); return }
    if (!documentUrl) { setError("Please upload a PDF document"); return }
    if (signers.some((s) => !s.name.trim() || !s.email.trim())) {
      setError("All signers need a name and email")
      return
    }

    setCreating(true)
    setError(null)

    try {
      const res = await fetch("/api/airsign/envelopes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          documentUrl,
          pageCount,
          signers: signers.map((s) => ({ ...s, order: s.order || 1 })),
        }),
      })

      if (res.ok) {
        const envelope = await res.json()
        if (envelope.autoPlaced) {
          setAutoPlacedNotice(`Detected ${envelope.autoPlaced.displayName} — ${envelope.autoPlaced.count} fields auto-placed.`)
          // Brief delay so the agent sees the notice before navigation
          setTimeout(() => router.push(`/airsign/${envelope.id}`), 1400)
        } else {
          router.push(`/airsign/${envelope.id}`)
        }
      } else {
        const err = await res.json()
        setError(err.error ?? "Failed to create envelope")
      }
    } catch {
      setError("Network error")
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="border border-red-500/30 rounded p-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {autoPlacedNotice && (
        <div className="border border-warm/30 bg-[#9aab7e]/10 rounded p-3">
          <p className="text-[#6b7d52] text-sm">{autoPlacedNotice}</p>
        </div>
      )}

      {/* Envelope name */}
      <div>
        <label className="text-[#6a6a60] text-xs tracking-wide block mb-2">Envelope name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          spellCheck={false}
          placeholder="Auto-filled from document"
          className="w-full bg-transparent border border-[#d4c8b8]/60 rounded px-4 py-3 text-[#1e2416] text-sm focus:outline-none focus:border-warm/40 placeholder:text-[#6a6a60]/30"
        />
      </div>

      {/* Document: Template Library + Upload */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-[#6a6a60] text-xs tracking-wide">Document</label>
          {!documentUrl && (
            <div className="flex items-center gap-1 border border-[#d4c8b8]/60 rounded overflow-hidden">
              <button
                type="button"
                onClick={() => setShowTemplates(true)}
                className={`text-xs px-3 py-1 transition ${showTemplates ? "bg-[#9aab7e]/20 text-[#9aab7e]" : "text-[#6a6a60]/50 hover:text-[#6a6a60]"}`}
              >
                Templates
              </button>
              <button
                type="button"
                onClick={() => setShowTemplates(false)}
                className={`text-xs px-3 py-1 transition ${!showTemplates ? "bg-[#9aab7e]/20 text-[#9aab7e]" : "text-[#6a6a60]/50 hover:text-[#6a6a60]"}`}
              >
                Upload PDF
              </button>
            </div>
          )}
        </div>

        {documentUrl ? (
          <div className="border border-[#9aab7e]/30 bg-[#9aab7e]/5 rounded-lg p-3 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <svg className="w-4 h-4 text-[#9aab7e] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <span className="text-[#1e2416] text-sm truncate">{fileName || "Document uploaded"}</span>
              {pageCount ? <span className="text-[#6a6a60]/50 text-xs shrink-0">{pageCount} pg</span> : null}
            </div>
            <button
              onClick={() => { setDocumentUrl(""); setPageCount(null); setFileName(""); setSelectedTemplate(null); setShowTemplates(true) }}
              className="text-[#6a6a60] text-xs hover:text-[#1e2416] shrink-0 ml-3"
            >
              Replace
            </button>
          </div>
        ) : showTemplates ? (
          /* ── Template Library ── */
          <div className="space-y-3">
            {/* Search */}
            <input
              type="text"
              value={templateSearch}
              onChange={(e) => setTemplateSearch(e.target.value)}
              placeholder="Search templates... (e.g. purchase, disclosure, lease)"
              className="w-full bg-transparent border border-[#d4c8b8]/60 rounded px-3 py-2 text-[#1e2416] text-sm focus:outline-none focus:border-[#9aab7e]/40 placeholder:text-[#6a6a60]/30"
            />

            {/* Categories */}
            <div className="max-h-[400px] overflow-y-auto space-y-1 pr-1">
              {TEMPLATE_CATEGORIES.map((cat) => {
                const filtered = templateSearch.trim()
                  ? cat.templates.filter((t) =>
                      t.name.toLowerCase().includes(templateSearch.toLowerCase()) ||
                      t.desc.toLowerCase().includes(templateSearch.toLowerCase()) ||
                      t.lrec.toLowerCase().includes(templateSearch.toLowerCase())
                    )
                  : cat.templates

                if (filtered.length === 0) return null
                const isExpanded = expandedCategory === cat.name || templateSearch.trim().length > 0

                return (
                  <div key={cat.name}>
                    <button
                      type="button"
                      onClick={() => setExpandedCategory(isExpanded && !templateSearch ? null : cat.name)}
                      className="w-full flex items-center justify-between py-2 px-1 text-left"
                    >
                      <span className="text-[#1e2416] text-xs font-medium uppercase tracking-wider">{cat.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[#6a6a60]/40 text-[10px]">{filtered.length}</span>
                        <span className="text-[#6a6a60]/40 text-xs">{isExpanded ? "−" : "+"}</span>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="grid grid-cols-1 gap-1.5 pb-2">
                        {filtered.map((tmpl) => (
                          <button
                            key={tmpl.id}
                            type="button"
                            onClick={() => handleTemplateSelect(tmpl)}
                            className={`text-left rounded-lg border px-3 py-2.5 transition-all ${
                              selectedTemplate === tmpl.id
                                ? "border-[#9aab7e] bg-[#9aab7e]/10"
                                : "border-[#d4c8b8]/60/50 hover:border-[#9aab7e]/40 hover:bg-[#9aab7e]/5"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-[#1e2416] text-sm font-medium truncate">{tmpl.name}</p>
                                <p className="text-[#6a6a60]/50 text-xs mt-0.5">{tmpl.desc}</p>
                              </div>
                              <div className="shrink-0 flex items-center gap-2">
                                <span className="text-[10px] text-[#9aab7e]/60 font-mono">{tmpl.lrec}</span>
                                <span className="text-[10px] text-[#6a6a60]/30">{tmpl.pages}pg</span>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <p className="text-[#6a6a60]/30 text-[10px] text-center">
              Or <button type="button" onClick={() => setShowTemplates(false)} className="text-[#9aab7e]/60 hover:text-[#9aab7e] underline">upload your own PDF</button>
            </p>
          </div>
        ) : (
          /* ── Upload your own ── */
          <div>
            <label className="block border border-[#d4c8b8]/60 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-[#9aab7e]/30 transition-colors">
              <input type="file" accept=".pdf" onChange={handleFileUpload} className="hidden" />
              {uploading ? (
                <p className="text-[#6a6a60] text-sm">Uploading...</p>
              ) : (
                <>
                  <p className="text-[#6a6a60] text-sm">Click to upload PDF</p>
                  <p className="text-[#6a6a60]/30 text-xs mt-1">or drag and drop</p>
                </>
              )}
            </label>
            <p className="text-[#6a6a60]/30 text-[10px] text-center mt-2">
              Or <button type="button" onClick={() => setShowTemplates(true)} className="text-[#9aab7e]/60 hover:text-[#9aab7e] underline">choose from templates</button>
            </p>
          </div>
        )}
      </div>

      {/* Signers */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-[#6a6a60] text-xs tracking-wide">Signers</label>
          <div className="flex items-center gap-1 border border-[#d4c8b8]/60 rounded overflow-hidden">
            <button
              type="button"
              onClick={() => toggleParallel(true)}
              className={`text-xs px-3 py-1 transition ${parallel ? "bg-[#9aab7e]/20 text-[#6b7d52]" : "text-[#6a6a60]/50 hover:text-[#6a6a60]"}`}
            >
              Parallel
            </button>
            <button
              type="button"
              onClick={() => toggleParallel(false)}
              className={`text-xs px-3 py-1 transition ${!parallel ? "bg-[#9aab7e]/20 text-[#6b7d52]" : "text-[#6a6a60]/50 hover:text-[#6a6a60]"}`}
            >
              Sequential
            </button>
          </div>
        </div>
        <p className="text-[#6a6a60]/40 text-[10px] mb-2">
          {parallel
            ? "All signers get an invite at the same time."
            : "Signers are invited one-at-a-time in order. Lower numbers go first. Use the same number to group signers (e.g., both buyers at step 1)."}
        </p>
        <div className="space-y-2">
          {signers.map((signer, i) => (
            <div key={i} className="border border-[#d4c8b8]/60 rounded p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[#6a6a60] text-xs">Signer {i + 1}</span>
                {signers.length > 1 && (
                  <button onClick={() => removeSigner(i)} className="text-[#6a6a60]/30 text-xs hover:text-red-400">
                    Remove
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={signer.name}
                  onChange={(e) => updateSigner(i, "name", e.target.value)}
                  placeholder="Full name"
                  className="bg-transparent border border-[#d4c8b8]/60 rounded px-3 py-2 text-[#1e2416] text-sm focus:outline-none focus:border-warm/40 placeholder:text-[#6a6a60]/30"
                />
                <input
                  type="email"
                  value={signer.email}
                  onChange={(e) => updateSigner(i, "email", e.target.value)}
                  placeholder="email@example.com"
                  className="bg-transparent border border-[#d4c8b8]/60 rounded px-3 py-2 text-[#1e2416] text-sm focus:outline-none focus:border-warm/40 placeholder:text-[#6a6a60]/30"
                />
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <select
                  value={signer.role}
                  onChange={(e) => updateSigner(i, "role", e.target.value)}
                  className="bg-white border border-[#d4c8b8]/60 rounded px-3 py-2 text-[#1e2416] text-sm focus:outline-none"
                >
                  <option value="SIGNER">Signer</option>
                  <option value="WITNESS">Witness</option>
                  <option value="NOTARY">Notary</option>
                </select>
                {!parallel && (
                  <div className="flex items-center gap-1">
                    <label className="text-[#6a6a60]/60 text-[10px] uppercase">Order</label>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={signer.order}
                      onChange={(e) => updateSigner(i, "order", Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-14 bg-white border border-[#d4c8b8]/60 rounded px-2 py-2 text-[#1e2416] text-sm focus:outline-none focus:border-warm/40 text-center"
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={addSigner}
          className="mt-2 text-[#6b7d52] text-sm hover:underline"
        >
          + Add signer
        </button>
      </div>

      {/* Create */}
      <button
        onClick={handleCreate}
        disabled={creating}
        className="w-full bg-[#6b7d52] text-[#f5f2ea] font-medium py-3 rounded text-sm hover:bg-[#5a6c44] disabled:opacity-50 transition"
      >
        {creating ? "Creating..." : "Create envelope"}
      </button>
    </div>
  )
}
