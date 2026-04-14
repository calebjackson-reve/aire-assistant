/**
 * GET /api/estimate?address=123 Main St, Baton Rouge, LA 70808
 *
 * Public API for aire-assistant (and any AIRE product) to get a property estimate.
 *
 * Returns:
 *  - AIRE ensemble estimate (if property exists in DB)
 *  - Flood zone + insurance cost summary
 *  - Neighborhood score summary
 *  - Confidence tier
 *
 * If property is NOT in the DB, returns flood + neighborhood data only
 * with aire_estimate: null.
 */

import { NextRequest, NextResponse } from 'next/server'
import { normalizeAddress } from '@/lib/intel/engine/normalize'
import { calculateInsurance } from '@/lib/intel/insurance/optimizer'

// Inline flood zone lookup (same as /api/flood)
const FLOOD_ZONES: Record<string, { zone: string; risk: number; premMin: number; premMax: number }> = {
  '70801': { zone: 'AE', risk: 74, premMin: 2800, premMax: 6200 },
  '70802': { zone: 'AE', risk: 71, premMin: 2600, premMax: 5800 },
  '70803': { zone: 'X', risk: 28, premMin: 450, premMax: 980 },
  '70805': { zone: 'AE', risk: 82, premMin: 3200, premMax: 7100 },
  '70806': { zone: 'AE', risk: 76, premMin: 2900, premMax: 6400 },
  '70807': { zone: 'AE', risk: 79, premMin: 3100, premMax: 6800 },
  '70808': { zone: 'X/AE', risk: 52, premMin: 1200, premMax: 3200 },
  '70809': { zone: 'X', risk: 31, premMin: 480, premMax: 1100 },
  '70810': { zone: 'X', risk: 24, premMin: 420, premMax: 950 },
  '70811': { zone: 'AE', risk: 78, premMin: 3000, premMax: 6600 },
  '70812': { zone: 'AE', risk: 75, premMin: 2800, premMax: 6100 },
  '70814': { zone: 'AE', risk: 69, premMin: 2400, premMax: 5400 },
  '70816': { zone: 'X/AE', risk: 44, premMin: 900, premMax: 2400 },
  '70817': { zone: 'X', risk: 26, premMin: 440, premMax: 980 },
  '70818': { zone: 'X', risk: 22, premMin: 400, premMax: 890 },
  '70819': { zone: 'X', risk: 29, premMin: 460, premMax: 1020 },
  '70820': { zone: 'AE', risk: 65, premMin: 2200, premMax: 4800 },
  '70737': { zone: 'X/AE', risk: 48, premMin: 1000, premMax: 2700 },
  '70769': { zone: 'X', risk: 33, premMin: 520, premMax: 1180 },
  '70791': { zone: 'X', risk: 19, premMin: 380, premMax: 840 },
  '70775': { zone: 'X', risk: 27, premMin: 440, premMax: 980 },
}

// Neighborhood summary data (same ZIPs as /api/neighborhood)
const NEIGHBORHOOD_SUMMARY: Record<string, { name: string; schoolRating: string; crimeIndex: number; medianHomeValue: number; yoyAppreciation: number; floodRisk: string }> = {
  '70791': { name: 'Zachary', schoolRating: 'A', crimeIndex: 18, medianHomeValue: 248000, yoyAppreciation: 8.2, floodRisk: 'Low' },
  '70775': { name: 'St. Francisville', schoolRating: 'B+', crimeIndex: 12, medianHomeValue: 196000, yoyAppreciation: 5.1, floodRisk: 'Low' },
  '70769': { name: 'Prairieville', schoolRating: 'A-', crimeIndex: 14, medianHomeValue: 289000, yoyAppreciation: 9.4, floodRisk: 'Low-Moderate' },
  '70808': { name: 'South Baton Rouge', schoolRating: 'B', crimeIndex: 44, medianHomeValue: 274000, yoyAppreciation: 6.8, floodRisk: 'Moderate' },
  '70737': { name: 'Denham Springs', schoolRating: 'B-', crimeIndex: 26, medianHomeValue: 221000, yoyAppreciation: 7.6, floodRisk: 'Moderate' },
  '70806': { name: 'Midtown Baton Rouge', schoolRating: 'C+', crimeIndex: 52, medianHomeValue: 187000, yoyAppreciation: 10.2, floodRisk: 'Moderate-High' },
  '70816': { name: 'Southeast BR', schoolRating: 'B', crimeIndex: 32, medianHomeValue: 265000, yoyAppreciation: 7.1, floodRisk: 'Low-Moderate' },
  '70809': { name: 'Bluebonnet/Corporate', schoolRating: 'B+', crimeIndex: 28, medianHomeValue: 295000, yoyAppreciation: 6.5, floodRisk: 'Low' },
  '70810': { name: 'Jefferson Hwy', schoolRating: 'B', crimeIndex: 30, medianHomeValue: 278000, yoyAppreciation: 5.8, floodRisk: 'Low' },
  '70817': { name: 'Shenandoah/Tiger Bend', schoolRating: 'A-', crimeIndex: 16, medianHomeValue: 342000, yoyAppreciation: 7.8, floodRisk: 'Low' },
  '70818': { name: 'Central', schoolRating: 'A', crimeIndex: 14, medianHomeValue: 310000, yoyAppreciation: 8.5, floodRisk: 'Low' },
}

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address')
  if (!address) {
    return NextResponse.json({ error: 'address query parameter is required' }, { status: 400 })
  }

  const normalized = normalizeAddress(address)
  const zip = normalized?.zip || address.match(/\b7\d{4}\b/)?.[0] || '70808'
  const propertyId = normalized?.property_id ?? null

  // Try DB lookup for AIRE estimate
  let aireEstimate: number | null = null
  let confidenceTier: string | null = null
  let ppsTotalScore: number | null = null
  let bpsTotalScore: number | null = null
  let dbProperty: Record<string, unknown> | null = null

  try {
    const { query } = await import('@/lib/intel/db/client')

    if (propertyId) {
      const scoreRes = await query<{
        aire_estimate: number | null
        confidence_tier: string | null
        pps_total: number | null
        bps_total: number | null
      }>(
        `SELECT aire_estimate, confidence_tier, pps_total, bps_total
         FROM aire_scores WHERE property_id = $1
         ORDER BY score_date DESC, created_at DESC LIMIT 1`,
        [propertyId]
      )
      if (scoreRes.rows[0]) {
        aireEstimate = scoreRes.rows[0].aire_estimate
        confidenceTier = scoreRes.rows[0].confidence_tier
        ppsTotalScore = scoreRes.rows[0].pps_total
        bpsTotalScore = scoreRes.rows[0].bps_total
      }

      const propRes = await query<{
        address_canonical: string; city: string; zip: string; parish: string
        bedrooms: number | null; bathrooms: number | null; sqft: number | null; year_built: number | null
      }>(
        `SELECT address_canonical, city, zip, parish, bedrooms, bathrooms, sqft, year_built
         FROM properties_clean WHERE property_id = $1`,
        [propertyId]
      )
      if (propRes.rows[0]) {
        dbProperty = propRes.rows[0] as Record<string, unknown>
      }
    }
  } catch {
    // DB unavailable — continue with flood/neighborhood data only
  }

  // Flood data
  const flood = FLOOD_ZONES[zip] ?? { zone: 'X', risk: 32, premMin: 480, premMax: 1100 }
  const floodRiskLabel = flood.risk >= 70 ? 'High Risk' : flood.risk >= 45 ? 'Moderate Risk' : 'Lower Risk'

  // Neighborhood data
  const neighborhood = NEIGHBORHOOD_SUMMARY[zip] ?? null

  // Insurance summary
  const propertyValue = aireEstimate ?? neighborhood?.medianHomeValue ?? 250_000
  const yearBuilt = (dbProperty?.year_built as number) ?? 2000
  const sqft = (dbProperty?.sqft as number) ?? 1800
  const insurance = calculateInsurance({
    address,
    zip,
    propertyValue,
    yearBuilt,
    sqft,
    floodZone: flood.zone,
  })

  return NextResponse.json({
    ok: true,
    address: normalized?.address_canonical ?? address,
    property_id: propertyId,
    zip,
    parish: normalized?.parish ?? insurance.parish,

    // AIRE Estimate (null if not in DB)
    aire_estimate: aireEstimate,
    confidence_tier: confidenceTier,
    pps_score: ppsTotalScore,
    bps_score: bpsTotalScore,
    property: dbProperty,

    // Flood
    flood: {
      zone: flood.zone,
      riskScore: flood.risk,
      riskLabel: floodRiskLabel,
      annualPremiumRange: `$${flood.premMin.toLocaleString()} – $${flood.premMax.toLocaleString()}`,
    },

    // Neighborhood
    neighborhood,

    // Insurance
    insurance: {
      totalAnnualMin: insurance.totalAnnualMin,
      totalAnnualMax: insurance.totalAnnualMax,
      totalMonthlyMin: insurance.totalMonthlyMin,
      totalMonthlyMax: insurance.totalMonthlyMax,
      costAsPercentOfValue: insurance.costAsPercentOfValue,
      coverages: insurance.coverages.map(c => ({
        type: c.type,
        annualRange: `$${c.annualPremiumMin.toLocaleString()} – $${c.annualPremiumMax.toLocaleString()}`,
      })),
    },

    recommendation: insurance.recommendation,
    sources: ['AIRE Ensemble AVM', 'FEMA FIRM', 'NFIP Risk Rating 2.0', 'Census ACS', 'LA DOI', 'HUD FHA'],
    lastUpdated: new Date().toISOString().split('T')[0],
  })
}
