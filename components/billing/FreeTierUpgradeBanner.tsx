"use client"

import { useState } from "react"
import { TrialUpgradeModal } from "./TrialUpgradeModal"

interface FreeTierUpgradeBannerProps {
  tier: "FREE" | "PRO" | "INVESTOR"
  trialStatus: "none" | "active" | "expired"
  trialDaysRemaining: number | null
}

/**
 * Conversion banner shown on /aire for FREE users who never trialed, and a
 * gentle "trial active — N days left" nudge once they've started one.
 * Renders nothing for paid users with an active subscription.
 */
export function FreeTierUpgradeBanner({
  tier,
  trialStatus,
  trialDaysRemaining,
}: FreeTierUpgradeBannerProps) {
  const [modalOpen, setModalOpen] = useState(false)

  if (tier !== "FREE" && trialStatus !== "active") return null

  if (trialStatus === "active" && trialDaysRemaining !== null) {
    return (
      <div className="mb-6 rounded-xl border border-[#9aab7e]/30 bg-[#9aab7e]/10 px-5 py-3 flex items-center gap-4">
        <span
          className="w-2 h-2 rounded-full bg-[#9aab7e]"
          aria-hidden="true"
        />
        <div className="flex-1">
          <p className="text-[#4a5638] text-sm font-medium">
            Trial active · {trialDaysRemaining} day{trialDaysRemaining === 1 ? "" : "s"} remaining
          </p>
          <p className="text-[#6b7d52] text-xs">
            Add a card on the billing page to keep your subscription uninterrupted.
          </p>
        </div>
        <a
          href="/billing"
          className="text-[#4a5638] text-xs font-medium underline hover:text-[#1e2416]"
        >
          Manage billing
        </a>
      </div>
    )
  }

  return (
    <>
      <div className="mb-6 rounded-xl border border-[#6b7d52]/30 bg-gradient-to-r from-[#9aab7e]/10 via-[#f5f2ea] to-[#9aab7e]/10 px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex-1">
          <p className="text-[#6b7d52] text-[10px] tracking-[0.2em] uppercase mb-1">
            Unlock AIRE Pro
          </p>
          <p className="text-[#1e2416] text-sm">
            Voice commands, AirSign, Morning Brief, and compliance scans — free for 7 days.
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="px-4 py-2 rounded-lg bg-[#6b7d52] text-[#f5f2ea] text-xs font-medium tracking-wide hover:bg-[#5a6c44] transition-colors whitespace-nowrap"
        >
          Start 7-day free trial
        </button>
      </div>
      <TrialUpgradeModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        feature="dashboard_banner"
        featureLabel="AIRE Pro"
        headline="Unlock everything AIRE can do"
      />
    </>
  )
}
