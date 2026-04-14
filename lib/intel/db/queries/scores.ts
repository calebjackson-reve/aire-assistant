/**
 * AIRE — Score query functions
 * Scores are APPEND-ONLY — never update a row, always insert a new one.
 */

import { query } from '../client'

export interface AireScore {
  id: string
  property_id: string
  score_date: string
  aire_estimate: number | null
  ensemble_weight_mls: number | null
  ensemble_weight_propstream: number | null
  ensemble_weight_zillow: number | null
  ensemble_weight_redfin: number | null
  source_disagreement_pct: number | null
  confidence_tier: 'HIGH' | 'MEDIUM' | 'LOW' | null
  pps_total: number | null
  pps_pricing_fit: number | null
  pps_demand_strength: number | null
  pps_condition_match: number | null
  pps_competition_relief: number | null
  pps_seller_flexibility: number | null
  pps_momentum: number | null
  bps_total: number | null
  bps_curb_appeal: number | null
  bps_interior_finish: number | null
  bps_layout_flow: number | null
  bps_lighting: number | null
  bps_cleanliness_staging: number | null
  bps_modernity: number | null
  bps_photo_presentation: number | null
  uri_score: number | null
  uri_expected_value_lift: number | null
  uri_upgrade_cost: number | null
  uri_confidence_factor: number | null
  uri_appraiser_support_factor: number | null
  assessor_gap_pct: number | null
  reason_codes: Array<{ factor: string; score: number; note: string }> | null
  is_manually_reviewed: boolean
  reviewed_by: string | null
  review_notes: string | null
  job_run_id: string | null
  created_at: Date
}

export interface ScoreInsert {
  property_id: string
  score_date: string
  aire_estimate?: number
  ensemble_weight_mls?: number
  ensemble_weight_propstream?: number
  ensemble_weight_zillow?: number
  ensemble_weight_redfin?: number
  source_disagreement_pct?: number
  confidence_tier?: 'HIGH' | 'MEDIUM' | 'LOW'
  pps_total?: number
  pps_pricing_fit?: number
  pps_demand_strength?: number
  pps_condition_match?: number
  pps_competition_relief?: number
  pps_seller_flexibility?: number
  pps_momentum?: number
  uri_score?: number
  uri_expected_value_lift?: number
  uri_upgrade_cost?: number
  uri_confidence_factor?: number
  uri_appraiser_support_factor?: number
  assessor_gap_pct?: number
  reason_codes?: Array<{ factor: string; score: number; note: string }>
  job_run_id?: string
}

// ── Writes ────────────────────────────────────────────────────────────────────

export async function insertScore(s: ScoreInsert): Promise<AireScore> {
  const { rows } = await query<AireScore>(
    `INSERT INTO aire_scores (
       property_id, score_date,
       aire_estimate,
       ensemble_weight_mls, ensemble_weight_propstream,
       ensemble_weight_zillow, ensemble_weight_redfin,
       source_disagreement_pct, confidence_tier,
       pps_total, pps_pricing_fit, pps_demand_strength,
       pps_condition_match, pps_competition_relief,
       pps_seller_flexibility, pps_momentum,
       uri_score, uri_expected_value_lift, uri_upgrade_cost,
       uri_confidence_factor, uri_appraiser_support_factor,
       assessor_gap_pct, reason_codes, job_run_id
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
       $13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24
     ) RETURNING *`,
    [
      s.property_id, s.score_date,
      s.aire_estimate ?? null,
      s.ensemble_weight_mls ?? null, s.ensemble_weight_propstream ?? null,
      s.ensemble_weight_zillow ?? null, s.ensemble_weight_redfin ?? null,
      s.source_disagreement_pct ?? null, s.confidence_tier ?? null,
      s.pps_total ?? null, s.pps_pricing_fit ?? null, s.pps_demand_strength ?? null,
      s.pps_condition_match ?? null, s.pps_competition_relief ?? null,
      s.pps_seller_flexibility ?? null, s.pps_momentum ?? null,
      s.uri_score ?? null, s.uri_expected_value_lift ?? null, s.uri_upgrade_cost ?? null,
      s.uri_confidence_factor ?? null, s.uri_appraiser_support_factor ?? null,
      s.assessor_gap_pct ?? null,
      s.reason_codes ? JSON.stringify(s.reason_codes) : null,
      s.job_run_id ?? null,
    ]
  )
  return rows[0]
}

/** Save BPS sub-scores from admin review form. Creates a new row. */
export async function insertBpsReview(opts: {
  propertyId: string
  reviewedBy: string
  reviewNotes?: string
  bpsCurbAppeal: number
  bpsInteriorFinish: number
  bpsLayoutFlow: number
  bpsLighting: number
  bpsCleanlinessStaging: number
  bpsModernity: number
  bpsPhotoPresentation: number
}): Promise<AireScore> {
  // BPS = weighted sum per Section 5
  const bpsTotal =
    opts.bpsCurbAppeal * 0.20 +
    opts.bpsInteriorFinish * 0.20 +
    opts.bpsLayoutFlow * 0.15 +
    opts.bpsLighting * 0.10 +
    opts.bpsCleanlinessStaging * 0.10 +
    opts.bpsModernity * 0.10 +
    opts.bpsPhotoPresentation * 0.15

  const { rows } = await query<AireScore>(
    `INSERT INTO aire_scores (
       property_id, score_date,
       bps_total, bps_curb_appeal, bps_interior_finish, bps_layout_flow,
       bps_lighting, bps_cleanliness_staging, bps_modernity, bps_photo_presentation,
       is_manually_reviewed, reviewed_by, review_notes
     ) VALUES (
       $1, CURRENT_DATE,
       $2,$3,$4,$5,$6,$7,$8,$9,
       TRUE, $10, $11
     ) RETURNING *`,
    [
      opts.propertyId,
      bpsTotal.toFixed(2),
      opts.bpsCurbAppeal, opts.bpsInteriorFinish, opts.bpsLayoutFlow,
      opts.bpsLighting, opts.bpsCleanlinessStaging, opts.bpsModernity, opts.bpsPhotoPresentation,
      opts.reviewedBy, opts.reviewNotes ?? null,
    ]
  )
  return rows[0]
}

// ── Reads ─────────────────────────────────────────────────────────────────────

export async function getLatestScore(propertyId: string): Promise<AireScore | null> {
  const { rows } = await query<AireScore>(
    `SELECT * FROM aire_scores
     WHERE property_id = $1
     ORDER BY score_date DESC, created_at DESC
     LIMIT 1`,
    [propertyId]
  )
  return rows[0] ?? null
}

export async function getLowConfidenceProperties(limit = 50): Promise<Array<{
  property_id: string
  address_canonical: string
  source_disagreement_pct: number
  confidence_tier: string
  aire_estimate: number | null
  score_date: string
}>> {
  const { rows } = await query(
    `SELECT DISTINCT ON (s.property_id)
       s.property_id,
       p.address_canonical,
       s.source_disagreement_pct,
       s.confidence_tier,
       s.aire_estimate,
       s.score_date
     FROM aire_scores s
     JOIN properties_clean p ON p.property_id = s.property_id
     WHERE s.confidence_tier = 'LOW'
       AND s.is_manually_reviewed = FALSE
     ORDER BY s.property_id, s.score_date DESC
     LIMIT $1`,
    [limit]
  )
  return rows as never
}

export async function getAverageAireScore(zip?: string): Promise<number | null> {
  const { rows } = await query<{ avg: string }>(
    zip
      ? `SELECT AVG(s.pps_total) as avg
         FROM aire_scores s
         JOIN properties_clean p ON p.property_id = s.property_id
         WHERE p.zip = $1
           AND s.pps_total IS NOT NULL
           AND s.score_date >= CURRENT_DATE - INTERVAL '7 days'`
      : `SELECT AVG(pps_total) as avg FROM aire_scores
         WHERE pps_total IS NOT NULL
           AND score_date >= CURRENT_DATE - INTERVAL '7 days'`,
    zip ? [zip] : undefined
  )
  const avg = parseFloat(rows[0]?.avg ?? '')
  return isNaN(avg) ? null : avg
}
