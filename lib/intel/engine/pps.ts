/**
 * AIRE Intelligence — Pricing Position Score (PPS)
 *
 * Measures how well-positioned a listing is to sell.
 * Score: 0–100. Higher = better positioned.
 *
 * FORMULA:
 *   PPS = (
 *     35 * PricingFit +
 *     20 * DemandStrength +
 *     15 * ConditionMatch +
 *     10 * CompetitionRelief +
 *     10 * SellerFlexibility +
 *     10 * Momentum
 *   )
 *   Each sub-score is 0–1. Final PPS is 0–100.
 *
 * WEIGHTS RATIONALE:
 *   PricingFit (35%) — The single biggest factor. A mispriced listing fails
 *     regardless of all other conditions.
 *   DemandStrength (20%) — How hot is the neighborhood right now?
 *   ConditionMatch (15%) — Does the property's condition match buyer expectations?
 *   CompetitionRelief (10%) — How many competing listings in same zip+price band?
 *   SellerFlexibility (10%) — Has the seller shown willingness to negotiate?
 *   Momentum (10%) — Is the neighborhood price trend helping or hurting?
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PPSInputs {
  // PricingFit — compare list price to AIRE estimate
  list_price: number
  aire_estimate: number

  // DemandStrength — absorption rate + Redfin compete score
  sold_last_30_days: number      // number of sold comps in same zip last 30 days
  active_listings_in_zip: number // current active listing count in zip
  compete_score?: number | null  // Redfin compete score 0–100

  // ConditionMatch — from BPS sub-scores (if available)
  bps_interior_finish?: number | null   // 0–1
  bps_modernity?: number | null         // 0–1

  // CompetitionRelief — listings in same zip AND price band (±15%)
  competing_listings: number

  // SellerFlexibility — price reduction history
  price_reductions: number
  price_reduction_pct?: number | null   // total % reduction from original list price

  // Momentum — neighborhood 90-day price trend
  neighborhood_price_trend_90d_pct?: number | null  // e.g. 0.03 = +3%, -0.02 = -2%
}

export interface PPSResult {
  pps_total: number             // 0–100
  pps_pricing_fit: number       // 0–1
  pps_demand_strength: number   // 0–1
  pps_condition_match: number   // 0–1
  pps_competition_relief: number // 0–1
  pps_seller_flexibility: number // 0–1
  pps_momentum: number          // 0–1
  reason_codes: Array<{ factor: string; score: number; note: string }>
}

// ── Sub-score calculators ─────────────────────────────────────────────────────

/**
 * PricingFit (35% weight)
 * How close is list price to AIRE ensemble estimate?
 *   ≤2% off → 1.0  (essentially perfectly priced)
 *   ≤5%    → 0.8
 *   ≤10%   → 0.5
 *   ≤15%   → 0.3
 *   >15%   → 0.1  (significantly overpriced or underpriced)
 */
function scorePricingFit(listPrice: number, aireEstimate: number): { score: number; note: string } {
  const pctDiff = Math.abs(listPrice - aireEstimate) / aireEstimate
  const overUnder = listPrice > aireEstimate ? 'overpriced' : 'underpriced'
  const pctStr = `${(pctDiff * 100).toFixed(1)}%`

  let score: number
  let note: string

  if (pctDiff <= 0.02) {
    score = 1.0
    note = `List price within 2% of AIRE estimate — optimal pricing`
  } else if (pctDiff <= 0.05) {
    score = 0.8
    note = `List price ${pctStr} ${overUnder} — strong position`
  } else if (pctDiff <= 0.10) {
    score = 0.5
    note = `List price ${pctStr} ${overUnder} — moderate risk`
  } else if (pctDiff <= 0.15) {
    score = 0.3
    note = `List price ${pctStr} ${overUnder} — high risk of extended DOM`
  } else {
    score = 0.1
    note = `List price ${pctStr} ${overUnder} — significant repricing likely needed`
  }

  return { score, note }
}

/**
 * DemandStrength (20% weight)
 * Absorption rate = sold_30d / active_listings
 * Normalized 0–1, blended with Redfin compete score.
 */
function scoreDemandStrength(
  sold30d: number,
  activeListings: number,
  competeScore?: number | null
): { score: number; note: string } {
  // Absorption rate: months of supply = active / (sold_30d * 12 / 12)
  // Higher absorption rate = stronger demand
  const absorption = activeListings > 0 ? sold30d / activeListings : 0
  // Normalize: 0.5+ absorption is hot (seller's market); <0.1 is slow
  let absorptionScore = Math.min(absorption / 0.5, 1.0)

  // Blend with Redfin compete score if available
  let blended: number
  if (competeScore != null) {
    const normalizedCompete = competeScore / 100
    blended = absorptionScore * 0.6 + normalizedCompete * 0.4
  } else {
    blended = absorptionScore
  }

  const note = competeScore != null
    ? `Absorption rate: ${(absorption * 100).toFixed(0)}% | Compete score: ${competeScore}/100`
    : `Absorption rate: ${(absorption * 100).toFixed(0)}% (${sold30d} sold / ${activeListings} active)`

  return { score: parseFloat(blended.toFixed(3)), note }
}

/**
 * ConditionMatch (15% weight)
 * Derived from BPS sub-scores if available, else defaults to 0.5 (neutral).
 * Uses average of interior_finish and modernity scores.
 */
function scoreConditionMatch(
  bpsInteriorFinish?: number | null,
  bpsModernity?: number | null
): { score: number; note: string } {
  if (bpsInteriorFinish != null && bpsModernity != null) {
    const score = (bpsInteriorFinish + bpsModernity) / 2
    return {
      score: parseFloat(score.toFixed(3)),
      note: `BPS interior finish: ${bpsInteriorFinish.toFixed(2)} | modernity: ${bpsModernity.toFixed(2)}`,
    }
  }
  if (bpsInteriorFinish != null) {
    return { score: bpsInteriorFinish, note: `BPS interior finish: ${bpsInteriorFinish.toFixed(2)} (modernity not yet reviewed)` }
  }
  return { score: 0.5, note: 'BPS review pending — using neutral 0.5 default' }
}

/**
 * CompetitionRelief (10% weight)
 * Fewer competing listings in same zip + price band = higher score.
 */
function scoreCompetitionRelief(competing: number): { score: number; note: string } {
  let score: number
  let note: string

  if (competing === 0)        { score = 1.0; note = 'No direct competing listings — excellent positioning' }
  else if (competing <= 3)    { score = 0.8; note = `${competing} competing listings — low competition` }
  else if (competing <= 8)    { score = 0.6; note = `${competing} competing listings — moderate competition` }
  else if (competing <= 15)   { score = 0.4; note = `${competing} competing listings — elevated competition` }
  else                        { score = 0.2; note = `${competing} competing listings — saturated segment` }

  return { score, note }
}

/**
 * SellerFlexibility (10% weight)
 * Price reductions signal willingness to negotiate — a mild positive signal.
 * But being significantly overpriced (>10%) negates the flexibility signal.
 */
function scoreSellerFlexibility(
  priceReductions: number,
  priceReductionPct?: number | null,
  listPrice?: number,
  aireEstimate?: number
): { score: number; note: string } {
  // Check if overpriced
  const isSignificantlyOverpriced = listPrice && aireEstimate
    ? (listPrice - aireEstimate) / aireEstimate > 0.10
    : false

  if (isSignificantlyOverpriced) {
    return { score: 0.2, note: 'Overpriced >10% — flexibility signals undermined' }
  }

  if (priceReductions === 0) {
    return { score: 0.5, note: 'No price reductions — neutral signal' }
  }

  const reductionStr = priceReductionPct != null
    ? `${(priceReductionPct * 100).toFixed(1)}% total reduction`
    : `${priceReductions} reduction(s)`

  return {
    score: 0.7,
    note: `${reductionStr} — seller showing flexibility`,
  }
}

/**
 * Momentum (10% weight)
 * Neighborhood price trend over last 90 days.
 * A rising market lifts all boats; declining reduces urgency.
 */
function scoreMomentum(trend90d?: number | null): { score: number; note: string } {
  if (trend90d == null) {
    return { score: 0.5, note: 'Neighborhood trend data unavailable — neutral' }
  }

  let score: number
  let note: string

  if (trend90d > 0.03)       { score = 1.0; note = `+${(trend90d * 100).toFixed(1)}% 90d trend — strong appreciation momentum` }
  else if (trend90d > 0.01)  { score = 0.8; note = `+${(trend90d * 100).toFixed(1)}% 90d trend — positive momentum` }
  else if (trend90d >= -0.01){ score = 0.5; note = `${(trend90d * 100).toFixed(1)}% 90d trend — stable market` }
  else if (trend90d >= -0.03){ score = 0.3; note = `${(trend90d * 100).toFixed(1)}% 90d trend — mild price softening` }
  else                        { score = 0.2; note = `${(trend90d * 100).toFixed(1)}% 90d trend — market declining` }

  return { score, note }
}

// ── Core calculator ───────────────────────────────────────────────────────────

/**
 * Calculate the full Pricing Position Score.
 *
 * @example
 *   calculatePPS({
 *     list_price: 350000, aire_estimate: 340000,
 *     sold_last_30_days: 8, active_listings_in_zip: 22,
 *     compete_score: 68, competing_listings: 4,
 *     price_reductions: 1, neighborhood_price_trend_90d_pct: 0.025,
 *   })
 */
export function calculatePPS(inputs: PPSInputs): PPSResult {
  const pricingFit = scorePricingFit(inputs.list_price, inputs.aire_estimate)
  const demandStrength = scoreDemandStrength(
    inputs.sold_last_30_days,
    inputs.active_listings_in_zip,
    inputs.compete_score
  )
  const conditionMatch = scoreConditionMatch(inputs.bps_interior_finish, inputs.bps_modernity)
  const competitionRelief = scoreCompetitionRelief(inputs.competing_listings)
  const sellerFlex = scoreSellerFlexibility(
    inputs.price_reductions,
    inputs.price_reduction_pct,
    inputs.list_price,
    inputs.aire_estimate
  )
  const momentum = scoreMomentum(inputs.neighborhood_price_trend_90d_pct)

  // Weighted sum → 0–100
  const pps_total = parseFloat((
    35 * pricingFit.score +
    20 * demandStrength.score +
    15 * conditionMatch.score +
    10 * competitionRelief.score +
    10 * sellerFlex.score +
    10 * momentum.score
  ).toFixed(2))

  return {
    pps_total,
    pps_pricing_fit: pricingFit.score,
    pps_demand_strength: demandStrength.score,
    pps_condition_match: conditionMatch.score,
    pps_competition_relief: competitionRelief.score,
    pps_seller_flexibility: sellerFlex.score,
    pps_momentum: momentum.score,
    reason_codes: [
      { factor: 'PricingFit',        score: pricingFit.score,        note: pricingFit.note },
      { factor: 'DemandStrength',    score: demandStrength.score,    note: demandStrength.note },
      { factor: 'ConditionMatch',    score: conditionMatch.score,    note: conditionMatch.note },
      { factor: 'CompetitionRelief', score: competitionRelief.score, note: competitionRelief.note },
      { factor: 'SellerFlexibility', score: sellerFlex.score,        note: sellerFlex.note },
      { factor: 'Momentum',          score: momentum.score,          note: momentum.note },
    ],
  }
}
