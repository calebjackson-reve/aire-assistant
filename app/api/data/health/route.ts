/**
 * GET /api/data/health
 *
 * Health check for the AIRE data layer.
 * Verifies database connectivity and returns data freshness stats.
 */

import { NextResponse } from 'next/server'
import { checkConnection } from '@/lib/data/db/client'
import { countActiveListings, countSoldComps } from '@/lib/data/db/queries/properties'
import { getCacheStats } from '@/lib/data/sync/propstream-cache'

export async function GET() {
  const dbHealth = await checkConnection()

  let stats = null
  if (dbHealth.ok) {
    try {
      const [activeListings, soldComps] = await Promise.all([
        countActiveListings(),
        countSoldComps(),
      ])
      stats = { activeListings, soldComps }
    } catch {
      stats = { error: 'Could not query stats' }
    }
  }

  return NextResponse.json({
    status: dbHealth.ok ? 'healthy' : 'degraded',
    database: dbHealth,
    stats,
    cache: getCacheStats(),
    timestamp: new Date().toISOString(),
  }, { status: dbHealth.ok ? 200 : 503 })
}
