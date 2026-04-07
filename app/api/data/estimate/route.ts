/**
 * POST /api/data/estimate
 *
 * Calculate AIRE Estimate for a property using the ensemble AVM engine.
 * Accepts raw source values and returns the weighted estimate with confidence.
 */

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { calculateEnsemble } from '@/lib/data/engines/ensemble'
import { calculateDisagreement, disagreementReasonCode } from '@/lib/data/engines/disagreement'

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { mls_cma, propstream_avm, zillow_estimate, redfin_estimate, list_price, assessor_fmv } = body

  const inputs = { mls_cma, propstream_avm, zillow_estimate, redfin_estimate, list_price, assessor_fmv }

  const estimate = calculateEnsemble(inputs)
  if (!estimate) {
    return NextResponse.json({ error: 'No source data available to calculate estimate' }, { status: 400 })
  }

  const disagreement = calculateDisagreement(inputs)

  return NextResponse.json({
    aire_estimate: estimate.aire_estimate,
    weights_used: estimate.weights_used,
    sources_used: estimate.sources_used,
    missing_sources: estimate.missing_sources,
    assessor_gap_pct: estimate.assessor_gap_pct,
    confidence: disagreement ? {
      tier: disagreement.confidence_tier,
      disagreement_pct: disagreement.disagreement_pct,
      flag_for_review: disagreement.flag_for_review,
      reason: disagreementReasonCode(disagreement),
    } : null,
  })
}
