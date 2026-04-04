"use client"

import { useState, useEffect } from "react"

interface WorkflowEvent {
  id: string
  fromStatus: string | null
  toStatus: string
  trigger: string
  triggeredBy: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  PENDING_INSPECTION: "Inspection",
  PENDING_APPRAISAL: "Appraisal",
  PENDING_FINANCING: "Financing",
  CLOSING: "Closing",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
}

const TRIGGER_LABELS: Record<string, string> = {
  document_uploaded: "Document uploaded",
  deadline_passed: "Deadline passed",
  deadline_completed: "Deadline completed",
  manual: "Manual",
  voice_command: "Voice command",
  system: "System",
}

export function WorkflowTimeline({ transactionId }: { transactionId: string }) {
  const [events, setEvents] = useState<WorkflowEvent[]>([])
  const [currentStatus, setCurrentStatus] = useState<string>("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/transactions/${transactionId}/workflow`)
      .then((r) => r.json())
      .then((data) => {
        setEvents(data.events ?? [])
        setCurrentStatus(data.currentStatus ?? "")
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [transactionId])

  if (loading) {
    return <div className="text-cream-dim text-sm animate-pulse">Loading timeline...</div>
  }

  if (events.length === 0) {
    return (
      <div className="border border-brown-border rounded p-4">
        <p className="text-cream-dim text-xs tracking-wide mb-1">Workflow</p>
        <p className="text-cream text-sm">{STATUS_LABELS[currentStatus] || currentStatus}</p>
        <p className="text-cream-dim text-xs mt-1">No state changes recorded yet.</p>
      </div>
    )
  }

  return (
    <div className="border border-brown-border rounded p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-cream-dim text-xs tracking-wide">Workflow timeline</p>
        <span className="text-warm text-xs bg-warm/10 px-2 py-0.5 rounded">
          {STATUS_LABELS[currentStatus] || currentStatus}
        </span>
      </div>

      <div className="space-y-0">
        {events.map((event, i) => {
          const date = new Date(event.createdAt)
          const isLast = i === events.length - 1
          const reason = event.metadata && typeof event.metadata === "object"
            ? (event.metadata as Record<string, unknown>).reason as string | undefined
            : undefined

          return (
            <div key={event.id} className="flex gap-3">
              {/* Timeline line + dot */}
              <div className="flex flex-col items-center">
                <div className={`w-2 h-2 rounded-full mt-1.5 ${i === 0 ? "bg-warm" : "bg-cream-dim/30"}`} />
                {!isLast && <div className="w-px flex-1 bg-brown-border" />}
              </div>

              {/* Content */}
              <div className={`pb-3 ${isLast ? "" : ""}`}>
                <p className="text-cream text-sm">
                  {event.fromStatus
                    ? `${STATUS_LABELS[event.fromStatus] || event.fromStatus} → ${STATUS_LABELS[event.toStatus] || event.toStatus}`
                    : STATUS_LABELS[event.toStatus] || event.toStatus}
                </p>
                <p className="text-cream-dim text-xs mt-0.5">
                  {TRIGGER_LABELS[event.trigger] || event.trigger}
                  {reason ? ` · ${reason}` : ""}
                </p>
                <p className="text-cream-dim/50 text-xs">
                  {date.toLocaleDateString("en-US", { month: "short", day: "numeric" })} at{" "}
                  {date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
