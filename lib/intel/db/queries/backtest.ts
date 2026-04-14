/**
 * AIRE — Backtest query functions
 */

import { query } from '../client'

export interface BacktestResult {
  id: string
  run_date: string
  model_version: string | null
  geography: string | null
  price_band: string | null
  property_type: string | null
  sample_size: number | null
  aire_mae: number | null
  aire_mape: number | null
  aire_hit_rate_3pct: number | null
  aire_hit_rate_5pct: number | null
  aire_hit_rate_10pct: number | null
  zillow_mae: number | null
  zillow_mape: number | null
  zillow_hit_rate_5pct: number | null
  redfin_mae: number | null
  redfin_mape: number | null
  redfin_hit_rate_5pct: number | null
  propstream_mae: number | null
  propstream_mape: number | null
  propstream_hit_rate_5pct: number | null
  aire_vs_zillow_accuracy_gain: number | null
  aire_vs_redfin_accuracy_gain: number | null
  weights_used: Record<string, number> | null
  notes: string | null
  created_at: Date
}

export async function insertBacktestResult(r: Omit<BacktestResult, 'id' | 'created_at'>): Promise<BacktestResult> {
  const { rows } = await query<BacktestResult>(
    `INSERT INTO backtest_results (
       run_date, model_version, geography, price_band, property_type, sample_size,
       aire_mae, aire_mape, aire_hit_rate_3pct, aire_hit_rate_5pct, aire_hit_rate_10pct,
       zillow_mae, zillow_mape, zillow_hit_rate_5pct,
       redfin_mae, redfin_mape, redfin_hit_rate_5pct,
       propstream_mae, propstream_mape, propstream_hit_rate_5pct,
       aire_vs_zillow_accuracy_gain, aire_vs_redfin_accuracy_gain,
       weights_used, notes
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
       $15,$16,$17,$18,$19,$20,$21,$22,$23,$24
     ) RETURNING *`,
    [
      r.run_date, r.model_version, r.geography, r.price_band, r.property_type, r.sample_size,
      r.aire_mae, r.aire_mape, r.aire_hit_rate_3pct, r.aire_hit_rate_5pct, r.aire_hit_rate_10pct,
      r.zillow_mae, r.zillow_mape, r.zillow_hit_rate_5pct,
      r.redfin_mae, r.redfin_mape, r.redfin_hit_rate_5pct,
      r.propstream_mae, r.propstream_mape, r.propstream_hit_rate_5pct,
      r.aire_vs_zillow_accuracy_gain, r.aire_vs_redfin_accuracy_gain,
      r.weights_used ? JSON.stringify(r.weights_used) : null, r.notes,
    ]
  )
  return rows[0]
}

export async function getBacktestResults(filters?: {
  geography?: string
  price_band?: string
  property_type?: string
  date_from?: string
  date_to?: string
}): Promise<BacktestResult[]> {
  const conditions: string[] = []
  const params: unknown[] = []
  let i = 1

  if (filters?.geography && filters.geography !== 'all') {
    conditions.push(`geography = $${i++}`)
    params.push(filters.geography)
  }
  if (filters?.price_band && filters.price_band !== 'all') {
    conditions.push(`price_band = $${i++}`)
    params.push(filters.price_band)
  }
  if (filters?.property_type && filters.property_type !== 'all') {
    conditions.push(`property_type = $${i++}`)
    params.push(filters.property_type)
  }
  if (filters?.date_from) {
    conditions.push(`run_date >= $${i++}`)
    params.push(filters.date_from)
  }
  if (filters?.date_to) {
    conditions.push(`run_date <= $${i++}`)
    params.push(filters.date_to)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const { rows } = await query<BacktestResult>(
    `SELECT * FROM backtest_results ${where} ORDER BY run_date DESC`,
    params
  )
  return rows
}

/** Fetch sold comps for backtest calculation */
export async function getSoldCompsForBacktest(opts: {
  geography: string
  priceBand: string
  propertyType: string
  dateFrom: Date
  dateTo: Date
}): Promise<Array<{
  property_id: string
  sold_price: number
  list_price: number
  zillow_estimate: number | null
  redfin_estimate: number | null
  propstream_avm: number | null
  sold_date: string
  parish: string | null
}>> {
  const priceBandFilter = opts.priceBand !== 'all'
    ? opts.priceBand === '150k-250k'
      ? 'AND ms.sold_price BETWEEN 150000 AND 250000'
      : opts.priceBand === '250k-400k'
        ? 'AND ms.sold_price BETWEEN 250000 AND 400000'
        : 'AND ms.sold_price > 400000'
    : ''

  const geoFilter = opts.geography !== 'all'
    ? `AND p.parish = '${opts.geography}'` // safe: value is from enum, not user input
    : ''

  const typeFilter = opts.propertyType !== 'all'
    ? `AND p.property_type = '${opts.propertyType}'`
    : ''

  const { rows } = await query(
    `SELECT
       ms.property_id,
       ms.sold_price,
       ms.list_price,
       ms.zillow_estimate,
       ms.redfin_estimate,
       ms.propstream_avm,
       ms.sold_date,
       p.parish
     FROM market_snapshots ms
     JOIN properties_clean p ON p.property_id = ms.property_id
     WHERE ms.sold_date BETWEEN $1 AND $2
       AND ms.sold_price IS NOT NULL
       AND ms.list_price IS NOT NULL
       ${priceBandFilter}
       ${geoFilter}
       ${typeFilter}
     ORDER BY ms.sold_date DESC`,
    [opts.dateFrom.toISOString().split('T')[0], opts.dateTo.toISOString().split('T')[0]]
  )
  return rows as never
}
