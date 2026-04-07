/**
 * AIRE Intelligence — Backtest Engine
 *
 * Validates AIRE accuracy against actual sold prices.
 * Compares AIRE ensemble estimates to final sold_price for properties
 * that have both an aire_score and a sold snapshot.
 *
 * Key metric: "AIRE was within 5% on X% of comps vs Zillow's Y%"
 */

import { query } from '../db/client'
import { calculateEnsemble, DEFAULT_WEIGHTS, type EnsembleWeights } from './ensemble'

export interface BacktestParams {
  geography?: string    // parish filter (e.g., 'EBR', 'Ascension')
  price_band?: string   // '150k-250k' | '250k-400k' | '400k+' | 'all'
  months?: number       // lookback window in months (default 6)
  weights?: EnsembleWeights
}

interface SourceMetrics {
  mae: number | null         // mean absolute error ($)
  mape: number | null        // mean absolute % error
  hit_rate_5pct: number | null  // % of estimates within 5% of sold
  hit_rate_10pct: number | null
  properties_with_data: number
}

export interface BacktestResult {
  sample_size: number
  aire: SourceMetrics
  zillow: SourceMetrics
  redfin: SourceMetrics
  propstream: SourceMetrics
  aire_vs_zillow_gain: number | null  // % accuracy improvement
  headline: string
  weights_used: EnsembleWeights
  run_date: string
}

export async function runBacktest(params: BacktestParams = {}): Promise<BacktestResult> {
  const months = params.months ?? 6
  const weights = params.weights ?? DEFAULT_WEIGHTS

  // Pull sold comps with all source valuations
  let whereClause = `WHERE ms.sold_price IS NOT NULL AND ms.sold_date >= NOW() - INTERVAL '${months} months'`
  const queryParams: unknown[] = []

  if (params.geography && params.geography !== 'all') {
    queryParams.push(params.geography)
    whereClause += ` AND p.parish = $${queryParams.length}`
  }

  if (params.price_band && params.price_band !== 'all') {
    const bands: Record<string, [number, number]> = {
      '150k-250k': [150000, 250000],
      '250k-400k': [250000, 400000],
      '400k+': [400000, 999999999],
    }
    const band = bands[params.price_band]
    if (band) {
      queryParams.push(band[0], band[1])
      whereClause += ` AND ms.sold_price BETWEEN $${queryParams.length - 1} AND $${queryParams.length}`
    }
  }

  const { rows: comps } = await query<{
    property_id: string
    sold_price: number
    list_price: number | null
    zillow_estimate: number | null
    redfin_estimate: number | null
    propstream_avm: number | null
    assessor_fmv: number | null
  }>(
    `SELECT DISTINCT ON (ms.property_id)
       ms.property_id, ms.sold_price, ms.list_price,
       ms.zillow_estimate, ms.redfin_estimate,
       ms.propstream_avm, ms.assessor_fmv
     FROM market_snapshots ms
     JOIN properties_clean p ON p.property_id = ms.property_id
     ${whereClause}
     ORDER BY ms.property_id, ms.sold_date DESC`,
    queryParams
  )

  // Score each comp
  const aireErrors: number[] = []
  const zillowErrors: number[] = []
  const redfinErrors: number[] = []
  const propstreamErrors: number[] = []

  for (const comp of comps) {
    const estimate = calculateEnsemble({
      mls_cma: comp.list_price,
      propstream_avm: comp.propstream_avm,
      zillow_estimate: comp.zillow_estimate,
      redfin_estimate: comp.redfin_estimate,
    }, weights)

    if (estimate) {
      aireErrors.push(Math.abs(estimate.aire_estimate - comp.sold_price) / comp.sold_price)
    }
    if (comp.zillow_estimate) {
      zillowErrors.push(Math.abs(comp.zillow_estimate - comp.sold_price) / comp.sold_price)
    }
    if (comp.redfin_estimate) {
      redfinErrors.push(Math.abs(comp.redfin_estimate - comp.sold_price) / comp.sold_price)
    }
    if (comp.propstream_avm) {
      propstreamErrors.push(Math.abs(comp.propstream_avm - comp.sold_price) / comp.sold_price)
    }
  }

  const calcMetrics = (errors: number[]): SourceMetrics => {
    if (errors.length === 0) return { mae: null, mape: null, hit_rate_5pct: null, hit_rate_10pct: null, properties_with_data: 0 }
    const mape = errors.reduce((a, b) => a + b, 0) / errors.length
    return {
      mae: Math.round(mape * (comps.length > 0 ? comps.reduce((s, c) => s + c.sold_price, 0) / comps.length : 0)),
      mape: parseFloat((mape * 100).toFixed(2)),
      hit_rate_5pct: parseFloat(((errors.filter(e => e < 0.05).length / errors.length) * 100).toFixed(2)),
      hit_rate_10pct: parseFloat(((errors.filter(e => e < 0.10).length / errors.length) * 100).toFixed(2)),
      properties_with_data: errors.length,
    }
  }

  const aire = calcMetrics(aireErrors)
  const zillow = calcMetrics(zillowErrors)
  const redfin = calcMetrics(redfinErrors)
  const propstream = calcMetrics(propstreamErrors)

  const aire_vs_zillow_gain = aire.mape != null && zillow.mape != null && zillow.mape > 0
    ? parseFloat(((zillow.mape - aire.mape) / zillow.mape * 100).toFixed(2))
    : null

  const headline = aire.hit_rate_5pct != null && zillow.hit_rate_5pct != null
    ? `AIRE within 5% on ${aire.hit_rate_5pct}% of comps vs Zillow ${zillow.hit_rate_5pct}% — ${comps.length} sold comps`
    : `Backtest on ${comps.length} comps — insufficient source data for headline`

  const run_date = new Date().toISOString().split('T')[0]

  // Save results
  if (comps.length > 0) {
    try {
      await query(
        `INSERT INTO backtest_results (
           run_date, geography, price_band, sample_size,
           aire_mae, aire_mape, aire_hit_rate_5pct, aire_hit_rate_10pct,
           zillow_mae, zillow_mape, zillow_hit_rate_5pct,
           redfin_mae, redfin_mape, redfin_hit_rate_5pct,
           propstream_mae, propstream_mape, propstream_hit_rate_5pct,
           aire_vs_zillow_accuracy_gain, weights_used, notes
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
        [
          run_date, params.geography ?? 'all', params.price_band ?? 'all', comps.length,
          aire.mae, aire.mape, aire.hit_rate_5pct, aire.hit_rate_10pct,
          zillow.mae, zillow.mape, zillow.hit_rate_5pct,
          redfin.mae, redfin.mape, redfin.hit_rate_5pct,
          propstream.mae, propstream.mape, propstream.hit_rate_5pct,
          aire_vs_zillow_gain, JSON.stringify(weights), headline,
        ]
      )
    } catch { /* non-critical */ }
  }

  return { sample_size: comps.length, aire, zillow, redfin, propstream, aire_vs_zillow_gain, headline, weights_used: weights, run_date }
}
