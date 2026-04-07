"use client"

import { type ActivityEntry } from "@/lib/monitoring/types"

const SEVERITY_STYLES = {
  info: "text-[#6b7d52]",
  warn: "text-[#d4944c]",
  error: "text-[#c45c5c]",
  critical: "text-[#c45c5c] font-semibold",
} as const

const SEVERITY_DOT = {
  info: "bg-[#9aab7e]",
  warn: "bg-[#d4944c]",
  error: "bg-[#c45c5c]",
  critical: "bg-[#c45c5c] animate-pulse",
} as const

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function ActivityFeed({ activities }: { activities: ActivityEntry[] }) {
  if (activities.length === 0) {
    return (
      <div className="card-glass !rounded-xl !p-6 text-center">
        <p className="text-[#6b7d52]/40 text-sm">No activity yet</p>
      </div>
    )
  }

  return (
    <div className="card-glass !rounded-xl !p-4">
      <p className="text-[#6b7d52] text-[10px] font-medium tracking-[0.15em] uppercase mb-3">
        Recent Activity
      </p>
      <div className="space-y-2.5 max-h-[400px] overflow-y-auto">
        {activities.map((a) => (
          <div key={a.id} className="flex items-start gap-3">
            <div className="shrink-0 mt-1.5">
              <span className={`w-1.5 h-1.5 rounded-full block ${SEVERITY_DOT[a.severity]}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1e2416]/5 text-[#6b7d52]/60 font-mono">
                  {a.agent}
                </span>
                <span className="text-[10px] text-[#1e2416]/30">{a.action}</span>
              </div>
              <p className={`text-xs mt-0.5 ${SEVERITY_STYLES[a.severity]}`}>{a.message}</p>
            </div>
            <span className="text-[10px] text-[#1e2416]/30 shrink-0 font-mono">
              {timeAgo(a.createdAt)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
