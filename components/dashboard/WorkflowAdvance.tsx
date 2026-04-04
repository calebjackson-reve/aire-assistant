"use client"

import { useState, useEffect } from "react"
import type { TransactionStatus } from "@prisma/client"

interface AllowedTransition {
  to: TransactionStatus
  triggers: string[]
  description: string
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

export function WorkflowAdvance({
  transactionId,
  onAdvanced,
}: {
  transactionId: string
  onAdvanced?: () => void
}) {
  const [transitions, setTransitions] = useState<AllowedTransition[]>([])
  const [currentStatus, setCurrentStatus] = useState("")
  const [advancing, setAdvancing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/transactions/${transactionId}/advance`)
      .then((r) => r.json())
      .then((data) => {
        setTransitions(data.allowedTransitions ?? [])
        setCurrentStatus(data.currentStatus ?? "")
      })
      .catch(console.error)
  }, [transactionId])

  async function handleAdvance(toStatus: TransactionStatus) {
    setAdvancing(toStatus)
    setError(null)

    try {
      const res = await fetch(`/api/transactions/${transactionId}/advance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toStatus, trigger: "manual" }),
      })

      if (res.ok) {
        const data = await res.json()
        setCurrentStatus(data.toStatus)
        // Refresh allowed transitions
        const refreshed = await fetch(`/api/transactions/${transactionId}/advance`)
        const refreshData = await refreshed.json()
        setTransitions(refreshData.allowedTransitions ?? [])
        onAdvanced?.()
      } else {
        const errData = await res.json()
        setError(errData.error ?? "Advance failed")
      }
    } catch {
      setError("Network error")
    } finally {
      setAdvancing(null)
    }
  }

  // Filter out CANCELLED — that's a destructive action, don't show casually
  const forwardTransitions = transitions.filter((t) => t.to !== "CANCELLED")

  if (forwardTransitions.length === 0) return null

  return (
    <div className="mt-2">
      {error && <p className="text-red-400 text-xs mb-1">{error}</p>}
      <div className="flex gap-2 flex-wrap">
        {forwardTransitions.map((t) => (
          <button
            key={t.to}
            onClick={() => handleAdvance(t.to)}
            disabled={advancing !== null}
            className="text-xs border border-warm/20 text-warm px-3 py-1.5 rounded hover:bg-warm/10 disabled:opacity-50 transition"
          >
            {advancing === t.to
              ? "Advancing..."
              : `→ ${STATUS_LABELS[t.to] || t.to}`}
          </button>
        ))}
      </div>
    </div>
  )
}
