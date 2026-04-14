"use client"

import { useCallback, useEffect, useState } from "react"

interface ErrorPatternRow {
  id: string
  agentName: string
  errorType: string
  errorMessage: string
  occurrences: number
  lastSeenAt: string
  createdAt: string
  resolved: boolean
}

interface FeatureFeedbackRow {
  feature: string
  total30d: number
  thumbsUp: number
  thumbsDown: number
  approvalRate: number | null
  corrections: number
  dismissed: number
  trend7d: { date: string; thumbsUp: number; thumbsDown: number }[]
  verdict: "love" | "neutral" | "flag" | "insufficient_data"
}

interface LearningInsights {
  generatedAt: string
  errorPatterns: ErrorPatternRow[]
  features: FeatureFeedbackRow[]
  digest: {
    loved: string[]
    flagged: string[]
    generatedAt: string
  }
}

const VERDICT_STYLE: Record<FeatureFeedbackRow["verdict"], { color: string; label: string }> = {
  love: { color: "#9aab7e", label: "Users love it" },
  neutral: { color: "#d4944c", label: "Mixed" },
  flag: { color: "#d45b5b", label: "Flagged" },
  insufficient_data: { color: "#6b7d52", label: "Too few ratings" },
}

const ERROR_TYPE_COLOR: Record<string, string> = {
  transient: "#d4944c",
  permanent: "#d45b5b",
  data_quality: "#9aab7e",
  prompt_failure: "#c4775a",
}

function featureLabel(f: string) {
  return f.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

export function LearningDashboard() {
  const [data, setData] = useState<LearningInsights | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/learning/insights", { cache: "no-store" })
      if (!res.ok) {
        setError(`Failed (${res.status})`)
        return
      }
      const json = (await res.json()) as LearningInsights
      setData(json)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function act(errorId: string, action: "resolve" | "ignore") {
    setBusyId(errorId)
    try {
      const resolution =
        action === "resolve" ? window.prompt("Short note on how you fixed it:") ?? "" : ""
      if (action === "resolve" && !resolution.trim()) {
        setBusyId(null)
        return
      }
      const res = await fetch("/api/learning/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ errorId, action, resolution }),
      })
      if (!res.ok) {
        alert(`Failed (${res.status})`)
        return
      }
      await load()
    } finally {
      setBusyId(null)
    }
  }

  async function seed() {
    setBusyId("seed")
    try {
      await fetch("/api/learning/seed", { method: "POST" })
      await load()
    } finally {
      setBusyId(null)
    }
  }

  if (loading && !data) {
    return <div className="text-[#6b7d52] text-sm">Loading insights...</div>
  }

  if (error && !data) {
    return <div className="text-[#d45b5b] text-sm">Error: {error}</div>
  }

  if (!data) return null

  return (
    <div className="space-y-10">
      {/* Weekly digest */}
      <section className="rounded-xl border border-[#3a4030] bg-[#1a1f15] p-6">
        <p className="text-[#6b7d52] text-xs tracking-[0.2em] uppercase mb-2">Weekly digest</p>
        <h2 className="font-[family-name:var(--font-cormorant)] italic text-[#e8e4d8] text-2xl mb-4">
          {data.digest.loved.length} loved · {data.digest.flagged.length} flagged
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          <DigestCard
            title="Users love"
            items={data.digest.loved.map(featureLabel)}
            tone="ok"
            emptyText="No feature has passed 90% approval yet."
          />
          <DigestCard
            title="Needs attention"
            items={data.digest.flagged.map(featureLabel)}
            tone="fail"
            emptyText="Nothing is under 70% approval. Ship it."
          />
        </div>
      </section>

      {/* Feature feedback */}
      <section>
        <SectionHeader title="Feedback per feature (30d)" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.features.map((f) => (
            <FeatureCard key={f.feature} row={f} />
          ))}
        </div>
      </section>

      {/* Error patterns */}
      <section>
        <SectionHeader
          title="Top error patterns"
          right={
            data.errorPatterns.length === 0 ? (
              <button
                onClick={seed}
                disabled={busyId === "seed"}
                className="text-[#9aab7e] hover:text-[#e8e4d8] text-xs underline disabled:opacity-40"
              >
                {busyId === "seed" ? "Seeding..." : "Seed demo pattern"}
              </button>
            ) : null
          }
        />
        {data.errorPatterns.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#3a4030] bg-[#1a1f15]/60 p-6 text-center">
            <p className="text-[#e8e4d8] text-sm mb-1">No unresolved error patterns.</p>
            <p className="text-[#6b7d52]/70 text-xs">
              Agents are running clean — or nothing has logged an error yet.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-[#3a4030] bg-[#1a1f15] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#222821] text-[#9aab7e] text-xs tracking-[0.15em] uppercase">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Agent</th>
                  <th className="text-left px-4 py-3 font-medium">Type</th>
                  <th className="text-left px-4 py-3 font-medium">Error</th>
                  <th className="text-left px-4 py-3 font-medium">Count</th>
                  <th className="text-left px-4 py-3 font-medium">Last seen</th>
                  <th className="text-left px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.errorPatterns.map((p) => (
                  <tr
                    key={p.id}
                    className="border-t border-[#3a4030] hover:bg-[#222821]/60 transition-colors"
                  >
                    <td className="px-4 py-3 text-[#e8e4d8] font-mono text-xs">{p.agentName}</td>
                    <td className="px-4 py-3">
                      <span
                        className="text-[10px] font-medium tracking-wider uppercase px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: `${ERROR_TYPE_COLOR[p.errorType] || "#6b7d52"}22`,
                          color: ERROR_TYPE_COLOR[p.errorType] || "#6b7d52",
                          border: `1px solid ${ERROR_TYPE_COLOR[p.errorType] || "#6b7d52"}44`,
                        }}
                      >
                        {p.errorType}
                      </span>
                    </td>
                    <td
                      className="px-4 py-3 text-[#e8e4d8]/80 text-xs max-w-[340px] truncate"
                      title={p.errorMessage}
                    >
                      {p.errorMessage}
                    </td>
                    <td className="px-4 py-3 text-[#e8e4d8] font-mono text-sm">{p.occurrences}</td>
                    <td className="px-4 py-3 text-[#6b7d52]/80 text-xs font-mono">
                      {new Date(p.lastSeenAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => act(p.id, "resolve")}
                          disabled={busyId === p.id}
                          className="text-[10px] px-2 py-1 rounded border border-[#9aab7e]/40 text-[#9aab7e] hover:bg-[#9aab7e]/10 disabled:opacity-40"
                        >
                          Resolve
                        </button>
                        <button
                          onClick={() => act(p.id, "ignore")}
                          disabled={busyId === p.id}
                          className="text-[10px] px-2 py-1 rounded border border-[#6b7d52]/40 text-[#6b7d52] hover:bg-[#6b7d52]/10 disabled:opacity-40"
                        >
                          Ignore
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function SectionHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between mb-4">
      <h2 className="font-[family-name:var(--font-cormorant)] italic text-[#e8e4d8] text-xl">
        {title}
      </h2>
      {right}
    </div>
  )
}

function DigestCard({
  title,
  items,
  tone,
  emptyText,
}: {
  title: string
  items: string[]
  tone: "ok" | "fail"
  emptyText: string
}) {
  const color = tone === "ok" ? "#9aab7e" : "#d45b5b"
  return (
    <div className="rounded-lg border border-[#3a4030] bg-[#222821]/40 p-4">
      <p className="text-[10px] tracking-[0.2em] uppercase mb-2" style={{ color }}>
        {title}
      </p>
      {items.length > 0 ? (
        <ul className="space-y-1">
          {items.map((i) => (
            <li key={i} className="text-[#e8e4d8] text-sm">
              · {i}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[#6b7d52]/70 text-xs">{emptyText}</p>
      )}
    </div>
  )
}

function FeatureCard({ row }: { row: FeatureFeedbackRow }) {
  const verdict = VERDICT_STYLE[row.verdict]
  const max = Math.max(1, ...row.trend7d.map((d) => d.thumbsUp + d.thumbsDown))

  return (
    <div className="rounded-xl border border-[#3a4030] bg-[#1a1f15] p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-[#e8e4d8] font-medium text-base">{featureLabel(row.feature)}</h3>
          <p className="text-[#6b7d52]/70 text-xs mt-0.5">{row.total30d} interactions · 30d</p>
        </div>
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] tracking-wider uppercase font-medium"
          style={{
            backgroundColor: `${verdict.color}22`,
            color: verdict.color,
            border: `1px solid ${verdict.color}44`,
          }}
        >
          {verdict.label}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-4">
        <Stat
          label="Approval"
          value={row.approvalRate !== null ? `${row.approvalRate}%` : "—"}
          strong
        />
        <Stat label="Up" value={row.thumbsUp.toString()} />
        <Stat label="Down" value={row.thumbsDown.toString()} />
        <Stat label="Corrections" value={row.corrections.toString()} />
      </div>

      <div>
        <p className="text-[10px] tracking-[0.2em] uppercase text-[#6b7d52] mb-2">7-day trend</p>
        <div className="flex items-end gap-1 h-14">
          {row.trend7d.map((d) => {
            const total = d.thumbsUp + d.thumbsDown
            const upPct = total > 0 ? (d.thumbsUp / total) * 100 : 0
            const h = Math.max(2, Math.round((total / max) * 48))
            return (
              <div
                key={d.date}
                className="flex-1 flex flex-col justify-end"
                title={`${d.date} · ${d.thumbsUp} up / ${d.thumbsDown} down`}
              >
                <div
                  className="w-full rounded-sm"
                  style={{
                    height: `${h}px`,
                    background:
                      total > 0
                        ? `linear-gradient(to top, #d45b5b 0%, #d45b5b ${100 - upPct}%, #9aab7e ${
                            100 - upPct
                          }%, #9aab7e 100%)`
                        : "#3a4030",
                  }}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <p className="text-[10px] tracking-[0.2em] uppercase text-[#6b7d52]">{label}</p>
      <p
        className={`font-mono mt-1 ${strong ? "text-[#e8e4d8] text-lg" : "text-[#e8e4d8]/80 text-sm"}`}
      >
        {value}
      </p>
    </div>
  )
}
