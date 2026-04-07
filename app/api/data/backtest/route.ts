/**
 * GET /api/data/backtest — Get latest backtest results
 * POST /api/data/backtest — Run a new backtest
 */

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { runBacktest } from '@/lib/data/engines/backtest'
import { query } from '@/lib/data/db/client'

export async function GET(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { rows } = await query(
      `SELECT * FROM backtest_results ORDER BY run_date DESC, created_at DESC LIMIT 10`
    )
    return NextResponse.json({ results: rows })
  } catch {
    return NextResponse.json({ results: [], note: 'No backtest results yet' })
  }
}

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))

  const result = await runBacktest({
    geography: body.geography,
    price_band: body.price_band,
    months: body.months,
  })

  return NextResponse.json(result)
}
