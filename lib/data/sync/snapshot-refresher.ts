/**
 * AIRE Market Snapshot Refresher
 *
 * Checks for stale market snapshots and flags properties needing a data refresh.
 * Called by the data-sync cron to maintain data freshness.
 */

import { query } from '../db/client'

export interface RefreshResult {
  total_properties: number
  fresh: number       // snapshot within 7 days
  stale: number       // snapshot 7-30 days old
  very_stale: number  // snapshot >30 days old
  no_snapshot: number // property with no snapshot at all
  duration_ms: number
}

/**
 * Audit data freshness across all properties.
 * Returns counts by staleness category.
 */
export async function auditDataFreshness(): Promise<RefreshResult> {
  const start = Date.now()

  try {
    const { rows } = await query<{
      freshness: string
      count: string
    }>(
      `SELECT
         CASE
           WHEN latest_snapshot IS NULL THEN 'no_snapshot'
           WHEN latest_snapshot >= NOW() - INTERVAL '7 days' THEN 'fresh'
           WHEN latest_snapshot >= NOW() - INTERVAL '30 days' THEN 'stale'
           ELSE 'very_stale'
         END AS freshness,
         COUNT(*) as count
       FROM (
         SELECT p.property_id,
                MAX(ms.snapshot_date) as latest_snapshot
         FROM properties_clean p
         LEFT JOIN market_snapshots ms ON ms.property_id = p.property_id
         GROUP BY p.property_id
       ) sub
       GROUP BY freshness`
    )

    const counts: Record<string, number> = {}
    let total = 0
    for (const row of rows) {
      counts[row.freshness] = parseInt(row.count, 10)
      total += counts[row.freshness]
    }

    return {
      total_properties: total,
      fresh: counts.fresh ?? 0,
      stale: counts.stale ?? 0,
      very_stale: counts.very_stale ?? 0,
      no_snapshot: counts.no_snapshot ?? 0,
      duration_ms: Date.now() - start,
    }
  } catch (err) {
    console.error('[SnapshotRefresher] Error:', err)
    return {
      total_properties: 0, fresh: 0, stale: 0,
      very_stale: 0, no_snapshot: 0,
      duration_ms: Date.now() - start,
    }
  }
}

/**
 * Get property IDs that need a data refresh (stale or very stale).
 * Used to prioritize which properties to re-fetch from MLS/PropStream.
 */
export async function getStalePropertyIds(limit = 100): Promise<string[]> {
  try {
    const { rows } = await query<{ property_id: string }>(
      `SELECT p.property_id
       FROM properties_clean p
       LEFT JOIN LATERAL (
         SELECT snapshot_date FROM market_snapshots
         WHERE property_id = p.property_id
         ORDER BY snapshot_date DESC LIMIT 1
       ) ms ON true
       WHERE ms.snapshot_date IS NULL
          OR ms.snapshot_date < NOW() - INTERVAL '7 days'
       LIMIT $1`,
      [limit]
    )
    return rows.map(r => r.property_id)
  } catch {
    return []
  }
}
