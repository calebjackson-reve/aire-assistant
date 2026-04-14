"use client"

import { useState, useEffect } from "react"
import { FeedbackButtons } from "@/components/FeedbackButtons"

interface Transaction {
  id: string
  propertyAddress: string
  status: string
  buyerName: string | null
  sellerName: string | null
}

interface FieldPreview {
  [key: string]: string
}

interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

const FORM_TYPES = [
  { value: "lrec-101", label: "Purchase Agreement (LREC-101)" },
  { value: "lrec-102", label: "Property Disclosure (LREC-102)" },
  { value: "lrec-103", label: "Addendum / Amendment (LREC-103)" },
]

export function ContractForm() {
  const [nlInput, setNlInput] = useState("")
  const [formType, setFormType] = useState("lrec-101")
  const [selectedTxn, setSelectedTxn] = useState("")
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [fields, setFields] = useState<FieldPreview | null>(null)
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [result, setResult] = useState<{ filename: string; envelopeId?: string; envelopeUrl?: string; pdfBase64?: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/transactions")
      .then(r => r.json())
      .then(data => setTransactions(data.transactions || []))
      .catch(() => {})
  }, [])

  async function handleGenerate(routeToAirSign = false) {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch("/api/contracts/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formType,
          naturalLanguage: nlInput || undefined,
          transactionId: selectedTxn || undefined,
          routeToAirSign,
          saveToTransaction: !!selectedTxn,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.validation) {
          setValidation(data.validation)
          setFields(data.fields || null)
        }
        const helpText = data.error === "No fields could be extracted"
          ? "I couldn't parse that. Try a more specific format like: 'Purchase agreement for 123 Main St, buyer John Smith, seller Jane Doe, price $250,000, closing June 15, conventional financing'"
          : data.error || "Contract generation failed. Please try again."
        setError(helpText)
        return
      }

      setFields(data.fields)
      setValidation(data.validation)
      setResult({
        filename: data.filename,
        envelopeId: data.envelopeId,
        envelopeUrl: data.envelopeUrl,
        pdfBase64: data.pdfBase64,
      })
    } catch {
      setError("Network error")
    } finally {
      setLoading(false)
    }
  }

  async function handlePreviewFields() {
    if (!nlInput.trim()) return
    setParsing(true)
    setError(null)

    try {
      const res = await fetch("/api/contracts/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formType,
          naturalLanguage: nlInput,
          transactionId: selectedTxn || undefined,
        }),
      })
      const data = await res.json()
      setFields(data.fields || null)
      setValidation(data.validation || null)
      if (data.error && !data.fields) setError(data.error)
    } catch {
      setError("Failed to parse")
    } finally {
      setParsing(false)
    }
  }

  function downloadPdf() {
    if (!result?.pdfBase64) return
    const bytes = Uint8Array.from(atob(result.pdfBase64), c => c.charCodeAt(0))
    const blob = new Blob([bytes], { type: "application/pdf" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = result.filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Form Type Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-[#6b7d52] text-[10px] font-medium tracking-[0.12em] uppercase block mb-1">Form Type</label>
          <select
            value={formType}
            onChange={e => setFormType(e.target.value)}
            className="w-full bg-surface-elevated border border-[#9aab7e]/20 rounded-lg px-3 py-2 text-[#1e2416] text-sm focus:outline-none focus:border-[#9aab7e]/50"
          >
            {FORM_TYPES.map(ft => (
              <option key={ft.value} value={ft.value}>{ft.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[#6b7d52] text-[10px] font-medium tracking-[0.12em] uppercase block mb-1">Link to Transaction (optional)</label>
          <select
            value={selectedTxn}
            onChange={e => setSelectedTxn(e.target.value)}
            className="w-full bg-surface-elevated border border-[#9aab7e]/20 rounded-lg px-3 py-2 text-[#1e2416] text-sm focus:outline-none focus:border-[#9aab7e]/50"
          >
            <option value="">None — standalone contract</option>
            {transactions.map(t => (
              <option key={t.id} value={t.id}>{t.propertyAddress} ({t.status.replace(/_/g, " ").toLowerCase()})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Natural Language Input */}
      <div>
        <label className="text-[#6b7d52] text-[10px] font-medium tracking-[0.12em] uppercase block mb-1">Describe the Contract</label>
        <textarea
          value={nlInput}
          onChange={e => setNlInput(e.target.value)}
          rows={4}
          placeholder="Write a purchase agreement for 123 Oak Drive, buyer Sarah Johnson, $285,000, close June 15, conventional financing, 7-day inspection"
          className="w-full bg-surface-elevated border border-[#9aab7e]/20 rounded-lg px-4 py-3 text-[#1e2416] text-sm focus:outline-none focus:border-[#9aab7e]/50 placeholder:text-[#6b7d52]/30 resize-none"
        />
        <button
          onClick={handlePreviewFields}
          disabled={parsing || !nlInput.trim()}
          className="mt-2 text-xs text-[#6b7d52] border border-[#9aab7e]/20 px-3 py-1 rounded hover:bg-[#9aab7e]/5 disabled:opacity-30 transition"
        >
          {parsing ? "Parsing..." : "Preview Fields"}
        </button>
      </div>

      {/* Field Preview */}
      {fields && (
        <div className="card-glass !rounded-xl !p-4">
          <p className="text-[#6b7d52] text-[10px] font-medium tracking-[0.12em] uppercase mb-2">Extracted Fields</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(fields).filter(([, v]) => v).map(([key, value]) => (
              <div key={key}>
                <p className="text-[#6b7d52]/50 text-[9px] uppercase">{key.replace(/_/g, " ")}</p>
                <p className="text-[#1e2416] text-xs">{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Validation */}
      {validation && (
        <div>
          {validation.errors.length > 0 && (
            <div className="border border-[#c45c5c]/20 rounded-lg p-3 mb-2">
              {validation.errors.map((e, i) => (
                <p key={i} className="text-[#c45c5c] text-xs">{e}</p>
              ))}
            </div>
          )}
          {validation.warnings.length > 0 && (
            <div className="border border-[#d4944c]/20 rounded-lg p-3">
              {validation.warnings.map((w, i) => (
                <p key={i} className="text-[#d4944c] text-xs">{w}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && !validation && (
        <div className="border border-[#c45c5c]/20 rounded-lg p-3">
          <p className="text-[#c45c5c] text-sm">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={() => handleGenerate(false)}
          disabled={loading}
          className="flex-1 bg-[#6b7d52] text-[#f5f2ea] py-3 rounded-lg text-sm font-medium hover:bg-[#6b7d52]/90 disabled:opacity-40 transition"
        >
          {loading ? "Generating..." : "Generate Contract"}
        </button>
        <button
          onClick={() => handleGenerate(true)}
          disabled={loading}
          className="flex-1 border border-[#6b7d52]/30 text-[#6b7d52] py-3 rounded-lg text-sm font-medium hover:bg-[#9aab7e]/5 disabled:opacity-40 transition"
        >
          {loading ? "..." : "Generate & Send for Signatures"}
        </button>
      </div>

      {/* Result */}
      {result && (
        <div className="card-glass !rounded-xl !p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2.5 h-2.5 rounded-full bg-[#9aab7e]" />
            <p className="text-[#1e2416] text-sm font-medium">Contract Generated</p>
          </div>
          <p className="text-[#6b7d52]/60 text-xs mb-3">{result.filename}</p>
          <div className="flex items-center gap-2">
            <button onClick={downloadPdf} className="text-xs border border-[#9aab7e]/20 text-[#6b7d52] px-3 py-1.5 rounded hover:bg-[#9aab7e]/5 transition">
              Download PDF
            </button>
            {result.envelopeUrl && (
              <a href={result.envelopeUrl} className="text-xs border border-[#9aab7e]/20 text-[#6b7d52] px-3 py-1.5 rounded hover:bg-[#9aab7e]/5 transition">
                Open in AirSign →
              </a>
            )}
            <div className="ml-auto">
              <FeedbackButtons
                feature="contract"
                metadata={{ formType, filename: result.filename }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
