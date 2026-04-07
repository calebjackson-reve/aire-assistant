'use client'

import { useState, useEffect, useCallback } from 'react'

interface HealthData {
  status: string
  database: { ok: boolean; latencyMs: number }
  stats: { activeListings?: number; soldComps?: number; error?: string } | null
  cache: {
    property: { size: number; hits: number; misses: number; hitRate: string }
    snapshot: { size: number; hits: number; misses: number; hitRate: string }
    score: { size: number; hits: number; misses: number; hitRate: string }
  }
  timestamp: string
}

interface TableCount {
  name: string
  count: number
  status: 'ok' | 'empty' | 'error'
}

export default function DataHealthDashboard() {
  const [health, setHealth] = useState<HealthData | null>(null)
  const [tables, setTables] = useState<TableCount[]>([])
  const [tableError, setTableError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/data/health')
      if (res.ok) {
        const data = await res.json()
        setHealth(data)
      }
    } catch { /* ignore */ }
  }, [])

  const fetchTableCounts = useCallback(async () => {
    try {
      const res = await fetch('/api/data/health/tables')
      if (res.ok) {
        const data = await res.json()
        setTables(data.tables || [])
      }
    } catch {
      setTables([])
      setTableError("Failed to load table data")
    }
  }, [])

  useEffect(() => {
    async function load() {
      setLoading(true)
      await Promise.all([fetchHealth(), fetchTableCounts()])
      setLastRefresh(new Date())
      setLoading(false)
    }
    load()
    const interval = setInterval(load, 30000) // refresh every 30s
    return () => clearInterval(interval)
  }, [fetchHealth, fetchTableCounts])

  if (loading && !health) {
    return <div className="text-zinc-500">Loading health data...</div>
  }

  return (
    <div className="space-y-6">
      {/* Status Bar */}
      <div className="flex items-center gap-4">
        <div className={`w-3 h-3 rounded-full ${health?.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
        <span className="text-lg font-semibold">
          {health?.status === 'healthy' ? 'All Systems Healthy' : 'Degraded'}
        </span>
        {lastRefresh && (
          <span className="text-zinc-500 text-xs ml-auto">
            Last refresh: {lastRefresh.toLocaleTimeString()}
          </span>
        )}
        <button
          onClick={() => { fetchHealth(); fetchTableCounts(); setLastRefresh(new Date()) }}
          className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-xs transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="DB Latency" value={health?.database.latencyMs ? `${health.database.latencyMs}ms` : '—'} status={health?.database.ok ? 'good' : 'bad'} />
        <MetricCard label="Active Listings" value={health?.stats?.activeListings?.toString() ?? '0'} status="neutral" />
        <MetricCard label="Sold Comps" value={health?.stats?.soldComps?.toString() ?? '0'} status="neutral" />
        <MetricCard label="DB Status" value={health?.database.ok ? 'Connected' : 'Down'} status={health?.database.ok ? 'good' : 'bad'} />
      </div>

      {/* Intelligence Tables */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">Intelligence Tables</h2>
        {tableError && <p className="text-red-400 text-sm mb-3">{tableError}</p>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {['properties_clean', 'market_snapshots', 'aire_scores', 'job_runs', 'error_logs', 'raw_imports', 'backtest_results'].map((name) => {
            const table = tables.find((t) => t.name === name)
            return (
              <div key={name} className="flex items-center justify-between bg-zinc-800/50 rounded-lg px-4 py-3">
                <span className="text-sm font-mono text-zinc-300">{name}</span>
                <span className={`text-sm font-semibold ${table ? (table.count > 0 ? 'text-green-400' : 'text-yellow-400') : 'text-zinc-500'}`}>
                  {table ? `${table.count.toLocaleString()} rows` : 'checking...'}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Cache Performance */}
      {health?.cache && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">Cache Performance</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(health.cache).map(([name, stats]) => (
              <div key={name} className="bg-zinc-800/50 rounded-lg p-4">
                <div className="text-xs text-zinc-500 uppercase">{name}</div>
                <div className="text-xl font-bold mt-1">{stats.hitRate}</div>
                <div className="text-xs text-zinc-500 mt-1">
                  {stats.hits} hits / {stats.misses} misses / {stats.size} cached
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function MetricCard({ label, value, status }: { label: string; value: string; status: 'good' | 'bad' | 'neutral' }) {
  const colors = {
    good: 'border-green-800 bg-green-950/30',
    bad: 'border-red-800 bg-red-950/30',
    neutral: 'border-zinc-800 bg-zinc-900',
  }
  return (
    <div className={`rounded-xl border p-4 ${colors[status]}`}>
      <div className="text-xs text-zinc-500 uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  )
}
