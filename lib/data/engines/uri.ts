/**
 * AIRE Intelligence — Upgrade ROI Index (URI)
 *
 * Scores the return on investment for property upgrades.
 * URI = (ExpectedValueLift / UpgradeCost) * ConfidenceFactor * AppraiserSupportFactor
 */

interface UpgradeTemplate {
  type: string; label: string
  cost_low: number; cost_high: number
  lift_low: number; lift_high: number
  appraiser_support: number; notes: string
}

export const UPGRADE_TEMPLATES: UpgradeTemplate[] = [
  { type: 'kitchen_refresh', label: 'Kitchen Refresh (paint cabinets, hardware, faucet)', cost_low: 2500, cost_high: 6000, lift_low: 5000, lift_high: 12000, appraiser_support: 0.7, notes: 'High-impact, low-cost. BR buyers heavily weight kitchen condition.' },
  { type: 'kitchen_remodel', label: 'Kitchen Remodel (new cabinets, countertops, appliances)', cost_low: 18000, cost_high: 45000, lift_low: 15000, lift_high: 35000, appraiser_support: 0.65, notes: 'Full remodels rarely recoup 100% in BR market.' },
  { type: 'bathroom_update', label: 'Bathroom Update (vanity, fixtures, tile)', cost_low: 3000, cost_high: 8000, lift_low: 4000, lift_high: 10000, appraiser_support: 0.65, notes: 'Good ROI if current bath is dated.' },
  { type: 'paint_interior', label: 'Interior Paint (neutral palette throughout)', cost_low: 2000, cost_high: 5000, lift_low: 4000, lift_high: 8000, appraiser_support: 0.60, notes: 'Best ROI upgrade per dollar.' },
  { type: 'paint_exterior', label: 'Exterior Paint or Power Wash', cost_low: 1500, cost_high: 4000, lift_low: 3000, lift_high: 7000, appraiser_support: 0.60, notes: 'Curb appeal drives online click-throughs.' },
  { type: 'flooring_lvp', label: 'Replace Carpet with LVP Flooring', cost_low: 4000, cost_high: 10000, lift_low: 6000, lift_high: 15000, appraiser_support: 0.70, notes: 'LVP is the BR market standard.' },
  { type: 'landscaping_basic', label: 'Basic Landscaping (mulch, trim, sod patches)', cost_low: 500, cost_high: 2000, lift_low: 2000, lift_high: 5000, appraiser_support: 0.55, notes: 'Highest URI per dollar.' },
  { type: 'staging', label: 'Professional Staging', cost_low: 1500, cost_high: 3500, lift_low: 5000, lift_high: 12000, appraiser_support: 0.50, notes: 'Reduces DOM significantly.' },
  { type: 'hvac_replace', label: 'HVAC Replacement', cost_low: 6000, cost_high: 12000, lift_low: 4000, lift_high: 8000, appraiser_support: 0.60, notes: 'Prevents deal-kills.' },
  { type: 'roof_repair', label: 'Roof Repair or Replacement', cost_low: 4000, cost_high: 15000, lift_low: 5000, lift_high: 12000, appraiser_support: 0.70, notes: 'Insurance-required in Louisiana.' },
  { type: 'photography', label: 'Professional Real Estate Photography', cost_low: 200, cost_high: 500, lift_low: 3000, lift_high: 8000, appraiser_support: 0.50, notes: 'Highest URI in the list.' },
]

export interface URIInputs {
  upgrade_type: string
  estimated_cost_low: number; estimated_cost_high: number
  expected_value_lift_low: number; expected_value_lift_high: number
  confidence_factor: number
  appraiser_support_factor: number
}

export interface URIResult {
  uri_score: number; upgrade_type: string
  upgrade_cost: number; expected_value_lift: number
  roi_low: number; roi_high: number
  confidence_factor: number; appraiser_support_factor: number
  rating: 'poor' | 'break-even' | 'good' | 'exceptional'
  recommendation: string
  reason_code: { factor: string; score: number; note: string }
}

export function calculateURI(inputs: URIInputs): URIResult {
  const cost_mid = (inputs.estimated_cost_low + inputs.estimated_cost_high) / 2
  const lift_mid = (inputs.expected_value_lift_low + inputs.expected_value_lift_high) / 2
  if (cost_mid <= 0) throw new Error('Upgrade cost must be greater than 0')

  const uri_score = parseFloat(((lift_mid / cost_mid) * inputs.confidence_factor * inputs.appraiser_support_factor).toFixed(3))
  const roi_low = parseFloat((inputs.expected_value_lift_low / inputs.estimated_cost_high).toFixed(3))
  const roi_high = parseFloat((inputs.expected_value_lift_high / inputs.estimated_cost_low).toFixed(3))

  const rating: URIResult['rating'] =
    uri_score < 0.5 ? 'poor' : uri_score < 1.0 ? 'break-even' : uri_score < 2.0 ? 'good' : 'exceptional'

  const recommendations: Record<string, string> = {
    poor: 'Cost likely exceeds return. Consider skipping or lower-cost alternative.',
    'break-even': 'May prevent deal-kills but unlikely to increase net proceeds.',
    good: 'Recommended — seller likely to recoup cost in higher sale price.',
    exceptional: 'Highly recommended — one of the best dollar-for-dollar upgrades available.',
  }

  return {
    uri_score, upgrade_type: inputs.upgrade_type,
    upgrade_cost: Math.round(cost_mid), expected_value_lift: Math.round(lift_mid),
    roi_low, roi_high, confidence_factor: inputs.confidence_factor,
    appraiser_support_factor: inputs.appraiser_support_factor, rating,
    recommendation: recommendations[rating],
    reason_code: {
      factor: `URI_${inputs.upgrade_type}`,
      score: Math.min(uri_score / 2, 1),
      note: `${inputs.upgrade_type}: URI ${uri_score.toFixed(2)} (${rating}) — ${recommendations[rating]}`,
    },
  }
}

export function generateUpgradeRecommendations(
  bpsScores: { curb_appeal?: number | null; interior_finish?: number | null; modernity?: number | null; photo_presentation?: number | null; cleanliness_staging?: number | null },
  confidenceFactor: number = 0.5
): URIResult[] {
  const recommendations: URIResult[] = []
  const weaknesses: Array<{ score: number | null | undefined; upgradeTypes: string[] }> = [
    { score: bpsScores.curb_appeal, upgradeTypes: ['landscaping_basic', 'paint_exterior'] },
    { score: bpsScores.interior_finish, upgradeTypes: ['flooring_lvp', 'paint_interior'] },
    { score: bpsScores.modernity, upgradeTypes: ['kitchen_refresh', 'bathroom_update'] },
    { score: bpsScores.photo_presentation, upgradeTypes: ['photography', 'staging'] },
    { score: bpsScores.cleanliness_staging, upgradeTypes: ['staging'] },
  ]

  const addedTypes = new Set<string>()
  for (const { score, upgradeTypes } of weaknesses) {
    if (score != null && score >= 0.7) continue
    for (const upgradeType of upgradeTypes) {
      if (addedTypes.has(upgradeType)) continue
      addedTypes.add(upgradeType)
      const template = UPGRADE_TEMPLATES.find(t => t.type === upgradeType)
      if (!template) continue
      try {
        recommendations.push(calculateURI({
          upgrade_type: template.type,
          estimated_cost_low: template.cost_low, estimated_cost_high: template.cost_high,
          expected_value_lift_low: template.lift_low, expected_value_lift_high: template.lift_high,
          confidence_factor: confidenceFactor, appraiser_support_factor: template.appraiser_support,
        }))
      } catch { /* skip */ }
    }
  }

  return recommendations.sort((a, b) => b.uri_score - a.uri_score)
}
