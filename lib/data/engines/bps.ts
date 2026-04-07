/**
 * AIRE Intelligence — Buyer Perception Score (BPS)
 *
 * Measures how a property will be perceived by buyers on first impression.
 * Score: 0–100. Higher = more appealing to buyers.
 *
 * Sub-scores are INPUT by admin review or AI image analysis.
 * NEVER auto-generate BPS sub-scores without explicit data.
 */

export interface BPSInputs {
  curb_appeal?: number | null
  interior_finish?: number | null
  layout_flow?: number | null
  lighting?: number | null
  cleanliness_staging?: number | null
  modernity?: number | null
  photo_presentation?: number | null
}

export interface BPSResult {
  bps_total: number
  bps_curb_appeal: number
  bps_interior_finish: number
  bps_layout_flow: number
  bps_lighting: number
  bps_cleanliness_staging: number
  bps_modernity: number
  bps_photo_presentation: number
  reason_codes: Array<{ factor: string; score: number; note: string }>
  is_partial: boolean
  missing_fields: string[]
}

const SUB_SCORE_CONFIG: Array<{
  key: keyof BPSInputs; label: string; weight: number
  lowNote: string; midNote: string; highNote: string
}> = [
  { key: 'curb_appeal', label: 'CurbAppeal', weight: 20, lowNote: 'Poor curb appeal — landscaping, paint, or exterior condition needs attention', midNote: 'Average curb appeal — presents acceptably', highNote: 'Exceptional curb appeal — stand-out street presence' },
  { key: 'interior_finish', label: 'InteriorFinish', weight: 20, lowNote: 'Dated or damaged finishes — will affect perceived value and buyer offers', midNote: 'Average finishes — meets buyer expectations in this price band', highNote: 'High-end finishes — granite/quartz counters, hardwood, custom tile' },
  { key: 'layout_flow', label: 'LayoutFlow', weight: 15, lowNote: 'Choppy layout — closed rooms, awkward flow', midNote: 'Functional layout — buyers will accept it', highNote: 'Open-concept, excellent flow — major buyer appeal in BR market' },
  { key: 'photo_presentation', label: 'PhotoPresentation', weight: 15, lowNote: 'Poor listing photos — dark, cluttered, or low resolution', midNote: 'Adequate photos — room coverage but not compelling', highNote: 'Professional photography — bright, wide-angle, staged shots' },
  { key: 'lighting', label: 'Lighting', weight: 10, lowNote: 'Dark interior — small windows or inadequate fixtures', midNote: 'Average lighting — functional', highNote: 'Bright, well-lit throughout — natural light or great fixtures' },
  { key: 'cleanliness_staging', label: 'CleanlinessStaging', weight: 10, lowNote: 'Cluttered or unclean — immediate barrier for buyers', midNote: 'Acceptably clean and organized', highNote: 'Professionally staged or spotlessly presented' },
  { key: 'modernity', label: 'Modernity', weight: 10, lowNote: 'Significantly outdated — original finishes from 1990s or earlier', midNote: 'Partially updated — some modern touches', highNote: 'Fully updated kitchen and baths — buyers will pay a premium' },
]

export function calculateBPS(inputs: BPSInputs): BPSResult {
  const result: Record<string, number> = {}
  const missing_fields: string[] = []
  const reason_codes: Array<{ factor: string; score: number; note: string }> = []
  let weighted_sum = 0

  for (const config of SUB_SCORE_CONFIG) {
    const rawValue = inputs[config.key]
    const isPresent = rawValue != null
    const score = isPresent ? Math.max(0, Math.min(1, rawValue)) : 0.5
    if (!isPresent) missing_fields.push(config.key)

    result[config.key] = score
    weighted_sum += config.weight * score

    const note = !isPresent ? `Not yet reviewed — using neutral 0.5 default`
      : score < 0.35 ? config.lowNote
      : score < 0.65 ? config.midNote
      : config.highNote

    reason_codes.push({ factor: config.label, score, note })
  }

  return {
    bps_total: parseFloat(weighted_sum.toFixed(2)),
    bps_curb_appeal: result.curb_appeal,
    bps_interior_finish: result.interior_finish,
    bps_layout_flow: result.layout_flow,
    bps_lighting: result.lighting,
    bps_cleanliness_staging: result.cleanliness_staging,
    bps_modernity: result.modernity,
    bps_photo_presentation: result.photo_presentation,
    reason_codes,
    is_partial: missing_fields.length > 0,
    missing_fields,
  }
}

export function validateAndNormalizeBPSForm(formData: Record<string, unknown>): {
  valid: boolean; inputs: BPSInputs; errors: string[]
} {
  const errors: string[] = []
  const inputs: BPSInputs = {}
  const fields: (keyof BPSInputs)[] = [
    'curb_appeal', 'interior_finish', 'layout_flow', 'lighting',
    'cleanliness_staging', 'modernity', 'photo_presentation',
  ]

  for (const field of fields) {
    const raw = formData[field]
    if (raw === undefined || raw === null || raw === '') continue

    const n = parseFloat(String(raw))
    if (isNaN(n)) { errors.push(`${field}: must be a number`); continue }

    if (n >= 0 && n <= 1) inputs[field] = n
    else if (n >= 0 && n <= 10) inputs[field] = n / 10
    else errors.push(`${field}: must be between 0 and 10`)
  }

  return { valid: errors.length === 0, inputs, errors }
}
