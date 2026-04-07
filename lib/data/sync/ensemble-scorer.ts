/**
 * AIRE Batch Ensemble Scorer
 *
 * Runs ensemble AVM + disagreement scoring for all active properties
 * that have recent market snapshot data. Called nightly by the data-sync cron.
 */

import { query } from '../db/client'
import { calculateEnsemble, DEFAULT_WEIGHTS } from '../engines/ensemble'
import { calculateDisagreement } from '../engines/disagreement'

export interface BatchScoringResult {
  scored: number
  skipped: number
  errors: number
  duration_ms: number
}

/**
 * Score all active properties with fresh snapshot data.
 * Inserts new rows into aire_scores (append-only).
 */
export async function runBatchEnsembleScoring(): Promise<BatchScoringResult> {
  const start = Date.now()
  let scored = 0
  let skipped = 0
  let errors = 0

  try {
    // Pull all active properties with their latest snapshot
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
         ms.list_price, ms.sold_price,
         ms.zillow_estimate, ms.redfin_estimate,
         ms.propstream_avm, ms.assessor_fmv
       FROM market_snapshots ms
       WHERE ms.status = 'active'
         AND ms.snapshot_date >= NOW() - INTERVAL '14 days'
       ORDER BY ms.property_id, ms.snapshot_date DESC`
    )

    console.log(`[BatchScorer] Found ${rows.length} active properties to score`)

    const today = new Date().toISOString().split('T')[0]

    for (const row of rows) {
      try {
        const inputs = {
          mls_cma: row.list_price,
          propstream_avm: row.propstream_avm,
          zillow_estimate: row.zillow_estimate,
          redfin_estimate: row.redfin_estimate,
          list_price: row.list_price,
          assessor_fmv: row.assessor_fmv,
        }

        const estimate = calculateEnsemble(inputs)
        if (!estimate) { skipped++; continue }

        const disagreement = calculateDisagreement(inputs)

        await query(
          `INSERT INTO aire_scores (
             property_id, score_date, aire_estimate,
             ensemble_weight_mls, ensemble_weight_propstream,
             ensemble_weight_zillow, ensemble_weight_redfin,
             source_disagreement_pct, confidence_tier,
             assessor_gap_pct
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            row.property_id, today, estimate.aire_estimate,
            estimate.weights_used.mls, estimate.weights_used.propstream,
            estimate.weights_used.zillow, estimate.weights_used.redfin,
            disagreement?.disagreement_pct ?? null,
            disagreement?.confidence_tier ?? null,
            estimate.assessor_gap_pct,
          ]
        )
        scored++
      } catch {
        errors++
      }
    }
  } catch (err) {
    console.error('[BatchScorer] Fatal error:', err)
    errors++
  }

  return { scored, skipped, errors, duration_ms: Date.now() - start }
}
