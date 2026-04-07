import { calculateEnsemble } from '../lib/data/engines/ensemble'
import { calculateDisagreement } from '../lib/data/engines/disagreement'
import { calculatePPS } from '../lib/data/engines/pps'
import { calculateBPS } from '../lib/data/engines/bps'
import { calculateURI, UPGRADE_TEMPLATES } from '../lib/data/engines/uri'
import { normalizeAddress } from '../lib/data/engines/normalize'
import { AIRE_DATA } from '../lib/data/market-data'

let passed = 0
let failed = 0

function test(name: string, fn: () => void) {
  const start = performance.now()
  try {
    fn()
    const ms = (performance.now() - start).toFixed(2)
    console.log(`  ✓ ${name} (${ms}ms)`)
    passed++
  } catch (e) {
    const ms = (performance.now() - start).toFixed(2)
    console.log(`  ✗ ${name} (${ms}ms) — ${e}`)
    failed++
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg)
}

console.log('\n═══ AIRE Scoring Engine Tests ═══\n')

test('Ensemble AVM calculates weighted estimate', () => {
  const r = calculateEnsemble({ mls_cma: 340000, propstream_avm: 355000, zillow_estimate: 338000, redfin_estimate: 342000 })!
  assert(r.aire_estimate > 330000 && r.aire_estimate < 360000, `estimate ${r.aire_estimate} out of range`)
  assert(r.sources_used.length === 4, `expected 4 sources, got ${r.sources_used.length}`)
  assert(r.missing_sources.length === 0, 'expected no missing sources')
})

test('Ensemble handles missing sources with weight redistribution', () => {
  const r = calculateEnsemble({ mls_cma: 340000, zillow_estimate: 338000 })!
  assert(r.sources_used.length === 2, `expected 2 sources`)
  assert(r.missing_sources.includes('propstream'), 'propstream should be missing')
  assert(r.missing_sources.includes('redfin'), 'redfin should be missing')
  assert(r.weights_used.mls > 0.4, 'mls weight should be redistributed higher')
})

test('Ensemble returns null with no data', () => {
  const r = calculateEnsemble({})
  assert(r === null, 'should return null')
})

test('Disagreement detects HIGH confidence', () => {
  const r = calculateDisagreement({ mls_cma: 340000, propstream_avm: 342000, zillow_estimate: 338000, redfin_estimate: 341000 })!
  assert(r.confidence_tier === 'HIGH', `expected HIGH, got ${r.confidence_tier}`)
  assert(!r.flag_for_review, 'should not flag for review')
})

test('Disagreement detects LOW confidence', () => {
  const r = calculateDisagreement({ mls_cma: 300000, propstream_avm: 400000, zillow_estimate: 280000, redfin_estimate: 420000 })!
  assert(r.confidence_tier === 'LOW', `expected LOW, got ${r.confidence_tier}`)
  assert(r.flag_for_review, 'should flag for review')
})

test('PPS calculates 0-100 score', () => {
  const r = calculatePPS({ list_price: 350000, aire_estimate: 345000, sold_last_30_days: 8, active_listings_in_zip: 22, competing_listings: 4, price_reductions: 1 })
  assert(r.pps_total >= 0 && r.pps_total <= 100, `PPS ${r.pps_total} out of 0-100 range`)
  assert(r.reason_codes.length === 6, `expected 6 factors, got ${r.reason_codes.length}`)
})

test('PPS penalizes overpriced listings', () => {
  const good = calculatePPS({ list_price: 350000, aire_estimate: 348000, sold_last_30_days: 8, active_listings_in_zip: 22, competing_listings: 4, price_reductions: 0 })
  const bad = calculatePPS({ list_price: 450000, aire_estimate: 348000, sold_last_30_days: 8, active_listings_in_zip: 22, competing_listings: 4, price_reductions: 0 })
  assert(good.pps_total > bad.pps_total, `well-priced (${good.pps_total}) should score higher than overpriced (${bad.pps_total})`)
})

test('BPS calculates with partial inputs', () => {
  const r = calculateBPS({ curb_appeal: 0.8, interior_finish: 0.7 })
  assert(r.is_partial, 'should be partial')
  assert(r.bps_total > 0, 'should have a score')
  assert(r.missing_fields.length === 5, `expected 5 missing, got ${r.missing_fields.length}`)
})

test('URI calculates upgrade ROI', () => {
  const r = calculateURI({
    upgrade_type: 'paint_interior', estimated_cost_low: 2000, estimated_cost_high: 5000,
    expected_value_lift_low: 4000, expected_value_lift_high: 8000,
    confidence_factor: 0.75, appraiser_support_factor: 0.6,
  })
  assert(r.uri_score > 0, 'URI should be positive')
  assert(['poor', 'break-even', 'good', 'exceptional'].includes(r.rating), `invalid rating: ${r.rating}`)
})

test('URI templates has 11 upgrade types', () => {
  assert(UPGRADE_TEMPLATES.length === 11, `expected 11 templates, got ${UPGRADE_TEMPLATES.length}`)
})

test('Address normalization produces stable property_id', () => {
  const r1 = normalizeAddress('123 N. Oak Drive, Baton Rouge, LA 70816')!
  const r2 = normalizeAddress('123 North Oak Dr, Baton Rouge LA 70816')!
  assert(r1.property_id === r2.property_id, `IDs should match: ${r1.property_id} vs ${r2.property_id}`)
  assert(r1.parish === 'EBR', `parish should be EBR, got ${r1.parish}`)
})

test('Address normalization handles unit numbers', () => {
  const r = normalizeAddress('456 Main St Apt 2B, Zachary, LA 70791')!
  assert(r.unit !== null, 'should extract unit')
  assert(!r.property_id.includes('apt'), 'property_id should not include unit')
})

test('AIRE_DATA has 8 neighborhoods', () => {
  assert(AIRE_DATA.markets.length === 8, `expected 8 markets, got ${AIRE_DATA.markets.length}`)
})

test('AIRE_DATA heat scores are 0-100', () => {
  for (const m of AIRE_DATA.markets) {
    assert(m.heatScore >= 0 && m.heatScore <= 100, `${m.name} heat ${m.heatScore} out of range`)
  }
})

test('Metro data is populated', () => {
  assert(AIRE_DATA.metro.medianPrice > 200000, 'median price too low')
  assert(AIRE_DATA.metro.dom > 0, 'DOM should be positive')
})

console.log(`\n═══ Results: ${passed} passed, ${failed} failed ═══\n`)
process.exit(failed > 0 ? 1 : 0)
