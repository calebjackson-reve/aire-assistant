/**
 * GET /api/data/health/tables
 * Returns row counts for all intelligence tables.
 * Public endpoint (no auth) for monitoring.
 */

import { NextResponse } from 'next/server'
import { query } from '@/lib/data/db/client'

const INTELLIGENCE_TABLES = [
  'properties_clean', 'market_snapshots', 'aire_scores',
  'job_runs', 'error_logs', 'raw_imports', 'backtest_results',
]

export async function GET() {
  const tables = []

  for (const name of INTELLIGENCE_TABLES) {
    try {
      const result = await query<{ count: string }>(`SELECT COUNT(*) as count FROM ${name}`)
      tables.push({ name, count: parseInt(result.rows[0]?.count ?? '0', 10), status: 'ok' as const })
    } catch {
      tables.push({ name, count: 0, status: 'error' as const })
    }
  }

  return NextResponse.json({ tables, timestamp: new Date().toISOString() })
}
