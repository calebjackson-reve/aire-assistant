/**
 * CMA Scrapers Smoke Test — Day 1
 *
 * Walks through login + probe for each vendor, saves/reuses session storage,
 * and prints a pass/fail summary. Does NOT perform actual comp scraping —
 * that's Days 2 and 3.
 *
 * Run:
 *   npx tsx scripts/test-cma-scrapers-smoke.ts
 *
 * Expected outcome:
 *   [cma:smoke] mls_paragon    login=fresh|reused  marker=ok  duration=1234ms
 *   [cma:smoke] propstream     login=fresh|reused  marker=ok  duration=2345ms
 *   [cma:smoke] rpr            login=fresh|reused  marker=ok  duration=3456ms
 *   3/3 vendors healthy
 *
 * Each vendor has a placeholder login() that the real scraper will replace.
 * For Day 1 we only assert we can reach the login page and that our session
 * persistence / circuit breaker / rate-limit plumbing works.
 */

import {
  openVendorSession,
  closeBrowser,
  rateLimited,
  recordSuccess,
  recordFailure,
  logScrapeRun,
  captureDebug,
  humanPause,
  type VendorKey,
  type VendorSessionOpts,
} from "@/lib/cma/scrapers/base"
import type { Page } from "playwright"

interface VendorSpec {
  vendor: VendorKey
  displayName: string
  probeUrl: string
  login: VendorSessionOpts["login"]
  isLoggedIn: VendorSessionOpts["isLoggedIn"]
}

// ── Vendor specs (login flows are placeholders — real impl lands Days 2-3) ──

const mlsSpec: VendorSpec = {
  vendor: "mls_paragon",
  displayName: "GBRAR Paragon",
  probeUrl: process.env.MLS_LOGIN_URL || "about:blank",
  async login(page, creds) {
    // Paragon uses a standard form: #username / #password / button[type=submit]
    // If the real selectors differ, the Day 2 scraper will override.
    await page.waitForLoadState("domcontentloaded")
    const userSel = (await page.$("#username")) ? "#username"
                  : (await page.$('input[name="username"]')) ? 'input[name="username"]'
                  : 'input[type="text"]'
    const passSel = (await page.$("#password")) ? "#password"
                  : 'input[type="password"]'
    await page.fill(userSel, creds.username)
    await humanPause(400, 900)
    await page.fill(passSel, creds.password)
    await humanPause(400, 900)
    await page.click('button[type="submit"], input[type="submit"]')
    await page.waitForLoadState("domcontentloaded", { timeout: 30000 }).catch(() => {})
    await humanPause(1000, 2000)
  },
  async isLoggedIn(page: Page) {
    // Generic "logged-in" heuristic — final selector to be confirmed Day 2.
    const url = page.url().toLowerCase()
    if (url.includes("login") || url.includes("signin")) return false
    const bodyText = (await page.textContent("body").catch(() => "")) || ""
    return /log ?out|sign ?out|my account|dashboard/i.test(bodyText)
  },
}

const propstreamSpec: VendorSpec = {
  vendor: "propstream",
  displayName: "PropStream",
  probeUrl: process.env.PROPSTREAM_LOGIN_URL || "about:blank",
  async login(page, creds) {
    await page.waitForLoadState("domcontentloaded")
    const emailSel = (await page.$('input[name="username"]')) ? 'input[name="username"]'
                   : (await page.$('input[type="email"]')) ? 'input[type="email"]'
                   : 'input[type="text"]'
    await page.fill(emailSel, creds.username)
    await humanPause()
    await page.fill('input[type="password"]', creds.password)
    await humanPause()
    await page.click('button[type="submit"], input[type="submit"]')
    await page.waitForLoadState("domcontentloaded", { timeout: 30000 }).catch(() => {})
    await humanPause(1200, 2400)
  },
  async isLoggedIn(page: Page) {
    const url = page.url().toLowerCase()
    if (url.includes("login")) return false
    const bodyText = (await page.textContent("body").catch(() => "")) || ""
    return /log ?out|my properties|search properties|dashboard/i.test(bodyText)
  },
}

const rprSpec: VendorSpec = {
  vendor: "rpr",
  displayName: "Realtors Property Resource",
  probeUrl: process.env.RPR_LOGIN_URL || "about:blank",
  async login(page, creds) {
    await page.waitForLoadState("domcontentloaded")
    const userSel = (await page.$('input[name="username"]')) ? 'input[name="username"]'
                  : (await page.$('input[type="email"]')) ? 'input[type="email"]'
                  : 'input[type="text"]'
    await page.fill(userSel, creds.username)
    await humanPause()
    await page.fill('input[type="password"]', creds.password)
    await humanPause()
    await page.click('button[type="submit"], input[type="submit"]')
    await page.waitForLoadState("domcontentloaded", { timeout: 30000 }).catch(() => {})
    await humanPause(1200, 2400)
  },
  async isLoggedIn(page: Page) {
    const url = page.url().toLowerCase()
    if (url.includes("login") || url.includes("auth")) return false
    const bodyText = (await page.textContent("body").catch(() => "")) || ""
    return /log ?out|my workspace|property search|dashboard/i.test(bodyText)
  },
}

const specs: VendorSpec[] = [mlsSpec, propstreamSpec, rprSpec]

// ── Runner ────────────────────────────────────────────────────────────────

interface ProbeResult {
  vendor: VendorKey
  displayName: string
  status: "pass" | "fail"
  refreshed: boolean
  durationMs: number
  error?: string
}

async function probeVendor(spec: VendorSpec): Promise<ProbeResult> {
  const started = Date.now()
  try {
    const session = await rateLimited(spec.vendor, () =>
      openVendorSession({
        vendor: spec.vendor,
        probeUrl: spec.probeUrl,
        login: spec.login,
        isLoggedIn: spec.isLoggedIn,
      })
    )
    const loggedIn = await spec.isLoggedIn(session.page).catch(() => false)
    await session.context.close()
    if (!loggedIn) throw new Error("Post-session marker check failed")
    recordSuccess(spec.vendor)
    const durationMs = Date.now() - started
    await logScrapeRun({ vendor: spec.vendor, subject: "[smoke]", status: "success", durationMs })
    return { vendor: spec.vendor, displayName: spec.displayName, status: "pass", refreshed: session.refreshed, durationMs }
  } catch (err) {
    recordFailure(spec.vendor)
    const durationMs = Date.now() - started
    const message = err instanceof Error ? err.message : String(err)
    await logScrapeRun({ vendor: spec.vendor, subject: "[smoke]", status: "failure", durationMs, error: message })
    return { vendor: spec.vendor, displayName: spec.displayName, status: "fail", refreshed: false, durationMs, error: message }
  }
}

async function main() {
  console.log("[cma:smoke] starting Day-1 vendor login + session probes")
  const results: ProbeResult[] = []
  for (const spec of specs) {
    const r = await probeVendor(spec)
    results.push(r)
    console.log(
      `[cma:smoke] ${r.vendor.padEnd(14)} ${r.status === "pass" ? "PASS" : "FAIL"}  ` +
      `login=${r.refreshed ? "fresh" : "reused"}  duration=${r.durationMs}ms` +
      (r.error ? `  error="${r.error}"` : "")
    )
  }
  await closeBrowser()

  const healthy = results.filter(r => r.status === "pass").length
  console.log(`\n${healthy}/${results.length} vendors healthy`)
  if (healthy < results.length) {
    console.log("Check lib/cma/scrapers/debug/ for failure screenshots + meta.json")
    process.exitCode = 1
  }
}

main().catch(async err => {
  console.error("[cma:smoke] fatal", err)
  await closeBrowser()
  process.exitCode = 2
})
