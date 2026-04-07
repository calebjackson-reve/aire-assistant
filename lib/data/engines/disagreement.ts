/**
 * AIRE Intelligence — Source Disagreement Engine
 *
 * Measures how much the four AVM sources disagree with each other.
 * High disagreement = lower confidence in the AIRE estimate.
 *
 * Confidence tiers:
 *   < 4%  → HIGH   (sources closely agree)
 *   4–8%  → MEDIUM (moderate spread)
 *   > 8%  → LOW    (flag for admin review)
 */

import type { EnsembleInputs } from './ensemble'

export type ConfidenceTier = 'HIGH' | 'MEDIUM' | 'LOW'

export interface DisagreementResult {
  disagreement_pct: number
  confidence_tier: ConfidenceTier
  source_values: Record<string, number>
  mean: number
  std_dev: number
  source_count: number
  flag_for_review: boolean
}

const HIGH_THRESHOLD = 0.04
const MEDIUM_THRESHOLD = 0.08

export function calculateDisagreement(inputs: EnsembleInputs): DisagreementResult | null {
  const sourceMap: Record<string, number | null> = {
    mls: inputs.mls_cma ?? inputs.list_price ?? null,
    propstream: inputs.propstream_avm ?? null,
    zillow: inputs.zillow_estimate ?? null,
    redfin: inputs.redfin_estimate ?? null,
  }

  const presentSources = Object.entries(sourceMap).filter(([, v]) => v != null) as [string, number][]
  if (presentSources.length < 2) return null

  const values = presentSources.map(([, v]) => v)
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  if (mean === 0) return null

  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
  const std_dev = Math.sqrt(variance)
  const disagreement_pct = std_dev / mean

  const confidence_tier: ConfidenceTier =
    disagreement_pct < HIGH_THRESHOLD ? 'HIGH' :
    disagreement_pct < MEDIUM_THRESHOLD ? 'MEDIUM' : 'LOW'

  const source_values: Record<string, number> = {}
  for (const [k, v] of presentSources) source_values[k] = v

  return {
    disagreement_pct: parseFloat(disagreement_pct.toFixed(4)),
    confidence_tier,
    source_values,
    mean: Math.round(mean),
    std_dev: Math.round(std_dev),
    source_count: presentSources.length,
    flag_for_review: confidence_tier === 'LOW',
  }
}

export function disagreementReasonCode(result: DisagreementResult): { factor: string; score: number; note: string } {
  const score = result.confidence_tier === 'HIGH' ? 1.0 : result.confidence_tier === 'MEDIUM' ? 0.6 : 0.2
  const dollarSpread = (result.std_dev * 2).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

  return {
    factor: 'SourceAgreement',
    score,
    note: result.confidence_tier === 'HIGH'
      ? `Sources agree closely (${(result.disagreement_pct * 100).toFixed(1)}% spread) — high confidence`
      : result.confidence_tier === 'MEDIUM'
        ? `Moderate source spread (${(result.disagreement_pct * 100).toFixed(1)}%, ±${dollarSpread}) — use with context`
        : `Sources diverge significantly (${(result.disagreement_pct * 100).toFixed(1)}%, ±${dollarSpread}) — flagged for review`,
  }
}
