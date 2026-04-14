/**
 * Paragon MLS Day-4 Phase 4 — Batch harvest comps from ALL active CMAs.
 *
 * Reads lib/cma/scrapers/snapshots/mls_paragon/saved_cmas_index.json
 * (produced by Phase 2). Filters to comps > 0 (skips empty placeholders).
 * Iterates in a SINGLE session — opens popup once, navigates between
 * CMAs without closing the browser. Resumable: skips CMAs whose
 * snapshot already exists.
 *
 * Run:
 *   npx tsx scripts/test-cma-saved-harvest-all.ts
 *   npx tsx scripts/test-cma-saved-harvest-all.ts --no-resume   (force re-harvest)
 */

import path from "node:path"
import fs from "node:fs/promises"
import {
  paragonHarvestSavedCMAs,
  shutdownParagonScraper,
  type SavedCMAHarvestTarget,
} from "@/lib/cma/scrapers/mls"

const SNAPSHOT_DIR = path.resolve(process.cwd(), "lib/cma/scrapers/snapshots/mls_paragon")
const INDEX_PATH = path.join(SNAPSHOT_DIR, "saved_cmas_index.json")

interface IndexRow {
  cmaId: string
  name: string
  comparables: number
  subjectMls: string
  lastUpdated: string
}

async function main() {
  const noResume = process.argv.includes("--no-resume")

  const indexRaw = await fs.readFile(INDEX_PATH, "utf8")
  const index = JSON.parse(indexRaw) as { rows: IndexRow[] }
  const active = index.rows.filter((r) => r.comparables > 0)
  console.log(`[harvest] index has ${index.rows.length} CMAs; ${active.length} have comps > 0`)

  const targets: SavedCMAHarvestTarget[] = active.map((r) => ({
    cmaId: r.cmaId,
    name: r.name,
  }))

  console.log(`[harvest] starting batch — ${targets.length} CMAs, resume=${!noResume}`)
  const r = await paragonHarvestSavedCMAs(targets, { resumeFromSnapshots: !noResume })

  console.log(`\n[harvest] status     = ${r.status}`)
  console.log(`[harvest] loginPath  = ${r.loginPath}`)
  console.log(`[harvest] durationMs = ${r.durationMs} (${(r.durationMs / 1000 / 60).toFixed(1)} min)`)
  if (r.reason) console.log(`[harvest] reason     = ${r.reason}`)

  const passed = r.results.filter((x) => x.status === "PASS")
  const failed = r.results.filter((x) => x.status === "FAIL")
  const skipped = r.results.filter((x) => x.status === "SKIPPED")
  console.log(`\n[harvest] results    = ${passed.length} pass · ${failed.length} fail · ${skipped.length} skipped`)

  if (passed.length > 0) {
    console.log("\n──────── EXTRACTED ────────")
    for (const p of passed) console.log(`  PASS  ${p.cmaId.padEnd(8)} ${String(p.compCount).padStart(2)} comps  ${p.name}`)
  }
  if (failed.length > 0) {
    console.log("\n──────── FAILED ────────")
    for (const f of failed) console.log(`  FAIL  ${f.cmaId.padEnd(8)} ${f.name}  — ${f.reason}`)
  }
  if (skipped.length > 0) {
    console.log("\n──────── SKIPPED (already had snapshot) ────────")
    for (const s of skipped) console.log(`  SKIP  ${s.cmaId.padEnd(8)} ${s.name}`)
  }

  // Aggregate summary across snapshots (PASS + SKIPPED)
  const snapDir = path.join(SNAPSHOT_DIR, "saved_cmas")
  const allSnapshots: Array<{ cmaId: string; name: string; subjectMls: string | null; comps: unknown[] }> = []
  for (const file of await fs.readdir(snapDir).catch(() => [])) {
    if (!file.endsWith(".json")) continue
    try {
      const s = JSON.parse(await fs.readFile(path.join(snapDir, file), "utf8"))
      allSnapshots.push({ cmaId: s.cmaId, name: s.cmaName, subjectMls: s.subjectMls, comps: s.comps || [] })
    } catch {}
  }
  console.log(`\n[harvest] total snapshots on disk: ${allSnapshots.length}`)
  const totalComps = allSnapshots.reduce((acc, s) => acc + s.comps.length, 0)
  console.log(`[harvest] total comps across all CMAs: ${totalComps}`)
  console.log(`[harvest] avg comps per CMA snapshot: ${allSnapshots.length ? (totalComps / allSnapshots.length).toFixed(1) : 0}`)

  await shutdownParagonScraper()
  if (r.status === "HALT") { console.error("[harvest] HALT"); process.exit(2) }
  if (r.status === "FAIL") { console.error("[harvest] FAIL"); process.exit(1) }
  console.log("\n[harvest] PASS")
  process.exit(0)
}

main().catch(async (err) => {
  console.error("[harvest] fatal", err)
  await shutdownParagonScraper().catch(() => {})
  process.exit(2)
})
