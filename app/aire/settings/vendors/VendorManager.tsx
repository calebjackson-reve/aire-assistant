"use client"

import { useState, useRef } from "react"

interface Vendor {
  id: string
  name: string
  company: string | null
  category: string
  phone: string | null
  email: string | null
  notes: string | null
  preferred: boolean
  createdAt: string
  updatedAt: string
}

const CATEGORIES = [
  { value: "inspector", label: "Inspector" },
  { value: "appraiser", label: "Appraiser" },
  { value: "title", label: "Title Company" },
  { value: "surveyor", label: "Surveyor" },
  { value: "pest", label: "Pest Inspector" },
  { value: "other", label: "Other" },
]

function categoryLabel(cat: string): string {
  return CATEGORIES.find((c) => c.value === cat)?.label ?? cat
}

export function VendorManager({ initialVendors }: { initialVendors: Vendor[] }) {
  const [vendors, setVendors] = useState<Vendor[]>(initialVendors)
  const [showForm, setShowForm] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Form state
  const [form, setForm] = useState({
    name: "",
    company: "",
    category: "inspector",
    phone: "",
    email: "",
    notes: "",
    preferred: false,
  })

  async function handleAdd() {
    if (!form.name.trim()) {
      setError("Name is required")
      return
    }
    setSaving(true)
    setError(null)

    try {
      const res = await fetch("/api/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Failed to add vendor")
        return
      }
      setVendors((prev) => [...prev, data.vendor])
      setForm({ name: "", company: "", category: "inspector", phone: "", email: "", notes: "", preferred: false })
      setShowForm(false)
    } catch {
      setError("Network error")
    } finally {
      setSaving(false)
    }
  }

  async function handleImport() {
    const file = fileRef.current?.files?.[0]
    if (!file) return

    setImporting(true)
    setImportResult(null)
    setError(null)

    try {
      const fd = new FormData()
      fd.append("file", file)

      const res = await fetch("/api/vendors/import", {
        method: "POST",
        body: fd,
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Import failed")
        return
      }

      setVendors((prev) => [...prev, ...data.vendors])
      setImportResult(`Imported ${data.imported} vendor${data.imported !== 1 ? "s" : ""} from PDF`)

      if (fileRef.current) fileRef.current.value = ""
    } catch {
      setError("Network error during import")
    } finally {
      setImporting(false)
    }
  }

  async function togglePreferred(vendor: Vendor) {
    // Optimistic update
    setVendors((prev) =>
      prev.map((v) => (v.id === vendor.id ? { ...v, preferred: !v.preferred } : v))
    )

    try {
      await fetch("/api/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...vendor,
          preferred: !vendor.preferred,
        }),
      })
    } catch {
      // Revert on failure
      setVendors((prev) =>
        prev.map((v) => (v.id === vendor.id ? { ...v, preferred: vendor.preferred } : v))
      )
    }
  }

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-copper text-white text-sm rounded-lg hover:bg-copper/90 transition-colors"
        >
          {showForm ? "Cancel" : "+ Add Vendor"}
        </button>

        <label className="px-4 py-2 border border-brown-border text-cream text-sm rounded-lg hover:bg-white/5 transition-colors cursor-pointer">
          {importing ? "Importing..." : "Upload Vendor PDF"}
          <input
            ref={fileRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handleImport}
            disabled={importing}
          />
        </label>
      </div>

      {/* Status messages */}
      {error && (
        <div className="p-3 border border-red-500/30 rounded-xl bg-red-500/10 text-red-300 text-sm">
          {error}
        </div>
      )}
      {importResult && (
        <div className="p-3 border border-green-500/30 rounded-xl bg-green-500/10 text-green-300 text-sm">
          {importResult}
        </div>
      )}

      {/* Add Vendor Form */}
      {showForm && (
        <div className="border border-brown-border rounded-xl p-5 space-y-4">
          <h2 className="text-cream text-sm font-medium">New Vendor</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              placeholder="Name *"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="bg-white/5 border border-brown-border rounded-lg px-3 py-2 text-cream text-sm placeholder:text-cream-dim/40 focus:outline-none focus:border-copper"
            />
            <input
              placeholder="Company"
              value={form.company}
              onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
              className="bg-white/5 border border-brown-border rounded-lg px-3 py-2 text-cream text-sm placeholder:text-cream-dim/40 focus:outline-none focus:border-copper"
            />
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="bg-white/5 border border-brown-border rounded-lg px-3 py-2 text-cream text-sm focus:outline-none focus:border-copper"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value} className="bg-[#1a1f14] text-cream">
                  {c.label}
                </option>
              ))}
            </select>
            <input
              placeholder="Phone"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="bg-white/5 border border-brown-border rounded-lg px-3 py-2 text-cream text-sm placeholder:text-cream-dim/40 focus:outline-none focus:border-copper"
            />
            <input
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="bg-white/5 border border-brown-border rounded-lg px-3 py-2 text-cream text-sm placeholder:text-cream-dim/40 focus:outline-none focus:border-copper"
            />
            <input
              placeholder="Notes"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="bg-white/5 border border-brown-border rounded-lg px-3 py-2 text-cream text-sm placeholder:text-cream-dim/40 focus:outline-none focus:border-copper"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.preferred}
              onChange={(e) => setForm((f) => ({ ...f, preferred: e.target.checked }))}
              className="rounded border-brown-border"
            />
            <span className="text-cream-dim text-sm">Preferred vendor</span>
          </div>
          <button
            onClick={handleAdd}
            disabled={saving}
            className="px-4 py-2 bg-copper text-white text-sm rounded-lg hover:bg-copper/90 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Vendor"}
          </button>
        </div>
      )}

      {/* Vendor Table */}
      {vendors.length === 0 ? (
        <div className="border border-brown-border rounded-xl p-8 text-center">
          <p className="text-cream-dim text-sm">No vendors yet.</p>
          <p className="text-cream-dim/50 text-xs mt-1">
            Add vendors manually or upload a PDF vendor list to get started.
          </p>
        </div>
      ) : (
        <div className="border border-brown-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brown-border bg-white/5">
                  <th className="text-left px-4 py-3 text-cream-dim font-medium"></th>
                  <th className="text-left px-4 py-3 text-cream-dim font-medium">Name</th>
                  <th className="text-left px-4 py-3 text-cream-dim font-medium">Company</th>
                  <th className="text-left px-4 py-3 text-cream-dim font-medium">Category</th>
                  <th className="text-left px-4 py-3 text-cream-dim font-medium">Phone</th>
                  <th className="text-left px-4 py-3 text-cream-dim font-medium">Email</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((v) => (
                  <tr key={v.id} className="border-b border-brown-border/50 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => togglePreferred(v)}
                        className={`text-lg ${v.preferred ? "text-yellow-400" : "text-cream-dim/30"} hover:text-yellow-400 transition-colors`}
                        title={v.preferred ? "Remove preferred" : "Mark as preferred"}
                      >
                        {v.preferred ? "\u2605" : "\u2606"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-cream">{v.name}</td>
                    <td className="px-4 py-3 text-cream-dim">{v.company || "\u2014"}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 text-xs rounded border border-brown-border text-cream-dim">
                        {categoryLabel(v.category)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-cream-dim">{v.phone || "\u2014"}</td>
                    <td className="px-4 py-3 text-cream-dim">{v.email || "\u2014"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary */}
      {vendors.length > 0 && (
        <p className="text-cream-dim/50 text-xs">
          {vendors.length} vendor{vendors.length !== 1 ? "s" : ""} &middot;{" "}
          {vendors.filter((v) => v.preferred).length} preferred
        </p>
      )}
    </div>
  )
}
