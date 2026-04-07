/**
 * AIRE Intelligence — Weighted Ensemble AVM
 *
 * Combines MLS CMA, PropStream AVM, Zillow Zestimate, and Redfin estimate
 * into a single AIRE estimate using calibrated weights.
 *
 * DEFAULT WEIGHTS (recalibrate quarterly via scripts/recalibrate-weights.ts):
 *   MLS CMA:        40% — highest weight; local agent-priced comps are most reliable
 *   PropStream AVM: 25% — strong automated model with local data
 *   Zillow:         20% — broad market signal, less accurate in low-inventory markets
 *   Redfin:         15% — tends to be conservative; useful downside anchor
 *
 * MISSING SOURCE RULE:
 *   If a source is missing, redistribute its weight proportionally among available sources.
 *   Always record which sources were actually used in aire_scores.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EnsembleInputs {
  mls_cma?: number | null
  propstream_avm?: number | null
  zillow_estimate?: number | null
  redfin_estimate?: number | null
  list_price?: number | null
  assessor_fmv?: number | null
}

export interface EnsembleWeights {
  [key: string]: number
  mls: number
  propstream: number
  zillow: number
  redfin: number
}

export interface EnsembleResult {
  aire_estimate: number
  weights_used: EnsembleWeights
  sources_used: string[]
  missing_sources: string[]
  assessor_gap_pct: number | null
}

// ── Default weights ───────────────────────────────────────────────────────────

export const DEFAULT_WEIGHTS: EnsembleWeights = {
  mls: 0.40,
  propstream: 0.25,
  zillow: 0.20,
  redfin: 0.15,
}

// ── Core calculation ──────────────────────────────────────────────────────────

export function calculateEnsemble(
  inputs: EnsembleInputs,
  weights: EnsembleWeights = DEFAULT_WEIGHTS
): EnsembleResult | null {
  const mlsValue = inputs.mls_cma ?? inputs.list_price ?? null

  const sourceMap: Record<string, number | null> = {
    mls: mlsValue,
    propstream: inputs.propstream_avm ?? null,
    zillow: inputs.zillow_estimate ?? null,
    redfin: inputs.redfin_estimate ?? null,
  }

  const available = Object.entries(sourceMap).filter(([, v]) => v != null) as [string, number][]
  const missing = Object.keys(sourceMap).filter(k => sourceMap[k] == null)

  if (available.length === 0) return null

  const totalMissingWeight = missing.reduce((sum, k) => sum + (weights as Record<string, number>)[k], 0)
  const totalAvailableWeight = available.reduce((sum, [k]) => sum + (weights as Record<string, number>)[k], 0)

  const redistributedWeights: EnsembleWeights = { ...weights }
  if (totalMissingWeight > 0 && totalAvailableWeight > 0) {
    for (const [key] of available) {
      const originalWeight = (weights as Record<string, number>)[key]
      const addedShare = (originalWeight / totalAvailableWeight) * totalMissingWeight;
      (redistributedWeights as Record<string, number>)[key] = originalWeight + addedShare
    }
    for (const key of missing) {
      (redistributedWeights as Record<string, number>)[key] = 0
    }
  }

  let weightedSum = 0
  let totalWeight = 0
  for (const [key, value] of available) {
    const w = (redistributedWeights as Record<string, number>)[key]
    weightedSum += value * w
    totalWeight += w
  }

  if (totalWeight === 0) return null

  const aire_estimate = Math.round(weightedSum / totalWeight)

  const listPrice = inputs.list_price ?? mlsValue
  const assessor_gap_pct = inputs.assessor_fmv && listPrice
    ? (listPrice - inputs.assessor_fmv) / inputs.assessor_fmv
    : null

  return {
    aire_estimate,
    weights_used: redistributedWeights,
    sources_used: available.map(([k]) => k),
    missing_sources: missing,
    assessor_gap_pct: assessor_gap_pct != null ? parseFloat(assessor_gap_pct.toFixed(4)) : null,
  }
}
