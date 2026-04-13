/**
 * CMA Self-Learning Wrapper
 *
 * Wires scraper events into the existing learning infrastructure.
 * Does NOT rebuild — uses lib/learning/error-memory.ts + circuit-breaker.
 *
 * Scope (Day 2 minimum):
 *   - logScraperFailure() → ErrorMemory, agentName = "cma_scraper_<vendor>"
 *   - writeSuccessSnapshot() → lib/cma/scrapers/snapshots/<vendor>/<slug>.json
 *   - detectSnapshotDrift() → returns drift % between current + previous snapshot
 *
 * Deferred (Day 2.5):
 *   - Auto-regression-test generation after 3 failures on same selector
 *   - Weekly cron analyzer in app/api/cron/learning/
 *   - proposed-tuning.json writer for constant recalibration
 */

import fs from "node:fs/promises"
import path from "node:path"
import { logError, shouldCircuitBreak } from "@/lib/learning/error-memory"

export type ScrapeVendor = "mls_paragon" | "propstream" | "rpr"
export type ScrapeStage = "session_open" | "login_navigate" | "login_submit" | "login_verify" | "search_navigate" | "search_submit" | "results_parse"

const SNAPSHOT_DIR = path.resolve(process.cwd(), "lib/cma/scrapers/snapshots")

function agentName(vendor: ScrapeVendor) {
  return `cma_scraper_${vendor}`
}

function slug(address: string) {
  return address.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")
}

// ── Failure logging ──────────────────────────────────────────────────────

export interface ScraperFailureContext {
  vendor: ScrapeVendor
  stage: ScrapeStage
  selector?: string
  url?: string
  screenshotPath?: string
  subject?: string
}

export async function logScraperFailure(error: Error | string, ctx: ScraperFailureContext) {
  try {
    await logError({
      agentName: agentName(ctx.vendor),
      error,
      context: {
        stage: ctx.stage,
        selector: ctx.selector,
        url: ctx.url,
        screenshotPath: ctx.screenshotPath,
        subject: ctx.subject,
      },
    })
  } catch {
    // Never let learning-logger break the scraper
  }
}

export async function shouldBreakScraper(vendor: ScrapeVendor): Promise<boolean> {
  try {
    return await shouldCircuitBreak(agentName(vendor))
  } catch {
    return false
  }
}

// ── Snapshot writer + drift detector ─────────────────────────────────────

export interface CompShape {
  address: string
  soldPrice: number
  soldDate: string
  sqft?: number
  beds?: number
  baths?: number
  yearBuilt?: number
  distanceMiles?: number
}

export interface SuccessSnapshot {
  vendor: ScrapeVendor
  subject: string
  capturedAt: string
  vendorSuggestedPrice: number | null
  compCount: number
  priceSummary: { min: number; max: number; mean: number; median: number } | null
  sqftSummary: { min: number; max: number; mean: number } | null
  sampleComps: CompShape[] // first 3 for shape diff
}

function computeSummary(values: number[]) {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mean = Math.round(values.reduce((s, v) => s + v, 0) / values.length)
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean,
    median: sorted[Math.floor(sorted.length / 2)],
  }
}

export function buildSnapshot(params: {
  vendor: ScrapeVendor
  subject: string
  vendorSuggestedPrice: number | null
  comps: CompShape[]
}): SuccessSnapshot {
  const prices = params.comps.map(c => c.soldPrice).filter(v => Number.isFinite(v))
  const sqfts = params.comps.map(c => c.sqft).filter((v): v is number => typeof v === "number")
  const priceSummary = computeSummary(prices)
  const sqftSummaryFull = computeSummary(sqfts)
  const sqftSummary = sqftSummaryFull
    ? { min: sqftSummaryFull.min, max: sqftSummaryFull.max, mean: sqftSummaryFull.mean }
    : null
  return {
    vendor: params.vendor,
    subject: params.subject,
    capturedAt: new Date().toISOString(),
    vendorSuggestedPrice: params.vendorSuggestedPrice,
    compCount: params.comps.length,
    priceSummary,
    sqftSummary,
    sampleComps: params.comps.slice(0, 3),
  }
}

export async function writeSuccessSnapshot(snapshot: SuccessSnapshot) {
  const dir = path.join(SNAPSHOT_DIR, snapshot.vendor)
  await fs.mkdir(dir, { recursive: true })
  const file = path.join(dir, `${slug(snapshot.subject)}.json`)
  await fs.writeFile(file, JSON.stringify(snapshot, null, 2), "utf8")
  return file
}

export async function readSnapshot(vendor: ScrapeVendor, subject: string): Promise<SuccessSnapshot | null> {
  try {
    const file = path.join(SNAPSHOT_DIR, vendor, `${slug(subject)}.json`)
    const raw = await fs.readFile(file, "utf8")
    return JSON.parse(raw) as SuccessSnapshot
  } catch {
    return null
  }
}

export interface DriftReport {
  subject: string
  vendor: ScrapeVendor
  previous: SuccessSnapshot
  current: SuccessSnapshot
  compCountDeltaPct: number
  priceMeanDeltaPct: number | null
  sqftMeanDeltaPct: number | null
  driftExceeds5pct: boolean
}

export function detectSnapshotDrift(previous: SuccessSnapshot, current: SuccessSnapshot): DriftReport {
  const countDelta = previous.compCount === 0
    ? 1
    : (current.compCount - previous.compCount) / previous.compCount
  const priceDelta = previous.priceSummary && current.priceSummary
    ? (current.priceSummary.mean - previous.priceSummary.mean) / previous.priceSummary.mean
    : null
  const sqftDelta = previous.sqftSummary && current.sqftSummary
    ? (current.sqftSummary.mean - previous.sqftSummary.mean) / previous.sqftSummary.mean
    : null
  const biggest = Math.max(
    Math.abs(countDelta),
    Math.abs(priceDelta ?? 0),
    Math.abs(sqftDelta ?? 0),
  )
  return {
    subject: current.subject,
    vendor: current.vendor,
    previous,
    current,
    compCountDeltaPct: countDelta,
    priceMeanDeltaPct: priceDelta,
    sqftMeanDeltaPct: sqftDelta,
    driftExceeds5pct: biggest > 0.05,
  }
}
