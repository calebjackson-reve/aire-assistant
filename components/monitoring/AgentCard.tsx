"use client"

import { type AgentStatus } from "@/lib/monitoring/types"

const STATUS_STYLES = {
  complete: { bg: "bg-[#9aab7e]/15", text: "text-[#6b7d52]", dot: "bg-[#9aab7e]", label: "Complete" },
  building: { bg: "bg-[#d4944c]/10", text: "text-[#d4944c]", dot: "bg-[#d4944c] animate-pulse", label: "Building" },
  pending: { bg: "bg-[#1e2416]/5", text: "text-[#1e2416]/40", dot: "bg-[#1e2416]/20", label: "Pending" },
  error: { bg: "bg-[#c45c5c]/10", text: "text-[#c45c5c]", dot: "bg-[#c45c5c] animate-pulse", label: "Error" },
} as const

export function AgentCard({ agent }: { agent: AgentStatus }) {
  const style = STATUS_STYLES[agent.status]
  const pct = agent.totalPhases > 0 ? Math.round((agent.phase / agent.totalPhases) * 100) : 0

  return (
    <div className="card-glass !rounded-xl !p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <span className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />
          <h3 className="text-[#1e2416] text-sm font-semibold">{agent.name}</h3>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${style.bg} ${style.text}`}>
          {style.label}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-[#1e2416]/5 overflow-hidden mb-2">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            agent.status === "error" ? "bg-[#c45c5c]" : "bg-[#9aab7e]"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-[#6b7d52]/60">
          Phase {agent.phase}/{agent.totalPhases}
        </span>
        <span className="font-mono text-xs text-[#1e2416]/40">{pct}%</span>
      </div>

      {agent.lastActivity && (
        <p className="text-[#6b7d52]/50 text-xs mt-2 truncate">{agent.lastActivity}</p>
      )}
    </div>
  )
}
