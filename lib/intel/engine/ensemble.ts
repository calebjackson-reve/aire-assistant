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
  mls_cma?: number | null       // Agent CMA or MLS list price used as CMA proxy
  propstream_avm?: number | null
  zillow_estimate?: number | null
  redfin_estimate?: number | null
  list_price?: number | null    // Fallback if mls_cma unavailable
  assessor_fmv?: number | null  // Used for assessor_gap_pct only, not in estimate
}

export interface EnsembleWeights {
  [key: string]: number  // index signature for Record<string, number> compatibility
  mls: number         // default 0.40
  propstream: number  // default 0.25
  zillow: number      // default 0.20
  redfin: number      // default 0.15
}

export interface EnsembleResult {
  aire_estimate: number
  weights_used: EnsembleWeights         // actual weights after redistribution
  sources_used: string[]                // which sources contributed
  missing_sources: string[]             // which sources were absent
  assessor_gap_pct: number | null       // (list_price - assessor_fmv) / assessor_fmv
}

// ── Default weights ───────────────────────────────────────────────────────────

export const DEFAULT_WEIGHTS: EnsembleWeights = {
  mls: 0.40,
  propstream: 0.25,
  zillow: 0.20,
  redfin: 0.15,
}

// ── Core calculation ──────────────────────────────────────────────────────────

/**
 * Calculate the AIRE ensemble AVM estimate.
 * Returns null if no source data is available.
 *
 * @example
 *   calculateEnsemble({
 *     mls_cma: 340000,
 *     zillow_estimate: 355000,
 *     redfin_estimate: 338000,
 *     propstream_avm: null,  // missing — weight redistributed
 *   })
 */
export function calculateEnsemble(
  inputs: EnsembleInputs,
  weights: EnsembleWeights = DEFAULT_WEIGHTS
): EnsembleResult | null {
  // Use list_price as MLS CMA proxy if no explicit CMA provided
  const mlsValue = inputs.mls_cma ?? inputs.list_price ?? null

  // Build source map: name → value
  const sourceMap: Record<string, number | null> = {
    mls: mlsValue,
    propstream: inputs.propstream_avm ?? null,
    zillow: inputs.zillow_estimate ?? null,
    redfin: inputs.redfin_estimate ?? null,
  }

  // Identify which sources are available
  const available = Object.entries(sourceMap).filter(([, v]) => v != null) as [string, number][]
  const missing = Object.keys(sourceMap).filter(k => sourceMap[k] == null)

  if (available.length === 0) return null

  // ── Redistribute missing weights proportionally ────────────────────────────
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

  // ── Weighted average ──────────────────────────────────────────────────────
  let weightedSum = 0
  let totalWeight = 0
  for (const [key, value] of available) {
    const w = (redistributedWeights as Record<string, number>)[key]
    weightedSum += value * w
    totalWeight += w
  }

  if (totalWeight === 0) return null

  const aire_estimate = Math.round(weightedSum / totalWeight)

  // ── Assessor gap (Louisiana-specific alpha signal) ────────────────────────
  // High gap (>1.5x assessor FMV) in a slow market = pricing risk
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

// ── Batch calculation ─────────────────────────────────────────────────────────

/**
 * Run ensemble calculation for all active properties in the DB.
 * Called nightly by the scheduler (Step 5 of nightly run).
 */
export async function runBatchEnsemble(weights?: EnsembleWeights): Promise<{
  calculated: number
  failed: number
}> {
  const { query } = await import('../db/client')
  const { insertScore } = await import('../db/queries/scores')
  const { createJobLogger } = await import('../utils/logger')

  const effectiveWeights = weights ?? DEFAULT_WEIGHTS
  const job = await createJobLogger('ensemble-scoring', undefined, 'scheduler')
  let calculated = 0
  let failed = 0

  // Pull all active properties with their latest snapshot data
  const { rows } = await query<{
    property_id: string
    list_price: number | null
    sold_price: number | null
    zillow_estimate: number | null
    redfin_estimate: number | null
    propstream_avm: number | null
    assessor_fmv: number | null
  }>(
    `SELECT DISTINCT ON (ms.property_id)
       ms.property_id,
       ms.list_price,
       ms.sold_price,
       ms.zillow_estimate,
       ms.redfin_estimate,
       ms.propstream_avm,
       ms.assessor_fmv
     FROM market_snapshots ms
     WHERE ms.status = 'active'
       AND ms.snapshot_date >= NOW() - INTERVAL '14 days'
     ORDER BY ms.property_id, ms.snapshot_date DESC`
  )

  job.info(`Running ensemble for ${rows.length} active properties`)

  const today = new Date().toISOString().split('T')[0]

  for (const row of rows) {
    job.countAttempted()
    try {
      const result = calculateEnsemble({
        mls_cma: row.list_price,
        propstream_avm: row.propstream_avm,
        zillow_estimate: row.zillow_estimate,
        redfin_estimate: row.redfin_estimate,
        assessor_fmv: row.assessor_fmv,
        list_price: row.list_price,
      }, effectiveWeights)

      if (!result) {
        job.countSkipped()
        continue
      }

      await insertScore({
        property_id: row.property_id,
        score_date: today,
        aire_estimate: result.aire_estimate,
        ensemble_weight_mls: result.weights_used.mls,
        ensemble_weight_propstream: result.weights_used.propstream,
        ensemble_weight_zillow: result.weights_used.zillow,
        ensemble_weight_redfin: result.weights_used.redfin,
        assessor_gap_pct: result.assessor_gap_pct ?? undefined,
      })

      job.countImported()
      calculated++
    } catch (err) {
      failed++
      job.countErrored()
    }
  }

  await job.complete(failed === 0 ? 'success' : 'partial', { calculated, failed })
  return { calculated, failed }
}
