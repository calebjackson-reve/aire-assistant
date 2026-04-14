"use client"

import { useCallback, useEffect, useState } from "react"

type HealthState = "ok" | "warn" | "fail" | "unknown"

interface ServiceHealth {
  id: string
  name: string
  kind: string
  state: HealthState
  latencyMs: number | null
  detail: string
  envConfigured: boolean
}

interface CronHealth {
  id: string
  path: string
  humanSchedule: string
  description: string
  lastRunAt: string | null
  lastStatus: "success" | "failed" | "running" | "unknown"
  lastDurationMs: number | null
  lastError: string | null
  successRate7d: number | null
  totalRuns7d: number
  hasLogging: boolean
}

interface SystemStatus {
  generatedAt: string
  db: ServiceHealth
  services: ServiceHealth[]
  crons: CronHealth[]
  summary: {
    servicesOk: number
    servicesTotal: number
    cronsOk: number
    cronsTotal: number
    cronsUnknown: number
  }
}

const STATE_COLOR: Record<HealthState, string> = {
  ok: "#9aab7e",
  warn: "#d4944c",
  fail: "#d45b5b",
  unknown: "#6b7d52",
}

const STATE_LABEL: Record<HealthState, string> = {
  ok: "Healthy",
  warn: "Warning",
  fail: "Failed",
  unknown: "Unknown",
}

function formatRelative(iso: string | null): string {
  if (!iso) return "Never"
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

function cronStateColor(cron: CronHealth): HealthState {
  if (!cron.hasLogging) return "unknown"
  if (cron.lastStatus === "failed") return "fail"
  if (cron.lastStatus === "unknown") return "unknown"
  if (cron.successRate7d !== null && cron.successRate7d < 80) return "warn"
  return "ok"
}

export function SystemStatusDashboard() {
  const [data, setData] = useState<SystemStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/system-status", { cache: "no-store" })
      if (!res.ok) {
        setError(`Failed (${res.status})`)
        return
      }
      const json = (await res.json()) as SystemStatus
      setData(json)
      setError(null)
      setLastRefresh(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 30_000)
    return () => clearInterval(interval)
  }, [load])

  if (loading && !data) {
    return <div className="text-[#6b7d52] text-sm">Loading system status...</div>
  }

  if (error && !data) {
    return <div className="text-[#d45b5b] text-sm">Error: {error}</div>
  }

  if (!data) return null

  const allServices = [data.db, ...data.services]

  return (
    <div className="space-y-8">
      {/* Summary strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard
          label="Services"
          value={`${data.summary.servicesOk}/${data.summary.servicesTotal}`}
          state={data.summary.servicesOk === data.summary.servicesTotal ? "ok" : "warn"}
          detail="Healthy dependencies"
        />
        <SummaryCard
          label="Crons (7d)"
          value={`${data.summary.cronsOk}/${data.summary.cronsTotal}`}
          state={data.summary.cronsOk >= data.summary.cronsTotal - data.summary.cronsUnknown ? "ok" : "warn"}
          detail={`${data.summary.cronsUnknown} with no logging`}
        />
        <SummaryCard
          label="DB latency"
          value={data.db.latencyMs !== null ? `${data.db.latencyMs}ms` : "—"}
          state={data.db.state}
          detail={data.db.detail}
        />
      </div>

      {/* Services */}
      <section>
        <SectionHeader
          title="External services"
          right={
            lastRefresh ? (
              <span className="text-[#6b7d52]/60 text-xs font-mono">
                Refreshed {lastRefresh.toLocaleTimeString()}
              </span>
            ) : null
          }
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {allServices.map((svc) => (
            <ServiceRow key={svc.id} svc={svc} />
          ))}
        </div>
      </section>

      {/* Crons */}
      <section>
        <SectionHeader title="Scheduled jobs" />
        <div className="rounded-xl border border-[#3a4030] bg-[#1a1f15] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#222821] text-[#9aab7e] text-xs tracking-[0.15em] uppercase">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Job</th>
                <th className="text-left px-4 py-3 font-medium">Schedule</th>
                <th className="text-left px-4 py-3 font-medium">Last run</th>
                <th className="text-left px-4 py-3 font-medium">Duration</th>
                <th className="text-left px-4 py-3 font-medium">7d success</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.crons.map((cron) => {
                const state = cronStateColor(cron)
                return (
                  <tr
                    key={cron.id}
                    className="border-t border-[#3a4030] hover:bg-[#222821]/60 transition-colors"
                  >
                    <td className="px-4 py-3 align-top">
                      <div className="text-[#e8e4d8] font-medium">{cron.id}</div>
                      <div className="text-[#6b7d52]/60 text-xs mt-0.5">{cron.description}</div>
                    </td>
                    <td className="px-4 py-3 align-top text-[#e8e4d8]/70 text-xs font-mono">
                      {cron.humanSchedule}
                    </td>
                    <td className="px-4 py-3 align-top text-[#e8e4d8]/80 text-xs font-mono">
                      {formatRelative(cron.lastRunAt)}
                    </td>
                    <td className="px-4 py-3 align-top text-[#e8e4d8]/80 text-xs font-mono">
                      {cron.lastDurationMs != null ? `${cron.lastDurationMs}ms` : "—"}
                    </td>
                    <td className="px-4 py-3 align-top text-[#e8e4d8]/80 text-xs font-mono">
                      {cron.successRate7d !== null ? `${cron.successRate7d}%` : "—"}
                      {cron.totalRuns7d > 0 && (
                        <span className="text-[#6b7d52]/50 ml-1">({cron.totalRuns7d})</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <StatePill state={state} />
                      {cron.lastError && (
                        <div
                          className="text-[#d45b5b] text-[10px] font-mono mt-1 truncate max-w-[220px]"
                          title={cron.lastError}
                        >
                          {cron.lastError}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[#6b7d52]/50 text-xs mt-2">
          Jobs without AgentRun logging show "Unknown" — still scheduled, just not instrumented yet.
        </p>
      </section>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  state,
  detail,
}: {
  label: string
  value: string
  state: HealthState
  detail: string
}) {
  return (
    <div className="rounded-xl border border-[#3a4030] bg-[#1a1f15] p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[#6b7d52] text-xs tracking-[0.15em] uppercase">{label}</span>
        <span
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: STATE_COLOR[state] }}
        />
      </div>
      <div className="text-[#e8e4d8] text-3xl font-mono">{value}</div>
      <div className="text-[#6b7d52]/70 text-xs mt-1">{detail}</div>
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

function ServiceRow({ svc }: { svc: ServiceHealth }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[#3a4030] bg-[#1a1f15] px-4 py-3">
      <div className="flex items-center gap-3">
        <span
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: STATE_COLOR[svc.state] }}
        />
        <div>
          <div className="text-[#e8e4d8] text-sm font-medium">{svc.name}</div>
          <div className="text-[#6b7d52]/70 text-xs">{svc.detail}</div>
        </div>
      </div>
      <div className="text-right">
        {svc.latencyMs !== null && (
          <div className="text-[#e8e4d8]/80 text-xs font-mono">{svc.latencyMs}ms</div>
        )}
        <StatePill state={svc.state} />
      </div>
    </div>
  )
}

function StatePill({ state }: { state: HealthState }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] tracking-wider uppercase font-medium"
      style={{
        backgroundColor: `${STATE_COLOR[state]}22`,
        color: STATE_COLOR[state],
        border: `1px solid ${STATE_COLOR[state]}44`,
      }}
    >
      {STATE_LABEL[state]}
    </span>
  )
}
