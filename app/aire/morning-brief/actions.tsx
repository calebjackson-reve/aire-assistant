"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export function MorningBriefActions({ briefId }: { briefId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  async function handleAction(action: "approve" | "dismiss") {
    setLoading(action)
    try {
      const res = await fetch("/api/morning-brief/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ briefId, action }),
      })
      if (res.ok) router.refresh()
      else console.error("Action failed:", await res.text())
    } catch (error) {
      console.error("Action error:", error)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex gap-3">
      <button
        onClick={() => handleAction("approve")}
        disabled={loading !== null}
        className="flex-1 bg-warm text-brown font-medium py-2.5 rounded text-sm hover:brightness-110 disabled:opacity-50 transition"
      >
        {loading === "approve" ? "Approving..." : "Approve brief"}
      </button>
      <button
        onClick={() => handleAction("dismiss")}
        disabled={loading !== null}
        className="flex-1 border border-brown-border text-cream-dim py-2.5 rounded text-sm hover:text-cream hover:border-cream/20 disabled:opacity-50 transition"
      >
        {loading === "dismiss" ? "Dismissing..." : "Dismiss"}
      </button>
    </div>
  )
}
