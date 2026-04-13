"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

interface ReviewRow {
  id: string
  envelopeId: string
  envelopeName: string
  envelopeStatus: string
  submittedAt: string
  submittedBy: string
}

export function BrokerDashboardClient({ initialQueue }: { initialQueue: ReviewRow[] }) {
  const router = useRouter()
  const [queue, setQueue] = useState<ReviewRow[]>(initialQueue)
  const [acting, setActing] = useState<string | null>(null)
  const [noteFor, setNoteFor] = useState<string | null>(null)
  const [note, setNote] = useState("")

  async function decide(reviewId: string, decision: "APPROVE" | "REJECT" | "CHANGES", extraNote?: string) {
    setActing(reviewId)
    try {
      const res = await fetch("/api/airsign/v2/compliance/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId, decision, note: extraNote }),
      })
      if (res.ok) {
        setQueue((prev) => prev.filter((r) => r.id !== reviewId))
        setNoteFor(null)
        setNote("")
        router.refresh()
      }
    } finally {
      setActing(null)
    }
  }

  return (
    <div>
      <p className="text-[#8a9070] text-[11px] tracking-[0.1em] uppercase mb-4">Pending review queue</p>
      {queue.length === 0 ? (
        <div className="bg-[#1e2416]/40 border border-[#4a5638]/50 rounded-lg p-12 text-center">
          <p className="text-[#9aab7e] font-[family-name:var(--font-playfair)] text-2xl mb-1">All clear</p>
          <p className="text-[#e8e4d8]/50 text-sm">No envelopes waiting for compliance review.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {queue.map((r) => {
            const hoursAgo = Math.floor((Date.now() - new Date(r.submittedAt).getTime()) / (1000 * 60 * 60))
            return (
              <div key={r.id} className="bg-[#1e2416]/40 border border-[#4a5638]/50 rounded-lg p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="min-w-0">
                    <a
                      href={`/airsign/${r.envelopeId}`}
                      className="text-[#e8e4d8] font-medium hover:text-[#9aab7e] transition-colors block truncate"
                    >
                      {r.envelopeName}
                    </a>
                    <p className="text-[#8a9070] text-xs mt-1">
                      by <span className="text-[#e8e4d8]/70">{r.submittedBy}</span>
                      {" · "}
                      <span className="font-[family-name:var(--font-mono)]">{hoursAgo}h</span> ago
                    </p>
                  </div>
                  <span className="text-[10px] font-[family-name:var(--font-mono)] text-[#9aab7e] bg-[#6b7d52]/15 px-2 py-0.5 rounded">
                    {r.envelopeStatus}
                  </span>
                </div>

                {noteFor === r.id ? (
                  <div className="space-y-3">
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={3}
                      placeholder="What needs to change?"
                      className="w-full bg-[#1e2416]/60 border border-[#4a5638] rounded-md px-3 py-2 text-[#e8e4d8] text-sm placeholder:text-[#8a9070]/60 focus:outline-none focus:border-[#9aab7e]"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setNoteFor(null)
                          setNote("")
                        }}
                        className="border border-[#4a5638] text-[#8a9070] text-xs px-3 py-1.5 rounded-md hover:text-[#e8e4d8] transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        disabled={acting === r.id}
                        onClick={() => decide(r.id, "CHANGES", note)}
                        className="bg-[#b5956a] text-[#1e2416] font-medium text-xs px-4 py-1.5 rounded-md hover:brightness-110 disabled:opacity-50 transition-all"
                      >
                        Request changes
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      disabled={acting === r.id}
                      onClick={() => decide(r.id, "APPROVE")}
                      className="bg-[#6b7d52] text-[#f5f2ea] font-medium text-xs px-4 py-1.5 rounded-md hover:bg-[#5a6b43] disabled:opacity-50 transition-colors"
                    >
                      Approve
                    </button>
                    <button
                      disabled={acting === r.id}
                      onClick={() => {
                        setNoteFor(r.id)
                        setNote("")
                      }}
                      className="border border-[#b5956a]/40 text-[#b5956a] text-xs px-4 py-1.5 rounded-md hover:bg-[#b5956a]/5 transition-colors"
                    >
                      Request changes
                    </button>
                    <button
                      disabled={acting === r.id}
                      onClick={() => decide(r.id, "REJECT")}
                      className="border border-[#8b4a4a]/40 text-[#8b4a4a] text-xs px-4 py-1.5 rounded-md hover:bg-[#8b4a4a]/5 transition-colors"
                    >
                      Reject
                    </button>
                    <a
                      href={`/airsign/${r.envelopeId}`}
                      className="ml-auto text-[#8a9070] text-xs hover:text-[#e8e4d8] transition-colors"
                    >
                      Open envelope →
                    </a>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
