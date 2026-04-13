/**
 * Paragon MLS Day-3 Comp Search — SINGLE SHOT
 *
 * Subject: 5834 Guice Dr, Baton Rouge LA
 * Runs paragonCompSearch() once. Prints PASS / FAIL / HALT + stepReached.
 * Never retries. Writes snapshot on PASS.
 *
 * Run:
 *   npx tsx scripts/test-cma-paragon-day3.ts
 */

import {
  paragonCompSearch,
  shutdownParagonScraper,
} from "@/lib/cma/scrapers/mls"
import {
  writeSuccessSnapshot,
  buildSnapshot,
} from "@/lib/cma/self-learning"

const SUBJECT = "5834 Guice Dr, Baton Rouge LA"

async function main() {
  console.log(`[paragon:day3] starting — subject="${SUBJECT}"`)
  const r = await paragonCompSearch(SUBJECT)

  console.log(`\n[paragon:day3] status         = ${r.status}`)
  console.log(`[paragon:day3] stepReached    = ${r.stepReached}`)
  console.log(`[paragon:day3] loginPath      = ${r.loginPath}`)
  console.log(`[paragon:day3] durationMs     = ${r.durationMs}`)
  console.log(`[paragon:day3] popupUrl       = ${r.popupUrl ?? "—"}`)
  console.log(`[paragon:day3] comps returned = ${r.comps.length}`)
  if (r.reason) console.log(`[paragon:day3] reason         = ${r.reason}`)
  console.log(`[paragon:day3] screenshots:`)
  for (const s of r.screenshots) console.log(`  - ${s}`)

  for (const [i, c] of r.comps.slice(0, 10).entries()) {
    console.log(`\n[paragon:day3] comp ${i + 1}:`)
    console.log(`  address    ${c.address || "—"}`)
    console.log(`  soldPrice  ${c.soldPrice ?? "—"}`)
    console.log(`  soldDate   ${c.soldDate ?? "—"}`)
    console.log(`  sqft       ${c.sqft ?? "—"}`)
    console.log(`  beds/baths ${c.beds ?? "—"}/${c.baths ?? "—"}`)
    console.log(`  distance   ${c.distanceMiles ?? "—"}`)
  }

  if (r.status === "PASS" && r.comps.length > 0) {
    const snap = buildSnapshot({
      vendor: "mls_paragon",
      subject: SUBJECT,
      vendorSuggestedPrice: null,
      comps: r.comps.map((c) => ({
        address: c.address,
        soldPrice: c.soldPrice ?? 0,
        soldDate: c.soldDate ?? "",
        sqft: c.sqft ?? undefined,
        beds: c.beds ?? undefined,
        baths: c.baths ?? undefined,
        distanceMiles: c.distanceMiles ?? undefined,
      })),
    })
    const file = await writeSuccessSnapshot(snap)
    console.log(`\n[paragon:day3] snapshot written = ${file}`)
  }

  await shutdownParagonScraper()

  if (r.status === "HALT") { console.error("[paragon:day3] HALT"); process.exit(2) }
  if (r.status === "FAIL") { console.error("[paragon:day3] FAIL"); process.exit(1) }
  console.log("[paragon:day3] PASS")
  process.exit(0)
}

main().catch(async (err) => {
  console.error("[paragon:day3] fatal", err)
  await shutdownParagonScraper().catch(() => {})
  process.exit(2)
})
