/**
 * Multi-Source CMA Auto-Fetch
 *
 * Given an address, automatically pulls valuations from all available sources:
 *   1. Paragon MLS (local sold comps) — always highest weight
 *   2. PropStream (AVM + tax assessor) — off-market data
 *   3. Zillow (Zestimate) — consumer-facing estimate
 *   4. RPR (Realtors Property Resource) — if API key available
 *
 * Then feeds into the existing ensemble engine for weighted reconciliation.
 */

import { runEnsemble } from "@/lib/data/engines/ensemble"
import { runDisagreement } from "@/lib/data/engines/disagreement"
import { runPPS } from "@/lib/data/engines/pps"
import { normalizeAddress } from "@/lib/data/engines/normalize"

export interface CMASourceResult {
  source: string
  estimate: number | null
  comps: CompData[]
  confidence: "high" | "medium" | "low"
  error?: string
}

export interface CompData {
  address: string
  soldPrice: number
  soldDate: string
  sqft: number
  beds: number
  baths: number
  distance?: number
  adjustedValue?: number
}

export interface MultiSourceCMA {
  address: string
  propertyId: string
  sources: CMASourceResult[]
  ensemble: {
    aireEstimate: number
    weights: Record<string, number>
    sourcesUsed: string[]
    missingSources: string[]
  }
  confidence: {
    tier: string
    disagreementPct: number
    flagForReview: boolean
  }
  pricingPosition: {
    score: number
    factors: { factor: string; score: number; note: string }[]
  } | null
  buyerPerceptionGap: {
    zillowEstimate: number | null
    aireEstimate: number
    gapPct: number | null
    explanation: string
  }
}

// ─── SOURCE FETCHERS ────────────────────────────────────────────

/**
 * Fetch Paragon MLS comps (local database).
 */
async function fetchParagonComps(address: string): Promise<CMASourceResult> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || ""}/api/data/paragon/sales?address=${encodeURIComponent(address)}&radius=1&months=12`,
      { headers: { "x-internal": "true" } }
    )
    if (!res.ok) throw new Error(`Paragon API ${res.status}`)
    const data = await res.json()

    const comps: CompData[] = (data.sales || []).slice(0, 5).map((s: Record<string, unknown>) => ({
      address: s.address as string,
      soldPrice: s.soldPrice as number,
      soldDate: s.soldDate as string,
      sqft: s.sqft as number || 0,
      beds: s.beds as number || 0,
      baths: s.baths as number || 0,
      distance: s.distance as number,
    }))

    const avg = comps.length > 0
      ? Math.round(comps.reduce((sum, c) => sum + c.soldPrice, 0) / comps.length)
      : null

    return { source: "paragon_mls", estimate: avg, comps, confidence: comps.length >= 3 ? "high" : "medium" }
  } catch (err) {
    return { source: "paragon_mls", estimate: null, comps: [], confidence: "low", error: String(err) }
  }
}

/**
 * Fetch PropStream AVM.
 */
async function fetchPropStreamAVM(address: string): Promise<CMASourceResult> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || ""}/api/data/propstream/property?address=${encodeURIComponent(address)}`,
      { headers: { "x-internal": "true" } }
    )
    if (!res.ok) throw new Error(`PropStream API ${res.status}`)
    const data = await res.json()

    const estimate = data.estimatedValue || data.avm || null
    return { source: "propstream", estimate, comps: [], confidence: estimate ? "medium" : "low" }
  } catch (err) {
    return { source: "propstream", estimate: null, comps: [], confidence: "low", error: String(err) }
  }
}

/**
 * Fetch Zillow Zestimate via data API.
 * Note: Zillow's API requires partnership. Falls back to estimate endpoint.
 */
async function fetchZillowEstimate(address: string): Promise<CMASourceResult> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || ""}/api/data/estimate?address=${encodeURIComponent(address)}&source=zillow`,
      { headers: { "x-internal": "true" } }
    )
    if (!res.ok) throw new Error(`Zillow estimate API ${res.status}`)
    const data = await res.json()

    return {
      source: "zillow",
      estimate: data.estimate || data.zestimate || null,
      comps: [],
      confidence: "low", // Zillow is always low confidence for Louisiana
    }
  } catch (err) {
    return { source: "zillow", estimate: null, comps: [], confidence: "low", error: String(err) }
  }
}

/**
 * Fetch RPR estimate (requires RPR API key).
 */
async function fetchRPREstimate(address: string): Promise<CMASourceResult> {
  if (!process.env.RPR_API_KEY) {
    return { source: "rpr", estimate: null, comps: [], confidence: "low", error: "RPR_API_KEY not configured" }
  }

  try {
    const res = await fetch(
      `https://api.narrpr.com/v2/property/search?address=${encodeURIComponent(address)}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.RPR_API_KEY}`,
          Accept: "application/json",
        },
      }
    )
    if (!res.ok) throw new Error(`RPR API ${res.status}`)
    const data = await res.json()

    const property = data.results?.[0]
    const estimate = property?.estimatedValue || property?.rprValue || null

    return { source: "rpr", estimate, comps: [], confidence: estimate ? "medium" : "low" }
  } catch (err) {
    return { source: "rpr", estimate: null, comps: [], confidence: "low", error: String(err) }
  }
}

// ─── MAIN CMA FUNCTION ─────────────────────────────────────────

/**
 * Run a complete multi-source CMA for an address.
 * Fetches all sources in parallel, then runs ensemble reconciliation.
 */
export async function runMultiSourceCMA(
  address: string,
  listPrice?: number
): Promise<MultiSourceCMA> {
  const normalized = normalizeAddress(address)
  const propertyId = normalized.property_id

  // Fetch all sources in parallel
  const [paragon, propstream, zillow, rpr] = await Promise.all([
    fetchParagonComps(address),
    fetchPropStreamAVM(address),
    fetchZillowEstimate(address),
    fetchRPREstimate(address),
  ])

  const sources = [paragon, propstream, zillow, rpr]

  // Build input for ensemble engine
  const ensembleInput = {
    mls_cma: paragon.estimate,
    propstream_avm: propstream.estimate,
    zillow_estimate: zillow.estimate,
    redfin_estimate: rpr.estimate, // RPR fills the redfin slot in the ensemble
  }

  const ensemble = runEnsemble(ensembleInput)
  const confidence = runDisagreement(ensembleInput)

  // PPS only if we have a list price
  let pricingPosition = null
  if (listPrice && ensemble.aire_estimate) {
    pricingPosition = runPPS({ list_price: listPrice, aire_estimate: ensemble.aire_estimate })
  }

  // Buyer perception gap analysis
  const buyerPerceptionGap = {
    zillowEstimate: zillow.estimate,
    aireEstimate: ensemble.aire_estimate,
    gapPct: zillow.estimate && ensemble.aire_estimate
      ? Math.round(((zillow.estimate - ensemble.aire_estimate) / ensemble.aire_estimate) * 1000) / 10
      : null,
    explanation: zillow.estimate && ensemble.aire_estimate && zillow.estimate > ensemble.aire_estimate
      ? `Zillow's Zestimate of $${zillow.estimate.toLocaleString()} is ${Math.round(((zillow.estimate - ensemble.aire_estimate) / ensemble.aire_estimate) * 100)}% higher than the local market supports. Zillow uses a national algorithm that doesn't account for Louisiana-specific factors like flood zone differences and parish-level pricing.`
      : "Zillow estimate aligns with local market data.",
  }

  return {
    address: normalized.canonical || address,
    propertyId,
    sources,
    ensemble: {
      aireEstimate: ensemble.aire_estimate,
      weights: ensemble.weights_used,
      sourcesUsed: ensemble.sources_used,
      missingSources: ensemble.missing_sources,
    },
    confidence: {
      tier: confidence.confidence_tier,
      disagreementPct: confidence.disagreement_pct,
      flagForReview: confidence.flag_for_review,
    },
    pricingPosition,
    buyerPerceptionGap,
  }
}
