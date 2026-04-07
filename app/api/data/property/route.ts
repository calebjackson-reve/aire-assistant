/**
 * GET /api/data/property?id={property_id}
 * GET /api/data/property?address={raw_address}
 *
 * Look up a property from the intelligence database.
 * Returns property details + latest market snapshot + latest AIRE score.
 */

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { findByPropertyId, getLatestSnapshot } from '@/lib/data/db/queries/properties'
import { getLatestScore } from '@/lib/data/db/queries/scores'
import { normalizeAddress } from '@/lib/data/engines/normalize'

export async function GET(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  let propertyId = searchParams.get('id')

  // If address provided instead of ID, normalize it to get the property_id
  if (!propertyId) {
    const address = searchParams.get('address')
    if (!address) {
      return NextResponse.json({ error: 'Provide either id or address parameter' }, { status: 400 })
    }
    const normalized = normalizeAddress(address)
    if (!normalized) {
      return NextResponse.json({ error: 'Could not parse address' }, { status: 400 })
    }
    propertyId = normalized.property_id
  }

  const property = await findByPropertyId(propertyId)
  if (!property) {
    return NextResponse.json({ error: 'Property not found', property_id: propertyId }, { status: 404 })
  }

  const [snapshot, score] = await Promise.all([
    getLatestSnapshot(propertyId),
    getLatestScore(propertyId),
  ])

  return NextResponse.json({
    property,
    latest_snapshot: snapshot,
    latest_score: score ? {
      aire_estimate: score.aire_estimate,
      confidence_tier: score.confidence_tier,
      pps_total: score.pps_total,
      bps_total: score.bps_total,
      score_date: score.score_date,
    } : null,
  })
}
