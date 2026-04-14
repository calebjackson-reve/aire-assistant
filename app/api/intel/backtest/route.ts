/**
 * GET /api/backtest/public
 *
 * Public (no auth) endpoint that returns the latest backtest accuracy stats.
 * Used by the public accuracy dashboard and the homepage headline metric.
 *
 * Returns the most recent backtest per geography, plus an overall best result.
 */

import { NextResponse } from 'next/server'
import { query } from '@/lib/intel/db/client'

export async function GET() {
  try {
    // Latest result per geography
    const { rows } = await query<{
      id: string
      run_date: string
      geography: string
      price_band: string
      property_type: string
      sample_size: number
      aire_mape: number | null
      aire_hit_rate_3pct: number | null
      aire_hit_rate_5pct: number | null
      aire_hit_rate_10pct: number | null
      zillow_mape: number | null
      zillow_hit_rate_5pct: number | null
      redfin_mape: number | null
      redfin_hit_rate_5pct: number | null
      propstream_mape: number | null
      propstream_hit_rate_5pct: number | null
      aire_vs_zillow_accuracy_gain: number | null
      aire_vs_redfin_accuracy_gain: number | null
      notes: string | null
    }>(
      `SELECT DISTINCT ON (geography)
         id, run_date, geography, price_band, property_type, sample_size,
         aire_mape, aire_hit_rate_3pct, aire_hit_rate_5pct, aire_hit_rate_10pct,
         zillow_mape, zillow_hit_rate_5pct,
         redfin_mape, redfin_hit_rate_5pct,
         propstream_mape, propstream_hit_rate_5pct,
         aire_vs_zillow_accuracy_gain, aire_vs_redfin_accuracy_gain,
         notes
       FROM backtest_results
       WHERE sample_size >= 10
       ORDER BY geography, run_date DESC, created_at DESC`
    )

    // Best overall result (largest sample)
    const bestRes = await query<{
      aire_hit_rate_5pct: number | null
      zillow_hit_rate_5pct: number | null
      aire_vs_zillow_accuracy_gain: number | null
      sample_size: number
      run_date: string
    }>(
      `SELECT aire_hit_rate_5pct, zillow_hit_rate_5pct, aire_vs_zillow_accuracy_gain, sample_size, run_date
       FROM backtest_results
       WHERE sample_size >= 10
       ORDER BY sample_size DESC, run_date DESC
       LIMIT 1`
    )

    const best = bestRes.rows[0] ?? null
    const headline = best?.aire_hit_rate_5pct
      ? `AIRE was within 5% of sold price on ${best.aire_hit_rate_5pct}% of properties vs Zillow ${best.zillow_hit_rate_5pct ?? '?'}% — ${best.sample_size} comps`
      : 'Backtest data not yet available'

    return NextResponse.json({
      ok: true,
      headline,
      best,
      byGeography: rows,
      lastUpdated: best?.run_date ?? null,
    })
  } catch (err) {
    console.error('[/api/backtest/public] Error:', err)
    // Return graceful fallback — don't break the dashboard
    return NextResponse.json({
      ok: true,
      headline: 'AIRE accuracy data loading...',
      best: null,
      byGeography: [],
      lastUpdated: null,
    })
  }
}
