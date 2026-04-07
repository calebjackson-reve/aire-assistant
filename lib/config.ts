/**
 * AIRE Platform Configuration Constants
 * Centralized config for values that were previously hardcoded across the codebase.
 */

// ─── AirSign ────────────────────────────────────────────────────
export const AIRSIGN_TOKEN_EXPIRY_DAYS = 14
export const AIRSIGN_ENVELOPE_EXPIRY_DAYS = 30
export const AIRSIGN_FROM_EMAIL = "AirSign <signing@aireintel.org>"

// ─── File Upload Limits (bytes) ─────────────────────────────────
export const UPLOAD_MAX_SIZE = 10 * 1024 * 1024       // 10 MB — document upload
export const EXTRACT_MAX_SIZE = 20 * 1024 * 1024      // 20 MB — document extraction
export const AIRSIGN_MAX_SIZE = 25 * 1024 * 1024      // 25 MB — AirSign PDF upload

// ─── Billing ────────────────────────────────────────────────────
export const PLAN_PRO_PRICE = 97
export const PLAN_INVESTOR_PRICE = 197

// ─── Defaults ───────────────────────────────────────────────────
export const DEFAULT_CITY = "Baton Rouge"
export const DEFAULT_STATE = "LA"
export const DEFAULT_LOCATION = "Baton Rouge, Louisiana"

// ─── Milliseconds helpers ───────────────────────────────────────
export const MS_PER_DAY = 86_400_000
