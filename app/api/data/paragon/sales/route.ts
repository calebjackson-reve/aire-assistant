/**
 * GET /api/data/paragon/sales?zip=70816&months=6
 *
 * Returns sold comps from the intelligence database.
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
  const months = Math.min(parseInt(searchParams.get('months') || '6'), 24)
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)

  try {
    const { rows } = await query<{
      property_id: string; address_canonical: string; zip: string
      bedrooms: number; bathrooms: number; sqft: number
      year_built: number; sold_price: number; list_price: number
      dom: number; sold_date: string; price_per_sqft: number
    }>(
      `SELECT p.property_id, p.address_canonical, p.zip,
              p.bedrooms, p.bathrooms, p.sqft, p.year_built,
              ms.sold_price, ms.list_price, ms.dom,
              ms.sold_date, ms.price_per_sqft
       FROM properties_clean p
       INNER JOIN LATERAL (
         SELECT sold_price, list_price, dom, sold_date, price_per_sqft
         FROM market_snapshots
         WHERE property_id = p.property_id
           AND sold_price IS NOT NULL
           AND sold_date >= NOW() - INTERVAL '${months} months'
         ORDER BY sold_date DESC
         LIMIT 1
       ) ms ON true
       ${zip ? 'WHERE p.zip = $1' : ''}
       ORDER BY ms.sold_date DESC
       LIMIT ${zip ? '$2' : '$1'}`,
      zip ? [zip, limit] : [limit]
    )

    // Calculate summary stats
    const prices = rows.map(r => r.sold_price).filter(Boolean)
    const summary = prices.length > 0 ? {
      count: prices.length,
      medianPrice: prices.sort((a, b) => a - b)[Math.floor(prices.length / 2)],
      avgPrice: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
      avgDom: Math.round(rows.map(r => r.dom).filter(Boolean).reduce((a, b) => a + b, 0) / rows.filter(r => r.dom).length || 0),
    } : null

    return NextResponse.json({
      source: 'paragon_mls',
      count: rows.length,
      filters: { zip, months, limit },
      summary,
      sales: rows,
    })
  } catch {
    // Fall back to static data
    return NextResponse.json({
      source: 'aire_data_static',
      note: 'Intelligence tables not yet provisioned. Returning static market data.',
      metro: {
        closedSales: AIRE_DATA.metro.closedSales,
        medianPrice: AIRE_DATA.metro.medianPrice,
        avgPrice: AIRE_DATA.metro.avgPrice,
        dom: AIRE_DATA.metro.dom,
        listSaleRatio: AIRE_DATA.metro.listSaleRatio,
      },
    })
  }
}
