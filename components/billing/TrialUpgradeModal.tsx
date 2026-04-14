"use client"

import { useEffect, useState } from "react"

export interface TrialUpgradeModalProps {
  open: boolean
  onClose: () => void
  /** Gated feature that triggered the modal — used in analytics */
  feature: string
  /** Human-readable label for the feature */
  featureLabel: string
  /** Tier required to unlock the feature (default: PRO) */
  requiredTier?: "PRO" | "INVESTOR"
  headline?: string
  bullets?: string[]
}

const TIER_COPY = {
  PRO: {
    name: "AIRE Pro",
    price: "$97",
    period: "/month",
    defaultBullets: [
      "Unlimited transactions + voice commands",
      "Morning Brief, AirSign, compliance scan",
      "Deadline SMS alerts",
    ],
  },
  INVESTOR: {
    name: "AIRE Investor",
    price: "$197",
    period: "/month",
    defaultBullets: [
      "Everything in Pro",
      "CMA engine + AIRE Estimate AVM",
      "Portfolio analytics + API access",
    ],
  },
} as const

/**
 * Sage-themed "Pro feature — start 7-day free trial" modal.
 * Fire-and-forget logs `viewed_upgrade` on open and `clicked_upgrade` when
 * the user accepts; `started_trial` is logged server-side by /api/billing/trial.
 */
export function TrialUpgradeModal({
  open,
  onClose,
  feature,
  featureLabel,
  requiredTier = "PRO",
  headline,
  bullets,
}: TrialUpgradeModalProps) {
  const tierCopy = TIER_COPY[requiredTier]
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    fetch("/api/billing/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "viewed_upgrade", feature, tier: requiredTier }),
    }).catch(() => {})
  }, [open, feature, requiredTier])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  async function startTrial() {
    setLoading(true)
    setError(null)
    try {
      fetch("/api/billing/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "clicked_upgrade", feature, tier: requiredTier }),
      }).catch(() => {})

      const res = await fetch("/api/billing/trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: requiredTier, feature }),
      })
      if (!res.ok) {
        setError("Could not start trial. Try again or head to billing.")
        setLoading(false)
        return
      }
      const data = (await res.json()) as { url?: string | null }
      if (data.url) {
        window.location.href = data.url
        return
      }
      window.location.href = "/billing?trial=started"
    } catch {
      setError("Something went wrong. Please try again.")
      setLoading(false)
    }
  }

  const headlineText = headline ?? `${featureLabel} is a ${tierCopy.name} feature`
  const bulletList = bullets ?? [...tierCopy.defaultBullets]

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="trial-upgrade-modal-title"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-md rounded-2xl bg-[#1a1f15] border border-[#3a4030] shadow-[0_24px_60px_rgba(0,0,0,0.4)] overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-[#9aab7e] via-[#6b7d52] to-[#9aab7e]" />

        <div className="p-8">
          <p className="text-[#9aab7e] text-[10px] tracking-[0.25em] uppercase mb-3">
            7-day free trial
          </p>
          <h2
            id="trial-upgrade-modal-title"
            className="font-[family-name:var(--font-cormorant)] italic text-[#e8e4d8] text-2xl leading-tight mb-2"
          >
            {headlineText}
          </h2>
          <p className="text-[#6b7d52] text-sm mb-6">
            Start your trial now — no charge for 7 days. Cancel anytime from the billing page.
          </p>

          <div className="rounded-lg bg-[#222821] border border-[#3a4030] p-4 mb-6">
            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-[#e8e4d8] text-2xl font-medium">{tierCopy.price}</span>
              <span className="text-[#6b7d52] text-sm">{tierCopy.period}</span>
              <span className="ml-auto text-[#9aab7e] text-[10px] tracking-wider uppercase">
                {tierCopy.name}
              </span>
            </div>
            <ul className="space-y-1.5">
              {bulletList.map((b) => (
                <li key={b} className="flex gap-2 text-[#e8e4d8]/80 text-sm">
                  <span className="text-[#9aab7e]">·</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg border border-[#d45b5b]/40 bg-[#d45b5b]/10 text-[#d45b5b] text-xs">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <button
              onClick={startTrial}
              disabled={loading}
              className="w-full py-3 rounded-lg text-sm font-medium bg-[#6b7d52] text-[#f5f2ea] hover:bg-[#5a6c44] transition-colors disabled:opacity-60"
            >
              {loading ? "Starting trial..." : "Start 7-day free trial"}
            </button>
            <button
              onClick={onClose}
              className="w-full py-2 text-[#6b7d52] hover:text-[#e8e4d8] text-xs transition-colors"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
