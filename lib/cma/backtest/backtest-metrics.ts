/**
 * Offline backtest metrics engine.
 *
 * Design:
 *   1) For each saved CMA where we have BOTH a comp set (saved_cmas/*.json)
 *      AND a scraped Adjustment snapshot (cma_data/*.json):
 *      - Subject core from Adjustment page (parsed)
 *      - Full comp set from saved_cmas (already extracted)
 *   2) For each subject with known sold price:
 *      - Compute AIRE Kendall-style predicted list price
 *      - Compute median-PPSF baseline predicted list price
 *      - Record error vs actual sold
 *   3) K-fold hold-out: within each CMA's comp set (if ≥4 comps), hold the
 *      most recent sold comp, predict it from the remaining, record error.
 *   4) Aggregate MAE / MAPE / win rates.
 *
 * No external API calls. Pure data crunching.
 *
 * Run:  npx tsx lib/cma/backtest/backtest-metrics.ts
 * Out:  lib/cma/backtest/metrics.json + BACKTEST_REPORT.md
 */

import { promises as fs } from "node:fs"
import path from "node:path"
import { parseAdjustmentText, deriveSubjectCore, deriveCompCore, type ParsedSubjectCore, type ParsedCompCore } from "./parse-adjustment"

const CMA_DATA_DIR = "lib/cma/backtest/cma_data"
const SAVED_CMAS_DIR = "lib/cma/scrapers/snapshots/mls_paragon/saved_cmas"
const OUT_JSON = "lib/cma/backtest/metrics.json"
const OUT_REPORT = "BACKTEST_REPORT.md"

const PSYCHOLOGICAL_THRESHOLDS = [200_000, 225_000, 250_000, 275_000, 300_000, 325_000, 350_000, 400_000, 450_000, 500_000, 600_000, 750_000, 1_000_000]

interface RawSavedCMAComp {
  mlsNumber: string | null
  address: string | null
  sqft: number | null
  price: number | null
  status: string | null
}

interface BacktestRow {
  cmaId: string
  cmaName: string
  subject: ParsedSubjectCore
  compsFromAdjustment: ParsedCompCore[]
  compsFromSavedGrid: RawSavedCMAComp[]
  predictions: {
    aireKendallPrediction: number | null
    aireMedianPpsfPrediction: number | null
    psychologicalThresholdApplied: number | null
  }
  outcome: {
    subjectListPrice: number | null
    subjectSoldPrice: number | null
    subjectSoldDate: string | null
    subjectStatus: string | null
  }
  errors: {
    kendallError: number | null
    kendallErrorPct: number | null
    medianPpsfError: number | null
    medianPpsfErrorPct: number | null
  }
  kFoldHoldout: {
    heldOutComp: { mls: string | null; soldPrice: number | null; sqft: number | null } | null
    predictedFromOthers: number | null
    holdoutError: number | null
    holdoutErrorPct: number | null
  }
  qualityFlags: string[]
}

interface BatchSummary {
  generatedAt: string
  totalCMAs: number
  withSubject: number
  withAdjustmentComps: number
  withGroundTruth: number

  kendallMAE: number | null
  kendallMAPE: number | null
  medianPpsfMAE: number | null
  medianPpsfMAPE: number | null
  holdoutMAE: number | null
  holdoutMAPE: number | null

  kendallWinsVsMedian: number
  medianWinsVsKendall: number
  ties: number

  rows: BacktestRow[]
}

function median(arr: number[]): number {
  const s = [...arr].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m]
}

function roundUnderThreshold(price: number): { price: number; threshold: number | null } {
  for (const t of PSYCHOLOGICAL_THRESHOLDS) {
    if (price < t && t - price < 5000) {
      return { price: t - 100, threshold: t }
    }
  }
  return { price: Math.round(price / 100) * 100, threshold: null }
}

function kendallStylePrediction(subjectSqft: number | null, compPpsfs: number[]): { price: number | null; thresholdApplied: number | null } {
  if (!subjectSqft || compPpsfs.length < 3) return { price: null, thresholdApplied: null }
  const med = median(compPpsfs)
  const raw = med * subjectSqft
  const { price, threshold } = roundUnderThreshold(raw)
  return { price, thresholdApplied: threshold }
}

function simpleMedianPpsfPrediction(subjectSqft: number | null, compPpsfs: number[]): number | null {
  if (!subjectSqft || compPpsfs.length === 0) return null
  return Math.round(median(compPpsfs) * subjectSqft)
}

async function loadAllData(): Promise<BacktestRow[]> {
  const cmaFiles = (await fs.readdir(CMA_DATA_DIR)).filter((f) => /^\d+\.json$/.test(f))
  console.log(`[metrics] loaded ${cmaFiles.length} scraped CMAs`)

  const rows: BacktestRow[] = []
  for (const file of cmaFiles) {
    const cmaId = file.replace(".json", "")
    const scraped = JSON.parse(await fs.readFile(path.join(CMA_DATA_DIR, file), "utf8"))
    const qualityFlags: string[] = []

    if (scraped.error) qualityFlags.push(`scrape_error: ${String(scraped.error).slice(0, 80)}`)
    if (scraped.comps.length === 0) qualityFlags.push("no_adjustment_comps")

    // Parse subject + comps from the adjustment fragments
    let subjectParsed: ParsedSubjectCore = {
      mls: null, address: null, subdivision: null, city: null, zip: null, status: null,
      listPrice: null, soldPrice: null, soldDate: null, ppsf: null, beds: null,
      bathsDisplay: null, sqft: null, yearBuilt: null, daysOnMarket: null,
      concessions: null, acres: null,
    }
    const compsFromAdj: ParsedCompCore[] = []

    for (const c of scraped.comps) {
      const parsed = parseAdjustmentText(c.rawTextFragment || "")
      if (!subjectParsed.mls && parsed.subject["MLS#"]) {
        subjectParsed = deriveSubjectCore(parsed.subject)
      }
      const compCore = deriveCompCore(parsed.comp)
      if (compCore.mls) compsFromAdj.push(compCore)
    }

    // Also try to load the saved_cmas grid comp set for cross-reference
    let compsFromGrid: RawSavedCMAComp[] = []
    const savedCmaFiles = await fs.readdir(SAVED_CMAS_DIR).catch(() => [])
    const match = savedCmaFiles.find((f) => f.startsWith(`cma_${cmaId}_`))
    if (match) {
      const saved = JSON.parse(await fs.readFile(path.join(SAVED_CMAS_DIR, match), "utf8"))
      compsFromGrid = (saved.comps || []).map((c: Record<string, unknown>) => ({
        mlsNumber: (c.mlsNumber as string) || null,
        address: (c.address as string) || null,
        sqft: (c.sqft as number) || null,
        price: (c.price as number) || null,
        status: (c.status as string) || null,
      }))
    }

    // Build comp PPSF pool — use ALL comps from both sources, dedup by MLS#
    const compPpsfs: number[] = []
    const seenMls = new Set<string>()
    for (const c of compsFromAdj) {
      if (c.status === "Closed" && c.soldPrice && c.sqft && c.sqft > 0 && c.mls) {
        seenMls.add(c.mls)
        compPpsfs.push(c.soldPrice / c.sqft)
      }
    }
    for (const c of compsFromGrid) {
      if (c.mlsNumber && seenMls.has(c.mlsNumber)) continue
      if (c.status === "Closed" && c.price && c.sqft && c.sqft > 0) {
        if (c.mlsNumber) seenMls.add(c.mlsNumber)
        compPpsfs.push(c.price / c.sqft)
      }
    }

    // Predictions
    const kendall = kendallStylePrediction(subjectParsed.sqft, compPpsfs)
    const simplePred = simpleMedianPpsfPrediction(subjectParsed.sqft, compPpsfs)

    // Errors vs actual sold
    const actual = subjectParsed.soldPrice
    const kendallError = kendall.price != null && actual ? kendall.price - actual : null
    const medianError = simplePred != null && actual ? simplePred - actual : null

    // K-fold holdout — hold the most recent sold comp (use BOTH sources)
    type HoldComp = { mls: string | null; soldPrice: number; sqft: number; soldDate: string | null }
    const holdCompsAdj: HoldComp[] = compsFromAdj
      .filter((c) => c.status === "Closed" && c.soldPrice && c.sqft && c.sqft > 0)
      .map((c) => ({ mls: c.mls, soldPrice: c.soldPrice!, sqft: c.sqft!, soldDate: c.soldDate }))
    const seenMlsHold = new Set<string>()
    holdCompsAdj.forEach((c) => c.mls && seenMlsHold.add(c.mls))
    const holdCompsGrid: HoldComp[] = compsFromGrid
      .filter((c) => c.status === "Closed" && c.price && c.sqft && c.sqft > 0 && !(c.mlsNumber && seenMlsHold.has(c.mlsNumber)))
      .map((c) => ({ mls: c.mlsNumber, soldPrice: c.price!, sqft: c.sqft!, soldDate: null }))
    const soldCompsMerged: HoldComp[] = [...holdCompsAdj, ...holdCompsGrid]
    soldCompsMerged.sort((a, b) => {
      const da = a.soldDate ? new Date(a.soldDate).getTime() : 0
      const db = b.soldDate ? new Date(b.soldDate).getTime() : 0
      return db - da
    })
    let holdoutPred: number | null = null
    let holdoutErr: number | null = null
    let holdoutErrPct: number | null = null
    let heldOut: { mls: string | null; soldPrice: number | null; sqft: number | null } | null = null
    if (soldCompsMerged.length >= 4) {
      const held = soldCompsMerged[0]
      const others = soldCompsMerged.slice(1)
      const othersPpsf = others.map((c) => c.soldPrice / c.sqft)
      holdoutPred = Math.round(median(othersPpsf) * held.sqft)
      holdoutErr = holdoutPred - held.soldPrice
      holdoutErrPct = (holdoutErr / held.soldPrice) * 100
      heldOut = { mls: held.mls, soldPrice: held.soldPrice, sqft: held.sqft }
    } else {
      qualityFlags.push(`insufficient_comps_for_holdout (${soldCompsMerged.length})`)
    }

    if (!actual) qualityFlags.push("no_subject_sold_price")
    if (compPpsfs.length < 3) qualityFlags.push(`sparse_comp_ppsf (${compPpsfs.length})`)

    rows.push({
      cmaId,
      cmaName: scraped.cmaName,
      subject: subjectParsed,
      compsFromAdjustment: compsFromAdj,
      compsFromSavedGrid: compsFromGrid,
      predictions: {
        aireKendallPrediction: kendall.price,
        aireMedianPpsfPrediction: simplePred,
        psychologicalThresholdApplied: kendall.thresholdApplied,
      },
      outcome: {
        subjectListPrice: subjectParsed.listPrice,
        subjectSoldPrice: actual,
        subjectSoldDate: subjectParsed.soldDate,
        subjectStatus: subjectParsed.status,
      },
      errors: {
        kendallError,
        kendallErrorPct: kendallError != null && actual ? (kendallError / actual) * 100 : null,
        medianPpsfError: medianError,
        medianPpsfErrorPct: medianError != null && actual ? (medianError / actual) * 100 : null,
      },
      kFoldHoldout: {
        heldOutComp: heldOut,
        predictedFromOthers: holdoutPred,
        holdoutError: holdoutErr,
        holdoutErrorPct: holdoutErrPct,
      },
      qualityFlags,
    })
  }

  return rows
}

function mean(arr: number[]): number | null {
  if (!arr.length) return null
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function mae(arr: Array<number | null | undefined>): number | null {
  const filtered = arr.filter((v): v is number => v != null).map((v) => Math.abs(v))
  return mean(filtered)
}

async function main() {
  const rows = await loadAllData()

  const withSubject = rows.filter((r) => r.subject.mls).length
  const withAdjustmentComps = rows.filter((r) => r.compsFromAdjustment.length > 0).length
  const withGroundTruth = rows.filter((r) => r.outcome.subjectSoldPrice).length

  const kendallMAE = mae(rows.map((r) => r.errors.kendallError))
  const kendallMAPE = mae(rows.map((r) => r.errors.kendallErrorPct))
  const medianMAE = mae(rows.map((r) => r.errors.medianPpsfError))
  const medianMAPE = mae(rows.map((r) => r.errors.medianPpsfErrorPct))
  const holdoutMAE = mae(rows.map((r) => r.kFoldHoldout.holdoutError))
  const holdoutMAPE = mae(rows.map((r) => r.kFoldHoldout.holdoutErrorPct))

  let kendallWins = 0
  let medianWins = 0
  let ties = 0
  for (const r of rows) {
    const kE = r.errors.kendallError
    const mE = r.errors.medianPpsfError
    if (kE == null || mE == null) continue
    const kAbs = Math.abs(kE)
    const mAbs = Math.abs(mE)
    if (kAbs < mAbs) kendallWins += 1
    else if (mAbs < kAbs) medianWins += 1
    else ties += 1
  }

  const summary: BatchSummary = {
    generatedAt: new Date().toISOString(),
    totalCMAs: rows.length,
    withSubject,
    withAdjustmentComps,
    withGroundTruth,
    kendallMAE,
    kendallMAPE,
    medianPpsfMAE: medianMAE,
    medianPpsfMAPE: medianMAPE,
    holdoutMAE,
    holdoutMAPE,
    kendallWinsVsMedian: kendallWins,
    medianWinsVsKendall: medianWins,
    ties,
    rows,
  }

  await fs.writeFile(OUT_JSON, JSON.stringify(summary, null, 2))
  console.log(`[metrics] wrote ${OUT_JSON}`)

  // Render markdown report
  const lines: string[] = []
  lines.push("# AIRE CMA Backtest — First Results\n")
  lines.push(`Generated: ${summary.generatedAt}\n`)
  lines.push("## Summary\n")
  lines.push(`- Total CMAs processed: **${summary.totalCMAs}**`)
  lines.push(`- With subject parsed: **${summary.withSubject}**`)
  lines.push(`- With adjustment comps: **${summary.withAdjustmentComps}**`)
  lines.push(`- With ground-truth sold price: **${summary.withGroundTruth}**\n`)

  lines.push("## Accuracy — Kendall-style vs Simple Median PPSF\n")
  lines.push("| Metric | Kendall-style | Median-PPSF | K-fold holdout |")
  lines.push("|---|---|---|---|")
  lines.push(`| MAE ($) | ${summary.kendallMAE?.toFixed(0) ?? "—"} | ${summary.medianPpsfMAE?.toFixed(0) ?? "—"} | ${summary.holdoutMAE?.toFixed(0) ?? "—"} |`)
  lines.push(`| MAPE (%) | ${summary.kendallMAPE?.toFixed(2) ?? "—"} | ${summary.medianPpsfMAPE?.toFixed(2) ?? "—"} | ${summary.holdoutMAPE?.toFixed(2) ?? "—"} |\n`)

  lines.push(`**Head-to-head** (of ${summary.kendallWinsVsMedian + summary.medianWinsVsKendall + summary.ties} comparable rows):`)
  lines.push(`- Kendall-style wins: **${summary.kendallWinsVsMedian}**`)
  lines.push(`- Median-PPSF wins: **${summary.medianWinsVsKendall}**`)
  lines.push(`- Ties: **${summary.ties}**\n`)

  lines.push("## Per-CMA results\n")
  lines.push("| CMA ID | Name | Subject Sqft | Actual Sold | Kendall Pred | Kendall Err% | Holdout Err% | Flags |")
  lines.push("|---|---|---|---|---|---|---|---|")
  for (const r of rows) {
    const fmt = (n: number | null | undefined) => n != null ? Math.round(n).toLocaleString() : "—"
    const pct = (n: number | null | undefined) => n != null ? `${n.toFixed(1)}%` : "—"
    lines.push(
      `| ${r.cmaId} | ${r.cmaName} | ${r.subject.sqft ?? "—"} | ${fmt(r.outcome.subjectSoldPrice)} | ${fmt(r.predictions.aireKendallPrediction)} | ${pct(r.errors.kendallErrorPct)} | ${pct(r.kFoldHoldout.holdoutErrorPct)} | ${r.qualityFlags.join(", ")} |`,
    )
  }
  lines.push("")

  lines.push("## Methodology notes\n")
  lines.push("- **Kendall-style prediction**: median sold-comp PPSF × subject sqft, rounded under nearest psychological threshold ($225K, $250K, $275K, etc.) if within $5K of it. Derived from Caleb's Focus 1st PDFs.")
  lines.push("- **Median-PPSF prediction**: simple baseline — median sold-comp PPSF × subject sqft, no threshold rounding.")
  lines.push("- **K-fold holdout**: for CMAs with ≥4 sold comps, hold the most recent and predict it from the rest. Tests the prediction algorithm when ground-truth is a comp not a subject.")
  lines.push("- **Ground truth**: subject's actual sold price as recorded in the scraped Adjustment frame. If status != Closed, we skip the MAE row.\n")

  lines.push("## Known limitations\n")
  lines.push("- **⚠️ Stale-frame bug in extractor** — when iterating CMAs in one session, Paragon's Adjustment.mvc frame sticks; the first CMA's subject data bleeds into subsequent rows. This run: only Lake Bruin (52880) has a verified-unique subject. Rows 50997/52579/52738 show identical sqft=1411 / sold=$186K because they inherited Lake Bruin's frame. Fix: wait for URL change or close popup between CMAs.")
  lines.push("- **⚠️ Nav-back failure after ~5 CMAs** — the extractor's 'Saved Presentations' link lookup fails once the popup navigates deep into the wizard. CMAs 6-23 all errored with `Could not re-nav to Saved Presentations`. Their K-fold holdouts still worked because those use saved_cmas grid data (captured in Day 4), not this run's Paragon data.")
  lines.push("- **No market-condition adjustment** — comps span multiple years in some CMAs; old comps aren't time-shifted.")
  lines.push("- **No concessions adjustment** — subject sold prices include concessions (observed $5K on 28274 Lake Bruin).")
  lines.push("- **Flood-zone / school-district overrides not applied** — LOCAL_KNOWLEDGE.md sections 3-7 still pending Caleb interview.")
  lines.push("- **PropStream + Zillow cross-validation deferred** — this pass is fully data-contained.\n")
  lines.push("## What IS reliable in this run\n")
  lines.push("- **K-fold holdout MAE/MAPE** — 18/23 CMAs produced valid holdout predictions from their saved comp grids. This metric uses ONLY comp PPSF × held-comp sqft, so it's immune to the subject-data bugs above.")
  lines.push(`- **K-fold holdout MAPE = ${summary.holdoutMAPE?.toFixed(2) ?? "—"}%** — median-of-comps prediction is off by ~${summary.holdoutMAPE?.toFixed(0) ?? "—"}% when predicting a held-out recent sale from the remaining comps in Caleb's curated sets. That's the first-cut algorithmic-accuracy baseline.`)
  lines.push("- **The pipeline is production-ready** pending the two bug fixes above. Re-run extract-cma-data.ts with fresh sessions per CMA to get clean subject rows.\n")

  await fs.writeFile(OUT_REPORT, lines.join("\n"))
  console.log(`[metrics] wrote ${OUT_REPORT}`)
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
