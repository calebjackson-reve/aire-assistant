/**
 * Paragon MLS Day-4 — Saved CMA Presentations RECON (Phase 1)
 *
 * SINGLE SHOT. No retry. No loop. No per-CMA drill-down.
 *
 * Flow:
 *   ROAM dashboard → Paragon popup → dismiss wizard →
 *   CMA tab (dropdown) → Saved Presentations → screenshot list +
 *   capture DOM outline → STOP.
 *
 * Phase 2 (separate run, after inspecting screenshot + DOM outline):
 *   parse list rows → open each CMA → extract subject + comps →
 *   aggregate summary.
 *
 * Run:
 *   npx tsx scripts/test-cma-saved-presentations.ts
 */

import {
  paragonListSavedPresentations,
  shutdownParagonScraper,
} from "@/lib/cma/scrapers/mls"

async function main() {
  console.log("[paragon:day4] starting — phase 1 recon (list view only)")
  const r = await paragonListSavedPresentations()

  console.log(`\n[paragon:day4] status         = ${r.status}`)
  console.log(`[paragon:day4] stepReached    = ${r.stepReached}`)
  console.log(`[paragon:day4] loginPath      = ${r.loginPath}`)
  console.log(`[paragon:day4] durationMs     = ${r.durationMs}`)
  console.log(`[paragon:day4] listUrl        = ${r.listUrl ?? "—"}`)
  console.log(`[paragon:day4] listTitle      = ${r.listTitle ?? "—"}`)
  console.log(`[paragon:day4] rowCountHint   = ${r.rowCountHint ?? "—"}`)
  if (r.reason) console.log(`[paragon:day4] reason         = ${r.reason}`)
  if (r.domOutlinePath) console.log(`[paragon:day4] domOutline     = ${r.domOutlinePath}`)
  console.log(`[paragon:day4] screenshots:`)
  for (const s of r.screenshots) console.log(`  - ${s}`)

  await shutdownParagonScraper()

  if (r.status === "HALT") { console.error("[paragon:day4] HALT"); process.exit(2) }
  if (r.status === "FAIL") { console.error("[paragon:day4] FAIL"); process.exit(1) }
  console.log("\n[paragon:day4] PASS — inspect screenshot + DOM outline, then build Phase 2 parser.")
  process.exit(0)
}

main().catch(async (err) => {
  console.error("[paragon:day4] fatal", err)
  await shutdownParagonScraper().catch(() => {})
  process.exit(2)
})
