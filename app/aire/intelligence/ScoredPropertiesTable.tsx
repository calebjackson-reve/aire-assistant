"use client"

import { useState, useEffect, useCallback } from "react"

interface ScoredProperty {
  property_id: string
  address_canonical: string
  list_price: number | null
  aire_estimate: number | null
  confidence_tier: string | null
  source_disagreement_pct: number | null
  pps_total: number | null
  assessor_gap_pct: number | null
  score_date: string
  is_manually_reviewed: boolean
  review_notes: string | null
}

export function ScoredPropertiesTable() {
  const [properties, setProperties] = useState<ScoredProperty[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [tier, setTier] = useState<string>("")
  const [offset, setOffset] = useState(0)
  const limit = 25

  const fetchData = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const params = new URLSearchParams()
      if (tier) params.set("tier", tier)
      if (search.trim()) params.set("search", search.trim())
      params.set("limit", String(limit))
      params.set("offset", String(offset))

      const res = await fetch(`/api/data/admin?${params}`)
      if (res.ok) {
        const data = await res.json()
        setProperties(data.properties || [])
        setTotal(data.total || 0)
      }
    } catch {
      setFetchError("Failed to load scored properties")
    } finally {
      setLoading(false)
    }
  }, [tier, search, offset])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Reset offset when filters change
  useEffect(() => {
    setOffset(0)
  }, [tier, search])

  const tierColor = (t: string | null) => {
    if (t === "HIGH") return "text-green-400 bg-green-950/40 border-green-800/50"
    if (t === "MEDIUM") return "text-yellow-400 bg-yellow-950/40 border-yellow-800/50"
    if (t === "LOW") return "text-red-400 bg-red-950/40 border-red-800/50"
    return "text-zinc-500 bg-zinc-900 border-zinc-800"
  }

  return (
    <div className="border border-brown-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-cream font-medium">Scored Properties</h2>
        <span className="text-cream-dim text-xs">{total.toLocaleString()} total</span>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <input
          type="text"
          placeholder="Search address..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-forest-deep border border-brown-border rounded-lg px-3 py-2 text-cream text-sm placeholder:text-cream-dark/50 focus:outline-none focus:border-copper/40"
        />
        <select
          value={tier}
          onChange={(e) => setTier(e.target.value)}
          className="bg-forest-deep border border-brown-border rounded-lg px-3 py-2 text-cream text-sm focus:outline-none focus:border-copper/40"
        >
          <option value="">All tiers</option>
          <option value="HIGH">HIGH confidence</option>
          <option value="MEDIUM">MEDIUM confidence</option>
          <option value="LOW">LOW confidence</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-cream-dim text-sm py-8 text-center">Loading scores...</div>
      ) : fetchError ? (
        <div className="text-center py-8">
          <p className="text-red-400 text-sm mb-3">{fetchError}</p>
          <button onClick={fetchData} className="text-copper hover:text-copper-light text-sm">Retry</button>
        </div>
      ) : properties.length === 0 ? (
        <div className="text-cream-dim text-sm py-8 text-center">
          No scored properties found. Import data via /api/data/import to populate.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-cream-dim text-xs uppercase tracking-wider border-b border-brown-border">
                  <th className="text-left py-2 pr-3">Address</th>
                  <th className="text-right py-2 px-3">List Price</th>
                  <th className="text-right py-2 px-3">AIRE Est.</th>
                  <th className="text-center py-2 px-3">Confidence</th>
                  <th className="text-right py-2 px-3">PPS</th>
                  <th className="text-right py-2 px-3">Disagree %</th>
                  <th className="text-right py-2 px-3">Assessor Gap</th>
                  <th className="text-center py-2 pl-3">Reviewed</th>
                </tr>
              </thead>
              <tbody>
                {properties.map((p) => (
                  <tr key={p.property_id} className="border-b border-brown-border/30 hover:bg-forest-deep/50">
                    <td className="py-2.5 pr-3">
                      <div className="text-cream text-sm">{p.address_canonical || p.property_id}</div>
                      <div className="text-cream-dim text-xs">{p.score_date}</div>
                    </td>
                    <td className="text-right py-2.5 px-3 text-cream">
                      {p.list_price ? `$${p.list_price.toLocaleString()}` : "—"}
                    </td>
                    <td className="text-right py-2.5 px-3 text-cream font-medium">
                      {p.aire_estimate ? `$${p.aire_estimate.toLocaleString()}` : "—"}
                    </td>
                    <td className="text-center py-2.5 px-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${tierColor(p.confidence_tier)}`}>
                        {p.confidence_tier || "N/A"}
                      </span>
                    </td>
                    <td className="text-right py-2.5 px-3 text-cream">
                      {p.pps_total != null ? `${p.pps_total}/100` : "—"}
                    </td>
                    <td className="text-right py-2.5 px-3 text-cream">
                      {p.source_disagreement_pct != null
                        ? `${(p.source_disagreement_pct * 100).toFixed(1)}%`
                        : "—"}
                    </td>
                    <td className="text-right py-2.5 px-3 text-cream">
                      {p.assessor_gap_pct != null
                        ? `${(p.assessor_gap_pct * 100).toFixed(1)}%`
                        : "—"}
                    </td>
                    <td className="text-center py-2.5 pl-3">
                      {p.is_manually_reviewed ? (
                        <span className="text-green-400 text-xs" title={p.review_notes || ""}>Yes</span>
                      ) : (
                        <span className="text-zinc-600 text-xs">No</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > limit && (
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-brown-border/30">
              <button
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
                className="text-xs text-copper hover:text-copper-light disabled:text-zinc-600 transition-colors"
              >
                Previous
              </button>
              <span className="text-cream-dim text-xs">
                {offset + 1}–{Math.min(offset + limit, total)} of {total}
              </span>
              <button
                onClick={() => setOffset(offset + limit)}
                disabled={offset + limit >= total}
                className="text-xs text-copper hover:text-copper-light disabled:text-zinc-600 transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
