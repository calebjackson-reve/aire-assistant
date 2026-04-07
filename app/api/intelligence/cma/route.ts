/**
 * POST /api/intelligence/cma
 *
 * Generates a Comparative Market Analysis using the AIRE ensemble AVM engine.
 * Combines MLS CMA, PropStream AVM, Zillow, and Redfin into a weighted estimate.
 * Also calculates PPS (Pricing Position Score) and source disagreement.
 */

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { calculateEnsemble } from '@/lib/data/engines/ensemble'
import { calculateDisagreement, disagreementReasonCode } from '@/lib/data/engines/disagreement'
import { calculatePPS } from '@/lib/data/engines/pps'
import { normalizeAddress } from '@/lib/data/engines/normalize'
import { AIRE_DATA } from '@/lib/data/market-data'

export async function POST(request: Request) {
  const { requireFeature } = await import("@/lib/auth/subscription-gate")
  const gate = await requireFeature("cma_engine")
  if (gate) return gate

  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const {
    address,
    mls_cma, propstream_avm, zillow_estimate, redfin_estimate,
    list_price, assessor_fmv,
    sold_last_30_days, active_listings_in_zip,
    competing_listings, price_reductions,
  } = body

  // Normalize address if provided
  let normalized = null
  if (address) {
    normalized = normalizeAddress(address)
  }

  // Calculate ensemble estimate
  const inputs = { mls_cma, propstream_avm, zillow_estimate, redfin_estimate, list_price, assessor_fmv }
  const estimate = calculateEnsemble(inputs)

  if (!estimate) {
    return NextResponse.json({
      error: 'Insufficient data for CMA. Provide at least one valuation source.',
      required: 'At least one of: mls_cma, propstream_avm, zillow_estimate, redfin_estimate, list_price',
    }, { status: 400 })
  }

  // Source disagreement / confidence
  const disagreement = calculateDisagreement(inputs)

  // PPS if we have list price and estimate
  let pps = null
  if (list_price && estimate) {
    pps = calculatePPS({
      list_price,
      aire_estimate: estimate.aire_estimate,
      sold_last_30_days: sold_last_30_days ?? 0,
      active_listings_in_zip: active_listings_in_zip ?? 0,
      competing_listings: competing_listings ?? 0,
      price_reductions: price_reductions ?? 0,
    })
  }

  // Find neighborhood context if address normalizes
  let neighborhoodContext = null
  if (normalized?.zip || normalized?.city) {
    const cityLower = (normalized.city || '').toLowerCase()
    neighborhoodContext = AIRE_DATA.markets.find(
      m => m.name.toLowerCase().includes(cityLower) ||
           m.id === cityLower.replace(/\s+/g, '-')
    ) || null
  }

  return NextResponse.json({
    cma: {
      aire_estimate: estimate.aire_estimate,
      weights_used: estimate.weights_used,
      sources_used: estimate.sources_used,
      missing_sources: estimate.missing_sources,
      assessor_gap_pct: estimate.assessor_gap_pct,
    },
    confidence: disagreement ? {
      tier: disagreement.confidence_tier,
      disagreement_pct: disagreement.disagreement_pct,
      source_count: disagreement.source_count,
      flag_for_review: disagreement.flag_for_review,
      reason: disagreementReasonCode(disagreement),
    } : null,
    pricing_position: pps ? {
      score: pps.pps_total,
      factors: pps.reason_codes,
    } : null,
    address: normalized ? {
      property_id: normalized.property_id,
      canonical: normalized.address_canonical,
      parish: normalized.parish,
    } : null,
    neighborhood: neighborhoodContext ? {
      name: neighborhoodContext.name,
      heat_score: neighborhoodContext.heatScore,
      label: neighborhoodContext.label,
      median_price: neighborhoodContext.medianPrice,
      dom: neighborhoodContext.dom,
      recommendation: neighborhoodContext.recommendation,
    } : null,
    metro: {
      median_price: AIRE_DATA.metro.medianPrice,
      dom: AIRE_DATA.metro.dom,
      months_supply: AIRE_DATA.metro.monthsSupply,
    },
  })
}
