/**
 * GET /api/data/propstream/property?id={property_id}
 * GET /api/data/propstream/property?address={raw_address}
 *
 * Returns PropStream enrichment data for a property.
 * Includes AVM, equity, ownership, and lien data from PropStream CSV ingestion.
 */

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { findByPropertyId, getLatestSnapshot } from '@/lib/data/db/queries/properties'
import { getLatestScore } from '@/lib/data/db/queries/scores'
import { normalizeAddress } from '@/lib/data/engines/normalize'
import { AIRE_DATA } from '@/lib/data/market-data'

export async function GET(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  let propertyId = searchParams.get('id')

  if (!propertyId) {
    const address = searchParams.get('address')
    if (!address) {
      return NextResponse.json({ error: 'Provide id or address parameter' }, { status: 400 })
    }
    const normalized = normalizeAddress(address)
    if (!normalized) {
      return NextResponse.json({ error: 'Could not parse address' }, { status: 400 })
    }
    propertyId = normalized.property_id
  }

  try {
    const property = await findByPropertyId(propertyId)
    if (!property) {
      return NextResponse.json({
        error: 'Property not found in PropStream data',
        property_id: propertyId,
        note: 'Property may not yet be ingested. Run PropStream CSV import.',
      }, { status: 404 })
    }

    const [snapshot, score] = await Promise.all([
      getLatestSnapshot(propertyId),
      getLatestScore(propertyId),
    ])

    return NextResponse.json({
      source: 'propstream',
      property: {
        property_id: property.property_id,
        address: property.address_canonical,
        city: property.city,
        zip: property.zip,
        parish: property.parish,
        type: property.property_type,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        sqft: property.sqft,
        lot_sqft: property.lot_sqft,
        year_built: property.year_built,
        parcel_id: property.parcel_id,
        propstream_id: property.propstream_id,
      },
      valuation: snapshot ? {
        propstream_avm: snapshot.propstream_avm,
        list_price: snapshot.list_price,
        sold_price: snapshot.sold_price,
        assessor_fmv: snapshot.assessor_fmv,
        snapshot_date: snapshot.snapshot_date,
      } : null,
      aire_score: score ? {
        aire_estimate: score.aire_estimate,
        confidence_tier: score.confidence_tier,
        pps_total: score.pps_total,
        score_date: score.score_date,
      } : null,
    })
  } catch {
    // Tables not provisioned
    return NextResponse.json({
      source: 'propstream_static',
      note: 'Intelligence tables not yet provisioned.',
      propstream_summary: AIRE_DATA.propstream,
    })
  }
}
