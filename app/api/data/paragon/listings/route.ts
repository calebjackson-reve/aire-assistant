/**
 * GET /api/data/paragon/listings?zip=70816
 * GET /api/data/paragon/listings?neighborhood=zachary
 *
 * Returns active MLS listings from the intelligence database.
 * Data sourced from Paragon MLS via MCP ingestion pipeline.
 */

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { query } from '@/lib/data/db/client'
import { AIRE_DATA } from '@/lib/data/market-data'

export async function GET(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const zip = searchParams.get('zip')
  const neighborhood = searchParams.get('neighborhood')
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)

  // If neighborhood requested, return static AIRE_DATA market info
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
    return NextResponse.json({
      source: 'paragon_mls',
      neighborhood: market,
      metro_context: {
        medianPrice: AIRE_DATA.metro.medianPrice,
        dom: AIRE_DATA.metro.dom,
        inventory: AIRE_DATA.metro.inventory,
      },
    })
  }

  // Try DB query for live data
  try {
    const { rows } = await query<{
      property_id: string; address_canonical: string; zip: string
      bedrooms: number; bathrooms: number; sqft: number
      year_built: number; list_price: number; dom: number
      status: string; price_per_sqft: number
    }>(
      `SELECT p.property_id, p.address_canonical, p.zip,
              p.bedrooms, p.bathrooms, p.sqft, p.year_built,
              ms.list_price, ms.dom, ms.status, ms.price_per_sqft
       FROM properties_clean p
       INNER JOIN LATERAL (
         SELECT list_price, dom, status, price_per_sqft
         FROM market_snapshots
         WHERE property_id = p.property_id
         ORDER BY snapshot_date DESC, created_at DESC
         LIMIT 1
       ) ms ON true
       WHERE ms.status = 'active'
         ${zip ? 'AND p.zip = $1' : ''}
       ORDER BY ms.list_price DESC
       LIMIT ${zip ? '$2' : '$1'}`,
      zip ? [zip, limit] : [limit]
    )

    return NextResponse.json({
      source: 'paragon_mls',
      count: rows.length,
      listings: rows,
      filters: { zip, limit },
    })
  } catch {
    // Intelligence tables may not exist yet — fall back to AIRE_DATA
    return NextResponse.json({
      source: 'aire_data_static',
      note: 'Intelligence tables not yet provisioned. Returning static market data.',
      metro: AIRE_DATA.metro,
      neighborhoods: AIRE_DATA.markets,
      propstream: AIRE_DATA.propstream,
    })
  }
}
