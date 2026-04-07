/**
 * AIRE Intelligence — Pricing Position Score (PPS)
 *
 * Measures how well-positioned a listing is to sell.
 * Score: 0–100. Higher = better positioned.
 *
 * FORMULA:
 *   PPS = (35 * PricingFit + 20 * DemandStrength + 15 * ConditionMatch +
 *          10 * CompetitionRelief + 10 * SellerFlexibility + 10 * Momentum)
 */

export interface PPSInputs {
  list_price: number
  aire_estimate: number
  sold_last_30_days: number
  active_listings_in_zip: number
  compete_score?: number | null
  bps_interior_finish?: number | null
  bps_modernity?: number | null
  competing_listings: number
  price_reductions: number
  price_reduction_pct?: number | null
  neighborhood_price_trend_90d_pct?: number | null
}

export interface PPSResult {
  pps_total: number
  pps_pricing_fit: number
  pps_demand_strength: number
  pps_condition_match: number
  pps_competition_relief: number
  pps_seller_flexibility: number
  pps_momentum: number
  reason_codes: Array<{ factor: string; score: number; note: string }>
}

function scorePricingFit(listPrice: number, aireEstimate: number): { score: number; note: string } {
  const pctDiff = Math.abs(listPrice - aireEstimate) / aireEstimate
  const overUnder = listPrice > aireEstimate ? 'overpriced' : 'underpriced'
  const pctStr = `${(pctDiff * 100).toFixed(1)}%`

  if (pctDiff <= 0.02) return { score: 1.0, note: `List price within 2% of AIRE estimate — optimal pricing` }
  if (pctDiff <= 0.05) return { score: 0.8, note: `List price ${pctStr} ${overUnder} — strong position` }
  if (pctDiff <= 0.10) return { score: 0.5, note: `List price ${pctStr} ${overUnder} — moderate risk` }
  if (pctDiff <= 0.15) return { score: 0.3, note: `List price ${pctStr} ${overUnder} — high risk of extended DOM` }
  return { score: 0.1, note: `List price ${pctStr} ${overUnder} — significant repricing likely needed` }
}

function scoreDemandStrength(sold30d: number, activeListings: number, competeScore?: number | null): { score: number; note: string } {
  const absorption = activeListings > 0 ? sold30d / activeListings : 0
  const absorptionScore = Math.min(absorption / 0.5, 1.0)

  let blended: number
  if (competeScore != null) {
    blended = absorptionScore * 0.6 + (competeScore / 100) * 0.4
  } else {
    blended = absorptionScore
  }

  const note = competeScore != null
    ? `Absorption rate: ${(absorption * 100).toFixed(0)}% | Compete score: ${competeScore}/100`
    : `Absorption rate: ${(absorption * 100).toFixed(0)}% (${sold30d} sold / ${activeListings} active)`

  return { score: parseFloat(blended.toFixed(3)), note }
}

function scoreConditionMatch(bpsInteriorFinish?: number | null, bpsModernity?: number | null): { score: number; note: string } {
  if (bpsInteriorFinish != null && bpsModernity != null) {
    const score = (bpsInteriorFinish + bpsModernity) / 2
    return { score: parseFloat(score.toFixed(3)), note: `BPS interior finish: ${bpsInteriorFinish.toFixed(2)} | modernity: ${bpsModernity.toFixed(2)}` }
  }
  if (bpsInteriorFinish != null) {
    return { score: bpsInteriorFinish, note: `BPS interior finish: ${bpsInteriorFinish.toFixed(2)} (modernity not yet reviewed)` }
  }
  return { score: 0.5, note: 'BPS review pending — using neutral 0.5 default' }
}

function scoreCompetitionRelief(competing: number): { score: number; note: string } {
  if (competing === 0) return { score: 1.0, note: 'No direct competing listings — excellent positioning' }
  if (competing <= 3) return { score: 0.8, note: `${competing} competing listings — low competition` }
  if (competing <= 8) return { score: 0.6, note: `${competing} competing listings — moderate competition` }
  if (competing <= 15) return { score: 0.4, note: `${competing} competing listings — elevated competition` }
  return { score: 0.2, note: `${competing} competing listings — saturated segment` }
}

function scoreSellerFlexibility(priceReductions: number, priceReductionPct?: number | null, listPrice?: number, aireEstimate?: number): { score: number; note: string } {
  const isSignificantlyOverpriced = listPrice && aireEstimate
    ? (listPrice - aireEstimate) / aireEstimate > 0.10
    : false

  if (isSignificantlyOverpriced) return { score: 0.2, note: 'Overpriced >10% — flexibility signals undermined' }
  if (priceReductions === 0) return { score: 0.5, note: 'No price reductions — neutral signal' }

  const reductionStr = priceReductionPct != null
    ? `${(priceReductionPct * 100).toFixed(1)}% total reduction`
    : `${priceReductions} reduction(s)`

  return { score: 0.7, note: `${reductionStr} — seller showing flexibility` }
}

function scoreMomentum(trend90d?: number | null): { score: number; note: string } {
  if (trend90d == null) return { score: 0.5, note: 'Neighborhood trend data unavailable — neutral' }
  if (trend90d > 0.03) return { score: 1.0, note: `+${(trend90d * 100).toFixed(1)}% 90d trend — strong appreciation momentum` }
  if (trend90d > 0.01) return { score: 0.8, note: `+${(trend90d * 100).toFixed(1)}% 90d trend — positive momentum` }
  if (trend90d >= -0.01) return { score: 0.5, note: `${(trend90d * 100).toFixed(1)}% 90d trend — stable market` }
  if (trend90d >= -0.03) return { score: 0.3, note: `${(trend90d * 100).toFixed(1)}% 90d trend — mild price softening` }
  return { score: 0.2, note: `${(trend90d * 100).toFixed(1)}% 90d trend — market declining` }
}

export function calculatePPS(inputs: PPSInputs): PPSResult {
  const pricingFit = scorePricingFit(inputs.list_price, inputs.aire_estimate)
  const demandStrength = scoreDemandStrength(inputs.sold_last_30_days, inputs.active_listings_in_zip, inputs.compete_score)
  const conditionMatch = scoreConditionMatch(inputs.bps_interior_finish, inputs.bps_modernity)
  const competitionRelief = scoreCompetitionRelief(inputs.competing_listings)
  const sellerFlex = scoreSellerFlexibility(inputs.price_reductions, inputs.price_reduction_pct, inputs.list_price, inputs.aire_estimate)
  const momentum = scoreMomentum(inputs.neighborhood_price_trend_90d_pct)

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
      { factor: 'PricingFit', score: pricingFit.score, note: pricingFit.note },
      { factor: 'DemandStrength', score: demandStrength.score, note: demandStrength.note },
      { factor: 'ConditionMatch', score: conditionMatch.score, note: conditionMatch.note },
      { factor: 'CompetitionRelief', score: competitionRelief.score, note: competitionRelief.note },
      { factor: 'SellerFlexibility', score: sellerFlex.score, note: sellerFlex.note },
      { factor: 'Momentum', score: momentum.score, note: momentum.note },
    ],
  }
}
