"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"

interface ImportResult {
  imported: number
  skipped: number
  errors: number
  total: number
}

// Column mapping presets for known CSV formats
const FORMAT_PRESETS: Record<string, { label: string; description: string; mapping: Record<string, string> }> = {
  google: {
    label: "Google Contacts",
    description: "Exported from contacts.google.com",
    mapping: {
      "Given Name": "firstName",
      "Family Name": "lastName",
      "E-mail 1 - Value": "email",
      "Phone 1 - Value": "phone",
      "Notes": "notes",
      "Group Membership": "tags",
    },
  },
  iphone: {
    label: "iPhone / iCloud",
    description: "Exported from iCloud or iPhone contacts",
    mapping: {
      "First name": "firstName",
      "Last name": "lastName",
      "E-mail address": "email",
      "Phone": "phone",
      "Notes": "notes",
    },
  },
  followupboss: {
    label: "Follow Up Boss",
    description: "Exported from Follow Up Boss CRM",
    mapping: {
      "First Name": "firstName",
      "Last Name": "lastName",
      "Email": "email",
      "Phone": "phone",
      "Stage": "type",
      "Source": "source",
      "Tags": "tags",
      "Notes": "notes",
    },
  },
  dotloop: {
    label: "Dotloop",
    description: "Exported from Dotloop contacts",
    mapping: {
      "First Name": "firstName",
      "Last Name": "lastName",
      "Email": "email",
      "Phone Number": "phone",
      "Role": "type",
    },
  },
  generic: {
    label: "Other / Generic CSV",
    description: "Any CSV with first name, last name, email, phone columns",
    mapping: {
      "first_name": "firstName",
      "last_name": "lastName",
      "email": "email",
      "phone": "phone",
      "type": "type",
      "source": "source",
      "notes": "notes",
    },
  },
}

export function ContactImporter() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [format, setFormat] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<Array<Record<string, string>>>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [columnMap, setColumnMap] = useState<Record<string, string>>({})
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  function reset() {
    setFormat(null)
    setFile(null)
    setPreview([])
    setHeaders([])
    setColumnMap({})
    setResult(null)
    setError("")
    setImporting(false)
  }

  function parseCSV(text: string): Array<Record<string, string>> {
    const lines = text.split(/\r?\n/).filter((l) => l.trim())
    if (lines.length < 2) return []

    const hdrs = parseCSVLine(lines[0])
    setHeaders(hdrs)

    const rows: Array<Record<string, string>> = []
    for (let i = 1; i < lines.length; i++) {
      const vals = parseCSVLine(lines[i])
      const row: Record<string, string> = {}
      hdrs.forEach((h, idx) => { row[h] = vals[idx] ?? "" })
      rows.push(row)
    }
    return rows
  }

  function parseCSVLine(line: string): string[] {
    const result: string[] = []
    let current = ""
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (inQuotes) {
        if (char === '"' && line[i + 1] === '"') {
          current += '"'
          i++
        } else if (char === '"') {
          inQuotes = false
        } else {
          current += char
        }
      } else {
        if (char === '"') {
          inQuotes = true
        } else if (char === ",") {
          result.push(current.trim())
          current = ""
        } else {
          current += char
        }
      }
    }
    result.push(current.trim())
    return result
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setError("")
    setResult(null)

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const rows = parseCSV(text)
      setPreview(rows.slice(0, 5))

      // Auto-detect format and apply mapping
      if (format && FORMAT_PRESETS[format]) {
        applyPresetMapping(rows.length > 0 ? Object.keys(rows[0]) : [])
      } else {
        autoDetectMapping(rows.length > 0 ? Object.keys(rows[0]) : [])
      }
    }
    reader.readAsText(f)
  }

  function applyPresetMapping(csvHeaders: string[]) {
    if (!format) return
    const preset = FORMAT_PRESETS[format]
    const map: Record<string, string> = {}

    for (const csvH of csvHeaders) {
      // Exact match from preset
      if (preset.mapping[csvH]) {
        map[csvH] = preset.mapping[csvH]
        continue
      }
      // Case-insensitive match
      const lc = csvH.toLowerCase()
      for (const [presetH, field] of Object.entries(preset.mapping)) {
        if (presetH.toLowerCase() === lc) {
          map[csvH] = field
          break
        }
      }
      // Fallback fuzzy
      if (!map[csvH]) {
        map[csvH] = fuzzyMatch(csvH)
      }
    }
    setColumnMap(map)
  }

  function autoDetectMapping(csvHeaders: string[]) {
    const map: Record<string, string> = {}
    for (const h of csvHeaders) {
      map[h] = fuzzyMatch(h)
    }
    setColumnMap(map)
  }

  function fuzzyMatch(header: string): string {
    const h = header.toLowerCase().replace(/[^a-z0-9]/g, "")
    if (h.includes("firstname") || h === "givenname" || h === "first") return "firstName"
    if (h.includes("lastname") || h === "familyname" || h === "surname" || h === "last") return "lastName"
    if (h.includes("email") || h.includes("mail")) return "email"
    if (h.includes("phone") || h.includes("mobile") || h.includes("cell") || h.includes("tel")) return "phone"
    if (h.includes("type") || h.includes("role") || h.includes("stage") || h.includes("category")) return "type"
    if (h.includes("source") || h.includes("leadsource")) return "source"
    if (h.includes("note") || h.includes("comment")) return "notes"
    if (h.includes("tag") || h.includes("group") || h.includes("label")) return "tags"
    if (h.includes("neighborhood") || h.includes("area") || h.includes("zip")) return "neighborhood"
    if (h === "name" || h === "fullname" || h === "contactname") return "fullName"
    return "skip"
  }

  async function handleImport() {
    if (!file) return
    setImporting(true)
    setError("")

    try {
      const text = await file.text()
      const allRows = parseCSV(text)

      // Map rows using column mapping
      const mapped = allRows.map((row) => {
        const contact: Record<string, string | string[]> = {}
        for (const [csvCol, field] of Object.entries(columnMap)) {
          if (field === "skip" || !row[csvCol]?.trim()) continue
          if (field === "fullName") {
            const parts = row[csvCol].trim().split(/\s+/)
            contact.firstName = parts[0]
            contact.lastName = parts.slice(1).join(" ")
          } else if (field === "tags") {
            contact.tags = row[csvCol].split(/[;,]/).map((t) => t.trim()).filter(Boolean)
          } else {
            contact[field] = row[csvCol].trim()
          }
        }
        return contact
      }).filter((c) => c.firstName)

      const res = await fetch("/api/contacts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: mapped,
          source: format ? FORMAT_PRESETS[format]?.label : file.name,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Import failed")
      }

      const data: ImportResult = await res.json()
      setResult(data)
      if (data.imported > 0) {
        setTimeout(() => router.refresh(), 2000)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed")
    } finally {
      setImporting(false)
    }
  }

  const FIELD_OPTIONS = [
    { value: "skip", label: "— Skip —" },
    { value: "firstName", label: "First Name" },
    { value: "lastName", label: "Last Name" },
    { value: "fullName", label: "Full Name (will split)" },
    { value: "email", label: "Email" },
    { value: "phone", label: "Phone" },
    { value: "type", label: "Type (buyer/seller/lead)" },
    { value: "source", label: "Source" },
    { value: "notes", label: "Notes" },
    { value: "tags", label: "Tags" },
    { value: "neighborhood", label: "Neighborhood" },
  ]

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-sm bg-white hover:bg-[#9aab7e]/8 text-[#6a6a60] hover:text-[#1e2416] px-4 py-2 rounded-lg transition-colors border border-[#d4c8b8]/60"
      >
        Import Contacts
      </button>
    )
  }

  return (
    <div className="border border-[#d4c8b8]/60 rounded-xl p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-[family-name:var(--font-cormorant)] italic text-[#1e2416] text-xl">
          Import Contacts
        </h2>
        <button onClick={() => { reset(); setOpen(false) }} className="text-[#6a6a60] hover:text-[#1e2416] text-sm">
          Close
        </button>
      </div>

      {/* Step 1: Choose format */}
      {!format && (
        <div className="space-y-2">
          <p className="text-[#6a6a60] text-sm">Where are your contacts coming from?</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {Object.entries(FORMAT_PRESETS).map(([key, preset]) => (
              <button
                key={key}
                onClick={() => setFormat(key)}
                className="text-left border border-[#d4c8b8]/60/50 hover:border-[#9aab7e]/50 rounded-lg p-3 transition-colors"
              >
                <p className="text-[#1e2416] text-sm font-medium">{preset.label}</p>
                <p className="text-[#6a6a60] text-xs mt-0.5">{preset.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Upload file */}
      {format && !file && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <button onClick={() => setFormat(null)} className="text-[#6a6a60] hover:text-[#1e2416] text-xs">
              &larr; Back
            </button>
            <p className="text-[#1e2416] text-sm font-medium">{FORMAT_PRESETS[format]?.label}</p>
          </div>
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-[#d4c8b8]/60/50 hover:border-[#9aab7e]/50 rounded-xl p-8 text-center cursor-pointer transition-colors"
          >
            <p className="text-[#1e2416] text-sm font-medium">Click to upload CSV</p>
            <p className="text-[#6a6a60] text-xs mt-1">
              .csv file exported from {FORMAT_PRESETS[format]?.label}
            </p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      )}

      {/* Step 3: Preview + column mapping */}
      {file && !result && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[#1e2416] text-sm font-medium">
              {file.name} — {preview.length > 0 ? `previewing first 5 rows` : "parsing..."}
            </p>
            <button onClick={() => { setFile(null); setPreview([]); setHeaders([]) }} className="text-[#6a6a60] hover:text-[#1e2416] text-xs">
              Choose different file
            </button>
          </div>

          {/* Column mapping */}
          {headers.length > 0 && (
            <div className="space-y-2">
              <p className="text-[#6a6a60] text-xs uppercase tracking-wider">Column Mapping</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {headers.map((h) => (
                  <div key={h} className="flex items-center gap-2">
                    <span className="text-[#1e2416] text-xs truncate w-32 shrink-0" title={h}>{h}</span>
                    <span className="text-[#6a6a60] text-xs">&rarr;</span>
                    <select
                      value={columnMap[h] ?? "skip"}
                      onChange={(e) => setColumnMap((m) => ({ ...m, [h]: e.target.value }))}
                      className="flex-1 bg-white border border-[#d4c8b8]/50 rounded px-2 py-1 text-[#1e2416] text-xs focus:outline-none focus:border-[#9aab7e]"
                    >
                      {FIELD_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preview table */}
          {preview.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    {headers.filter((h) => columnMap[h] !== "skip").slice(0, 5).map((h) => (
                      <th key={h} className="text-left text-[#6a6a60] py-1 px-2 border-b border-[#d4c8b8]/60/30">
                        {columnMap[h] ?? h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i}>
                      {headers.filter((h) => columnMap[h] !== "skip").slice(0, 5).map((h) => (
                        <td key={h} className="text-[#1e2416] text-xs py-1 px-2 truncate max-w-32">
                          {row[h] ?? ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {error && <p className="text-status-red text-xs">{error}</p>}

          <div className="flex justify-end gap-2">
            <button
              onClick={() => { reset(); setOpen(false) }}
              className="btn-pill !py-2 !px-4 btn-pill-outline !text-xs"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={importing || !Object.values(columnMap).includes("firstName")}
              className="btn-pill !py-2 !px-4 btn-pill-primary !text-xs disabled:opacity-40"
            >
              {importing ? "Importing..." : "Import Contacts"}
            </button>
          </div>

          {!Object.values(columnMap).includes("firstName") && (
            <p className="text-status-amber text-xs">Map at least one column to &quot;First Name&quot; to import.</p>
          )}
        </div>
      )}

      {/* Step 4: Result */}
      {result && (
        <div className="text-center py-4 space-y-2">
          <p className="text-[#1e2416] text-lg font-medium">{result.imported} contacts imported</p>
          <div className="flex justify-center gap-4 text-xs text-[#6a6a60]">
            {result.skipped > 0 && <span>{result.skipped} duplicates skipped</span>}
            {result.errors > 0 && <span className="text-status-red">{result.errors} errors</span>}
          </div>
          <button
            onClick={() => { reset(); setOpen(false) }}
            className="text-[#6b7d52] text-sm hover:text-[#5a6c44] mt-2"
          >
            Done
          </button>
        </div>
      )}
    </div>
  )
}
