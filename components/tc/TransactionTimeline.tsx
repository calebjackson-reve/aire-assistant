"use client"

/**
 * AIRE TC — Visual Transaction Pipeline + Deal DNA Strip
 *
 * Pipeline: Contract → Inspection → Appraisal → Financing → Closing
 *   Color-coded by status. Shows days remaining per phase.
 *
 * Deal DNA Strip (NEW): horizontal scrollable row of colored pulses
 *   representing every touchpoint in chronological order.
 *   email → olive  |  sms → sage  |  doc → cream  |  deadline_completed → brass
 *   workflow_advanced → deep-forest dot with ring  |  other → muted
 */

import { useRef } from "react"

interface WorkflowEvent {
  id: string
  eventType: string
  createdAt: string
  notes?: string | null
}

interface TransactionTimelineProps {
  status: string
  contractDate: string | null
  closingDate: string | null
  deadlines: Array<{
    name: string
    dueDate: string
    completedAt: string | null
  }>
  workflowEvents?: WorkflowEvent[]
}

const PHASES = [
  { key: "DRAFT",              label: "Draft",      short: "Dft" },
  { key: "ACTIVE",             label: "Active",     short: "Act" },
  { key: "PENDING_INSPECTION", label: "Inspection", short: "Insp" },
  { key: "PENDING_APPRAISAL",  label: "Appraisal",  short: "App" },
  { key: "PENDING_FINANCING",  label: "Financing",  short: "Fin" },
  { key: "CLOSING",            label: "Closing",    short: "Clsg" },
  { key: "CLOSED",             label: "Closed",     short: "Done" },
]

const STATUS_ORDER: Record<string, number> = {
  DRAFT: 0, ACTIVE: 1, PENDING_INSPECTION: 2, PENDING_APPRAISAL: 3,
  PENDING_FINANCING: 4, CLOSING: 5, CLOSED: 6, CANCELLED: -1,
}

// DNA pulse color + label mapping by event type keyword
function getDnaPulse(eventType: string): { color: string; bg: string; ring: string; label: string } {
  const et = eventType.toLowerCase()
  if (et.includes("email") || et.includes("sent") || et.includes("communication"))
    return { color: "#6b7d52", bg: "rgba(107, 125, 82, 0.18)", ring: "rgba(107, 125, 82, 0.30)", label: "Email" }
  if (et.includes("sms") || et.includes("text") || et.includes("message"))
    return { color: "#9aab7e", bg: "rgba(154, 171, 126, 0.18)", ring: "rgba(154, 171, 126, 0.30)", label: "SMS" }
  if (et.includes("document") || et.includes("upload") || et.includes("doc") || et.includes("file"))
    return { color: "#d4c9a8", bg: "rgba(212, 201, 168, 0.18)", ring: "rgba(212, 201, 168, 0.30)", label: "Doc" }
  if (et.includes("deadline") || et.includes("completed"))
    return { color: "#b5956a", bg: "rgba(181, 149, 106, 0.18)", ring: "rgba(181, 149, 106, 0.30)", label: "Done" }
  if (et.includes("workflow") || et.includes("advance") || et.includes("status"))
    return { color: "#9aab7e", bg: "rgba(30, 36, 22, 0.35)", ring: "rgba(154, 171, 126, 0.40)", label: "Stage" }
  if (et.includes("airsign") || et.includes("sign") || et.includes("envelope"))
    return { color: "#9aab7e", bg: "rgba(154, 171, 126, 0.12)", ring: "rgba(154, 171, 126, 0.25)", label: "Sign" }
  return { color: "#8a9070", bg: "rgba(138, 144, 112, 0.12)", ring: "rgba(138, 144, 112, 0.20)", label: "Event" }
}

function getPhaseDeadline(
  phaseName: string,
  deadlines: TransactionTimelineProps["deadlines"]
): { daysLeft: number | null; completed: boolean } {
  const now = new Date()
  const mapping: Record<string, string[]> = {
    Inspection: ["Inspection Deadline", "inspection"],
    Appraisal:  ["Appraisal Deadline", "appraisal"],
    Financing:  ["Financing Contingency Deadline", "financing"],
    Closing:    ["Closing / Act of Sale", "closing", "Final Walkthrough"],
  }
  const keywords = mapping[phaseName]
  if (!keywords) return { daysLeft: null, completed: false }
  const match = deadlines.find(d => keywords.some(k => d.name.toLowerCase().includes(k.toLowerCase())))
  if (!match) return { daysLeft: null, completed: false }
  if (match.completedAt) return { daysLeft: null, completed: true }
  const daysLeft = Math.ceil((new Date(match.dueDate).getTime() - now.getTime()) / 86400000)
  return { daysLeft, completed: false }
}

export function TransactionTimeline({
  status,
  contractDate,
  closingDate,
  deadlines,
  workflowEvents = [],
}: TransactionTimelineProps) {
  const dnaRef = useRef<HTMLDivElement>(null)
  const currentIndex = STATUS_ORDER[status] ?? -1
  const isCancelled = status === "CANCELLED"

  if (isCancelled) {
    return (
      <div className="card-glass !rounded-xl !p-4">
        <p className="text-[10px] font-medium tracking-[0.15em] uppercase mb-2" style={{ color: "#6b7d52" }}>Pipeline</p>
        <p className="text-sm" style={{ color: "#c45c5c" }}>Transaction Cancelled</p>
      </div>
    )
  }

  // Timeline progress
  const startDate = contractDate ? new Date(contractDate) : null
  const endDate   = closingDate  ? new Date(closingDate)  : null
  const now = new Date()
  let progressPercent = 0
  if (startDate && endDate) {
    progressPercent = Math.min(100, Math.max(0,
      ((now.getTime() - startDate.getTime()) / (endDate.getTime() - startDate.getTime())) * 100
    ))
  }

  // Sort DNA events oldest-first, cap at 32 for visual clarity
  const dnaEvents = [...workflowEvents]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .slice(-32)

  return (
    <div className="card-glass !rounded-xl !p-5 space-y-5">
      {/* ── PIPELINE HEADER ── */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-medium tracking-[0.15em] uppercase" style={{ color: "#6b7d52" }}>
          Deal Pipeline
        </p>
        {startDate && endDate && (
          <span className="font-mono text-[10px]" style={{ color: "rgba(107, 125, 82, 0.40)" }}>
            {Math.round(progressPercent)}% through timeline
          </span>
        )}
      </div>

      {/* ── TIME PROGRESS BAR ── */}
      {startDate && endDate && (
        <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(154, 171, 126, 0.10)" }}>
          <div
            className="h-full rounded-full"
            style={{
              width: `${progressPercent}%`,
              background: progressPercent >= 80 ? "#b5956a" : "#9aab7e",
              transition: "width 600ms cubic-bezier(0.34, 1.56, 0.64, 1)",
            }}
          />
        </div>
      )}

      {/* ── PHASE DOTS ── */}
      <div className="flex items-start justify-between">
        {PHASES.map((phase, i) => {
          const phaseIndex = STATUS_ORDER[phase.key]
          const isCompleted = phaseIndex < currentIndex
          const isCurrent   = phaseIndex === currentIndex
          const isFuture    = phaseIndex > currentIndex
          const dl          = getPhaseDeadline(phase.label, deadlines)
          const isOverdue   = dl.daysLeft !== null && dl.daysLeft < 0

          return (
            <div key={phase.key} className="flex flex-col items-center flex-1 relative">
              {/* Connector */}
              {i > 0 && (
                <div
                  className="absolute top-3 w-full h-0.5"
                  style={{
                    left: "-50%",
                    background: isCompleted || isCurrent ? "#9aab7e" : "rgba(154, 171, 126, 0.10)",
                    transition: "background 300ms ease",
                  }}
                />
              )}

              {/* Dot */}
              <div
                className="relative z-10 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all"
                style={
                  isCompleted
                    ? { background: "#9aab7e", color: "#f5f2ea" }
                    : isCurrent
                    ? isOverdue
                      ? { background: "#c45c5c", color: "#f5f2ea", boxShadow: "0 0 0 3px rgba(196, 92, 92, 0.20)" }
                      : { background: "#6b7d52", color: "#f5f2ea", boxShadow: "0 0 0 3px rgba(154, 171, 126, 0.20)" }
                    : { background: "rgba(154, 171, 126, 0.10)", color: "rgba(107, 125, 82, 0.30)" }
                }
              >
                {isCompleted ? "✓" : isCurrent ? "●" : "○"}
              </div>

              {/* Label */}
              <p
                className="text-[9px] mt-1.5 text-center leading-tight font-medium"
                style={{
                  color: isCurrent
                    ? "#1e2416"
                    : isFuture
                    ? "rgba(107, 125, 82, 0.30)"
                    : "rgba(107, 125, 82, 0.60)",
                }}
              >
                {phase.short}
              </p>

              {/* Days left */}
              {isCurrent && dl.daysLeft !== null && (
                <p
                  className="text-[8px] font-mono mt-0.5"
                  style={{ color: isOverdue ? "#c45c5c" : dl.daysLeft <= 3 ? "#b5956a" : "rgba(107, 125, 82, 0.40)" }}
                >
                  {isOverdue ? `${Math.abs(dl.daysLeft)}d over` : `${dl.daysLeft}d`}
                </p>
              )}
              {dl.completed && (
                <p className="text-[8px] font-mono mt-0.5" style={{ color: "#9aab7e" }}>done</p>
              )}
            </div>
          )
        })}
      </div>

      {/* ── DEAL DNA STRIP ── */}
      {dnaEvents.length > 0 && (
        <div>
          {/* Label row */}
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-medium tracking-[0.12em] uppercase" style={{ color: "rgba(107, 125, 82, 0.50)" }}>
              Deal DNA
            </p>
            <div className="flex items-center gap-3 text-[9px]" style={{ color: "rgba(107, 125, 82, 0.40)", fontFamily: "var(--font-mono)" }}>
              <span style={{ color: "#6b7d52" }}>● email</span>
              <span style={{ color: "#9aab7e" }}>● doc</span>
              <span style={{ color: "#b5956a" }}>● done</span>
            </div>
          </div>

          {/* Pulse strip — horizontally scrollable */}
          <div
            ref={dnaRef}
            className="flex items-center gap-2 overflow-x-auto pb-1"
            style={{ scrollbarWidth: "none" }}
          >
            {dnaEvents.map((evt, i) => {
              const pulse = getDnaPulse(evt.eventType)
              const date  = new Date(evt.createdAt)
              const label = date.toLocaleDateString("en-US", { month: "numeric", day: "numeric" })

              return (
                <div
                  key={evt.id}
                  className="flex flex-col items-center gap-1 shrink-0 group relative"
                  title={`${evt.eventType.replace(/_/g, " ")} · ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                >
                  {/* Connecting line */}
                  {i > 0 && (
                    <div
                      className="absolute top-2 w-2 -left-2 h-px"
                      style={{ background: "rgba(154, 171, 126, 0.12)" }}
                    />
                  )}

                  {/* Pulse dot */}
                  <div
                    className="w-4 h-4 rounded-full flex items-center justify-center transition-all"
                    style={{
                      background: pulse.bg,
                      border: `1px solid ${pulse.ring}`,
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = "scale(1.35)"
                      e.currentTarget.style.boxShadow = `0 0 0 3px ${pulse.ring}`
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = "scale(1)"
                      e.currentTarget.style.boxShadow = "none"
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: pulse.color }}
                    />
                  </div>

                  {/* Date label — only every 4th to keep strip clean */}
                  {i % 4 === 0 && (
                    <p
                      className="text-[8px] font-mono leading-none"
                      style={{ color: "rgba(107, 125, 82, 0.35)" }}
                    >
                      {label}
                    </p>
                  )}
                </div>
              )
            })}

            {/* "Now" marker */}
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div
                className="w-px h-4"
                style={{ background: "rgba(154, 171, 126, 0.30)" }}
              />
              <p className="text-[8px] font-mono" style={{ color: "rgba(154, 171, 126, 0.50)" }}>now</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
