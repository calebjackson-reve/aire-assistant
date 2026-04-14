import { NextRequest, NextResponse } from 'next/server'

// ── ZIP-level fallback data (used when FEMA API is unavailable or no geocode) ──
const FLOOD_ZONES: Record<string, { zone: string; risk: number; premMin: number; premMax: number; bfe: string; nfipClaims: number }> = {
  '70801': { zone: 'AE', risk: 74, premMin: 2800, premMax: 6200, bfe: '2 ft above BFE', nfipClaims: 892 },
  '70802': { zone: 'AE', risk: 71, premMin: 2600, premMax: 5800, bfe: '2-3 ft above BFE', nfipClaims: 743 },
  '70803': { zone: 'X', risk: 28, premMin: 450, premMax: 980, bfe: 'Above 100-yr floodplain', nfipClaims: 42 },
  '70805': { zone: 'AE', risk: 82, premMin: 3200, premMax: 7100, bfe: '<1 ft above BFE', nfipClaims: 1204 },
  '70806': { zone: 'AE', risk: 76, premMin: 2900, premMax: 6400, bfe: '1-2 ft above BFE', nfipClaims: 967 },
  '70807': { zone: 'AE', risk: 79, premMin: 3100, premMax: 6800, bfe: '1 ft above BFE', nfipClaims: 1089 },
  '70808': { zone: 'X/AE', risk: 52, premMin: 1200, premMax: 3200, bfe: '3-4 ft above BFE', nfipClaims: 284 },
  '70809': { zone: 'X', risk: 31, premMin: 480, premMax: 1100, bfe: 'Above 100-yr floodplain', nfipClaims: 67 },
  '70810': { zone: 'X', risk: 24, premMin: 420, premMax: 950, bfe: 'Above 100-yr floodplain', nfipClaims: 38 },
  '70811': { zone: 'AE', risk: 78, premMin: 3000, premMax: 6600, bfe: '1-2 ft above BFE', nfipClaims: 1132 },
  '70812': { zone: 'AE', risk: 75, premMin: 2800, premMax: 6100, bfe: '2 ft above BFE', nfipClaims: 876 },
  '70814': { zone: 'AE', risk: 69, premMin: 2400, premMax: 5400, bfe: '2-3 ft above BFE', nfipClaims: 621 },
  '70816': { zone: 'X/AE', risk: 44, premMin: 900, premMax: 2400, bfe: '4 ft above BFE', nfipClaims: 156 },
  '70817': { zone: 'X', risk: 26, premMin: 440, premMax: 980, bfe: 'Above 100-yr floodplain', nfipClaims: 44 },
  '70818': { zone: 'X', risk: 22, premMin: 400, premMax: 890, bfe: 'Well above floodplain', nfipClaims: 29 },
  '70819': { zone: 'X', risk: 29, premMin: 460, premMax: 1020, bfe: 'Above 100-yr floodplain', nfipClaims: 51 },
  '70820': { zone: 'AE', risk: 65, premMin: 2200, premMax: 4800, bfe: '2-4 ft above BFE', nfipClaims: 487 },
  '70836': { zone: 'X', risk: 18, premMin: 380, premMax: 820, bfe: 'Well above floodplain', nfipClaims: 19 },
  '70737': { zone: 'X/AE', risk: 48, premMin: 1000, premMax: 2700, bfe: '3 ft above BFE', nfipClaims: 198 },
  '70769': { zone: 'X', risk: 33, premMin: 520, premMax: 1180, bfe: '5 ft above BFE', nfipClaims: 74 },
  '70791': { zone: 'X', risk: 19, premMin: 380, premMax: 840, bfe: 'Well above floodplain', nfipClaims: 21 },
  '70775': { zone: 'X', risk: 27, premMin: 440, premMax: 980, bfe: 'Above 100-yr floodplain', nfipClaims: 38 },
}

// ── FEMA NFHL ArcGIS REST API ─────────────────────────────────────────────────
// Free, no API key required. Returns flood zone for a lat/lng point.
const FEMA_NFHL_URL = 'https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHL/MapServer/28/query'

interface FemaFloodResult {
  zone: string
  floodwayStatus: string | null
  panelNumber: string | null
  effectiveDate: string | null
  source: 'fema-api'
}

async function queryFemaNFHL(lat: number, lng: number): Promise<FemaFloodResult | null> {
  const params = new URLSearchParams({
    geometry: `${lng},${lat}`,
    geometryType: 'esriGeometryPoint',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'FLD_ZONE,FLOODWAY,DFIRM_ID,EFF_DATE',
    returnGeometry: 'false',
    f: 'json',
    inSR: '4326',
  })

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)

  try {
    const res = await fetch(`${FEMA_NFHL_URL}?${params}`, { signal: controller.signal })
    clearTimeout(timeout)

    if (!res.ok) return null
    const data = await res.json()

    if (!data.features?.length) return null

    const attrs = data.features[0].attributes
    return {
      zone: attrs.FLD_ZONE ?? 'X',
      floodwayStatus: attrs.FLOODWAY ?? null,
      panelNumber: attrs.DFIRM_ID ?? null,
      effectiveDate: attrs.EFF_DATE ? new Date(attrs.EFF_DATE).toISOString().split('T')[0] : null,
      source: 'fema-api',
    }
  } catch {
    clearTimeout(timeout)
    return null
  }
}

// ── Geocode address to lat/lng using Census Geocoder (free, no key) ───────────
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const params = new URLSearchParams({
    address: address,
    benchmark: 'Public_AR_Current',
    format: 'json',
  })

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 6000)

  try {
    const res = await fetch(
      `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?${params}`,
      { signal: controller.signal }
    )
    clearTimeout(timeout)

    if (!res.ok) return null
    const data = await res.json()

    const match = data.result?.addressMatches?.[0]
    if (!match?.coordinates) return null

    return { lat: match.coordinates.y, lng: match.coordinates.x }
  } catch {
    clearTimeout(timeout)
    return null
  }
}

// ── Risk score calculation from zone ──────────────────────────────────────────
function riskScoreFromZone(zone: string): number {
  const z = zone.toUpperCase()
  if (z.startsWith('V')) return 92
  if (z === 'AE' || z === 'A') return 78
  if (z === 'AH') return 72
  if (z === 'AO') return 68
  if (z.includes('AE') && z.includes('X')) return 50
  if (z === 'B') return 35
  if (z === 'C' || z === 'X') return 25
  return 40
}

// ── Premium estimate from zone + risk ─────────────────────────────────────────
function estimatePremium(zone: string, risk: number): { min: number; max: number } {
  if (risk >= 70) return { min: 2400 + (risk - 70) * 80, max: 5200 + (risk - 70) * 180 }
  if (risk >= 45) return { min: 800 + (risk - 45) * 40, max: 2200 + (risk - 45) * 60 }
  return { min: 350 + risk * 5, max: 800 + risk * 12 }
}

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address')
  if (!address) return NextResponse.json({ error: 'Address required' }, { status: 400 })

  const zipMatch = address.match(/\b7\d{4}\b/)
  const zip = zipMatch ? zipMatch[0] : '70801'

  let zone: string
  let riskScore: number
  let bfe: string
  let nfipClaims: number
  let dataSource: string
  let femaPanel: string | null = null
  let femaEffDate: string | null = null
  let geocoded: { lat: number; lng: number } | null = null

  // Try real FEMA API: geocode → NFHL query
  const coords = await geocodeAddress(address)
  if (coords) {
    geocoded = coords
    const fema = await queryFemaNFHL(coords.lat, coords.lng)

    if (fema) {
      zone = fema.zone
      riskScore = riskScoreFromZone(fema.zone)
      femaPanel = fema.panelNumber
      femaEffDate = fema.effectiveDate
      dataSource = 'FEMA NFHL API (parcel-level)'

      // Use ZIP fallback for BFE + claims (NFHL doesn't return these)
      const fallback = FLOOD_ZONES[zip]
      bfe = fallback?.bfe ?? 'See elevation certificate'
      nfipClaims = fallback?.nfipClaims ?? 0
    } else {
      // FEMA API returned no data — use ZIP fallback
      const fallback = FLOOD_ZONES[zip] ?? { zone: 'X', risk: 32, premMin: 480, premMax: 1100, bfe: 'Above 100-yr floodplain', nfipClaims: 55 }
      zone = fallback.zone
      riskScore = fallback.risk
      bfe = fallback.bfe
      nfipClaims = fallback.nfipClaims
      dataSource = 'AIRE ZIP-level analysis (FEMA API returned no features)'
    }
  } else {
    // Geocode failed — use ZIP fallback
    const fallback = FLOOD_ZONES[zip] ?? { zone: 'X', risk: 32, premMin: 480, premMax: 1100, bfe: 'Above 100-yr floodplain', nfipClaims: 55 }
    zone = fallback.zone
    riskScore = fallback.risk
    bfe = fallback.bfe
    nfipClaims = fallback.nfipClaims
    dataSource = 'AIRE ZIP-level analysis (geocode unavailable)'
  }

  const riskLabel = riskScore >= 70 ? 'High Risk' : riskScore >= 45 ? 'Moderate Risk' : 'Lower Risk'
  const premium = estimatePremium(zone, riskScore)

  const recommendation = riskScore >= 70
    ? 'Flood insurance strongly recommended. Obtain elevation certificate before purchase. Factor flood costs into offer price.'
    : riskScore >= 45
    ? 'Moderate flood exposure. Flood insurance recommended. Review updated FIRM maps and lender requirements.'
    : 'Lower flood risk zone. Consider low-cost preferred risk policy. Verify with elevation certificate for precise determination.'

  return NextResponse.json({
    zip,
    address,
    zone,
    riskScore,
    riskLabel,
    annualPremiumMin: premium.min,
    annualPremiumMax: premium.max,
    elevation: bfe,
    nfipClaimsInZip: nfipClaims,
    recommendation,
    dataSource,
    femaPanel,
    femaEffectiveDate: femaEffDate,
    geocoded,
    sources: ['FEMA NFHL API', 'Census Geocoder', 'NFIP Claims Data', 'AIRE Louisiana ZIP Analysis'],
    femaMapUrl: 'https://msc.fema.gov/portal/search#searchresultsanchor',
    disclaimer: 'Flood zone data sourced from FEMA National Flood Hazard Layer. For legally binding flood zone determination, order an official LOMA from a licensed surveyor.',
    lastUpdated: new Date().toISOString().split('T')[0],
  })
}
