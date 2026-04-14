/**
 * AIRE Intelligence — Website Publisher: Data Builder (Phase 7)
 *
 * Pulls latest AIRE data from the DB and builds the JSON payloads
 * that power the public-facing website pages.
 *
 * Output: structured objects ready to be written to Next.js revalidation endpoints
 * or static JSON files served from /public/data/.
 */

import { query } from '../db/client'
import { log } from '../utils/logger'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MarketSummary {
  geography: string
  as_of_date: string
  active_listings: number
  median_list_price: number | null
  median_aire_estimate: number | null
  median_days_on_market: number | null
  avg_disagreement_pct: number | null
  pct_overpriced: number | null      // % listings where list > AIRE estimate by >5%
  pct_underpriced: number | null     // % listings where list < AIRE estimate by >5%
  price_trend_90d_pct: number | null
  top_zip_codes: Array<{ zip: string; count: number; median_price: number | null }>
}

export interface AccuracyStats {
  headline: string
  aire_hit_rate_5pct: number | null
  zillow_hit_rate_5pct: number | null
  accuracy_gain_pct: number | null
  sample_size: number | null
  as_of_date: string
}

export interface ActiveListingPublic {
  property_id: string
  address: string
  city: string
  zip: string
  parish: string
  beds: number | null
  baths: number | null
  sqft: number | null
  list_price: number | null
  aire_estimate: number | null
  disagreement_tier: string | null
  pps_total: number | null
  days_on_market: number | null
  status: string
  snapshot_date: string
}

// ── Market summary builder ────────────────────────────────────────────────────

export async function buildMarketSummary(geography: string = 'all'): Promise<MarketSummary[]> {
  log.info(`Building market summary for: ${geography}`)

  const geoFilter = geography !== 'all' ? `WHERE p.parish = '${geography}'` : ''

  const result = await query<{
    parish: string
    active_count: string
    median_list: string | null
    median_aire: string | null
    median_dom: string | null
    avg_disagreement: string | null
    overpriced_pct: string | null
    underpriced_pct: string | null
  }>(
    `SELECT
       p.parish,
       COUNT(*) as active_count,
       PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ms.list_price) as median_list,
       PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s.aire_estimate) as median_aire,
       PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ms.days_on_market) as median_dom,
       AVG(s.disagreement_pct) as avg_disagreement,
       ROUND(
         100.0 * SUM(CASE WHEN ms.list_price > s.aire_estimate * 1.05 THEN 1 ELSE 0 END)
         / NULLIF(COUNT(*), 0), 1
       ) as overpriced_pct,
       ROUND(
         100.0 * SUM(CASE WHEN ms.list_price < s.aire_estimate * 0.95 THEN 1 ELSE 0 END)
         / NULLIF(COUNT(*), 0), 1
       ) as underpriced_pct
     FROM properties_clean p
     JOIN LATERAL (
       SELECT list_price, days_on_market, snapshot_date
       FROM market_snapshots WHERE property_id = p.property_id
       ORDER BY snapshot_date DESC LIMIT 1
     ) ms ON true
     LEFT JOIN LATERAL (
       SELECT aire_estimate, disagreement_pct
       FROM aire_scores WHERE property_id = p.property_id
       ORDER BY scored_at DESC LIMIT 1
     ) s ON true
     WHERE p.status = 'active' ${geography !== 'all' ? `AND p.parish = '${geography}'` : ''}
     GROUP BY p.parish
     ORDER BY active_count DESC`,
    []
  )

  const summaries: MarketSummary[] = []

  for (const row of result.rows) {
    // Top zip codes in this parish
    const zipResult = await query<{ zip: string; count: string; median_price: string | null }>(
      `SELECT p.zip,
         COUNT(*) as count,
         PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ms.list_price) as median_price
       FROM properties_clean p
       JOIN LATERAL (
         SELECT list_price FROM market_snapshots WHERE property_id = p.property_id
         ORDER BY snapshot_date DESC LIMIT 1
       ) ms ON true
       WHERE p.status = 'active' AND p.parish = $1
       GROUP BY p.zip
       ORDER BY count DESC
       LIMIT 5`,
      [row.parish]
    )

    summaries.push({
      geography: row.parish,
      as_of_date: new Date().toISOString().split('T')[0],
      active_listings: parseInt(row.active_count, 10),
      median_list_price: row.median_list ? Math.round(parseFloat(row.median_list)) : null,
      median_aire_estimate: row.median_aire ? Math.round(parseFloat(row.median_aire)) : null,
      median_days_on_market: row.median_dom ? Math.round(parseFloat(row.median_dom)) : null,
      avg_disagreement_pct: row.avg_disagreement ? parseFloat(parseFloat(row.avg_disagreement).toFixed(2)) : null,
      pct_overpriced: row.overpriced_pct ? parseFloat(row.overpriced_pct) : null,
      pct_underpriced: row.underpriced_pct ? parseFloat(row.underpriced_pct) : null,
      price_trend_90d_pct: null,  // computed separately from price history
      top_zip_codes: zipResult.rows.map(z => ({
        zip: z.zip,
        count: parseInt(z.count, 10),
        median_price: z.median_price ? Math.round(parseFloat(z.median_price)) : null,
      })),
    })
  }

  return summaries
}

// ── Accuracy stats builder ────────────────────────────────────────────────────
// Pulls the most recent backtest result for the homepage headline

export async function buildAccuracyStats(): Promise<AccuracyStats | null> {
  log.info('Building accuracy stats')

  const result = await query<{
    notes: string
    aire_hit_rate_5pct: number | null
    zillow_hit_rate_5pct: number | null
    aire_vs_zillow_accuracy_gain: number | null
    sample_size: number
    run_date: string
  }>(
    `SELECT notes, aire_hit_rate_5pct, zillow_hit_rate_5pct,
            aire_vs_zillow_accuracy_gain, sample_size, run_date
     FROM backtest_results
     WHERE geography = 'all' OR geography = 'EBR'
     ORDER BY run_date DESC
     LIMIT 1`,
    []
  )

  if (!result.rows[0]) return null

  const row = result.rows[0]
  return {
    headline: row.notes ?? '',
    aire_hit_rate_5pct: row.aire_hit_rate_5pct,
    zillow_hit_rate_5pct: row.zillow_hit_rate_5pct,
    accuracy_gain_pct: row.aire_vs_zillow_accuracy_gain,
    sample_size: row.sample_size,
    as_of_date: row.run_date,
  }
}

// ── Active listings builder ───────────────────────────────────────────────────
// Returns paginated, sanitized active listing data for the public website

export async function buildActiveListings(options: {
  parish?: string
  zip?: string
  minPrice?: number
  maxPrice?: number
  limit?: number
  offset?: number
} = {}): Promise<{ listings: ActiveListingPublic[]; total: number }> {
  const { parish, zip, minPrice, maxPrice, limit = 50, offset = 0 } = options

  const conditions: string[] = ["p.status = 'active'"]
  const params: unknown[] = []
  let paramIdx = 1

  if (parish) { conditions.push(`p.parish = $${paramIdx++}`); params.push(parish) }
  if (zip) { conditions.push(`p.zip = $${paramIdx++}`); params.push(zip) }
  if (minPrice) { conditions.push(`ms.list_price >= $${paramIdx++}`); params.push(minPrice) }
  if (maxPrice) { conditions.push(`ms.list_price <= $${paramIdx++}`); params.push(maxPrice) }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count
     FROM properties_clean p
     JOIN LATERAL (
       SELECT list_price FROM market_snapshots WHERE property_id = p.property_id
       ORDER BY snapshot_date DESC LIMIT 1
     ) ms ON true
     ${where}`,
    params
  )
  const total = parseInt(countResult.rows[0].count, 10)

  const listingsResult = await query<{
    property_id: string; address_canonical: string; city: string; zip: string; parish: string
    beds: number | null; baths: number | null; sqft: number | null
    list_price: number | null; aire_estimate: number | null
    disagreement_tier: string | null; pps_total: number | null
    days_on_market: number | null; status: string; snapshot_date: string
  }>(
    `SELECT
       p.property_id, p.address_canonical, p.city, p.zip, p.parish,
       p.beds, p.baths, p.sqft,
       ms.list_price, ms.days_on_market, ms.snapshot_date, p.status,
       s.aire_estimate, s.disagreement_tier, s.pps_total
     FROM properties_clean p
     JOIN LATERAL (
       SELECT list_price, days_on_market, snapshot_date
       FROM market_snapshots WHERE property_id = p.property_id
       ORDER BY snapshot_date DESC LIMIT 1
     ) ms ON true
     LEFT JOIN LATERAL (
       SELECT aire_estimate, disagreement_tier, pps_total
       FROM aire_scores WHERE property_id = p.property_id
       ORDER BY scored_at DESC LIMIT 1
     ) s ON true
     ${where}
     ORDER BY ms.snapshot_date DESC
     LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
    [...params, limit, offset]
  )

  const listings: ActiveListingPublic[] = listingsResult.rows.map(row => ({
    property_id: row.property_id,
    address: row.address_canonical,
    city: row.city,
    zip: row.zip,
    parish: row.parish,
    beds: row.beds,
    baths: row.baths,
    sqft: row.sqft,
    list_price: row.list_price,
    aire_estimate: row.aire_estimate,
    disagreement_tier: row.disagreement_tier,
    pps_total: row.pps_total,
    days_on_market: row.days_on_market,
    status: row.status,
    snapshot_date: row.snapshot_date,
  }))

  return { listings, total }
}

// ── Revalidation trigger ──────────────────────────────────────────────────────
// Pings the Next.js revalidation endpoint after data is updated

export async function triggerRevalidation(paths: string[]): Promise<boolean> {
  const secret = process.env.REVALIDATE_SECRET
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  if (!secret) {
    log.warn('REVALIDATE_SECRET not set — skipping revalidation')
    return false
  }

  try {
    const results = await Promise.all(
      paths.map(path =>
        fetch(`${baseUrl}/api/revalidate?path=${encodeURIComponent(path)}&secret=${secret}`, {
          method: 'POST',
        })
      )
    )

    const allOk = results.every(r => r.ok)
    log.info(`Revalidated ${paths.length} paths: ${allOk ? 'ok' : 'some failed'}`)
    return allOk
  } catch (err) {
    log.warn(`Revalidation failed: ${err}`)
    return false
  }
}
