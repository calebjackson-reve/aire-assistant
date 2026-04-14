/**
 * Paragon MLS Day-4 Phase 3 — Drill into ONE saved CMA, extract comps.
 *
 * SINGLE SHOT. Target CMA: "28274 lake bruin" (Caleb's walkthrough case).
 *
 * Flow: ROAM dashboard → Paragon popup → Saved Presentations → click CMA
 *        name → CMA Wizard → Step 2: Comparables → parse comp table.
 *
 * Run:
 *   npx tsx scripts/test-cma-saved-drill.ts "28274 lake bruin"
 *   (argument optional; defaults to "28274 lake bruin")
 */

import path from "node:path"
import fs from "node:fs/promises"
import {
  paragonDrillSavedCMA,
  shutdownParagonScraper,
} from "@/lib/cma/scrapers/mls"

const SNAPSHOT_DIR = path.resolve(process.cwd(), "lib/cma/scrapers/snapshots/mls_paragon/saved_cmas")

async function main() {
  const nameArg = process.argv.slice(2).join(" ").trim() || "28274 lake bruin"
  console.log(`[paragon:day4p3] starting — target CMA name contains "${nameArg}"`)
  const r = await paragonDrillSavedCMA(nameArg)

  console.log(`\n[paragon:day4p3] status        = ${r.status}`)
  console.log(`[paragon:day4p3] stepReached   = ${r.stepReached}`)
  console.log(`[paragon:day4p3] loginPath     = ${r.loginPath}`)
  console.log(`[paragon:day4p3] durationMs    = ${r.durationMs}`)
  console.log(`[paragon:day4p3] cmaId         = ${r.cmaId ?? "—"}`)
  console.log(`[paragon:day4p3] cmaName       = ${r.cmaName ?? "—"}`)
  console.log(`[paragon:day4p3] subjectMls    = ${r.subjectMls ?? "—"}`)
  console.log(`[paragon:day4p3] wizardUrl     = ${r.wizardUrl ?? "—"}`)
  if (r.reason) console.log(`[paragon:day4p3] reason        = ${r.reason}`)
  if (r.domDumpPath) console.log(`[paragon:day4p3] domDump       = ${r.domDumpPath}`)
  console.log(`[paragon:day4p3] compTableHeader = [${r.compTableHeader.join(", ")}]`)
  console.log(`[paragon:day4p3] comps extracted = ${r.comps.length}`)

  if (r.comps.length > 0) {
    console.log("\n──────── COMPS ────────")
    console.log("#   MLS#         Price      Sqft   Bd/Ba  DOM   Address, City ST")
    console.log("─".repeat(80))
    r.comps.forEach((c, i) => {
      const n = String(i + 1).padStart(2)
      const mls = (c.mlsNumber || "—").padEnd(12)
      const price = c.price ? `$${c.price.toLocaleString()}`.padStart(10) : "         —"
      const sqft = c.sqft ? String(c.sqft).padStart(5) : "    —"
      const bdba = `${c.beds ?? "—"}/${c.baths ?? "—"}`.padEnd(6)
      const dom = c.dom != null ? String(c.dom).padStart(4) : "   —"
      const addr = `${c.address || "—"}, ${c.city || "—"} ${c.state || ""}`
      console.log(`${n}  ${mls} ${price}  ${sqft}  ${bdba} ${dom}   ${addr}`)
    })

    // Save snapshot
    await fs.mkdir(SNAPSHOT_DIR, { recursive: true })
    const safeName = (r.cmaName || "unknown").replace(/[^a-z0-9]+/gi, "_").toLowerCase()
    const file = path.join(SNAPSHOT_DIR, `cma_${r.cmaId || "na"}_${safeName}.json`)
    await fs.writeFile(
      file,
      JSON.stringify(
        {
          capturedAt: new Date().toISOString(),
          cmaId: r.cmaId,
          cmaName: r.cmaName,
          subjectMls: r.subjectMls,
          compTableHeader: r.compTableHeader,
          comps: r.comps,
        },
        null,
        2,
      ),
      "utf8",
    )
    console.log(`\n[paragon:day4p3] snapshot      = ${file}`)
  }

  await shutdownParagonScraper()
  if (r.status === "HALT") { console.error("[paragon:day4p3] HALT"); process.exit(2) }
  if (r.status === "FAIL") { console.error("[paragon:day4p3] FAIL"); process.exit(1) }
  console.log("\n[paragon:day4p3] PASS")
  process.exit(0)
}

main().catch(async (err) => {
  console.error("[paragon:day4p3] fatal", err)
  await shutdownParagonScraper().catch(() => {})
  process.exit(2)
})
