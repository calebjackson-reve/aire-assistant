/**
 * GET /api/market-data
 *
 * Returns market summary data for the public website.
 * Cached via Next.js ISR — revalidates on demand via /api/revalidate.
 *
 * Query params:
 *   parish  — filter by parish (EBR | Ascension | Livingston)
 *   zip     — filter by zip code
 */

import { NextRequest, NextResponse } from 'next/server'
import { buildMarketSummary, buildAccuracyStats } from '@/lib/intel/publisher/builder'

// Revalidate every 4 hours (ISR)
export const revalidate = 14400

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const parish = searchParams.get('parish') ?? 'all'

    const [summaries, accuracyStats] = await Promise.all([
      buildMarketSummary(parish),
      buildAccuracyStats(),
    ])

    return NextResponse.json({
      ok: true,
      as_of: new Date().toISOString(),
      accuracy: accuracyStats,
      market: summaries,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=14400, stale-while-revalidate=3600',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[/api/market-data] Error:', message)
    return NextResponse.json({ ok: false, error: 'Failed to fetch market data' }, { status: 500 })
  }
}
