/**
 * AIRE Intelligence — Backtest Engine (Phase 4)
 *
 * Validates AIRE accuracy against actual sold prices.
 * This is the proof that AIRE outperforms Zillow, Redfin, and PropStream AVM.
 *
 * HOW IT WORKS:
 * 1. Pull sold comps from market_snapshots (known final sale price)
 * 2. Reconstruct what AIRE would have estimated at list date using available sources
 * 3. Compare AIRE, Zillow, Redfin, PropStream to actual sold_price
 * 4. Calculate MAE, MAPE, hit rates for each source
 * 5. Calculate AIRE's accuracy gain vs. Zillow (the headline metric)
 * 6. Save results to backtest_results table
 *
 * KEY HEADLINE METRIC:
 * "AIRE was within 5% of final sold price on X% of properties vs Zillow's Y%"
 * This number goes on the homepage once the first backtest completes.
 */

import { calculateEnsemble, EnsembleWeights, DEFAULT_WEIGHTS } from './ensemble'
import { getSoldCompsForBacktest, insertBacktestResult } from '../db/queries/backtest'
import { log } from '../utils/logger'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BacktestParams {
  geography: 'EBR' | 'Ascension' | 'Livingston' | 'all'
  price_band: '150k-250k' | '250k-400k' | '400k+' | 'all'
  property_type: 'SFR' | 'condo' | 'multi' | 'all'
  date_from: Date
  date_to: Date
  weights?: EnsembleWeights
  model_version?: string
}

export interface PropertyBacktestResult {
  property_id: string
  sold_price: number
  list_price: number | null
  aire_estimate: number | null
  zillow_estimate: number | null
  redfin_estimate: number | null
  propstream_avm: number | null
  aire_abs_error: number | null
  zillow_abs_error: number | null
  redfin_abs_error: number | null
  propstream_abs_error: number | null
  aire_abs_pct_error: number | null
  zillow_abs_pct_error: number | null
  redfin_abs_pct_error: number | null
  propstream_abs_pct_error: number | null
}

export interface BacktestSummary {
  sample_size: number
  aire: SourceMetrics
  zillow: SourceMetrics
  redfin: SourceMetrics
  propstream: SourceMetrics
  aire_vs_zillow_accuracy_gain: number | null
  aire_vs_redfin_accuracy_gain: number | null
  weights_used: EnsembleWeights
  headline: string  // human-readable summary for the website
}

interface SourceMetrics {
  mae: number | null
  mape: number | null
  hit_rate_3pct: number | null
  hit_rate_5pct: number | null
  hit_rate_10pct: number | null
  properties_with_data: number
}

// ── Core backtest runner ──────────────────────────────────────────────────────

/**
 * Run a full backtest. Returns per-property results and aggregate metrics.
 * Saves results to backtest_results table.
 *
 * @example
 *   const result = await runBacktest({
 *     geography: 'EBR',
 *     price_band: 'all',
 *     property_type: 'SFR',
 *     date_from: new Date('2024-06-01'),
 *     date_to: new Date('2024-12-31'),
 *   })
 *   console.log(result.headline)
 *   // "AIRE was within 5% on 74% of comps vs Zillow 61% (+21% accuracy gain)"
 */
export async function runBacktest(params: BacktestParams): Promise<BacktestSummary> {
  const weights = params.weights ?? DEFAULT_WEIGHTS
  const modelVersion = params.model_version ?? '1.0'

  log.info('Starting backtest', {
    geography: params.geography,
    price_band: params.price_band,
    property_type: params.property_type,
    date_from: params.date_from.toISOString().split('T')[0],
    date_to: params.date_to.toISOString().split('T')[0],
  })

  // ── 1. Fetch sold comps ───────────────────────────────────────────────────
  const comps = await getSoldCompsForBacktest({
    geography: params.geography,
    priceBand: params.price_band,
    propertyType: params.property_type,
    dateFrom: params.date_from,
    dateTo: params.date_to,
  })

  log.info(`Fetched ${comps.length} sold comps for backtest`)

  if (comps.length < 10) {
    log.warn('Fewer than 10 comps — backtest results may not be statistically meaningful')
  }

  // ── 2. Score each comp ───────────────────────────────────────────────────
  const propertyResults: PropertyBacktestResult[] = []

  for (const comp of comps) {
    // Reconstruct AIRE estimate using sources available at list date
    const ensembleResult = calculateEnsemble({
      mls_cma: comp.list_price,
      propstream_avm: comp.propstream_avm,
      zillow_estimate: comp.zillow_estimate,
      redfin_estimate: comp.redfin_estimate,
    }, weights)

    const aire_estimate = ensembleResult?.aire_estimate ?? null

    // Calculate absolute errors vs sold_price
    const calcError = (estimate: number | null) =>
      estimate != null ? Math.abs(estimate - comp.sold_price) : null
    const calcPctError = (estimate: number | null) =>
      estimate != null ? Math.abs(estimate - comp.sold_price) / comp.sold_price : null

    propertyResults.push({
      property_id: comp.property_id,
      sold_price: comp.sold_price,
      list_price: comp.list_price,
      aire_estimate,
      zillow_estimate: comp.zillow_estimate,
      redfin_estimate: comp.redfin_estimate,
      propstream_avm: comp.propstream_avm,
      aire_abs_error: calcError(aire_estimate),
      zillow_abs_error: calcError(comp.zillow_estimate),
      redfin_abs_error: calcError(comp.redfin_estimate),
      propstream_abs_error: calcError(comp.propstream_avm),
      aire_abs_pct_error: calcPctError(aire_estimate),
      zillow_abs_pct_error: calcPctError(comp.zillow_estimate),
      redfin_abs_pct_error: calcPctError(comp.redfin_estimate),
      propstream_abs_pct_error: calcPctError(comp.propstream_avm),
    })
  }

  // ── 3. Aggregate metrics ─────────────────────────────────────────────────
  const aireMetrics = aggregateMetrics(propertyResults, 'aire')
  const zillowMetrics = aggregateMetrics(propertyResults, 'zillow')
  const redfinMetrics = aggregateMetrics(propertyResults, 'redfin')
  const propstreamMetrics = aggregateMetrics(propertyResults, 'propstream')

  // Accuracy gain vs Zillow: (zillow_mape - aire_mape) / zillow_mape
  const aireVsZillow = aireMetrics.mape != null && zillowMetrics.mape != null && zillowMetrics.mape > 0
    ? parseFloat(((zillowMetrics.mape - aireMetrics.mape) / zillowMetrics.mape * 100).toFixed(2))
    : null

  const aireVsRedfin = aireMetrics.mape != null && redfinMetrics.mape != null && redfinMetrics.mape > 0
    ? parseFloat(((redfinMetrics.mape - aireMetrics.mape) / redfinMetrics.mape * 100).toFixed(2))
    : null

  // ── 4. Build headline metric ──────────────────────────────────────────────
  const headline = buildHeadline(aireMetrics, zillowMetrics, aireVsZillow, comps.length)
  log.info(`Backtest complete: ${headline}`)

  // ── 5. Save to DB ─────────────────────────────────────────────────────────
  const today = new Date().toISOString().split('T')[0]

  await insertBacktestResult({
    run_date: today,
    model_version: modelVersion,
    geography: params.geography,
    price_band: params.price_band,
    property_type: params.property_type,
    sample_size: comps.length,

    aire_mae: aireMetrics.mae,
    aire_mape: aireMetrics.mape != null ? parseFloat((aireMetrics.mape * 100).toFixed(2)) : null,
    aire_hit_rate_3pct: aireMetrics.hit_rate_3pct,
    aire_hit_rate_5pct: aireMetrics.hit_rate_5pct,
    aire_hit_rate_10pct: aireMetrics.hit_rate_10pct,

    zillow_mae: zillowMetrics.mae,
    zillow_mape: zillowMetrics.mape != null ? parseFloat((zillowMetrics.mape * 100).toFixed(2)) : null,
    zillow_hit_rate_5pct: zillowMetrics.hit_rate_5pct,

    redfin_mae: redfinMetrics.mae,
    redfin_mape: redfinMetrics.mape != null ? parseFloat((redfinMetrics.mape * 100).toFixed(2)) : null,
    redfin_hit_rate_5pct: redfinMetrics.hit_rate_5pct,

    propstream_mae: propstreamMetrics.mae,
    propstream_mape: propstreamMetrics.mape != null ? parseFloat((propstreamMetrics.mape * 100).toFixed(2)) : null,
    propstream_hit_rate_5pct: propstreamMetrics.hit_rate_5pct,

    aire_vs_zillow_accuracy_gain: aireVsZillow,
    aire_vs_redfin_accuracy_gain: aireVsRedfin,
    weights_used: weights,
    notes: headline,
  })

  return {
    sample_size: comps.length,
    aire: aireMetrics,
    zillow: zillowMetrics,
    redfin: redfinMetrics,
    propstream: propstreamMetrics,
    aire_vs_zillow_accuracy_gain: aireVsZillow,
    aire_vs_redfin_accuracy_gain: aireVsRedfin,
    weights_used: weights,
    headline,
  }
}

// ── Metric aggregation ────────────────────────────────────────────────────────

function aggregateMetrics(
  results: PropertyBacktestResult[],
  source: 'aire' | 'zillow' | 'redfin' | 'propstream'
): SourceMetrics {
  const absErrors = results
    .map(r => r[`${source}_abs_error` as keyof PropertyBacktestResult] as number | null)
    .filter((v): v is number => v != null)

  const pctErrors = results
    .map(r => r[`${source}_abs_pct_error` as keyof PropertyBacktestResult] as number | null)
    .filter((v): v is number => v != null)

  if (pctErrors.length === 0) {
    return { mae: null, mape: null, hit_rate_3pct: null, hit_rate_5pct: null, hit_rate_10pct: null, properties_with_data: 0 }
  }

  const mae = Math.round(absErrors.reduce((a, b) => a + b, 0) / absErrors.length)
  const mape = parseFloat((pctErrors.reduce((a, b) => a + b, 0) / pctErrors.length).toFixed(4))

  const hitRate = (threshold: number) =>
    parseFloat(((pctErrors.filter(e => e < threshold).length / pctErrors.length) * 100).toFixed(2))

  return {
    mae,
    mape,
    hit_rate_3pct: hitRate(0.03),
    hit_rate_5pct: hitRate(0.05),
    hit_rate_10pct: hitRate(0.10),
    properties_with_data: pctErrors.length,
  }
}

function buildHeadline(
  aire: SourceMetrics,
  zillow: SourceMetrics,
  gainPct: number | null,
  totalComps: number
): string {
  if (!aire.hit_rate_5pct || !zillow.hit_rate_5pct) {
    return `Backtest run on ${totalComps} comps — insufficient source data for headline metric`
  }

  const gain = gainPct != null ? ` (+${gainPct}% accuracy gain)` : ''
  return `AIRE was within 5% on ${aire.hit_rate_5pct}% of comps vs Zillow ${zillow.hit_rate_5pct}%${gain} — ${totalComps} sold comps analyzed`
}
