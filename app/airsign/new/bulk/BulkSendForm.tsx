"use client"

import { useMemo, useRef, useState } from "react"
import Link from "next/link"

interface TemplateOption {
  id: string
  name: string
  scope: string
  kind: string
  formCode: string | null
  pageCount: number | null
}

interface BatchRow {
  id: string
  name: string
  status: string
  totalCount: number
  createdCount: number
  failedCount: number
  createdAt: string
}

interface BulkSendResult {
  batchId: string
  status: string
  createdCount: number
  failedCount: number
  envelopeIds: string[]
  errors: Array<{ rowIndex: number; error: string; signerEmail?: string }>
}

const SAMPLE_CSV = `envelope_name,transaction_id,signer_name,signer_email,signer_phone,signer_role,permission,auth_method
Inspection Response - 123 Main,,John Smith,john@example.com,,BUYER,CAN_SIGN,EMAIL_LINK
Inspection Response - 456 Oak,,Maria Lopez,maria@example.com,,SELLER,CAN_SIGN,EMAIL_LINK
Disclosure - 789 Elm,,Aaron Brown,aaron@example.com,,BUYER,CAN_SIGN,EMAIL_LINK
Disclosure - 789 Elm,,Beth Brown,beth@example.com,,BUYER,CAN_SIGN,EMAIL_LINK
Disclosure - 101 Pine,,Carla White,carla@example.com,,SELLER,CAN_SIGN,EMAIL_LINK
`

export function BulkSendForm({
  templates,
  recentBatches,
}: {
  templates: TemplateOption[]
  recentBatches: BatchRow[]
}) {
  const [templateId, setTemplateId] = useState<string>("")
  const [batchName, setBatchName] = useState<string>("")
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<BulkSendResult | null>(null)
  const [csvPreviewCount, setCsvPreviewCount] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const sortedTemplates = useMemo(() => {
    return [...templates].sort((a, b) => a.name.localeCompare(b.name))
  }, [templates])

  function downloadSample() {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "bulk-send-sample.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleFile(f: File | null) {
    setFile(f)
    setCsvPreviewCount(null)
    if (!f) return
    try {
      const text = await f.text()
      // Rough preview: count data lines (skip header + empty)
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
      setCsvPreviewCount(Math.max(0, lines.length - 1))
    } catch {
      setCsvPreviewCount(null)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setResult(null)

    if (!templateId) {
      setError("Select a template first")
      return
    }
    if (!file) {
      setError("Attach a CSV file")
      return
    }
    if (!batchName.trim()) {
      setError("Give this batch a name")
      return
    }

    const form = new FormData()
    form.append("templateId", templateId)
    form.append("batchName", batchName.trim())
    form.append("file", file)

    setSubmitting(true)
    try {
      const res = await fetch("/api/airsign/v2/bulk-send", {
        method: "POST",
        body: form,
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({ error: "Bulk send failed" }))
        setError(e.error ?? "Bulk send failed")
        return
      }
      const data: BulkSendResult = await res.json()
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-10">
      <form onSubmit={handleSubmit} className="space-y-6 bg-[#1e2416]/40 border border-[#4a5638]/50 rounded-lg p-6">
        {error && (
          <div className="bg-[#5a2a2a]/40 border-l-[3px] border-[#c45c5c] text-[#e8c2c2] text-sm px-4 py-3 rounded">
            {error}
          </div>
        )}

        <div>
          <label className="block text-[#8a9070] text-[10px] tracking-[0.1em] uppercase mb-2">Template</label>
          {sortedTemplates.length === 0 ? (
            <div className="bg-[#1e2416]/60 border border-dashed border-[#4a5638] rounded-md p-5 text-[#e8e4d8]/60 text-sm">
              No document templates yet.{" "}
              <Link href="/airsign/templates" className="text-[#9aab7e] underline underline-offset-2">
                Create one
              </Link>{" "}
              first — bulk send requires a reusable DOCUMENT or FIELD_SET template.
            </div>
          ) : (
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="w-full bg-[#1e2416]/60 border border-[#4a5638]/60 rounded-md px-3 py-2.5 text-[#e8e4d8] text-sm focus:outline-none focus:border-[#9aab7e]/60"
            >
              <option value="">Pick a template…</option>
              {sortedTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.formCode ? ` (${t.formCode})` : ""} — {t.scope.toLowerCase()}
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="block text-[#8a9070] text-[10px] tracking-[0.1em] uppercase mb-2">Batch name</label>
          <input
            type="text"
            value={batchName}
            onChange={(e) => setBatchName(e.target.value)}
            placeholder="e.g., April repair-request blast"
            className="w-full bg-[#1e2416]/60 border border-[#4a5638]/60 rounded-md px-3 py-2.5 text-[#e8e4d8] text-sm focus:outline-none focus:border-[#9aab7e]/60"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-[#8a9070] text-[10px] tracking-[0.1em] uppercase">Signer CSV</label>
            <button
              type="button"
              onClick={downloadSample}
              className="text-[#9aab7e] hover:text-[#b5c290] text-xs underline underline-offset-2 transition-colors"
            >
              Download sample CSV
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            className="w-full text-[#e8e4d8] text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-[#6b7d52] file:text-[#f5f2ea] file:font-medium hover:file:bg-[#5a6b43] file:cursor-pointer"
          />
          {csvPreviewCount !== null && (
            <p className="mt-2 text-[#9aab7e] text-xs font-[family-name:var(--font-mono)]">
              Detected {csvPreviewCount} row{csvPreviewCount === 1 ? "" : "s"} (excluding header)
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting || !sortedTemplates.length}
            className="bg-[#6b7d52] text-[#f5f2ea] font-medium px-6 py-2.5 rounded-md text-sm hover:bg-[#5a6b43] disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-[#9aab7e]/40"
          >
            {submitting ? "Creating envelopes…" : "Run bulk send"}
          </button>
          <Link
            href="/airsign"
            className="text-[#8a9070] hover:text-[#e8e4d8] text-sm transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>

      {result && <BulkResultPanel result={result} />}

      {recentBatches.length > 0 && (
        <div>
          <p className="text-[#8a9070] text-[11px] tracking-[0.1em] uppercase mb-3">Recent batches</p>
          <div className="space-y-2">
            {recentBatches.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between bg-[#1e2416]/30 border border-[#4a5638]/40 rounded-md px-4 py-3"
              >
                <div>
                  <p className="text-[#e8e4d8] text-sm">{b.name}</p>
                  <p className="text-[#8a9070] text-[11px] font-[family-name:var(--font-mono)]">
                    {new Date(b.createdAt).toLocaleString()} · {b.totalCount} row
                    {b.totalCount === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs font-[family-name:var(--font-mono)]">
                  <span className="text-[#9aab7e]">{b.createdCount} ok</span>
                  {b.failedCount > 0 && <span className="text-[#c45c5c]">{b.failedCount} failed</span>}
                  <StatusBadge status={b.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function BulkResultPanel({ result }: { result: BulkSendResult }) {
  const progress = result.createdCount + result.failedCount === 0
    ? 0
    : Math.round((result.createdCount / (result.createdCount + result.failedCount)) * 100)

  return (
    <div className="bg-[#1e2416]/50 border border-[#9aab7e]/40 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[#e8e4d8] font-[family-name:var(--font-playfair)] text-xl">
          {result.status === "COMPLETED" ? "Done" : result.status === "COMPLETED_WITH_ERRORS" ? "Completed with errors" : "Failed"}
        </p>
        <StatusBadge status={result.status} />
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <ResultStat label="Envelopes created" value={result.createdCount} color="sage" />
        <ResultStat label="Failed rows" value={result.failedCount} color="red" />
        <ResultStat label="Success rate" value={`${progress}%`} color="olive" />
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-[#1e2416]/60 rounded-full overflow-hidden mb-5">
        <div
          className="h-full bg-[#9aab7e] transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      {result.errors.length > 0 && (
        <div className="mb-4">
          <p className="text-[#c45c5c] text-xs tracking-[0.08em] uppercase mb-2">Row errors</p>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {result.errors.map((e, i) => (
              <div key={i} className="text-[#e8e4d8] text-xs font-[family-name:var(--font-mono)]">
                <span className="text-[#c45c5c]">Row {e.rowIndex + 1}</span>
                {e.signerEmail && <span className="text-[#8a9070]"> · {e.signerEmail}</span>}
                <span className="text-[#e8e4d8]/70"> — {e.error}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.envelopeIds.length > 0 && (
        <div className="flex items-center gap-3">
          <Link
            href="/airsign"
            className="bg-[#6b7d52] text-[#f5f2ea] px-4 py-2 rounded-md text-sm hover:bg-[#5a6b43] transition-colors"
          >
            View envelopes ({result.envelopeIds.length})
          </Link>
          <Link
            href="/airsign/new/bulk"
            className="text-[#8a9070] hover:text-[#e8e4d8] text-sm transition-colors"
          >
            Start another batch
          </Link>
        </div>
      )}
    </div>
  )
}

function ResultStat({ label, value, color }: { label: string; value: number | string; color: "sage" | "olive" | "red" }) {
  const colorClass =
    color === "sage" ? "text-[#9aab7e]" : color === "red" ? "text-[#c45c5c]" : "text-[#b5956a]"
  return (
    <div className="bg-[#1e2416]/40 border border-[#4a5638]/40 rounded-md p-3">
      <p className="text-[#8a9070] text-[10px] tracking-[0.1em] uppercase mb-1">{label}</p>
      <p className={`font-[family-name:var(--font-mono)] text-2xl leading-none ${colorClass}`}>{value}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    COMPLETED: "bg-[#9aab7e]/20 text-[#9aab7e] border-[#9aab7e]/40",
    COMPLETED_WITH_ERRORS: "bg-[#b5956a]/20 text-[#b5956a] border-[#b5956a]/40",
    FAILED: "bg-[#c45c5c]/20 text-[#c45c5c] border-[#c45c5c]/40",
    PROCESSING: "bg-[#e8e4d8]/10 text-[#e8e4d8] border-[#e8e4d8]/30",
    PENDING: "bg-[#e8e4d8]/10 text-[#e8e4d8] border-[#e8e4d8]/30",
  }
  const cls = styles[status] ?? "bg-[#e8e4d8]/10 text-[#e8e4d8] border-[#e8e4d8]/20"
  return (
    <span className={`border px-2 py-0.5 rounded text-[10px] tracking-wide ${cls}`}>
      {status.replace(/_/g, " ").toLowerCase()}
    </span>
  )
}
