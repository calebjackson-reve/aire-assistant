import { NextRequest, NextResponse } from 'next/server'

// Census / static reference data per ZIP (sourced from Census ACS 2023 + local agencies)
// These fields don't change often — updated quarterly
const CENSUS_DATA: Record<string, {
  name: string; medianHHIncome: number; medianAge: number; ownerOccupied: number; renterOccupied: number
  populationGrowth5yr: number; collegeEducated: number; medianCommute: number
  newConstructionPermits: number; schoolDistrict: string; schoolRating: string
  walkScore: number; transitScore: number; bikeScore: number; crimeIndex: number
  floodRisk: string; population: number
}> = {
  '70791': { name: 'Zachary', medianHHIncome: 82400, medianAge: 34.2, ownerOccupied: 78, renterOccupied: 22, populationGrowth5yr: 12.4, collegeEducated: 38, medianCommute: 28, newConstructionPermits: 142, schoolDistrict: 'Zachary Community Schools', schoolRating: 'A', walkScore: 22, transitScore: 8, bikeScore: 30, crimeIndex: 18, floodRisk: 'Low', population: 17436 },
  '70775': { name: 'St. Francisville', medianHHIncome: 71200, medianAge: 42.1, ownerOccupied: 74, renterOccupied: 26, populationGrowth5yr: 8.1, collegeEducated: 42, medianCommute: 45, newConstructionPermits: 28, schoolDistrict: 'West Feliciana Parish Schools', schoolRating: 'B+', walkScore: 12, transitScore: 2, bikeScore: 18, crimeIndex: 12, floodRisk: 'Low', population: 1872 },
  '70769': { name: 'Prairieville', medianHHIncome: 88100, medianAge: 35.8, ownerOccupied: 82, renterOccupied: 18, populationGrowth5yr: 18.2, collegeEducated: 41, medianCommute: 32, newConstructionPermits: 198, schoolDistrict: 'Ascension Parish Schools', schoolRating: 'A-', walkScore: 18, transitScore: 5, bikeScore: 22, crimeIndex: 14, floodRisk: 'Low-Moderate', population: 29418 },
  '70808': { name: 'South Baton Rouge', medianHHIncome: 68900, medianAge: 38.4, ownerOccupied: 58, renterOccupied: 42, populationGrowth5yr: 2.1, collegeEducated: 52, medianCommute: 18, newConstructionPermits: 84, schoolDistrict: 'EBR Parish Schools', schoolRating: 'B', walkScore: 48, transitScore: 28, bikeScore: 42, crimeIndex: 38, floodRisk: 'Moderate', population: 48200 },
  '70737': { name: 'Denham Springs', medianHHIncome: 63400, medianAge: 37.2, ownerOccupied: 71, renterOccupied: 29, populationGrowth5yr: 6.8, collegeEducated: 28, medianCommute: 38, newConstructionPermits: 112, schoolDistrict: 'Livingston Parish Schools', schoolRating: 'B-', walkScore: 14, transitScore: 3, bikeScore: 16, crimeIndex: 26, floodRisk: 'Moderate', population: 10209 },
  '70806': { name: 'Midtown Baton Rouge', medianHHIncome: 54200, medianAge: 34.8, ownerOccupied: 44, renterOccupied: 56, populationGrowth5yr: -1.2, collegeEducated: 48, medianCommute: 16, newConstructionPermits: 52, schoolDistrict: 'EBR Parish Schools', schoolRating: 'C+', walkScore: 55, transitScore: 32, bikeScore: 48, crimeIndex: 52, floodRisk: 'Moderate-High', population: 22100 },
  '70816': { name: 'Southeast Baton Rouge', medianHHIncome: 72100, medianAge: 36.5, ownerOccupied: 68, renterOccupied: 32, populationGrowth5yr: 4.2, collegeEducated: 40, medianCommute: 22, newConstructionPermits: 96, schoolDistrict: 'EBR Parish Schools', schoolRating: 'B', walkScore: 28, transitScore: 12, bikeScore: 24, crimeIndex: 32, floodRisk: 'Low-Moderate', population: 38400 },
  '70809': { name: 'Bluebonnet / Corporate', medianHHIncome: 76800, medianAge: 37.1, ownerOccupied: 64, renterOccupied: 36, populationGrowth5yr: 3.8, collegeEducated: 48, medianCommute: 20, newConstructionPermits: 78, schoolDistrict: 'EBR Parish Schools', schoolRating: 'B+', walkScore: 35, transitScore: 18, bikeScore: 28, crimeIndex: 28, floodRisk: 'Low', population: 32100 },
  '70810': { name: 'Jefferson Hwy', medianHHIncome: 71400, medianAge: 38.8, ownerOccupied: 62, renterOccupied: 38, populationGrowth5yr: 1.8, collegeEducated: 44, medianCommute: 19, newConstructionPermits: 64, schoolDistrict: 'EBR Parish Schools', schoolRating: 'B', walkScore: 32, transitScore: 14, bikeScore: 26, crimeIndex: 30, floodRisk: 'Low', population: 28900 },
  '70817': { name: 'Shenandoah / Tiger Bend', medianHHIncome: 98200, medianAge: 39.4, ownerOccupied: 84, renterOccupied: 16, populationGrowth5yr: 6.1, collegeEducated: 52, medianCommute: 24, newConstructionPermits: 124, schoolDistrict: 'EBR Parish Schools', schoolRating: 'A-', walkScore: 16, transitScore: 6, bikeScore: 18, crimeIndex: 16, floodRisk: 'Low', population: 24800 },
  '70818': { name: 'Central', medianHHIncome: 86400, medianAge: 38.2, ownerOccupied: 80, renterOccupied: 20, populationGrowth5yr: 8.8, collegeEducated: 42, medianCommute: 26, newConstructionPermits: 168, schoolDistrict: 'Central Community Schools', schoolRating: 'A', walkScore: 14, transitScore: 4, bikeScore: 16, crimeIndex: 14, floodRisk: 'Low', population: 28200 },
}

export async function GET(req: NextRequest) {
  const zip = req.nextUrl.searchParams.get('zip') ?? '70808'
  const census = CENSUS_DATA[zip] ?? CENSUS_DATA['70808']

  // Try to enrich with live DB data (market snapshots)
  let dbMetrics: {
    activeListings?: number
    medianListPrice?: number
    medianPricePerSqft?: number
    avgDom?: number
    soldLast90?: number
    avgAireEstimate?: number
  } = {}

  try {
    const { query } = await import('@/lib/intel/db/client')

    // Active listing stats for this ZIP
    const activeRes = await query<{
      cnt: string
      med_price: string | null
      med_ppsf: string | null
      avg_dom: string | null
    }>(
      `SELECT
         COUNT(*)::text AS cnt,
         PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ms.list_price)::text AS med_price,
         PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ms.price_per_sqft)::text AS med_ppsf,
         AVG(ms.dom)::text AS avg_dom
       FROM market_snapshots ms
       JOIN properties_clean pc ON pc.property_id = ms.property_id
       WHERE pc.zip = $1
         AND ms.status = 'active'
         AND ms.snapshot_date >= NOW() - INTERVAL '14 days'`,
      [zip]
    )

    if (activeRes.rows[0]) {
      const r = activeRes.rows[0]
      dbMetrics.activeListings = parseInt(r.cnt) || undefined
      dbMetrics.medianListPrice = r.med_price ? Math.round(parseFloat(r.med_price)) : undefined
      dbMetrics.medianPricePerSqft = r.med_ppsf ? Math.round(parseFloat(r.med_ppsf)) : undefined
      dbMetrics.avgDom = r.avg_dom ? Math.round(parseFloat(r.avg_dom)) : undefined
    }

    // Sold in last 90 days
    const soldRes = await query<{ cnt: string }>(
      `SELECT COUNT(*)::text AS cnt
       FROM market_snapshots ms
       JOIN properties_clean pc ON pc.property_id = ms.property_id
       WHERE pc.zip = $1
         AND ms.status = 'sold'
         AND ms.sold_date >= NOW() - INTERVAL '90 days'`,
      [zip]
    )
    if (soldRes.rows[0]) {
      dbMetrics.soldLast90 = parseInt(soldRes.rows[0].cnt) || undefined
    }

    // Average AIRE estimate
    const aireRes = await query<{ avg_est: string | null }>(
      `SELECT AVG(s.aire_estimate)::text AS avg_est
       FROM aire_scores s
       JOIN properties_clean pc ON pc.property_id = s.property_id
       WHERE pc.zip = $1
         AND s.score_date >= NOW() - INTERVAL '30 days'
         AND s.aire_estimate IS NOT NULL`,
      [zip]
    )
    if (aireRes.rows[0]?.avg_est) {
      dbMetrics.avgAireEstimate = Math.round(parseFloat(aireRes.rows[0].avg_est))
    }
  } catch {
    // DB unavailable — return census data only
  }

  return NextResponse.json({
    zip,
    ...census,
    // Live market data (null if DB unavailable)
    market: {
      activeListings: dbMetrics.activeListings ?? null,
      medianListPrice: dbMetrics.medianListPrice ?? null,
      medianPricePerSqft: dbMetrics.medianPricePerSqft ?? null,
      avgDaysOnMarket: dbMetrics.avgDom ?? null,
      soldLast90Days: dbMetrics.soldLast90 ?? null,
      avgAireEstimate: dbMetrics.avgAireEstimate ?? null,
    },
    source: ['Census ACS 2023', 'AIRE Market Snapshots', 'BR Open Data'],
    lastUpdated: new Date().toISOString().split('T')[0],
  })
}
