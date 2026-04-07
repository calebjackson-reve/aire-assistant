/**
 * AIRE Intelligence Data Layer — Barrel Export
 *
 * Unified data layer powering all 7 AIRE agents.
 * Merged from aire-intelligence into aire-assistant.
 */

// Scoring engines (pure functions — no DB dependency)
export { calculateEnsemble, DEFAULT_WEIGHTS } from './engines/ensemble'
export type { EnsembleInputs, EnsembleWeights, EnsembleResult } from './engines/ensemble'

export { calculatePPS } from './engines/pps'
export type { PPSInputs, PPSResult } from './engines/pps'

export { calculateBPS, validateAndNormalizeBPSForm } from './engines/bps'
export type { BPSInputs, BPSResult } from './engines/bps'

export { calculateURI, generateUpgradeRecommendations, UPGRADE_TEMPLATES } from './engines/uri'
export type { URIInputs, URIResult } from './engines/uri'

export { calculateDisagreement, disagreementReasonCode } from './engines/disagreement'
export type { ConfidenceTier, DisagreementResult } from './engines/disagreement'

export { normalizeAddress, isFuzzyMatch, applyFieldMap } from './engines/normalize'
export type { NormalizedAddress } from './engines/normalize'

// Database queries
export { query, checkConnection } from './db/client'
export { findByPropertyId, findActiveByZip, getLatestSnapshot, countActiveListings, countSoldComps } from './db/queries/properties'
export type { PropertyClean, MarketSnapshot } from './db/queries/properties'
export { insertScore, getLatestScore, getLowConfidenceProperties } from './db/queries/scores'
export type { AireScore, ScoreInsert } from './db/queries/scores'

// Static market data
export { AIRE_DATA } from './market-data'
