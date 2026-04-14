/**
 * AIRE Intelligence — Source Disagreement Engine
 *
 * Measures how much the four AVM sources disagree with each other.
 * High disagreement = lower confidence in the AIRE estimate.
 *
 * Formula:
 *   disagreement_pct = StdDev([zillow, redfin, propstream_avm, mls_cma]) / Mean([all])
 *
 * Confidence tiers:
 *   < 4%  → HIGH   (sources closely agree — AIRE estimate is reliable)
 *   4–8%  → MEDIUM (moderate spread — use with context)
 *   > 8%  → LOW    (sources diverge significantly — flag for admin review)
 *
 * A LOW confidence property shows up in the admin review queue so Caleb can
 * manually investigate why sources disagree and optionally override the estimate.
 */

import type { EnsembleInputs } from './ensemble'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ConfidenceTier = 'HIGH' | 'MEDIUM' | 'LOW'

export interface DisagreementResult {
  disagreement_pct: number       // StdDev / Mean across available sources
  confidence_tier: ConfidenceTier
  source_values: Record<string, number>  // which sources contributed and their values
  mean: number
  std_dev: number
  source_count: number
  flag_for_review: boolean       // true if confidence = LOW
}

// ── Thresholds ────────────────────────────────────────────────────────────────

const HIGH_THRESHOLD   = 0.04   // < 4%  → HIGH
const MEDIUM_THRESHOLD = 0.08   // 4–8%  → MEDIUM; > 8% → LOW

// ── Core calculation ──────────────────────────────────────────────────────────

/**
 * Calculate source disagreement across available AVM inputs.
 * Returns null if fewer than 2 sources are available (can't compute spread).
 *
 * @example
 *   calculateDisagreement({
 *     mls_cma: 340000,
 *     zillow_estimate: 360000,
 *     redfin_estimate: 338000,
 *     propstream_avm: 355000,
 *   })
 *   // → { disagreement_pct: 0.032, confidence_tier: 'HIGH', ... }
 */
export function calculateDisagreement(inputs: EnsembleInputs): DisagreementResult | null {
  const sourceMap: Record<string, number | null> = {
    mls: inputs.mls_cma ?? inputs.list_price ?? null,
    propstream: inputs.propstream_avm ?? null,
    zillow: inputs.zillow_estimate ?? null,
    redfin: inputs.redfin_estimate ?? null,
  }

  // Collect only present values
  const presentSources = Object.entries(sourceMap).filter(([, v]) => v != null) as [string, number][]
  if (presentSources.length < 2) return null

  const values = presentSources.map(([, v]) => v)

  const mean = values.reduce((a, b) => a + b, 0) / values.length
  if (mean === 0) return null

  // Population std dev (not sample — we're measuring this specific set of sources)
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

// ── Batch update ──────────────────────────────────────────────────────────────

/**
 * Run disagreement scoring for all properties that have a score today
 * but no confidence_tier yet. Called after runBatchEnsemble() in the scheduler.
 */
export async function runBatchDisagreement(): Promise<{ updated: number }> {
  const { query } = await import('../db/client')

  // Pull properties scored today that have at least 2 sources in latest snapshot
  const { rows } = await query<{
    score_id: string
    property_id: string
    mls_cma: number | null
    propstream_avm: number | null
    zillow_estimate: number | null
    redfin_estimate: number | null
    list_price: number | null
  }>(
    `SELECT
       s.id as score_id,
       s.property_id,
       ms.list_price as mls_cma,
       ms.propstream_avm,
       ms.zillow_estimate,
       ms.redfin_estimate,
       ms.list_price
     FROM aire_scores s
     JOIN LATERAL (
       SELECT list_price, propstream_avm, zillow_estimate, redfin_estimate
       FROM market_snapshots
       WHERE property_id = s.property_id
       ORDER BY snapshot_date DESC, created_at DESC
       LIMIT 1
     ) ms ON true
     WHERE s.score_date = CURRENT_DATE
       AND s.confidence_tier IS NULL`
  )

  let updated = 0
  for (const row of rows) {
    const result = calculateDisagreement({
      mls_cma: row.mls_cma,
      propstream_avm: row.propstream_avm,
      zillow_estimate: row.zillow_estimate,
      redfin_estimate: row.redfin_estimate,
      list_price: row.list_price,
    })

    if (!result) continue

    await query(
      `UPDATE aire_scores
       SET source_disagreement_pct = $1, confidence_tier = $2
       WHERE id = $3`,
      [result.disagreement_pct, result.confidence_tier, row.score_id]
    )
    updated++
  }

  return { updated }
}

// ── Reason code generator ─────────────────────────────────────────────────────

export function disagreementReasonCode(result: DisagreementResult): {
  factor: string; score: number; note: string
} {
  const score = result.confidence_tier === 'HIGH' ? 1.0
    : result.confidence_tier === 'MEDIUM' ? 0.6 : 0.2

  const dollarSpread = (result.std_dev * 2).toLocaleString('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0
  })

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
