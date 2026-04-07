"use client"

/**
 * AIRE TC — Visual Transaction Pipeline
 * Shows: Contract → Inspection → Appraisal → Financing → Closing
 * Color-coded by status, shows days remaining per phase.
 */

interface TransactionTimelineProps {
  status: string
  contractDate: string | null
  closingDate: string | null
  deadlines: Array<{
    name: string
    dueDate: string
    completedAt: string | null
  }>
}

const PHASES = [
  { key: "DRAFT", label: "Draft", icon: "○" },
  { key: "ACTIVE", label: "Active", icon: "◉" },
  { key: "PENDING_INSPECTION", label: "Inspection", icon: "🔍" },
  { key: "PENDING_APPRAISAL", label: "Appraisal", icon: "📋" },
  { key: "PENDING_FINANCING", label: "Financing", icon: "🏦" },
  { key: "CLOSING", label: "Closing", icon: "📝" },
  { key: "CLOSED", label: "Closed", icon: "✓" },
]

const STATUS_ORDER: Record<string, number> = {
  DRAFT: 0,
  ACTIVE: 1,
  PENDING_INSPECTION: 2,
  PENDING_APPRAISAL: 3,
  PENDING_FINANCING: 4,
  CLOSING: 5,
  CLOSED: 6,
  CANCELLED: -1,
}

function getPhaseDeadline(phaseName: string, deadlines: TransactionTimelineProps["deadlines"]): { daysLeft: number | null; completed: boolean } {
  const now = new Date()
  const mapping: Record<string, string[]> = {
    "Inspection": ["Inspection Deadline", "inspection"],
    "Appraisal": ["Appraisal Deadline", "appraisal"],
    "Financing": ["Financing Contingency Deadline", "financing"],
    "Closing": ["Closing / Act of Sale", "closing", "Final Walkthrough"],
  }

  const keywords = mapping[phaseName]
  if (!keywords) return { daysLeft: null, completed: false }

  const match = deadlines.find(d =>
    keywords.some(k => d.name.toLowerCase().includes(k.toLowerCase()))
  )

  if (!match) return { daysLeft: null, completed: false }
  if (match.completedAt) return { daysLeft: null, completed: true }

  const due = new Date(match.dueDate)
  const daysLeft = Math.ceil((due.getTime() - now.getTime()) / 86400000)
  return { daysLeft, completed: false }
}

export function TransactionTimeline({ status, contractDate, closingDate, deadlines }: TransactionTimelineProps) {
  const currentIndex = STATUS_ORDER[status] ?? -1
  const isCancelled = status === "CANCELLED"

  if (isCancelled) {
    return (
      <div className="card-glass !rounded-xl !p-4">
        <p className="text-[#6b7d52] text-[10px] font-medium tracking-[0.15em] uppercase mb-2">Pipeline</p>
        <p className="text-[#c45c5c] text-sm">Transaction Cancelled</p>
      </div>
    )
  }

  // Calculate total timeline
  const startDate = contractDate ? new Date(contractDate) : null
  const endDate = closingDate ? new Date(closingDate) : null
  const now = new Date()
  let progressPercent = 0

  if (startDate && endDate) {
    const total = endDate.getTime() - startDate.getTime()
    const elapsed = now.getTime() - startDate.getTime()
    progressPercent = Math.min(100, Math.max(0, (elapsed / total) * 100))
  }

  return (
    <div className="card-glass !rounded-xl !p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[#6b7d52] text-[10px] font-medium tracking-[0.15em] uppercase">Deal Pipeline</p>
        {startDate && endDate && (
          <span className="font-mono text-[10px] text-[#6b7d52]/40">
            {Math.round(progressPercent)}% through timeline
          </span>
        )}
      </div>

      {/* Progress bar */}
      {startDate && endDate && (
        <div className="h-1 bg-[#9aab7e]/10 rounded-full mb-5 overflow-hidden">
          <div
            className="h-full bg-[#9aab7e] rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      {/* Phase steps */}
      <div className="flex items-start justify-between">
        {PHASES.map((phase, i) => {
          const phaseIndex = STATUS_ORDER[phase.key]
          const isCompleted = phaseIndex < currentIndex
          const isCurrent = phaseIndex === currentIndex
          const isFuture = phaseIndex > currentIndex

          const dl = getPhaseDeadline(phase.label, deadlines)
          const isOverdue = dl.daysLeft !== null && dl.daysLeft < 0

          return (
            <div key={phase.key} className="flex flex-col items-center flex-1 relative">
              {/* Connector line */}
              {i > 0 && (
                <div className={`absolute top-3 right-1/2 w-full h-0.5 -translate-y-1/2 ${
                  isCompleted || isCurrent ? "bg-[#9aab7e]" : "bg-[#9aab7e]/10"
                }`} style={{ left: "-50%" }} />
              )}

              {/* Dot */}
              <div className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${
                isCompleted
                  ? "bg-[#9aab7e] text-white"
                  : isCurrent
                  ? isOverdue
                    ? "bg-[#c45c5c] text-white ring-2 ring-[#c45c5c]/20"
                    : "bg-[#6b7d52] text-white ring-2 ring-[#9aab7e]/20"
                  : "bg-[#9aab7e]/10 text-[#6b7d52]/30"
              }`}>
                {isCompleted ? "✓" : phase.icon}
              </div>

              {/* Label */}
              <p className={`text-[9px] mt-1.5 text-center leading-tight ${
                isCurrent ? "text-[#1e2416] font-medium" : isFuture ? "text-[#6b7d52]/30" : "text-[#6b7d52]/60"
              }`}>
                {phase.label}
              </p>

              {/* Days indicator */}
              {isCurrent && dl.daysLeft !== null && (
                <p className={`text-[8px] font-mono mt-0.5 ${
                  isOverdue ? "text-[#c45c5c]" : dl.daysLeft <= 3 ? "text-[#d4944c]" : "text-[#6b7d52]/40"
                }`}>
                  {isOverdue ? `${Math.abs(dl.daysLeft)}d over` : `${dl.daysLeft}d left`}
                </p>
              )}
              {dl.completed && (
                <p className="text-[8px] font-mono mt-0.5 text-[#9aab7e]">done</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
