/**
 * GET /api/data/scores?property_id={id}
 * POST /api/data/scores — Calculate and store PPS for a property
 *
 * Retrieves or calculates AIRE scores for a property.
 */

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getLatestScore } from '@/lib/data/db/queries/scores'
import { getLatestSnapshot } from '@/lib/data/db/queries/properties'
import { calculatePPS } from '@/lib/data/engines/pps'
import { calculateEnsemble } from '@/lib/data/engines/ensemble'
import { calculateDisagreement } from '@/lib/data/engines/disagreement'

export async function GET(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const propertyId = searchParams.get('property_id')
  if (!propertyId) {
    return NextResponse.json({ error: 'property_id required' }, { status: 400 })
  }

  const score = await getLatestScore(propertyId)
  if (!score) {
    return NextResponse.json({ error: 'No scores found', property_id: propertyId }, { status: 404 })
  }

  return NextResponse.json({ score })
}

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { property_id } = body

  if (!property_id) {
    return NextResponse.json({ error: 'property_id required' }, { status: 400 })
  }

  // Get latest snapshot to feed scoring engines
  const snapshot = await getLatestSnapshot(property_id)
  if (!snapshot) {
    return NextResponse.json({ error: 'No market data found for property' }, { status: 404 })
  }

  // Calculate ensemble estimate
  const inputs = {
    mls_cma: snapshot.list_price,
    propstream_avm: snapshot.propstream_avm,
    zillow_estimate: snapshot.zillow_estimate,
    redfin_estimate: snapshot.redfin_estimate,
    list_price: snapshot.list_price,
    assessor_fmv: snapshot.assessor_fmv,
  }

  const estimate = calculateEnsemble(inputs)
  const disagreement = calculateDisagreement(inputs)

  // Calculate PPS if we have enough data
  let pps = null
  if (estimate && snapshot.list_price) {
    pps = calculatePPS({
      list_price: snapshot.list_price,
      aire_estimate: estimate.aire_estimate,
      sold_last_30_days: body.sold_last_30_days ?? 0,
      active_listings_in_zip: body.active_listings_in_zip ?? 0,
      compete_score: snapshot.compete_score,
      competing_listings: body.competing_listings ?? 0,
      price_reductions: snapshot.price_reductions ?? 0,
      neighborhood_price_trend_90d_pct: body.neighborhood_price_trend_90d_pct,
    })
  }

  return NextResponse.json({
    property_id,
    estimate: estimate ? {
      aire_estimate: estimate.aire_estimate,
      sources_used: estimate.sources_used,
      assessor_gap_pct: estimate.assessor_gap_pct,
    } : null,
    confidence: disagreement ? {
      tier: disagreement.confidence_tier,
      disagreement_pct: disagreement.disagreement_pct,
    } : null,
    pps,
  })
}
