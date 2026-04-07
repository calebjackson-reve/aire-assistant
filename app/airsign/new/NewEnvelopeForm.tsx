"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

interface SignerInput {
  name: string
  email: string
  role: string
  order: number
}

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
        <div className="border border-warm/30 bg-warm/10 rounded p-3">
          <p className="text-warm text-sm">{autoPlacedNotice}</p>
        </div>
      )}

      {/* Envelope name */}
      <div>
        <label className="text-cream-dim text-xs tracking-wide block mb-2">Envelope name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          spellCheck={false}
          placeholder="Auto-filled from document"
          className="w-full bg-transparent border border-brown-border rounded px-4 py-3 text-cream text-sm focus:outline-none focus:border-warm/40 placeholder:text-cream-dim/30"
        />
      </div>

      {/* PDF upload */}
      <div>
        <label className="text-cream-dim text-xs tracking-wide block mb-2">Document (PDF)</label>
        {documentUrl ? (
          <div className="border border-warm/20 rounded p-3 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <svg className="w-4 h-4 text-warm shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <span className="text-cream text-sm truncate">{fileName || "Document uploaded"}</span>
              {pageCount ? <span className="text-cream-dim/50 text-xs shrink-0">{pageCount} pg</span> : null}
            </div>
            <button
              onClick={() => { setDocumentUrl(""); setPageCount(null); setFileName("") }}
              className="text-cream-dim text-xs hover:text-cream shrink-0 ml-3"
            >
              Replace
            </button>
          </div>
        ) : (
          <label className="block border border-brown-border border-dashed rounded p-8 text-center cursor-pointer hover:border-warm/20 transition-colors">
            <input type="file" accept=".pdf" onChange={handleFileUpload} className="hidden" />
            {uploading ? (
              <p className="text-cream-dim text-sm">Uploading...</p>
            ) : (
              <>
                <p className="text-cream-dim text-sm">Click to upload PDF</p>
                <p className="text-cream-dim/30 text-xs mt-1">or drag and drop</p>
              </>
            )}
          </label>
        )}
      </div>

      {/* Signers */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-cream-dim text-xs tracking-wide">Signers</label>
          <div className="flex items-center gap-1 border border-brown-border rounded overflow-hidden">
            <button
              type="button"
              onClick={() => toggleParallel(true)}
              className={`text-xs px-3 py-1 transition ${parallel ? "bg-warm/20 text-warm" : "text-cream-dim/50 hover:text-cream-dim"}`}
            >
              Parallel
            </button>
            <button
              type="button"
              onClick={() => toggleParallel(false)}
              className={`text-xs px-3 py-1 transition ${!parallel ? "bg-warm/20 text-warm" : "text-cream-dim/50 hover:text-cream-dim"}`}
            >
              Sequential
            </button>
          </div>
        </div>
        <p className="text-cream-dim/40 text-[10px] mb-2">
          {parallel
            ? "All signers get an invite at the same time."
            : "Signers are invited one-at-a-time in order. Lower numbers go first. Use the same number to group signers (e.g., both buyers at step 1)."}
        </p>
        <div className="space-y-2">
          {signers.map((signer, i) => (
            <div key={i} className="border border-brown-border rounded p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-cream-dim text-xs">Signer {i + 1}</span>
                {signers.length > 1 && (
                  <button onClick={() => removeSigner(i)} className="text-cream-dim/30 text-xs hover:text-red-400">
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
                  className="bg-transparent border border-brown-border rounded px-3 py-2 text-cream text-sm focus:outline-none focus:border-warm/40 placeholder:text-cream-dim/30"
                />
                <input
                  type="email"
                  value={signer.email}
                  onChange={(e) => updateSigner(i, "email", e.target.value)}
                  placeholder="email@example.com"
                  className="bg-transparent border border-brown-border rounded px-3 py-2 text-cream text-sm focus:outline-none focus:border-warm/40 placeholder:text-cream-dim/30"
                />
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <select
                  value={signer.role}
                  onChange={(e) => updateSigner(i, "role", e.target.value)}
                  className="bg-[#1e2416] border border-brown-border rounded px-3 py-2 text-cream text-sm focus:outline-none"
                >
                  <option value="SIGNER">Signer</option>
                  <option value="WITNESS">Witness</option>
                  <option value="NOTARY">Notary</option>
                </select>
                {!parallel && (
                  <div className="flex items-center gap-1">
                    <label className="text-cream-dim/60 text-[10px] uppercase">Order</label>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={signer.order}
                      onChange={(e) => updateSigner(i, "order", Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-14 bg-[#1e2416] border border-brown-border rounded px-2 py-2 text-cream text-sm focus:outline-none focus:border-warm/40 text-center"
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={addSigner}
          className="mt-2 text-warm text-sm hover:underline"
        >
          + Add signer
        </button>
      </div>

      {/* Create */}
      <button
        onClick={handleCreate}
        disabled={creating}
        className="w-full bg-warm text-brown font-medium py-3 rounded text-sm hover:brightness-110 disabled:opacity-50 transition"
      >
        {creating ? "Creating..." : "Create envelope"}
      </button>
    </div>
  )
}
