/**
 * Louisiana Live Data Engine
 * Real-time property intelligence for Louisiana real estate.
 * Covers: FEMA flood zones, parish assessor records, market snapshots.
 * All APIs used are free / public — no keys required for core functionality.
 */

// ─── FEMA Flood Zone Lookup ───────────────────────────────────────────────

export type FloodZone =
  | "AE" | "A" | "AH" | "AO" | "VE" | "V"   // High risk — in SFHA
  | "X500"                                     // Moderate risk
  | "X"                                        // Low risk
  | "D"                                        // Undetermined
  | "UNKNOWN"

export interface FloodZoneResult {
  zone: FloodZone
  subtype: string | null
  inSFHA: boolean           // Special Flood Hazard Area = mandatory insurance for federally backed loans
  riskLabel: "High" | "Moderate" | "Low" | "Undetermined"
  riskColor: string         // AIRE palette: error=high, warning=moderate, success=low
  description: string
  femaLink: string
}

export async function lookupFloodZone(address: string): Promise<FloodZoneResult | null> {
  try {
    // Step 1: Geocode address → lat/lng via OpenStreetMap Nominatim
    const geoRes = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address + ", Louisiana")}&format=json&limit=1`,
      { headers: { "User-Agent": "AIRE-Intelligence/1.0 (contact@aireintel.org)" }, signal: AbortSignal.timeout(8000) }
    )
    const geoData = await geoRes.json()
    if (!geoData?.[0]) return null
    const { lat, lon } = geoData[0]

    // Step 2: Query FEMA NFHL flood zone layer (layer 28 = flood hazard zones)
    const femaUrl = `https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHL/MapServer/28/query?` +
      `geometry=${lon},${lat}&geometryType=esriGeometryPoint&spatialRel=esriSpatialRelIntersects` +
      `&outFields=FLD_ZONE,SFHA_TF,ZONE_SUBTY&returnGeometry=false&f=json`

    const femaRes = await fetch(femaUrl, { signal: AbortSignal.timeout(10000) })
    const femaData = await femaRes.json()

    const feature = femaData?.features?.[0]?.attributes
    if (!feature) {
      return buildFloodResult("UNKNOWN", null, false, address)
    }

    const zone = (feature.FLD_ZONE || "UNKNOWN").trim().toUpperCase() as FloodZone
    const inSFHA = feature.SFHA_TF === "T"
    const subtype = feature.ZONE_SUBTY || null

    return buildFloodResult(zone, subtype, inSFHA, address)
  } catch (err) {
    console.error("[FloodZone] Lookup failed (non-blocking):", err)
    return null
  }
}

function buildFloodResult(
  zone: FloodZone,
  subtype: string | null,
  inSFHA: boolean,
  address: string
): FloodZoneResult {
  const high = ["AE", "A", "AH", "AO", "VE", "V"]
  const moderate = ["X500"]
  const isHigh = high.includes(zone)
  const isMod = moderate.includes(zone)

  const riskLabel = zone === "UNKNOWN" || zone === "D"
    ? "Undetermined"
    : isHigh ? "High" : isMod ? "Moderate" : "Low"

  const riskColor = isHigh ? "#8b4a4a" : isMod ? "#b5956a" : "#6b7d52"

  const descriptions: Partial<Record<FloodZone, string>> = {
    AE: "High-risk flood zone. Flood insurance required for federally backed mortgages. Base flood elevations determined.",
    A: "High-risk flood zone. Flood insurance required for federally backed mortgages.",
    AH: "High-risk zone with shallow flooding (1–3 ft ponding). Insurance required.",
    AO: "High-risk zone with shallow sheet flooding. Insurance required.",
    VE: "Coastal high-hazard zone with wave action. Insurance required.",
    V: "Coastal high-hazard zone. Insurance required.",
    X500: "Moderate flood risk (0.2% annual chance). Insurance not required but strongly recommended in Louisiana.",
    X: "Minimal flood risk. Outside the 500-year floodplain. Insurance optional.",
    D: "Flood hazard undetermined. Recommend verifying with local parish.",
    UNKNOWN: "Flood zone data not available for this address.",
  }

  return {
    zone,
    subtype,
    inSFHA,
    riskLabel,
    riskColor,
    description: descriptions[zone] || `Flood zone ${zone}.`,
    femaLink: `https://msc.fema.gov/portal/search#searchresultsanchor`,
  }
}

// ─── Parish Assessor Lookup ───────────────────────────────────────────────

export type Parish = "ebr" | "ascension" | "livingston" | "other"

export interface AssessorRecord {
  parish: Parish
  parcelId: string | null
  legalDescription: string | null
  assessedValue: number | null
  landValue: number | null
  improvementValue: number | null
  ownerName: string | null
  siteAddress: string | null
  subdivision: string | null
  lotSize: string | null
  yearBuilt: number | null
  source: string
  lastUpdated: string
  directUrl: string | null
}

// Detect which parish based on city/zip
export function detectParish(address: string): Parish {
  const lower = address.toLowerCase()
  const ebrCities = ["baton rouge", "zachary", "baker", "central", "pride", "slaughter", "70801", "70802", "70803", "70806", "70808", "70809", "70810", "70811", "70812", "70814", "70815", "70816", "70817", "70818", "70819", "70820"]
  const ascensionCities = ["gonzales", "prairieville", "sorrento", "geismar", "dutchtown", "ascension", "70737", "70769", "70778"]
  const livingstonCities = ["denham springs", "walker", "watson", "livingston", "albany", "70726", "70754", "70785"]

  if (ebrCities.some(c => lower.includes(c))) return "ebr"
  if (ascensionCities.some(c => lower.includes(c))) return "ascension"
  if (livingstonCities.some(c => lower.includes(c))) return "livingston"
  return "other"
}

/**
 * Fetch parish assessor record. Uses Firecrawl API if FIRECRAWL_API_KEY is set,
 * otherwise returns a stub with direct link for manual lookup.
 */
export async function lookupAssessorRecord(address: string): Promise<AssessorRecord | null> {
  const parish = detectParish(address)

  const assessorUrls: Record<Parish, string> = {
    ebr: "https://www.ebrpa.org/",
    ascension: "https://www.ascensionassessor.com/",
    livingston: "https://www.lpao.org/",
    other: "https://www.lata.org/",
  }

  const sourceNames: Record<Parish, string> = {
    ebr: "East Baton Rouge Parish Assessor",
    ascension: "Ascension Parish Assessor",
    livingston: "Livingston Parish Assessor",
    other: "Louisiana Assessors Association",
  }

  // If Firecrawl API key is available, scrape the assessor site
  if (process.env.FIRECRAWL_API_KEY) {
    try {
      const record = await scrapeAssessorWithFirecrawl(address, parish, assessorUrls[parish])
      if (record) return record
    } catch (err) {
      console.error("[Assessor] Firecrawl scrape failed, returning stub:", err)
    }
  }

  // Stub response with direct link — user can look up manually
  return {
    parish,
    parcelId: null,
    legalDescription: null,
    assessedValue: null,
    landValue: null,
    improvementValue: null,
    ownerName: null,
    siteAddress: address,
    subdivision: null,
    lotSize: null,
    yearBuilt: null,
    source: sourceNames[parish],
    lastUpdated: new Date().toISOString().split("T")[0],
    directUrl: assessorUrls[parish],
  }
}

async function scrapeAssessorWithFirecrawl(
  address: string,
  parish: Parish,
  baseUrl: string
): Promise<AssessorRecord | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY
  if (!apiKey) return null

  // Use Firecrawl's scrape endpoint with extraction schema
  const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      url: baseUrl,
      formats: ["extract"],
      extract: {
        prompt: `Find property record for address: "${address}". Extract: parcel ID, legal description, assessed value, land value, improvement value, owner name, subdivision, lot size, year built.`,
        schema: {
          type: "object",
          properties: {
            parcelId: { type: "string" },
            legalDescription: { type: "string" },
            assessedValue: { type: "number" },
            landValue: { type: "number" },
            improvementValue: { type: "number" },
            ownerName: { type: "string" },
            subdivision: { type: "string" },
            lotSize: { type: "string" },
            yearBuilt: { type: "number" },
          },
        },
      },
    }),
    signal: AbortSignal.timeout(30000),
  })

  const data = await res.json()
  if (!data?.data?.extract) return null

  const e = data.data.extract
  return {
    parish,
    parcelId: e.parcelId || null,
    legalDescription: e.legalDescription || null,
    assessedValue: e.assessedValue || null,
    landValue: e.landValue || null,
    improvementValue: e.improvementValue || null,
    ownerName: e.ownerName || null,
    siteAddress: address,
    subdivision: e.subdivision || null,
    lotSize: e.lotSize || null,
    yearBuilt: e.yearBuilt || null,
    source: `${parish.toUpperCase()} Parish Assessor (via Firecrawl)`,
    lastUpdated: new Date().toISOString().split("T")[0],
    directUrl: baseUrl,
  }
}

// ─── Market Snapshot ──────────────────────────────────────────────────────

export interface MarketSnapshot {
  parish: string
  medianPrice: number
  avgDom: number
  listToSaleRatio: number   // e.g. 0.97 = 97%
  activeListings: number
  closedLast30: number
  pricePerSqft: number
  monthsSupply: number
  hotness: "Hot" | "Balanced" | "Buyer's Market"
  lastUpdated: string
  source: string
}

// Static baselines from GBRAR Q1 2026 data (updated via cron when Firecrawl key set)
export const MARKET_BASELINES: Record<string, MarketSnapshot> = {
  "baton-rouge": {
    parish: "East Baton Rouge",
    medianPrice: 277143,
    avgDom: 45,
    listToSaleRatio: 0.965,
    activeListings: 3170,
    closedLast30: 636,
    pricePerSqft: 142,
    monthsSupply: 4.98,
    hotness: "Balanced",
    lastUpdated: "2026-02-01",
    source: "GBRAR MLS InfoSparks Feb 2026",
  },
  "ascension": {
    parish: "Ascension",
    medianPrice: 295000,
    avgDom: 38,
    listToSaleRatio: 0.982,
    activeListings: 820,
    closedLast30: 178,
    pricePerSqft: 156,
    monthsSupply: 4.6,
    hotness: "Hot",
    lastUpdated: "2026-02-01",
    source: "GBRAR MLS InfoSparks Feb 2026",
  },
  "livingston": {
    parish: "Livingston",
    medianPrice: 243000,
    avgDom: 41,
    listToSaleRatio: 0.972,
    activeListings: 640,
    closedLast30: 142,
    pricePerSqft: 133,
    monthsSupply: 4.5,
    hotness: "Balanced",
    lastUpdated: "2026-02-01",
    source: "GBRAR MLS InfoSparks Feb 2026",
  },
}

export function getMarketSnapshot(address: string): MarketSnapshot {
  const parish = detectParish(address)
  if (parish === "ascension") return MARKET_BASELINES["ascension"]
  if (parish === "livingston") return MARKET_BASELINES["livingston"]
  return MARKET_BASELINES["baton-rouge"]
}

// ─── Louisiana Buyer Programs ─────────────────────────────────────────────

export interface BuyerProgram {
  name: string
  sponsor: string
  maxAssistance: number
  maxIncome: number         // household income limit (rough — varies by parish/family size)
  maxPurchasePrice: number
  forgivable: boolean
  firstTimeOnly: boolean
  description: string
  applyUrl: string
}

export const LOUISIANA_BUYER_PROGRAMS: BuyerProgram[] = [
  {
    name: "MRB Home",
    sponsor: "Louisiana Housing Corporation",
    maxAssistance: 0,
    maxIncome: 95000,
    maxPurchasePrice: 310000,
    forgivable: false,
    firstTimeOnly: true,
    description: "Below-market mortgage interest rate for first-time buyers. Must use LHC-approved lender.",
    applyUrl: "https://www.lhc.la.gov/mrb-home",
  },
  {
    name: "MRB Assisted",
    sponsor: "Louisiana Housing Corporation",
    maxAssistance: 15000,
    maxIncome: 95000,
    maxPurchasePrice: 310000,
    forgivable: true,
    firstTimeOnly: true,
    description: "Up to $15,000 down payment assistance (forgivable at $5K/yr over 3 years) paired with MRB Home rate.",
    applyUrl: "https://www.lhc.la.gov/mrb-assisted",
  },
  {
    name: "Soft Second Program",
    sponsor: "Louisiana Housing Corporation",
    maxAssistance: 35000,
    maxIncome: 80000,
    maxPurchasePrice: 250000,
    forgivable: true,
    firstTimeOnly: true,
    description: "Silent second mortgage forgiven after 5 years. For low-to-moderate income buyers in targeted areas.",
    applyUrl: "https://www.lhc.la.gov/soft-second",
  },
  {
    name: "GNOPH NeighborhoodLIFT",
    sponsor: "Greater New Orleans / Home Point",
    maxAssistance: 15000,
    maxIncome: 90640,
    maxPurchasePrice: 300000,
    forgivable: true,
    firstTimeOnly: false,
    description: "Down payment assistance for EBR and surrounding parishes. Not restricted to first-time buyers.",
    applyUrl: "https://gnoph.org",
  },
  {
    name: "USDA Rural Development",
    sponsor: "US Dept of Agriculture",
    maxAssistance: 0,
    maxIncome: 110650,
    maxPurchasePrice: 400000,
    forgivable: false,
    firstTimeOnly: false,
    description: "0% down in rural/suburban areas. Livingston, Ascension, and outer EBR zip codes often qualify.",
    applyUrl: "https://www.rd.usda.gov/programs-services/single-family-housing-programs",
  },
]

// ─── Calculators ─────────────────────────────────────────────────────────

export interface PITIInput {
  purchasePrice: number
  downPaymentPct: number   // e.g. 0.035 for 3.5%
  interestRate: number     // e.g. 0.0685 for 6.85%
  loanTermYears: number    // 30 or 15
  taxRate: number          // annual, e.g. 0.0108 for 1.08%
  insuranceAnnual: number  // homeowner's insurance
  floodInsuranceAnnual?: number
  hoaMonthly?: number
  pmiRate?: number         // e.g. 0.0085 — required if down < 20%
}

export interface PITIResult {
  loanAmount: number
  downPayment: number
  monthlyPrincipalInterest: number
  monthlyTax: number
  monthlyInsurance: number
  monthlyFloodInsurance: number
  monthlyPMI: number
  monthlyHOA: number
  totalMonthly: number
  totalMonthlyNoFlood: number   // so agent can show "with/without flood insurance"
  affordableAt: number          // purchase price affordable at this income (28% front-end DTI)
}

export function calculatePITI(input: PITIInput): PITIResult {
  const {
    purchasePrice, downPaymentPct, interestRate, loanTermYears,
    taxRate, insuranceAnnual, floodInsuranceAnnual = 0,
    hoaMonthly = 0, pmiRate,
  } = input

  const downPayment = purchasePrice * downPaymentPct
  const loanAmount = purchasePrice - downPayment
  const monthlyRate = interestRate / 12
  const n = loanTermYears * 12

  // P&I amortization formula
  const monthlyPI = monthlyRate === 0
    ? loanAmount / n
    : loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1)

  const monthlyTax = (purchasePrice * taxRate) / 12
  const monthlyIns = insuranceAnnual / 12
  const monthlyFlood = floodInsuranceAnnual / 12

  // PMI: required if < 20% down, unless VA/USDA
  const needsPMI = downPaymentPct < 0.20
  const effectivePmiRate = pmiRate ?? (needsPMI ? 0.0085 : 0)
  const monthlyPMI = needsPMI ? (loanAmount * effectivePmiRate) / 12 : 0

  const totalMonthly = monthlyPI + monthlyTax + monthlyIns + monthlyFlood + monthlyPMI + hoaMonthly
  const totalNoFlood = monthlyPI + monthlyTax + monthlyIns + monthlyPMI + hoaMonthly

  // Reverse: what income do you need? 28% front-end DTI
  const affordableAt = Math.round((totalMonthly / 0.28) * 12)

  return {
    loanAmount: Math.round(loanAmount),
    downPayment: Math.round(downPayment),
    monthlyPrincipalInterest: Math.round(monthlyPI),
    monthlyTax: Math.round(monthlyTax),
    monthlyInsurance: Math.round(monthlyIns),
    monthlyFloodInsurance: Math.round(monthlyFlood),
    monthlyPMI: Math.round(monthlyPMI),
    monthlyHOA: Math.round(hoaMonthly),
    totalMonthly: Math.round(totalMonthly),
    totalMonthlyNoFlood: Math.round(totalNoFlood),
    affordableAt,
  }
}

export interface NetProceedsInput {
  salePrice: number
  mortgagePayoff: number
  agentCommissionPct: number   // e.g. 0.06
  closingCostsPct: number      // seller closing costs, typically 0.01-0.02 in LA
  repairConcessions: number
  transferTax: number          // Louisiana deed/transfer tax (usually low)
  otherFees: number
}

export interface NetProceedsResult {
  grossProceeds: number
  agentCommission: number
  closingCosts: number
  totalDeductions: number
  netToSeller: number
  breakdown: { label: string; amount: number; negative: boolean }[]
}

export function calculateNetProceeds(input: NetProceedsInput): NetProceedsResult {
  const {
    salePrice, mortgagePayoff, agentCommissionPct, closingCostsPct,
    repairConcessions, transferTax, otherFees,
  } = input

  const commission = Math.round(salePrice * agentCommissionPct)
  const closing = Math.round(salePrice * closingCostsPct)
  const total = mortgagePayoff + commission + closing + repairConcessions + transferTax + otherFees
  const net = salePrice - total

  return {
    grossProceeds: salePrice,
    agentCommission: commission,
    closingCosts: closing,
    totalDeductions: total,
    netToSeller: net,
    breakdown: [
      { label: "Sale Price", amount: salePrice, negative: false },
      { label: "Mortgage Payoff", amount: mortgagePayoff, negative: true },
      { label: "Agent Commission", amount: commission, negative: true },
      { label: "Closing Costs", amount: closing, negative: true },
      { label: "Repair / Concessions", amount: repairConcessions, negative: true },
      { label: "Transfer Tax", amount: transferTax, negative: true },
      { label: "Other Fees", amount: otherFees, negative: true },
    ].filter(i => i.amount > 0),
  }
}
