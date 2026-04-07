"use client"

import { useState, useEffect, useCallback } from "react"
import { type MonitoringSnapshot } from "@/lib/monitoring/types"
import { AgentCard } from "./AgentCard"
import { ActivityFeed } from "./ActivityFeed"
import { MetricsPanel } from "./MetricsPanel"
import { ControlPanel } from "./ControlPanel"

export function MonitoringDashboard() {
  const [snapshot, setSnapshot] = useState<MonitoringSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const fetchSnapshot = useCallback(async () => {
    try {
      const res = await fetch("/api/monitoring/snapshot")
      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json()
      setSnapshot(data)
      setError(null)
      setLastRefresh(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch")
    }
  }, [])

  useEffect(() => {
    fetchSnapshot()
    const interval = setInterval(fetchSnapshot, 10000)
    return () => clearInterval(interval)
  }, [fetchSnapshot])

  if (error && !snapshot) {
    return (
      <div className="card-glass !rounded-xl !p-8 text-center">
        <p className="text-[#c45c5c] text-sm">Failed to load monitoring data</p>
        <p className="text-[#6b7d52]/50 text-xs mt-1">{error}</p>
        <button onClick={fetchSnapshot} className="mt-3 text-xs text-[#6b7d52] hover:underline">
          Retry
        </button>
      </div>
    )
  }

  if (!snapshot) {
    return (
      <div className="card-glass !rounded-xl !p-8 text-center">
        <div className="w-5 h-5 border-2 border-[#9aab7e] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-[#6b7d52]/50 text-xs mt-3">Loading monitoring data...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Overall progress */}
      <div className="card-glass !rounded-xl !p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[#6b7d52] text-[10px] font-medium tracking-[0.15em] uppercase">
              Overall Progress
            </p>
            <p className="text-[#1e2416] text-2xl font-light mt-1 font-mono">
              {snapshot.overallProgress}%
            </p>
          </div>
          <div className="text-right">
            <p className="text-[#6b7d52]/40 text-[10px]">
              Last refresh: {lastRefresh.toLocaleTimeString()}
            </p>
            <p className="text-[#6b7d52]/40 text-[10px]">Auto-refresh: 10s</p>
          </div>
        </div>
        <div className="h-2 rounded-full bg-[#1e2416]/5 overflow-hidden">
          <div
            className="h-full rounded-full bg-[#9aab7e] transition-all duration-700"
            style={{ width: `${snapshot.overallProgress}%` }}
          />
        </div>
      </div>

      {/* Agent cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {snapshot.agents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>

      {/* Metrics */}
      <MetricsPanel metrics={snapshot.metrics} />

      {/* Two column: activity + controls */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
        <ActivityFeed activities={snapshot.recentActivity} />
        <ControlPanel agents={snapshot.agents} />
      </div>

      {/* Errors */}
      {snapshot.errors.length > 0 && (
        <div className="card-glass !rounded-xl !p-4 border border-[#c45c5c]/20">
          <p className="text-[#c45c5c] text-[10px] font-medium tracking-[0.15em] uppercase mb-3">
            Active Errors
          </p>
          <div className="space-y-2">
            {snapshot.errors.map((e) => (
              <div key={e.id} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#c45c5c] mt-1.5 shrink-0" />
                <div>
                  <span className="text-[10px] font-mono text-[#c45c5c]/60">{e.agent}</span>
                  <p className="text-[#c45c5c] text-xs">{e.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
