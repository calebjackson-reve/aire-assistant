/**
 * GET /api/data/market
 * GET /api/data/market?neighborhood=zachary
 *
 * Returns market data. Without params: full metro stats.
 * With neighborhood param: specific neighborhood heat score + metrics.
 */

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { AIRE_DATA } from '@/lib/data/market-data'

export async function GET(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const neighborhood = searchParams.get('neighborhood')

  if (neighborhood) {
    const market = AIRE_DATA.markets.find(
      m => m.id === neighborhood || m.name.toLowerCase() === neighborhood.toLowerCase()
    )
    if (!market) {
      return NextResponse.json(
        { error: 'Neighborhood not found', available: AIRE_DATA.markets.map(m => m.id) },
        { status: 404 }
      )
    }
    return NextResponse.json({ neighborhood: market })
  }

  return NextResponse.json({
    metro: AIRE_DATA.metro,
    statewide: AIRE_DATA.statewide,
    national: AIRE_DATA.national,
    neighborhoods: AIRE_DATA.markets,
    rentals: AIRE_DATA.rentals,
    propstream: AIRE_DATA.propstream,
    foreclosures: AIRE_DATA.foreclosures,
    sources: AIRE_DATA.sources,
  })
}
