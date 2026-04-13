/**
 * Paragon MLS Day-4 Phase 2 — Enumerate ALL saved CMAs (paginated).
 *
 * SINGLE SHOT. Reads-only the list view. Does NOT open individual CMAs.
 *
 * Expected: ~28 CMAs across 3 pages (per Phase 1 recon).
 *
 * Output:
 *   - Full list printed to console
 *   - JSON snapshot at lib/cma/scrapers/snapshots/mls_paragon/saved_cmas_index.json
 *   - Aggregate summary (total, avg comps, date range, top subjects)
 *
 * Run:
 *   npx tsx scripts/test-cma-saved-enumerate.ts
 */

import path from "node:path"
import fs from "node:fs/promises"
import {
  paragonEnumerateSavedCMAs,
  shutdownParagonScraper,
  type SavedCMARow,
} from "@/lib/cma/scrapers/mls"

const SNAPSHOT_DIR = path.resolve(process.cwd(), "lib/cma/scrapers/snapshots/mls_paragon")

function summarize(rows: SavedCMARow[]) {
  const total = rows.length
  const withComps = rows.filter((r) => r.comparables > 0)
  const empty = rows.filter((r) => r.comparables === 0)
  const avgComps = withComps.length ? withComps.reduce((s, r) => s + r.comparables, 0) / withComps.length : 0
  const dates = rows
    .map((r) => r.lastUpdated)
    .filter(Boolean)
    .map((d) => new Date(d))
    .filter((d) => !isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime())
  const oldest = dates[0]?.toISOString().slice(0, 10) || "—"
  const newest = dates[dates.length - 1]?.toISOString().slice(0, 10) || "—"

  return {
    total,
    withCompsCount: withComps.length,
    emptyCount: empty.length,
    avgCompsInActiveCMAs: Math.round(avgComps * 10) / 10,
    oldestUpdated: oldest,
    newestUpdated: newest,
    maxComps: Math.max(0, ...rows.map((r) => r.comparables)),
  }
}

async function main() {
  console.log("[paragon:day4p2] starting — enumerate saved CMAs (all pages)")
  const r = await paragonEnumerateSavedCMAs()

  console.log(`\n[paragon:day4p2] status        = ${r.status}`)
  console.log(`[paragon:day4p2] loginPath     = ${r.loginPath}`)
  console.log(`[paragon:day4p2] durationMs    = ${r.durationMs}`)
  console.log(`[paragon:day4p2] totalCount    = ${r.totalCount ?? "—"}`)
  console.log(`[paragon:day4p2] pagesVisited  = ${r.pagesVisited}`)
  console.log(`[paragon:day4p2] rowsHarvested = ${r.rows.length}`)
  if (r.reason) console.log(`[paragon:day4p2] reason        = ${r.reason}`)

  if (r.rows.length > 0) {
    console.log("\n──────── SAVED CMA INDEX ────────")
    console.log("CMAID    | Comps | Updated     | Name / Subject")
    console.log("─".repeat(80))
    for (const row of r.rows) {
      const id = row.cmaId.padEnd(8)
      const comps = String(row.comparables).padStart(3)
      const updated = row.lastUpdated.padEnd(11)
      const label = row.name + (row.subjectMls ? `  (MLS ${row.subjectMls})` : "")
      console.log(`${id} | ${comps}   | ${updated} | ${label}`)
    }

    const s = summarize(r.rows)
    console.log("\n──────── SUMMARY ────────")
    console.log(`Total saved CMAs         : ${s.total}`)
    console.log(`CMAs with comparables    : ${s.withCompsCount}`)
    console.log(`Empty / placeholder CMAs : ${s.emptyCount}`)
    console.log(`Avg comps per active CMA : ${s.avgCompsInActiveCMAs}`)
    console.log(`Max comps in one CMA     : ${s.maxComps}`)
    console.log(`Oldest last-updated      : ${s.oldestUpdated}`)
    console.log(`Newest last-updated      : ${s.newestUpdated}`)

    // Persist index + summary
    await fs.mkdir(SNAPSHOT_DIR, { recursive: true })
    const out = {
      capturedAt: new Date().toISOString(),
      summary: s,
      rows: r.rows,
    }
    const file = path.join(SNAPSHOT_DIR, "saved_cmas_index.json")
    await fs.writeFile(file, JSON.stringify(out, null, 2), "utf8")
    console.log(`\n[paragon:day4p2] index snapshot = ${file}`)
  }

  await shutdownParagonScraper()

  if (r.status === "HALT") { console.error("[paragon:day4p2] HALT"); process.exit(2) }
  if (r.status === "FAIL") { console.error("[paragon:day4p2] FAIL"); process.exit(1) }
  console.log("\n[paragon:day4p2] PASS")
  process.exit(0)
}

main().catch(async (err) => {
  console.error("[paragon:day4p2] fatal", err)
  await shutdownParagonScraper().catch(() => {})
  process.exit(2)
})
