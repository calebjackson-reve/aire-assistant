"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"

interface TemplateRow {
  id: string
  scope: string
  kind: string
  name: string
  description: string | null
  folder: string | null
  formCode: string | null
  pageCount: number | null
  updatedAt: string
}

const KIND_LABELS: Record<string, string> = {
  DOCUMENT: "Document",
  TASK_LIST: "Task list",
  CLAUSE: "Clause",
  FIELD_SET: "Field layout",
}

const SCOPE_STYLES: Record<string, string> = {
  PERSONAL: "bg-[#6b7d52]/10 text-[#9aab7e] border-[#6b7d52]/30",
  OFFICE: "bg-[#b5956a]/10 text-[#b5956a] border-[#b5956a]/30",
  BROKERAGE: "bg-[#9aab7e]/15 text-[#9aab7e] border-[#9aab7e]/40",
  MARKETPLACE: "bg-[#f5f2ea]/5 text-[#e8e4d8] border-[#e8e4d8]/20",
}

export function TemplatesClient({
  initialTemplates,
  brokerageId,
  officeId,
}: {
  initialTemplates: TemplateRow[]
  brokerageId: string | null
  officeId: string | null
}) {
  const router = useRouter()
  const [templates, setTemplates] = useState<TemplateRow[]>(initialTemplates)
  const [search, setSearch] = useState("")
  const [kindFilter, setKindFilter] = useState<string>("ALL")
  const [scopeFilter, setScopeFilter] = useState<string>("ALL")
  const [showNew, setShowNew] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [seedMessage, setSeedMessage] = useState<string | null>(null)

  async function handleSeedLrec() {
    setSeeding(true)
    setSeedMessage(null)
    try {
      const res = await fetch("/api/airsign/v2/templates/seed-lrec", { method: "POST" })
      if (!res.ok) {
        const e = await res.json().catch(() => ({ error: "Seed failed" }))
        setSeedMessage(e.error ?? "Seed failed")
        return
      }
      const data = await res.json()
      const created = data.seeded?.length ?? 0
      const skipped = data.skipped?.length ?? 0
      setSeedMessage(
        created > 0
          ? `Seeded ${created} LREC template${created === 1 ? "" : "s"}${skipped > 0 ? ` (${skipped} already existed)` : ""}. Refreshing…`
          : `All LREC templates already in your library.`
      )
      if (created > 0) router.refresh()
    } catch (err) {
      setSeedMessage(err instanceof Error ? err.message : "Seed failed")
    } finally {
      setSeeding(false)
    }
  }

  const filtered = useMemo(() => {
    return templates.filter((t) => {
      if (kindFilter !== "ALL" && t.kind !== kindFilter) return false
      if (scopeFilter !== "ALL" && t.scope !== scopeFilter) return false
      if (search) {
        const s = search.toLowerCase()
        const hay = `${t.name} ${t.description ?? ""} ${t.formCode ?? ""} ${t.folder ?? ""}`.toLowerCase()
        if (!hay.includes(s)) return false
      }
      return true
    })
  }, [templates, kindFilter, scopeFilter, search])

  const byFolder = useMemo(() => {
    const groups: Record<string, TemplateRow[]> = {}
    for (const t of filtered) {
      const key = t.folder ?? "Uncategorized"
      if (!groups[key]) groups[key] = []
      groups[key].push(t)
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  async function handleDelete(id: string) {
    if (!confirm("Delete this template? Envelopes already using it are unaffected.")) return
    const res = await fetch(`/api/airsign/v2/templates/${id}`, { method: "DELETE" })
    if (res.ok) setTemplates((prev) => prev.filter((t) => t.id !== id))
  }

  async function handleClone(id: string) {
    const res = await fetch(`/api/airsign/v2/templates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clone: true }),
    })
    if (res.ok) router.refresh()
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3 items-center mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search templates..."
          className="flex-1 min-w-[240px] bg-[#1e2416]/40 border border-[#4a5638]/50 rounded-md px-4 py-2.5 text-[#e8e4d8] text-sm placeholder:text-[#8a9070]/60 focus:outline-none focus:border-[#9aab7e]/60 focus:ring-2 focus:ring-[#9aab7e]/20"
        />
        <select
          value={scopeFilter}
          onChange={(e) => setScopeFilter(e.target.value)}
          className="bg-[#1e2416]/40 border border-[#4a5638]/50 rounded-md px-3 py-2.5 text-[#e8e4d8] text-sm focus:outline-none focus:border-[#9aab7e]/60"
        >
          <option value="ALL">All scopes</option>
          <option value="PERSONAL">Personal</option>
          <option value="OFFICE">Office</option>
          <option value="BROKERAGE">Brokerage</option>
          <option value="MARKETPLACE">Marketplace</option>
        </select>
        <select
          value={kindFilter}
          onChange={(e) => setKindFilter(e.target.value)}
          className="bg-[#1e2416]/40 border border-[#4a5638]/50 rounded-md px-3 py-2.5 text-[#e8e4d8] text-sm focus:outline-none focus:border-[#9aab7e]/60"
        >
          <option value="ALL">All kinds</option>
          <option value="DOCUMENT">Documents</option>
          <option value="CLAUSE">Clauses</option>
          <option value="TASK_LIST">Task lists</option>
          <option value="FIELD_SET">Field layouts</option>
        </select>
        <button
          type="button"
          onClick={handleSeedLrec}
          disabled={seeding}
          className="border border-[#6b7d52]/60 text-[#9aab7e] font-medium px-4 py-2.5 rounded-md text-sm hover:bg-[#6b7d52]/10 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-[#9aab7e]/40"
        >
          {seeding ? "Seeding..." : "Seed LREC forms"}
        </button>
        <button
          type="button"
          onClick={() => setShowNew(true)}
          className="bg-[#6b7d52] text-[#f5f2ea] font-medium px-5 py-2.5 rounded-md text-sm hover:bg-[#5a6b43] transition-colors focus:outline-none focus:ring-2 focus:ring-[#9aab7e]/40"
        >
          + New template
        </button>
      </div>

      {seedMessage && (
        <div className="mb-4 bg-[#1e2416]/40 border-l-[3px] border-[#9aab7e] text-[#e8e4d8] text-sm px-4 py-3 rounded">
          {seedMessage}
        </div>
      )}

      {byFolder.length === 0 ? (
        <div className="bg-[#1e2416]/40 border border-[#4a5638]/50 rounded-lg p-12 text-center">
          <p className="text-[#e8e4d8] font-[family-name:var(--font-playfair)] text-xl mb-2">No templates yet</p>
          <p className="text-[#e8e4d8]/50 text-sm mb-4">Upload a PDF, save a clause, or create a task list.</p>
          <button
            onClick={handleSeedLrec}
            disabled={seeding}
            className="bg-[#6b7d52] text-[#f5f2ea] px-5 py-2 rounded-md text-sm hover:bg-[#5a6b43] disabled:opacity-50 transition-colors"
          >
            {seeding ? "Seeding..." : "Seed 3 LREC templates"}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {byFolder.map(([folder, rows]) => (
            <div key={folder}>
              <p className="text-[#8a9070] text-[11px] tracking-[0.1em] uppercase mb-3">
                {folder} <span className="font-[family-name:var(--font-mono)] text-[#6b7d52]">({rows.length})</span>
              </p>
              <div className="grid gap-2">
                {rows.map((t) => (
                  <div key={t.id} className="group bg-[#1e2416]/40 border border-[#4a5638]/40 rounded-md p-4 hover:border-[#9aab7e]/40 transition-colors">
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-[#e8e4d8] font-medium truncate">{t.name}</p>
                          {t.formCode && (
                            <span className="text-[10px] font-[family-name:var(--font-mono)] text-[#9aab7e]/70 bg-[#6b7d52]/15 px-1.5 py-0.5 rounded">
                              {t.formCode}
                            </span>
                          )}
                        </div>
                        {t.description && <p className="text-[#e8e4d8]/50 text-xs truncate">{t.description}</p>}
                        <div className="flex items-center gap-3 mt-2 text-[11px]">
                          <span className={`px-2 py-0.5 rounded border text-[10px] tracking-wide ${SCOPE_STYLES[t.scope] ?? ""}`}>
                            {t.scope}
                          </span>
                          <span className="text-[#8a9070]">{KIND_LABELS[t.kind] ?? t.kind}</span>
                          {t.pageCount != null && (
                            <span className="font-[family-name:var(--font-mono)] text-[#8a9070]">{t.pageCount} pg</span>
                          )}
                        </div>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
                        {t.scope !== "PERSONAL" && (
                          <button
                            onClick={() => handleClone(t.id)}
                            className="text-[#8a9070] hover:text-[#9aab7e] text-xs px-2 py-1 transition-colors"
                          >
                            Clone → personal
                          </button>
                        )}
                        {t.scope !== "MARKETPLACE" && (
                          <button
                            onClick={() => handleDelete(t.id)}
                            className="text-[#8a9070] hover:text-[#c45c5c] text-xs px-2 py-1 transition-colors"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showNew && (
        <NewTemplateModal
          onClose={() => setShowNew(false)}
          brokerageId={brokerageId}
          officeId={officeId}
          onCreated={(t) => {
            setTemplates((prev) => [t, ...prev])
            setShowNew(false)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

function NewTemplateModal({
  onClose,
  brokerageId,
  officeId,
  onCreated,
}: {
  onClose: () => void
  brokerageId: string | null
  officeId: string | null
  onCreated: (t: TemplateRow) => void
}) {
  const [kind, setKind] = useState<string>("CLAUSE")
  const [scope, setScope] = useState<string>("PERSONAL")
  const [name, setName] = useState("")
  const [folder, setFolder] = useState("")
  const [description, setDescription] = useState("")
  const [clauseBody, setClauseBody] = useState("")
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function handleSave() {
    setErr(null)
    if (!name.trim()) {
      setErr("Name is required")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/airsign/v2/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          kind,
          name: name.trim(),
          folder: folder.trim() || undefined,
          description: description.trim() || undefined,
          clauseBody: kind === "CLAUSE" ? clauseBody : undefined,
          brokerageId: scope === "BROKERAGE" || scope === "OFFICE" ? brokerageId : undefined,
          officeId: scope === "OFFICE" ? officeId : undefined,
        }),
      })
      if (!res.ok) {
        const e = await res.json()
        setErr(e.error ?? "Failed to create")
        return
      }
      const { template } = await res.json()
      onCreated({
        id: template.id,
        scope: template.scope,
        kind: template.kind,
        name: template.name,
        description: template.description,
        folder: template.folder,
        formCode: template.formCode,
        pageCount: template.pageCount,
        updatedAt: template.updatedAt,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1e2416]/80 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[#f5f2ea] border border-[#c5c9b8] rounded-xl p-8 max-w-lg w-full mx-4 shadow-[0_20px_60px_rgba(30,36,22,0.3)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-[family-name:var(--font-playfair)] text-[#1e2416] text-2xl mb-6">New template</h2>

        {err && (
          <div className="bg-[#f5e8e8] border-l-[3px] border-[#8b4a4a] text-[#5a2a2a] text-sm px-4 py-3 rounded mb-4">
            {err}
          </div>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#8a9070] text-[10px] tracking-[0.08em] uppercase mb-1.5">Kind</label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value)}
                className="w-full bg-white border border-[#c5c9b8] rounded-md px-3 py-2.5 text-[#2c3520] text-sm focus:outline-none focus:border-[#6b7d52]"
              >
                <option value="CLAUSE">Clause</option>
                <option value="TASK_LIST">Task list</option>
                <option value="DOCUMENT">Document</option>
              </select>
            </div>
            <div>
              <label className="block text-[#8a9070] text-[10px] tracking-[0.08em] uppercase mb-1.5">Scope</label>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                className="w-full bg-white border border-[#c5c9b8] rounded-md px-3 py-2.5 text-[#2c3520] text-sm focus:outline-none focus:border-[#6b7d52]"
              >
                <option value="PERSONAL">Personal</option>
                {officeId && <option value="OFFICE">Office</option>}
                {brokerageId && <option value="BROKERAGE">Brokerage</option>}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[#8a9070] text-[10px] tracking-[0.08em] uppercase mb-1.5">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Inspection Repair Request"
              className="w-full bg-white border border-[#c5c9b8] rounded-md px-3 py-2.5 text-[#2c3520] text-sm focus:outline-none focus:border-[#6b7d52]"
            />
          </div>

          <div>
            <label className="block text-[#8a9070] text-[10px] tracking-[0.08em] uppercase mb-1.5">Folder (optional)</label>
            <input
              type="text"
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              placeholder="e.g., Purchase & Sale"
              className="w-full bg-white border border-[#c5c9b8] rounded-md px-3 py-2.5 text-[#2c3520] text-sm focus:outline-none focus:border-[#6b7d52]"
            />
          </div>

          <div>
            <label className="block text-[#8a9070] text-[10px] tracking-[0.08em] uppercase mb-1.5">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short helper text"
              className="w-full bg-white border border-[#c5c9b8] rounded-md px-3 py-2.5 text-[#2c3520] text-sm focus:outline-none focus:border-[#6b7d52]"
            />
          </div>

          {kind === "CLAUSE" && (
            <div>
              <label className="block text-[#8a9070] text-[10px] tracking-[0.08em] uppercase mb-1.5">Clause body</label>
              <textarea
                value={clauseBody}
                onChange={(e) => setClauseBody(e.target.value)}
                rows={5}
                placeholder="Reusable language to paste into contracts..."
                className="w-full bg-white border border-[#c5c9b8] rounded-md px-3 py-2.5 text-[#2c3520] text-sm focus:outline-none focus:border-[#6b7d52]"
              />
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-7">
          <button
            onClick={onClose}
            className="flex-1 border border-[#6b7d52] text-[#6b7d52] py-2.5 rounded-md text-sm font-medium hover:bg-[#6b7d52]/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-[#6b7d52] text-[#f5f2ea] py-2.5 rounded-md text-sm font-medium hover:bg-[#5a6b43] disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : "Create template"}
          </button>
        </div>
      </div>
    </div>
  )
}
