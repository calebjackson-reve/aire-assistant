/**
 * CMA Adjuster Constants
 *
 * All tunable knobs used by comp-picker + adjuster live here so the
 * recalibration job (scripts/recalibrate-cma.ts) can rewrite this file
 * without touching logic.
 *
 * Recalibration cadence (Caleb, 2026-04-12):
 *   - First 6 months: monthly
 *   - After 2026-10-12: quarterly
 * Flip RECALIBRATION_INTERVAL_DAYS to change — no deploy needed, just a
 * code push; cron reads this constant each run.
 */

// ── Recalibration cadence ────────────────────────────────────────────────

export const RECALIBRATION_LAUNCH_DATE = "2026-04-12"
export const RECALIBRATION_QUARTERLY_FROM = "2026-10-12"

/**
 * Returns the recalibration interval to use RIGHT NOW.
 * Monthly (30) until QUARTERLY_FROM, then quarterly (90).
 * Exposed as a function so the cron picks up the phase change without a deploy.
 */
export function currentRecalibrationIntervalDays(): number {
  const now = Date.now()
  const cutover = Date.parse(RECALIBRATION_QUARTERLY_FROM)
  return now < cutover ? 30 : 90
}

/** Hard default exported for convenience / display in admin UI. */
export const RECALIBRATION_INTERVAL_DAYS = currentRecalibrationIntervalDays()

// ── Similarity weights (comp-picker.ts) ──────────────────────────────────

export const SIMILARITY_WEIGHTS = {
  proximity: 0.30,
  sqft: 0.25,
  recency: 0.15,
  beds: 0.10,
  baths: 0.10,
  yearBuilt: 0.05,
  lotSize: 0.05,
} as const

export const HARD_FILTERS = {
  maxMonthsOld: 12,
  preferredMonthsOld: 6,
  maxMilesDefault: 1.5,
  maxMilesFallback: 3.0,
  minCandidatesBeforeFallback: 4,
  sqftTolerancePct: 0.25,
  bedsTolerance: 1,
}

export const SOURCE_DIVERSITY = {
  maxSingleVendorShare: 0.60, // at most 60% of final set from one vendor
}

// ── Adjustment constants (adjuster.ts) ───────────────────────────────────

export const ADJUSTMENTS = {
  // Sqft: looked up per-zip from market_snapshots; these are fallbacks.
  sqftFallbackUrbanPerSqft: 120,
  sqftFallbackRuralPerSqft: 85,

  bedroomBelow4: 5_000,
  bedroomAtOrAbove4: 8_000,

  fullBath: 7_500,
  halfBath: 3_500,

  lotUrbanPerSqft: 1.50,
  lotRuralPerSqft: 0.75,

  agePerYear: -500,
  agePerYearMaxYears: 30,

  garagePerBay: 6_000,

  pool: 15_000,
  waterfront: 40_000,

  // Condition multipliers (applied after lump-sum adjustments)
  conditionMultipliers: {
    excellent: 1.08,
    good: 1.03,
    average: 1.00,
    fair: 0.95,
    poor: 0.85,
  } as const,

  // Flood zone: if comp in X, subject in AE → subject worth less
  floodZonePenaltyWhenSubjectInAE: -0.03,

  // Net adjustment cap (Fannie/Freddie "net" rule)
  maxNetAdjustmentPct: 0.15,
  overAdjustedWeightPenalty: 0.5,
}

// ── Multi-source ensemble weights (Louisiana-tuned, added 2026-04-13) ───
//
// See lib/cma/SOURCE_INTELLIGENCE.md for the derivation. These weights
// feed calculateEnsemble() as an override when Louisiana tuning is desired.
// The existing DEFAULT_WEIGHTS in lib/data/engines/ensemble.ts remain the
// fallback for non-LA markets.
//
// Recalibration: scripts/recalibrate-cma.ts may rewrite SOURCE_WEIGHTS but
// MUST NOT touch the engine logic in ensemble.ts.

export const SOURCE_WEIGHTS = {
  // Ensemble base weights — sum to 1.0
  mls: 0.45,        // ROAM MLS: sold-price ground truth, agent-verified
  propstream: 0.25, // PropStream: AVM + distressed signals + liens
  rpr: 0.20,        // RPR: confidence-banded AVM + neighborhood context
  zillow: 0.10,     // Zillow: consumer anchor (weakest in LA flood zones)

  // Confidence multipliers applied before ensembling (see ensemble.ts)
  confidenceMultipliers: {
    high: 1.00,
    medium: 0.70,
    low: 0.35,
    missing: 0.00,
  } as const,

  // RPR's native AVM band overrides tier: if ±% > threshold, cap at
  // base × the capMultiplier for that band.
  rprBandThresholds: [
    { maxBandPct: 0.10, capMultiplier: 1.00 },
    { maxBandPct: 0.20, capMultiplier: 0.70 },
    { maxBandPct: 1.00, capMultiplier: 0.35 },
  ] as const,

  // Disagreement policy — if pairwise diff > threshold, reduce lowest-confidence
  // source by lowestConfidencePenalty before finalizing.
  disagreementThresholdPct: 0.15,
  lowestConfidencePenalty: 0.50,

  // Outlier trim on ROAM comps: drop comps > N stddev from median PPSF.
  roamCompStddevTrim: 2.0,
} as const

export type SourceKey = "mls" | "propstream" | "rpr" | "zillow"

// ── Vendor degradation bands (locked 2026-04-12) ─────────────────────────

export const DEGRADATION_BANDS = {
  full: { minVendors: 3, writeToAccuracyLog: true, label: "full" },
  partial: { minVendors: 2, writeToAccuracyLog: true, label: "partial" },
  degraded: { minVendors: 1, writeToAccuracyLog: false, label: "degraded" },
} as const

export type DegradationBand = keyof typeof DEGRADATION_BANDS

export function classifyDegradation(vendorsResponded: number): DegradationBand | null {
  if (vendorsResponded >= 3) return "full"
  if (vendorsResponded === 2) return "partial"
  if (vendorsResponded === 1) return "degraded"
  return null // 0 → hard error upstream
}
