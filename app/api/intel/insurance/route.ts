/**
 * GET /api/insurance?address=...&value=...&yearBuilt=...&sqft=...
 *
 * Returns insurance cost estimates (homeowners + flood + wind) for a property.
 * Sources: FEMA FIRM, NFIP Risk Rating 2.0, HUD FHA, LA DOI rate filings.
 */

import { NextRequest, NextResponse } from 'next/server'
import { calculateInsurance } from '@/lib/intel/insurance/optimizer'

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const address = params.get('address')
  const value = params.get('value')
  const yearBuilt = params.get('yearBuilt')
  const sqft = params.get('sqft')

  if (!address) {
    return NextResponse.json({ error: 'address is required' }, { status: 400 })
  }

  const propertyValue = value ? parseInt(value, 10) : 250_000
  const year = yearBuilt ? parseInt(yearBuilt, 10) : 2000
  const sf = sqft ? parseInt(sqft, 10) : 1800

  // Extract ZIP from address
  const zipMatch = address.match(/\b7\d{4}\b/)
  const zip = zipMatch ? zipMatch[0] : params.get('zip') ?? '70808'

  const result = calculateInsurance({
    address,
    zip,
    parish: params.get('parish') ?? undefined,
    propertyValue,
    yearBuilt: year,
    sqft: sf,
    stories: params.get('stories') ? parseInt(params.get('stories')!, 10) : undefined,
    constructionType: (params.get('construction') as 'frame' | 'masonry' | 'concrete') ?? undefined,
    roofAge: params.get('roofAge') ? parseInt(params.get('roofAge')!, 10) : undefined,
    hasPool: params.get('pool') === 'true',
    floodZone: params.get('floodZone') ?? undefined,
    elevation: params.get('elevation') ? parseFloat(params.get('elevation')!) : undefined,
    deductible: params.get('deductible') ? parseInt(params.get('deductible')!, 10) : undefined,
  })

  return NextResponse.json(result)
}
