"use client"

import { useCallback, useState } from "react"

export interface GateTrigger {
  feature: string
  featureLabel: string
  requiredTier?: "PRO" | "INVESTOR"
}

/**
 * Hook for client components that gate interactions behind a tier.
 *
 * Usage:
 *   const gate = useTrialGate()
 *   <button onClick={() => gate.trigger({ feature: "voice", featureLabel: "Voice Commands" })}>
 *   <TrialUpgradeModal open={gate.open} onClose={gate.close} feature={gate.state?.feature ?? ""} featureLabel={gate.state?.featureLabel ?? ""} />
 */
export function useTrialGate() {
  const [state, setState] = useState<GateTrigger | null>(null)

  const trigger = useCallback((t: GateTrigger) => {
    setState(t)
  }, [])

  const close = useCallback(() => setState(null), [])

  return {
    state,
    open: state !== null,
    trigger,
    close,
  }
}
