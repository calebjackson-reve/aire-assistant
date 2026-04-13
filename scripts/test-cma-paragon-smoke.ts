/**
 * Paragon MLS Day-2 Smoke Test — SINGLE SHOT
 *
 * One run, one address (5834 Guice Dr, Baton Rouge LA), no retry loop.
 * Mirrors the structure of scripts/test-cma-scrapers-smoke.ts but focuses
 * exclusively on Paragon login + landing reconnaissance.
 *
 * Exit codes:
 *   0 — PASS (authenticated, landing screenshot captured)
 *   1 — FAIL (non-halting failure; inspect screenshot + DAY2_NOTES.md)
 *   2 — HALT (captcha / repeat login failures — human intervention required)
 *
 * Run:
 *   npx tsx scripts/test-cma-paragon-smoke.ts
 *
 * NEVER wrap this in a retry loop. Two login failures in a row will HALT
 * automatically to protect account B24140.
 */

import {
  paragonSmokeTest,
  shutdownParagonScraper,
} from "@/lib/cma/scrapers/mls"
import {
  writeSuccessSnapshot,
  buildSnapshot,
} from "@/lib/cma/self-learning"

const SUBJECT_ADDRESS = "5834 Guice Dr, Baton Rouge LA"

async function main() {
  console.log(`[paragon:smoke] starting — subject="${SUBJECT_ADDRESS}"`)
  console.log("[paragon:smoke] rules: human-paced login, 7-day session reuse, no retry on fail")

  const result = await paragonSmokeTest(SUBJECT_ADDRESS)

  console.log("")
  console.log(`[paragon:smoke] result = ${result.status}`)
  console.log(`[paragon:smoke] loginPath = ${result.loginPath}`)
  if (result.sessionAgeDays !== null) {
    console.log(`[paragon:smoke] sessionAgeDays = ${result.sessionAgeDays.toFixed(2)}`)
  }
  console.log(`[paragon:smoke] durationMs = ${result.durationMs}`)
  if (result.landingUrl) console.log(`[paragon:smoke] landingUrl = ${result.landingUrl}`)
  if (result.landingTitle) console.log(`[paragon:smoke] landingTitle = ${result.landingTitle}`)
  if (result.screenshotPath) console.log(`[paragon:smoke] screenshot = ${result.screenshotPath}`)
  if (result.reason) console.log(`[paragon:smoke] reason = ${result.reason}`)

  if (result.status === "PASS") {
    // Day 2 has no comps yet — snapshot records the reconnaissance run so
    // drift detection on Day 3 has a baseline timestamp for this subject.
    try {
      const snap = buildSnapshot({
        vendor: "mls_paragon",
        subject: SUBJECT_ADDRESS,
        vendorSuggestedPrice: null,
        comps: [],
      })
      const file = await writeSuccessSnapshot(snap)
      console.log(`[paragon:smoke] snapshot written = ${file}`)
    } catch (err) {
      console.warn("[paragon:smoke] snapshot write failed", err)
    }
  }

  await shutdownParagonScraper()

  if (result.status === "HALT") {
    console.error("[paragon:smoke] HALT — human intervention required. Do not auto-retry.")
    process.exit(2)
  }
  if (result.status === "FAIL") {
    console.error("[paragon:smoke] FAIL — inspect screenshot and DAY2_NOTES.md before retrying.")
    process.exit(1)
  }
  console.log("[paragon:smoke] PASS")
  process.exit(0)
}

main().catch(async err => {
  console.error("[paragon:smoke] fatal", err)
  await shutdownParagonScraper().catch(() => {})
  process.exit(2)
})
