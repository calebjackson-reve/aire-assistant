/**
 * AIRE Intelligence — Upgrade ROI Index (URI)
 *
 * Scores the return on investment for property upgrades.
 * Used to recommend which upgrades Caleb should advise sellers to make
 * before listing, and what dollar value lift to expect.
 *
 * FORMULA:
 *   URI = (ExpectedValueLift / UpgradeCost) * ConfidenceFactor * AppraiserSupportFactor
 *
 * FACTOR DEFINITIONS:
 *   ExpectedValueLift — estimated $ increase in sale price from the upgrade
 *   UpgradeCost       — midpoint of (cost_low + cost_high)
 *   ConfidenceFactor:
 *     0.50 = estimate only (no contractor involved)
 *     0.75 = contractor quote obtained
 *     1.00 = verified (work completed, appraiser confirmed)
 *   AppraiserSupportFactor:
 *     0.60 = typical BR market — appraisers often don't give full credit
 *     0.80 = strong comp support for this upgrade in neighborhood
 *     1.00 = confirmed by appraiser on comparable sale
 *
 * URI INTERPRETATION:
 *   < 0.5  → Poor ROI — cost exceeds likely return
 *   0.5–1.0 → Break-even to modest return
 *   1.0–2.0 → Good ROI — seller will likely recoup cost
 *   > 2.0  → Exceptional ROI — highly recommended
 */

// ── Upgrade lookup table ──────────────────────────────────────────────────────
// Baton Rouge market calibrated estimates (update quarterly from sold comp data)
// cost_low/high in dollars; lift_low/high = expected sale price increase

interface UpgradeTemplate {
  type: string
  label: string
  cost_low: number
  cost_high: number
  lift_low: number
  lift_high: number
  appraiser_support: number  // default AppraiserSupportFactor for this upgrade type
  notes: string
}

export const UPGRADE_TEMPLATES: UpgradeTemplate[] = [
  {
    type: 'kitchen_refresh',
    label: 'Kitchen Refresh (paint cabinets, hardware, faucet)',
    cost_low: 2500, cost_high: 6000,
    lift_low: 5000, lift_high: 12000,
    appraiser_support: 0.7,
    notes: 'High-impact, low-cost. BR buyers heavily weight kitchen condition.',
  },
  {
    type: 'kitchen_remodel',
    label: 'Kitchen Remodel (new cabinets, countertops, appliances)',
    cost_low: 18000, cost_high: 45000,
    lift_low: 15000, lift_high: 35000,
    appraiser_support: 0.65,
    notes: 'Full remodels rarely recoup 100% in BR market. Focus on cabinet refacing instead.',
  },
  {
    type: 'bathroom_update',
    label: 'Bathroom Update (vanity, fixtures, tile)',
    cost_low: 3000, cost_high: 8000,
    lift_low: 4000, lift_high: 10000,
    appraiser_support: 0.65,
    notes: 'Good ROI if current bath is dated. Buyers notice bathroom condition immediately.',
  },
  {
    type: 'paint_interior',
    label: 'Interior Paint (neutral palette throughout)',
    cost_low: 2000, cost_high: 5000,
    lift_low: 4000, lift_high: 8000,
    appraiser_support: 0.60,
    notes: 'Best ROI upgrade per dollar. Fresh neutral paint removes negotiating ammunition.',
  },
  {
    type: 'paint_exterior',
    label: 'Exterior Paint or Power Wash',
    cost_low: 1500, cost_high: 4000,
    lift_low: 3000, lift_high: 7000,
    appraiser_support: 0.60,
    notes: 'Curb appeal drives online click-throughs. Critical for Louisiana heat/humidity damage.',
  },
  {
    type: 'flooring_lvp',
    label: 'Replace Carpet with LVP Flooring',
    cost_low: 4000, cost_high: 10000,
    lift_low: 6000, lift_high: 15000,
    appraiser_support: 0.70,
    notes: 'Stained or dated carpet is a common buyer objection. LVP is the BR market standard.',
  },
  {
    type: 'landscaping_basic',
    label: 'Basic Landscaping (mulch, trim, sod patches)',
    cost_low: 500, cost_high: 2000,
    lift_low: 2000, lift_high: 5000,
    appraiser_support: 0.55,
    notes: 'Highest URI per dollar. Appraisers give limited credit but buyer perception is high.',
  },
  {
    type: 'staging',
    label: 'Professional Staging',
    cost_low: 1500, cost_high: 3500,
    lift_low: 5000, lift_high: 12000,
    appraiser_support: 0.50,
    notes: 'Reduces DOM significantly. Staged homes sell 10-15% faster in BR data.',
  },
  {
    type: 'hvac_replace',
    label: 'HVAC Replacement',
    cost_low: 6000, cost_high: 12000,
    lift_low: 4000, lift_high: 8000,
    appraiser_support: 0.60,
    notes: 'Necessary for inspection but rarely full-value recoup. Prevents deal-kills.',
  },
  {
    type: 'roof_repair',
    label: 'Roof Repair or Replacement',
    cost_low: 4000, cost_high: 15000,
    lift_low: 5000, lift_high: 12000,
    appraiser_support: 0.70,
    notes: 'Insurance-required in Louisiana. Buyers and lenders will demand resolution.',
  },
  {
    type: 'photography',
    label: 'Professional Real Estate Photography',
    cost_low: 200, cost_high: 500,
    lift_low: 3000, lift_high: 8000,
    appraiser_support: 0.50,
    notes: 'Highest URI in the list. 95% of buyers search online first. Non-negotiable.',
  },
]

// ── Types ─────────────────────────────────────────────────────────────────────

export interface URIInputs {
  upgrade_type: string
  estimated_cost_low: number
  estimated_cost_high: number
  expected_value_lift_low: number
  expected_value_lift_high: number
  confidence_factor: number      // 0.5 | 0.75 | 1.0
  appraiser_support_factor: number  // 0.6 | 0.8 | 1.0
}

export interface URIResult {
  uri_score: number
  upgrade_type: string
  upgrade_cost: number            // midpoint
  expected_value_lift: number     // midpoint
  roi_low: number                 // lift_low / cost_high
  roi_high: number                // lift_high / cost_low
  confidence_factor: number
  appraiser_support_factor: number
  rating: 'poor' | 'break-even' | 'good' | 'exceptional'
  recommendation: string
  reason_code: { factor: string; score: number; note: string }
}

// ── Core calculator ───────────────────────────────────────────────────────────

/**
 * Calculate URI for a single upgrade.
 *
 * @example
 *   calculateURI({
 *     upgrade_type: 'paint_interior',
 *     estimated_cost_low: 2000, estimated_cost_high: 5000,
 *     expected_value_lift_low: 4000, expected_value_lift_high: 8000,
 *     confidence_factor: 0.75,
 *     appraiser_support_factor: 0.60,
 *   })
 */
export function calculateURI(inputs: URIInputs): URIResult {
  const cost_mid = (inputs.estimated_cost_low + inputs.estimated_cost_high) / 2
  const lift_mid = (inputs.expected_value_lift_low + inputs.expected_value_lift_high) / 2

  if (cost_mid <= 0) {
    throw new Error('Upgrade cost must be greater than 0')
  }

  // URI = (ExpectedValueLift / UpgradeCost) * ConfidenceFactor * AppraiserSupportFactor
  const uri_score = parseFloat(
    ((lift_mid / cost_mid) * inputs.confidence_factor * inputs.appraiser_support_factor).toFixed(3)
  )

  const roi_low = parseFloat((inputs.expected_value_lift_low / inputs.estimated_cost_high).toFixed(3))
  const roi_high = parseFloat((inputs.expected_value_lift_high / inputs.estimated_cost_low).toFixed(3))

  const rating: URIResult['rating'] =
    uri_score < 0.5  ? 'poor' :
    uri_score < 1.0  ? 'break-even' :
    uri_score < 2.0  ? 'good' : 'exceptional'

  const recommendations: Record<string, string> = {
    poor: 'Cost likely exceeds return. Consider skipping or lower-cost alternative.',
    'break-even': 'May prevent deal-kills but unlikely to increase net proceeds.',
    good: 'Recommended — seller likely to recoup cost in higher sale price.',
    exceptional: 'Highly recommended — one of the best dollar-for-dollar upgrades available.',
  }

  return {
    uri_score,
    upgrade_type: inputs.upgrade_type,
    upgrade_cost: Math.round(cost_mid),
    expected_value_lift: Math.round(lift_mid),
    roi_low,
    roi_high,
    confidence_factor: inputs.confidence_factor,
    appraiser_support_factor: inputs.appraiser_support_factor,
    rating,
    recommendation: recommendations[rating],
    reason_code: {
      factor: `URI_${inputs.upgrade_type}`,
      score: Math.min(uri_score / 2, 1),   // normalize for reason_codes array (cap at 1.0)
      note: `${inputs.upgrade_type}: URI ${uri_score.toFixed(2)} (${rating}) — ${recommendations[rating]}`,
    },
  }
}

// ── Batch recommendation generator ───────────────────────────────────────────

/**
 * Generate upgrade recommendations for a property based on BPS scores.
 * Targets the lowest-scoring BPS factors and returns the top upgrades by URI.
 */
export function generateUpgradeRecommendations(
  bpsScores: {
    curb_appeal?: number | null
    interior_finish?: number | null
    modernity?: number | null
    photo_presentation?: number | null
    cleanliness_staging?: number | null
  },
  confidenceFactor: number = 0.5  // default: estimate only, no contractor quote
): URIResult[] {
  const recommendations: URIResult[] = []

  // Map low BPS scores to relevant upgrades
  const weaknesses: Array<{ score: number | null | undefined; upgradeTypes: string[] }> = [
    { score: bpsScores.curb_appeal,        upgradeTypes: ['landscaping_basic', 'paint_exterior'] },
    { score: bpsScores.interior_finish,    upgradeTypes: ['flooring_lvp', 'paint_interior'] },
    { score: bpsScores.modernity,          upgradeTypes: ['kitchen_refresh', 'bathroom_update'] },
    { score: bpsScores.photo_presentation, upgradeTypes: ['photography', 'staging'] },
    { score: bpsScores.cleanliness_staging,upgradeTypes: ['staging'] },
  ]

  const addedTypes = new Set<string>()

  for (const { score, upgradeTypes } of weaknesses) {
    if (score != null && score >= 0.7) continue  // BPS sub-score is fine, skip

    for (const upgradeType of upgradeTypes) {
      if (addedTypes.has(upgradeType)) continue
      addedTypes.add(upgradeType)

      const template = UPGRADE_TEMPLATES.find(t => t.type === upgradeType)
      if (!template) continue

      try {
        const uri = calculateURI({
          upgrade_type: template.type,
          estimated_cost_low: template.cost_low,
          estimated_cost_high: template.cost_high,
          expected_value_lift_low: template.lift_low,
          expected_value_lift_high: template.lift_high,
          confidence_factor: confidenceFactor,
          appraiser_support_factor: template.appraiser_support,
        })
        recommendations.push(uri)
      } catch { /* skip */ }
    }
  }

  // Sort by URI score descending
  return recommendations.sort((a, b) => b.uri_score - a.uri_score)
}
