"use client"

import { type MetricEntry } from "@/lib/monitoring/types"

export function MetricsPanel({ metrics }: { metrics: MetricEntry[] }) {
  const grouped = metrics.reduce<Record<string, MetricEntry[]>>((acc, m) => {
    if (!acc[m.name]) acc[m.name] = []
    acc[m.name].push(m)
    return acc
  }, {})

  const metricCards = Object.entries(grouped).map(([name, entries]) => {
    const latest = entries[0]
    const previous = entries[1]
    const delta = previous ? latest.value - previous.value : 0
    const label = name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())

    return { name, label, value: latest.value, delta, agent: latest.agent }
  })

  if (metricCards.length === 0) {
    return (
      <div className="card-glass !rounded-xl !p-6 text-center">
        <p className="text-[#6b7d52]/40 text-sm">No metrics recorded</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {metricCards.map((m) => (
        <div key={m.name} className="card-glass !rounded-xl !p-4 text-center">
          <p className="text-[#6b7d52]/50 text-[10px] tracking-wider uppercase">{m.label}</p>
          <p className="text-xl font-light text-[#1e2416] mt-1 font-mono">{m.value}</p>
          {m.delta !== 0 && (
            <p className={`text-[10px] mt-0.5 ${m.delta > 0 ? "text-[#9aab7e]" : "text-[#c45c5c]"}`}>
              {m.delta > 0 ? "+" : ""}{m.delta}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
