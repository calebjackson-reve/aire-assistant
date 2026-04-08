"use client"

import { useState } from "react"

interface FeedbackButtonsProps {
  feature: string   // "morning_brief" | "voice" | "contract" etc.
  metadata?: Record<string, unknown>
  className?: string
}

export function FeedbackButtons({ feature, metadata, className }: FeedbackButtonsProps) {
  const [submitted, setSubmitted] = useState<"up" | "down" | null>(null)

  async function submitFeedback(rating: 1 | 5) {
    setSubmitted(rating === 5 ? "up" : "down")
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature, rating, metadata }),
      })
    } catch {
      // Silent — don't interrupt user flow for feedback failures
    }
  }

  if (submitted) {
    return (
      <span className={`text-[#6b7d52]/40 text-xs ${className || ""}`}>
        {submitted === "up" ? "Thanks!" : "Noted — we'll improve this."}
      </span>
    )
  }

  return (
    <div className={`flex items-center gap-2 ${className || ""}`}>
      <span className="text-[#6b7d52]/30 text-xs">Helpful?</span>
      <button
        onClick={() => submitFeedback(5)}
        className="text-[#6b7d52]/30 hover:text-green-600 transition-colors"
        title="Yes, helpful"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
        </svg>
      </button>
      <button
        onClick={() => submitFeedback(1)}
        className="text-[#6b7d52]/30 hover:text-red-500 transition-colors"
        title="No, not helpful"
      >
        <svg className="w-4 h-4 rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
        </svg>
      </button>
    </div>
  )
}
