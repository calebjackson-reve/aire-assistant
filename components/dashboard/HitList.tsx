"use client"

import { useState, useEffect } from "react"

interface HitListContact {
  id: string
  finalScore: number
  recommendation: string
  reasoning: string
  suggestedMessage: string
  channel: string
  priority: string
  contact: {
    id: string
    firstName: string
    lastName: string
    type: string
    phone: string | null
    email: string | null
  }
}

const CHANNEL_STYLES: Record<string, string> = {
  call: "text-warm bg-warm/10",
  text: "text-cream bg-cream/10",
  email: "text-cream-dim bg-brown-light",
}

export function HitList({ userId }: { userId: string }) {
  const [hitList, setHitList] = useState<HitListContact[]>([])
  const [lastRun, setLastRun] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/cron/relationship-intelligence?agentId=${userId}`)
      .then((r) => r.json())
      .then((data) => {
        setHitList(data.hitList ?? [])
        setLastRun(data.lastRun ?? null)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [userId])

  if (loading) {
    return <div className="text-cream-dim text-sm animate-pulse">Loading hit list...</div>
  }

  if (hitList.length === 0) {
    return (
      <div className="border border-brown-border rounded p-5">
        <p className="text-cream-dim text-xs tracking-wide mb-2">Relationship Intelligence</p>
        <p className="text-cream-dim text-sm">No outreach recommendations this week.</p>
        {!lastRun && <p className="text-cream-dim/50 text-xs mt-1">Intelligence engine hasn't run yet.</p>}
      </div>
    )
  }

  return (
    <div className="border border-brown-border rounded p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-cream-dim text-xs tracking-wide">Weekly hit list</p>
        {lastRun && (
          <p className="text-cream-dim/50 text-xs">
            Scored {new Date(lastRun).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </p>
        )}
      </div>

      <div className="space-y-2">
        {hitList.slice(0, 5).map((item) => (
          <div key={item.id} className="border border-brown-border rounded p-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-cream text-sm font-medium">
                {item.contact.firstName} {item.contact.lastName}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-cream-dim/50 text-xs">{item.finalScore}/100</span>
                <span className={`text-xs px-2 py-0.5 rounded ${CHANNEL_STYLES[item.channel] || "text-cream-dim"}`}>
                  {item.recommendation}
                </span>
              </div>
            </div>
            <p className="text-cream-dim text-xs">{item.reasoning}</p>
            {item.suggestedMessage && (
              <p className="text-cream-dim/70 text-xs mt-1 italic">"{item.suggestedMessage}"</p>
            )}
          </div>
        ))}
      </div>

      {hitList.length > 5 && (
        <p className="text-cream-dim/50 text-xs text-center mt-2">
          +{hitList.length - 5} more
        </p>
      )}
    </div>
  )
}
