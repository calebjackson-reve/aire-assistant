/**
 * AIRE Intelligence — Insurance Optimizer Engine
 *
 * Combines FEMA flood zone data, HUD FHA guidelines, and Louisiana DOI
 * rate filings to estimate total insurance cost for a property.
 *
 * Three coverage types:
 *  1. Homeowners (HO-3) — calibrated to LA DOI filed rates by parish
 *  2. Flood (NFIP Risk Rating 2.0) — FEMA zone + building characteristics
 *  3. Wind/Hail — LA DOI coastal wind pool or private market
 *
 * Sources: FEMA FIRM, NFIP Risk Rating 2.0, HUD FHA limits, LA DOI filings
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface InsuranceInput {
  address: string
  zip: string
  parish?: string
  propertyValue: number
  yearBuilt: number
  sqft: number
  stories?: number
  constructionType?: 'frame' | 'masonry' | 'concrete'
  roofAge?: number
  hasPool?: boolean
  floodZone?: string
  elevation?: number  // feet above BFE
  deductible?: number // homeowners deductible
}

export interface CoverageEstimate {
  type: 'homeowners' | 'flood' | 'wind'
  annualPremiumMin: number
  annualPremiumMax: number
  monthlyMin: number
  monthlyMax: number
  coverageAmount: number
  deductible: number
  source: string
  notes: string
}

export interface InsuranceResult {
  address: string
  zip: string
  parish: string
  propertyValue: number
  coverages: CoverageEstimate[]
  totalAnnualMin: number
  totalAnnualMax: number
  totalMonthlyMin: number
  totalMonthlyMax: number
  fhaRequired: boolean
  fhaFloodRequired: boolean
  recommendation: string
  costAsPercentOfValue: { min: number; max: number }
  vsStateAverage: { homeowners: string; flood: string; total: string }
  sources: string[]
  disclaimer: string
}

// ── Louisiana Parish Rate Factors ─────────────────────────────────────────────
// Based on LA DOI filed rates — ratio vs state base rate
// Higher = more expensive parish for homeowners insurance

const PARISH_HO_FACTORS: Record<string, number> = {
  'EBR': 1.00,           // East Baton Rouge — baseline
  'Ascension': 0.95,
  'Livingston': 1.08,    // 2016 flood impact on rates
  'West Baton Rouge': 0.92,
  'West Feliciana': 0.88,
  'Iberville': 0.94,
  'Pointe Coupee': 0.90,
  'East Feliciana': 0.87,
  'St. Helena': 0.86,
  'Tangipahoa': 1.05,
  'St. Tammany': 1.15,   // coastal proximity
  'Orleans': 1.35,       // highest risk metro
  'Jefferson': 1.25,
  'Calcasieu': 1.30,     // hurricane corridor
  'Lafayette': 1.02,
  'Caddo': 0.95,
  'Ouachita': 0.93,
  'Rapides': 0.96,
}

// ── FEMA Flood Zone Premium Factors (NFIP Risk Rating 2.0) ────────────────────

interface FloodRateConfig {
  baseRate: number       // $/yr per $100K coverage
  bfeAdjustment: number  // multiplier per foot above/below BFE
  riskLabel: string
  required: boolean      // required for federally backed mortgages
}

const FLOOD_ZONE_RATES: Record<string, FloodRateConfig> = {
  'V':   { baseRate: 4800, bfeAdjustment: 0.88, riskLabel: 'Coastal High Hazard', required: true },
  'VE':  { baseRate: 4800, bfeAdjustment: 0.88, riskLabel: 'Coastal High Hazard', required: true },
  'A':   { baseRate: 2800, bfeAdjustment: 0.85, riskLabel: 'High Risk', required: true },
  'AE':  { baseRate: 2800, bfeAdjustment: 0.85, riskLabel: 'High Risk', required: true },
  'AH':  { baseRate: 2600, bfeAdjustment: 0.87, riskLabel: 'High Risk - Shallow', required: true },
  'AO':  { baseRate: 2400, bfeAdjustment: 0.87, riskLabel: 'High Risk - Sheet Flow', required: true },
  'X/AE': { baseRate: 1600, bfeAdjustment: 0.90, riskLabel: 'Moderate Risk', required: false },
  'B':   { baseRate: 800,  bfeAdjustment: 0.92, riskLabel: 'Moderate Risk', required: false },
  'C':   { baseRate: 480,  bfeAdjustment: 0.95, riskLabel: 'Low Risk', required: false },
  'X':   { baseRate: 480,  bfeAdjustment: 0.95, riskLabel: 'Minimal Risk', required: false },
}

// ── Wind/Hail Rate Tiers ──────────────────────────────────────────────────────
// Louisiana Citizens or private wind — based on distance from coast

function getWindTier(zip: string): { factor: number; tier: string } {
  const coastalZips = ['70001','70002','70003','70005','70006','70112','70113','70114','70115','70116','70117','70118','70119','70121','70122','70123','70124','70125','70126','70127','70128','70129','70130','70131']
  const nearCoastalZips = ['70433','70435','70448','70458','70461','70471','70706','70726']

  if (coastalZips.includes(zip)) return { factor: 2.8, tier: 'Coastal' }
  if (nearCoastalZips.includes(zip)) return { factor: 1.8, tier: 'Near-Coastal' }

  // Baton Rouge metro — inland
  if (zip.startsWith('708') || zip.startsWith('707')) return { factor: 1.0, tier: 'Inland' }

  return { factor: 1.2, tier: 'Standard' }
}

// ── HUD FHA Loan Limits (2026) ────────────────────────────────────────────────

const FHA_LIMITS: Record<string, number> = {
  'EBR': 472_030,
  'Ascension': 472_030,
  'Livingston': 472_030,
  'West Baton Rouge': 472_030,
  'Orleans': 472_030,
  'Jefferson': 472_030,
  'St. Tammany': 472_030,
  'default': 472_030,
}

// ── LA State Averages (for comparison) ────────────────────────────────────────

const LA_AVG = {
  homeowners: 2_850,  // LA avg HO-3 premium
  flood: 1_100,       // LA avg NFIP premium
  total: 4_200,       // combined avg
}

// ── Core Calculation ──────────────────────────────────────────────────────────

export function calculateInsurance(input: InsuranceInput): InsuranceResult {
  const parish = input.parish ?? deriveParishFromZip(input.zip)
  const deductible = input.deductible ?? 2500
  const stories = input.stories ?? 1
  const constructionType = input.constructionType ?? 'frame'
  const roofAge = input.roofAge ?? Math.max(0, 2026 - input.yearBuilt - 10)
  const floodZone = input.floodZone ?? 'X'

  const coverages: CoverageEstimate[] = []

  // ── 1. Homeowners (HO-3) ──────────────────────────────────────────────────
  const hoBase = 1_850 // LA base rate for $200K frame home
  const parishFactor = PARISH_HO_FACTORS[parish] ?? 1.0
  const valueFactor = input.propertyValue / 200_000
  const ageFactor = input.yearBuilt < 1970 ? 1.35 : input.yearBuilt < 1990 ? 1.15 : input.yearBuilt < 2010 ? 1.0 : 0.90
  const constructionFactor = constructionType === 'masonry' ? 0.92 : constructionType === 'concrete' ? 0.85 : 1.0
  const roofFactor = roofAge > 20 ? 1.25 : roofAge > 15 ? 1.12 : 1.0
  const poolFactor = input.hasPool ? 1.08 : 1.0
  const deductibleFactor = deductible >= 5000 ? 0.88 : deductible >= 2500 ? 0.94 : 1.0

  const hoCalc = hoBase * parishFactor * valueFactor * ageFactor * constructionFactor * roofFactor * poolFactor * deductibleFactor
  const hoMin = Math.round(hoCalc * 0.85)
  const hoMax = Math.round(hoCalc * 1.15)

  coverages.push({
    type: 'homeowners',
    annualPremiumMin: hoMin,
    annualPremiumMax: hoMax,
    monthlyMin: Math.round(hoMin / 12),
    monthlyMax: Math.round(hoMax / 12),
    coverageAmount: input.propertyValue,
    deductible,
    source: 'LA DOI Filed Rates · AIRE Parish Calibration',
    notes: `${constructionType} construction, ${input.yearBuilt} build, ${parish} parish factor ${parishFactor}`,
  })

  // ── 2. Flood Insurance (NFIP) ─────────────────────────────────────────────
  const floodConfig = FLOOD_ZONE_RATES[floodZone] ?? FLOOD_ZONE_RATES['X']
  const floodCoverage = Math.min(input.propertyValue, 250_000) // NFIP max
  const floodValueFactor = floodCoverage / 250_000
  const elevationFeet = input.elevation ?? (floodZone === 'X' ? 5 : floodZone.includes('AE') ? 2 : 1)
  const elevationDiscount = Math.pow(floodConfig.bfeAdjustment, Math.max(0, elevationFeet - 1))
  const floodAgeDiscount = input.yearBuilt >= 2010 ? 0.82 : input.yearBuilt >= 2000 ? 0.90 : 1.0

  const floodCalc = floodConfig.baseRate * floodValueFactor * elevationDiscount * floodAgeDiscount
  const floodMin = Math.round(floodCalc * 0.80)
  const floodMax = Math.round(floodCalc * 1.20)

  coverages.push({
    type: 'flood',
    annualPremiumMin: floodMin,
    annualPremiumMax: floodMax,
    monthlyMin: Math.round(floodMin / 12),
    monthlyMax: Math.round(floodMax / 12),
    coverageAmount: floodCoverage,
    deductible: 1250,
    source: `FEMA NFIP Risk Rating 2.0 · Zone ${floodZone}`,
    notes: `${floodConfig.riskLabel} — ${floodConfig.required ? 'Required for federally backed mortgages' : 'Optional but recommended'}. ~${elevationFeet} ft above BFE.`,
  })

  // ── 3. Wind/Hail ──────────────────────────────────────────────────────────
  const windTier = getWindTier(input.zip)
  const windBase = 420
  const windCalc = windBase * windTier.factor * valueFactor * (stories >= 2 ? 1.12 : 1.0)
  const windMin = Math.round(windCalc * 0.85)
  const windMax = Math.round(windCalc * 1.15)

  coverages.push({
    type: 'wind',
    annualPremiumMin: windMin,
    annualPremiumMax: windMax,
    monthlyMin: Math.round(windMin / 12),
    monthlyMax: Math.round(windMax / 12),
    coverageAmount: input.propertyValue,
    deductible: deductible,
    source: `LA DOI Wind Pool · ${windTier.tier} Tier`,
    notes: `${windTier.tier} wind exposure. ${windTier.factor > 1.5 ? 'Consider fortified roof discount.' : 'Standard inland rate.'}`,
  })

  // ── Totals ────────────────────────────────────────────────────────────────
  const totalAnnualMin = coverages.reduce((s, c) => s + c.annualPremiumMin, 0)
  const totalAnnualMax = coverages.reduce((s, c) => s + c.annualPremiumMax, 0)

  // FHA requirements
  const fhaLimit = FHA_LIMITS[parish] ?? FHA_LIMITS['default']
  const fhaRequired = input.propertyValue <= fhaLimit
  const fhaFloodRequired = floodConfig.required

  // vs state average
  const hoMid = (hoMin + hoMax) / 2
  const floodMid = (floodMin + floodMax) / 2
  const totalMid = (totalAnnualMin + totalAnnualMax) / 2

  function vsAvg(mid: number, avg: number): string {
    const pct = ((mid - avg) / avg * 100)
    return pct >= 0 ? `+${pct.toFixed(0)}% above LA avg` : `${pct.toFixed(0)}% below LA avg`
  }

  // Recommendation
  let recommendation: string
  if (totalMid > 6000) {
    recommendation = 'High total insurance burden. Negotiate seller credits for insurance costs. Consider elevation certificate to reduce flood premium. Shop private flood market for potential savings over NFIP.'
  } else if (totalMid > 4000) {
    recommendation = 'Insurance costs above Louisiana average. Factor into offer price. Request elevation certificate. Compare NFIP vs private flood options.'
  } else if (floodConfig.required) {
    recommendation = 'Property is in a mandatory flood insurance zone. Budget for NFIP premium. Consider private flood insurance for potential savings. Verify zone with elevation certificate.'
  } else {
    recommendation = 'Insurance costs are manageable for this area. Still recommended to carry flood coverage even in X zone — 25% of flood claims come from low-risk zones.'
  }

  return {
    address: input.address,
    zip: input.zip,
    parish,
    propertyValue: input.propertyValue,
    coverages,
    totalAnnualMin,
    totalAnnualMax,
    totalMonthlyMin: Math.round(totalAnnualMin / 12),
    totalMonthlyMax: Math.round(totalAnnualMax / 12),
    fhaRequired,
    fhaFloodRequired,
    recommendation,
    costAsPercentOfValue: {
      min: parseFloat((totalAnnualMin / input.propertyValue * 100).toFixed(2)),
      max: parseFloat((totalAnnualMax / input.propertyValue * 100).toFixed(2)),
    },
    vsStateAverage: {
      homeowners: vsAvg(hoMid, LA_AVG.homeowners),
      flood: vsAvg(floodMid, LA_AVG.flood),
      total: vsAvg(totalMid, LA_AVG.total),
    },
    sources: ['FEMA FIRM Maps', 'NFIP Risk Rating 2.0', 'HUD FHA Loan Limits', 'LA DOI Rate Filings', 'AIRE Parish Calibration'],
    disclaimer: 'Insurance estimates are for informational purposes only. Actual premiums depend on individual underwriting, claims history, and carrier-specific factors. Consult a licensed insurance agent for binding quotes.',
  }
}

// ── Parish derivation from ZIP ────────────────────────────────────────────────

function deriveParishFromZip(zip: string): string {
  const EBR = ['70801','70802','70803','70805','70806','70807','70808','70809','70810','70811','70812','70814','70815','70816','70817','70818','70819','70820','70791','70836']
  const ASC = ['70737','70769','70346','70725','70734','70772','70778']
  const LIV = ['70706','70726','70744','70754','70785']
  const WBR = ['70767']

  if (EBR.includes(zip)) return 'EBR'
  if (ASC.includes(zip)) return 'Ascension'
  if (LIV.includes(zip)) return 'Livingston'
  if (WBR.includes(zip)) return 'West Baton Rouge'
  if (zip === '70775') return 'West Feliciana'
  return 'EBR'
}
