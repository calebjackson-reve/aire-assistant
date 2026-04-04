"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

interface SignerInput {
  name: string
  email: string
  role: string
}

export function NewEnvelopeForm() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [documentUrl, setDocumentUrl] = useState("")
  const [signers, setSigners] = useState<SignerInput[]>([
    { name: "", email: "", role: "SIGNER" },
  ])
  const [uploading, setUploading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addSigner() {
    setSigners([...signers, { name: "", email: "", role: "SIGNER" }])
  }

  function updateSigner(index: number, field: keyof SignerInput, value: string) {
    setSigners(signers.map((s, i) => (i === index ? { ...s, [field]: value } : s)))
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
          signers: signers.map((s, i) => ({ ...s, order: i + 1 })),
        }),
      })

      if (res.ok) {
        const envelope = await res.json()
        router.push(`/airsign/${envelope.id}`)
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

      {/* Envelope name */}
      <div>
        <label className="text-cream-dim text-xs tracking-wide block mb-2">Envelope name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Purchase Agreement — 123 Main St"
          className="w-full bg-transparent border border-brown-border rounded px-4 py-3 text-cream text-sm focus:outline-none focus:border-warm/40 placeholder:text-cream-dim/30"
        />
      </div>

      {/* PDF upload */}
      <div>
        <label className="text-cream-dim text-xs tracking-wide block mb-2">Document (PDF)</label>
        {documentUrl ? (
          <div className="border border-warm/20 rounded p-3 flex items-center justify-between">
            <span className="text-cream text-sm">Document uploaded</span>
            <button
              onClick={() => setDocumentUrl("")}
              className="text-cream-dim text-xs hover:text-cream"
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
        <label className="text-cream-dim text-xs tracking-wide block mb-2">Signers</label>
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
              <select
                value={signer.role}
                onChange={(e) => updateSigner(i, "role", e.target.value)}
                className="bg-[#1e2416] border border-brown-border rounded px-3 py-2 text-cream text-sm focus:outline-none w-full"
              >
                <option value="SIGNER">Signer</option>
                <option value="WITNESS">Witness</option>
                <option value="NOTARY">Notary</option>
              </select>
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
