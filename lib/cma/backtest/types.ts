/**
 * Shared types for the AIRE CMA backtest pipeline.
 *
 * Backtest architecture:
 *   1) For each saved CMA in Paragon (28 total, 23 with comps):
 *      - Capture Caleb's subject + recommended list price (Path B scraper)
 *      - Capture the comp set (already done — saved_cmas/*.json)
 *   2) For each subject: look up actual MLS sold price + concessions
 *   3) For each subject: fetch PropStream AVM + Zillow Zestimate
 *   4) Run AIRE ensemble against the same comp set + market context
 *   5) Compare all four predictions vs actual sold → compute accuracy metrics
 *
 * Ground-truth sources:
 *   - MLS closed sold price (primary)
 *   - Appraisal reports from local PDFs (Pecan Island) — secondary cross-val
 *   - Caleb's own past commercial CMAs (Plank Rd BPO) — cross-val
 */

export interface BacktestSubject {
  cmaId: string
  cmaName: string
  cmaLastUpdated: string | null

  /** Subject property MLS# as recorded in the saved-CMA index. */
  subjectMls: string
  subjectAddress: string | null
  subjectCity: string | null
  subjectZip: string | null
  subjectSubdivision: string | null
  subjectBeds: number | null
  subjectBaths: number | null
  subjectSqft: number | null
  subjectYearBuilt: number | null
  subjectLotAcres: number | null
  subjectFloodZone: "X" | "A" | "AE" | "VE" | "unknown" | null
}

export interface BacktestPredictions {
  /** Caleb's recommended list price from his saved CMA (scraped from Paragon wizard). */
  calebRecommendedList: number | null

  /** Caleb's recommended sold range (low/high) if present in wizard. */
  calebRecommendedLow: number | null
  calebRecommendedHigh: number | null

  /** AIRE ensemble's prediction using the same comp set + weights. */
  aireEnsembleEstimate: number | null

  /** AIRE confidence score (HIGH / MEDIUM / LOW per adjuster-constants DEGRADATION_BANDS). */
  aireConfidence: "HIGH" | "MEDIUM" | "LOW" | null

  /** Source diversity — how many sources responded. */
  aireSourcesContributed: number

  /** PropStream current AVM (proxy — marked as "current", not at-time-of-CMA). */
  propstreamAvm: number | null
  propstreamAvmCapturedAt: string | null

  /** Zillow Zestimate at most recent fetch (may be post-sale, marked as such). */
  zillowZestimate: number | null
  zillowZestimateCapturedAt: string | null

  /** Appraiser's opinion of value if local appraisal PDF exists. */
  appraiserOpinion: number | null
  appraiserSource: string | null
  appraisalDate: string | null
}

export interface BacktestOutcome {
  /** Did the subject actually go on market and close? */
  listed: boolean
  closed: boolean

  /** Actual MLS close data (populated if closed=true). */
  actualListPrice: number | null
  actualSoldPrice: number | null
  actualSoldDate: string | null
  actualConcessionsToBuyer: number | null
  actualDaysOnMarket: number | null

  /** If subject expired or was withdrawn without closing, capture that. */
  statusIfNotClosed: "Active" | "Pending" | "Expired" | "Withdrawn" | "Cancelled" | null

  /** Data quality flag — did we confirm via MLS lookup or just assume? */
  outcomeConfirmedVia: "mls_scrape" | "manual" | "not_found" | null
}

export interface BacktestMetrics {
  /** Error = prediction - actualSoldPrice (positive = over-predicted). */
  calebErrorDollars: number | null
  calebErrorPercent: number | null
  aireErrorDollars: number | null
  aireErrorPercent: number | null
  propstreamErrorDollars: number | null
  propstreamErrorPercent: number | null
  zillowErrorDollars: number | null
  zillowErrorPercent: number | null

  /** Winner: which source was closest to actual? */
  winner: "caleb" | "aire" | "propstream" | "zillow" | "appraiser" | "tie" | null

  /** Flagged for manual review? */
  flaggedForReview: boolean
  flagReasons: string[]
}

export interface BacktestRow {
  subject: BacktestSubject
  predictions: BacktestPredictions
  outcome: BacktestOutcome
  metrics: BacktestMetrics

  /** Paths to raw source artifacts for audit. */
  artifacts: {
    savedCmaCompSet: string | null       // lib/cma/scrapers/snapshots/mls_paragon/saved_cmas/cma_*.json
    scrapedSubjectSnapshot: string | null // lib/cma/backtest/cma_data/*.json
    localAppraisalPdf: string | null     // if matched in local_pdf_matches
    localCmaPdf: string | null           // if matched
    screenshotPath: string | null
  }

  generatedAt: string
  pipelineVersion: string
}

export interface BacktestBatchSummary {
  runStartedAt: string
  runEndedAt: string
  totalCMAs: number
  withComps: number
  withSubject: number
  withOutcome: number
  withAireEnsemble: number
  withPropstream: number
  withZillow: number
  withAppraisal: number

  /** Per-source aggregate accuracy. */
  calebMAE: number | null
  calebMAPE: number | null
  aireMAE: number | null
  aireMAPE: number | null
  propstreamMAE: number | null
  propstreamMAPE: number | null
  zillowMAE: number | null
  zillowMAPE: number | null

  /** Win counts. */
  wins: Record<"caleb" | "aire" | "propstream" | "zillow" | "appraiser" | "tie", number>

  /** Absolute-dollar distribution. */
  quantiles: {
    p50AireErrorDollars: number | null
    p90AireErrorDollars: number | null
  }
}
