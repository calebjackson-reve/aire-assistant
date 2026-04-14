/**
 * Single-shot deep-link listing detail fetch (Phase 5 test).
 *
 * Usage:
 *   npx tsx scripts/test-cma-fetch-listing.ts 2025014745
 *   npx tsx scripts/test-cma-fetch-listing.ts  (defaults to 2025014745)
 */

import path from "node:path"
import fs from "node:fs/promises"
import {
  paragonFetchListingDetail,
  shutdownParagonScraper,
} from "@/lib/cma/scrapers/mls"

const SNAPSHOT_DIR = path.resolve(process.cwd(), "lib/cma/scrapers/snapshots/mls_paragon/listings")

async function main() {
  const mls = process.argv[2] || "2025014745"
  console.log(`[listing] fetching ${mls}`)
  const r = await paragonFetchListingDetail(mls)

  console.log(`\n[listing] status      = ${r.status}`)
  console.log(`[listing] loginPath   = ${r.loginPath}`)
  console.log(`[listing] durationMs  = ${r.durationMs}`)
  if (r.reason) console.log(`[listing] reason      = ${r.reason}`)
  if (r.screenshotPath) console.log(`[listing] screenshot  = ${r.screenshotPath}`)

  if (r.listing) {
    const l = r.listing
    console.log("\n──────── LISTING ────────")
    console.log(`MLS#:        ${l.mlsId}`)
    console.log(`Address:     ${l.address || "—"}`)
    console.log(`             ${l.city || "?"} ${l.zip || ""}  Parish: ${l.parish || "?"}  Area: ${l.area || "?"}`)
    console.log(`Subdivision: ${l.subdivision || "—"}`)
    console.log(`Status:      ${l.status || "—"}`)
    console.log(`List / Sold: $${l.listPrice?.toLocaleString() || "—"} / $${l.soldPrice?.toLocaleString() || "—"}`)
    console.log(`PPSF:        list $${l.listPpsf ?? "—"}  sold $${l.soldPpsf ?? "—"}`)
    console.log(`Size:        ${l.livingSqft || "—"} living / ${l.totalSqft || "—"} total sqft`)
    console.log(`Beds/Baths:  ${l.bedrooms ?? "—"} / ${l.baths ?? "—"}`)
    console.log(`Style/Age:   ${l.style || "—"} · ${l.yearAge || "—"} · ${l.stories || "?"} stories`)
    console.log(`Lot:         ${l.acres ?? "—"} acres · ${l.lotDim || "—"}`)
    console.log(`Dates:       List ${l.listingDate || "—"} · Pend ${l.pendingDate || "—"} · Sold ${l.soldDate || "—"} · DOM ${l.dom ?? "—"}`)
    console.log(`Agents:      ${l.listAgent || "—"} @ ${l.listOffice || "—"}  →  ${l.buyerAgent || "—"}`)
    console.log(`Construct:   ${l.construct || "—"}`)
    console.log(`Foundation:  ${l.foundation || "—"}`)
    console.log(`Siding:      ${l.siding || "—"}`)
    console.log(`Roof:        ${l.roof || "—"}`)
    console.log(`HVAC:        ${l.hvac || "—"}`)
    console.log(`Pool:        ${l.pool || "—"}`)
    console.log(`Mineral:     ${l.mineralRights || "—"}`)
    console.log(`\nRaw field count: ${Object.keys(l.rawFieldMap).length}`)

    await fs.mkdir(SNAPSHOT_DIR, { recursive: true })
    const file = path.join(SNAPSHOT_DIR, `listing_${l.mlsId}.json`)
    await fs.writeFile(file, JSON.stringify(l, null, 2), "utf8")
    console.log(`\nSnapshot: ${file}`)
  }

  await shutdownParagonScraper()
  if (r.status === "HALT") { console.error("[listing] HALT"); process.exit(2) }
  if (r.status === "FAIL") { console.error("[listing] FAIL"); process.exit(1) }
  console.log("\n[listing] PASS")
  process.exit(0)
}

main().catch(async (e) => {
  console.error("[listing] fatal", e)
  await shutdownParagonScraper().catch(() => {})
  process.exit(2)
})
