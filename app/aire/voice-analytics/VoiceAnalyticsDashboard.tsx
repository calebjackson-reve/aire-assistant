"use client"

import { useState, useEffect } from "react"

interface AnalyticsData {
  days: number
  totalCommands: number
  timing: { avgTotalMs: number; avgClassifyMs: number; p95TotalMs: number }
  fastPath: { count: number; rate: number }
  confidence: { avg: number; lowConfCount: number }
  intentBreakdown: Array<{ intent: string; count: number; pct: number }>
  statusCounts: Record<string, number>
  dailyVolume: Record<string, number>
  recent: Array<{
    id: string; transcript: string; intent: string | null
    confidence: number | null; status: string
    totalMs: number | undefined; classifyMs: number | undefined
    createdAt: string
  }>
}

export default function VoiceAnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [days, setDays] = useState(7)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/voice-command/analytics?days=${days}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [days])

  if (loading) return <div className="text-cream-dim">Loading analytics...</div>
  if (!data) return <div className="text-cream-dim">No analytics data available.</div>

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex gap-2">
        {[7, 14, 30].map(d => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              days === d ? "bg-copper text-forest-deep" : "bg-forest-deep border border-brown-border text-cream-dim hover:text-cream"
            }`}
          >
            {d}d
          </button>
        ))}
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Total Commands" value={String(data.totalCommands)} />
        <MetricCard
          label="Avg Response"
          value={`${(data.timing.avgTotalMs / 1000).toFixed(1)}s`}
          sub={`P95: ${(data.timing.p95TotalMs / 1000).toFixed(1)}s`}
        />
        <MetricCard
          label="Fast-Path Rate"
          value={`${(data.fastPath.rate * 100).toFixed(0)}%`}
          sub={`${data.fastPath.count} of ${data.totalCommands}`}
        />
        <MetricCard
          label="Avg Confidence"
          value={`${(data.confidence.avg * 100).toFixed(0)}%`}
          sub={`${data.confidence.lowConfCount} low-conf`}
        />
      </div>

      {/* Intent breakdown + Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border border-brown-border rounded-xl p-5">
          <h3 className="text-cream-dim text-xs uppercase tracking-wider mb-3">Intent Distribution</h3>
          {data.intentBreakdown.length === 0 ? (
            <p className="text-cream-dim text-sm">No commands yet</p>
          ) : (
            <div className="space-y-2">
              {data.intentBreakdown.slice(0, 10).map(i => (
                <div key={i.intent} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-cream font-mono text-xs">{i.intent}</span>
                      <span className="text-cream-dim text-xs">{i.count}</span>
                    </div>
                    <div className="h-1.5 bg-forest-deep rounded-full overflow-hidden">
                      <div
                        className="h-full bg-copper rounded-full"
                        style={{ width: `${Math.max(i.pct * 100, 2)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border border-brown-border rounded-xl p-5">
          <h3 className="text-cream-dim text-xs uppercase tracking-wider mb-3">Status Breakdown</h3>
          <div className="space-y-2">
            {Object.entries(data.statusCounts).map(([status, count]) => (
              <div key={status} className="flex justify-between items-center">
                <span className={`text-sm font-mono ${
                  status === "completed" ? "text-green-400" :
                  status === "failed" ? "text-red-400" :
                  status === "clarification_needed" ? "text-yellow-400" :
                  "text-cream-dim"
                }`}>{status}</span>
                <span className="text-cream text-sm font-medium">{count}</span>
              </div>
            ))}
          </div>

          <h3 className="text-cream-dim text-xs uppercase tracking-wider mt-6 mb-3">Timing Breakdown</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-cream-dim">Avg Classify</span>
              <span className="text-cream font-mono">{data.timing.avgClassifyMs}ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-cream-dim">Avg Total</span>
              <span className="text-cream font-mono">{data.timing.avgTotalMs}ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-cream-dim">P95 Total</span>
              <span className="text-cream font-mono">{data.timing.p95TotalMs}ms</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent commands */}
      <div className="border border-brown-border rounded-xl p-5">
        <h3 className="text-cream-dim text-xs uppercase tracking-wider mb-3">Recent Commands</h3>
        {data.recent.length === 0 ? (
          <p className="text-cream-dim text-sm">No voice commands yet. Try saying "Show my pipeline".</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-cream-dim text-xs uppercase border-b border-brown-border">
                  <th className="text-left py-2 pr-3">Transcript</th>
                  <th className="text-left py-2 px-3">Intent</th>
                  <th className="text-right py-2 px-3">Conf.</th>
                  <th className="text-right py-2 px-3">Time</th>
                  <th className="text-center py-2 pl-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map(cmd => (
                  <tr key={cmd.id} className="border-b border-brown-border/30">
                    <td className="py-2 pr-3 text-cream max-w-[200px] truncate">{cmd.transcript}</td>
                    <td className="py-2 px-3 text-cream-dim font-mono text-xs">{cmd.intent || "—"}</td>
                    <td className="py-2 px-3 text-right text-cream">
                      {cmd.confidence != null ? `${(cmd.confidence * 100).toFixed(0)}%` : "—"}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-cream">
                      {cmd.totalMs != null ? `${(cmd.totalMs / 1000).toFixed(1)}s` : "—"}
                      {cmd.classifyMs === 0 && cmd.totalMs != null && (
                        <span className="ml-1 text-green-400 text-[10px]">FAST</span>
                      )}
                    </td>
                    <td className="py-2 pl-3 text-center">
                      <span className={`text-xs ${
                        cmd.status === "completed" ? "text-green-400" :
                        cmd.status === "failed" ? "text-red-400" :
                        "text-yellow-400"
                      }`}>{cmd.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border border-brown-border rounded-xl p-4">
      <div className="text-cream-dim text-xs uppercase tracking-wider">{label}</div>
      <div className="text-cream text-2xl font-light mt-1">{value}</div>
      {sub && <div className="text-cream-dim text-xs mt-1">{sub}</div>}
    </div>
  )
}
