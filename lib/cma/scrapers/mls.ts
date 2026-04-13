/**
 * Paragon MLS Scraper — Day 2 (login + landing reconnaissance)
 *
 * Scope for Day 2:
 *   - Authenticated session against GBRAR Paragon (account B24140, sole access).
 *   - Human-paced typing (50–150ms/char via base.humanType).
 *   - Captcha detection → ScraperHaltError, no bypass attempt.
 *   - 7-day storageState reuse (delegated to openVendorSession).
 *   - 2 consecutive login failures → ScraperHaltError.
 *   - Capture a landing-page screenshot for DOM reconnaissance.
 *
 * Search + results parsing land on Day 2.5 / Day 3. This file establishes the
 * safe login base only. Never add retry loops — Caleb's account is the only
 * door and a lockout costs weeks.
 */

import type { Page } from "playwright"
import path from "node:path"
import fs from "node:fs/promises"
import {
  openVendorSession,
  closeBrowser,
  rateLimited,
  recordSuccess,
  recordFailure,
  logScrapeRun,
  captureDebug,
  humanType,
  humanPause,
  detectCaptcha,
  ScraperHaltError,
  type VendorKey,
  type VendorCredentials,
  type VendorSession,
} from "@/lib/cma/scrapers/base"

const VENDOR: VendorKey = "mls_paragon"

const DEBUG_DIR = path.resolve(process.cwd(), "lib/cma/scrapers/debug")

let consecutiveLoginFailures = 0
const MAX_CONSECUTIVE_LOGIN_FAILURES = 2

/** Login marker heuristic — ROAM redirects from clareityiam.net to clareity.net
 *  after SSO hand-off. Treat any non-IAM clareity.net host as logged in, and
 *  fall back to body text for skins on other hosts. */
async function isParagonLoggedIn(page: Page): Promise<boolean> {
  const url = page.url().toLowerCase()
  if (url.includes("login") || url.includes("signin") || url.includes("authenticate")) return false
  // Strong positive signal: we're on the ROAM MLS shell, not the IAM.
  if (url.includes("clareity.net") && !url.includes("clareityiam.net")) return true
  const bodyText = (await page.textContent("body").catch(() => "")) || ""
  return /log ?out|sign ?out|my account|dashboard|home ?page|search/i.test(bodyText)
}

/** Human-paced Paragon login. Defers selector-specific tuning to the first live run. */
async function paragonLogin(page: Page, creds: VendorCredentials): Promise<void> {
  await page.waitForLoadState("domcontentloaded")
  await humanPause(500, 1200)

  // Captcha gate BEFORE touching any input
  const preCaptcha = await detectCaptcha(page)
  if (preCaptcha.present) {
    const shot = await captureLandingScreenshot(page, "captcha_on_login")
    throw new ScraperHaltError(
      `Captcha detected on login page (${preCaptcha.kind ?? "unknown"})`,
      VENDOR,
      shot,
    )
  }

  // Selector resolution — Paragon historically ships #username / #password,
  // but legacy FlexmlsWeb skins use input[name="Username"]. Probe both.
  const userSel = (await page.$("#username")) ? "#username"
    : (await page.$('input[name="username"]')) ? 'input[name="username"]'
    : (await page.$('input[name="Username"]')) ? 'input[name="Username"]'
    : 'input[type="text"]:visible'

  const passSel = (await page.$("#password")) ? "#password"
    : (await page.$('input[name="password"]')) ? 'input[name="password"]'
    : (await page.$('input[name="Password"]')) ? 'input[name="Password"]'
    : 'input[type="password"]:visible'

  await humanType(page, userSel, creds.username)
  await humanPause(400, 900)
  await humanType(page, passSel, creds.password)
  await humanPause(500, 1100)

  // Clareity IAM (ROAM MLS) uses a <button> with visible text "Password Login"
  // and no type="submit" attribute. Keep generic fallbacks for other skins.
  const submitCandidates = [
    'button:has-text("Password Login")',
    'button[type="submit"]',
    'input[type="submit"]',
    'button:has-text("Log In")',
    'button:has-text("Sign In")',
    'button:has-text("Login")',
  ]
  let submitSel: string | null = null
  for (const sel of submitCandidates) {
    if (await page.$(sel)) { submitSel = sel; break }
  }
  if (!submitSel) {
    const shot = await captureLandingScreenshot(page, "submit_selector_not_found")
    throw new Error(`Submit button not found on login page (screenshot: ${shot})`)
  }
  await page.click(submitSel)

  // ROAM's SSO chain: clareityiam.net → clareity.net. Wait for the hand-off
  // before deciding login succeeded. domcontentloaded fires on the interstitial
  // and would return too early, which is what caused the blank-screenshot FAIL
  // on 2026-04-13. Budget 20s for the redirect + 15s for network to settle.
  await page.waitForURL(
    (url) => {
      const s = url.toString().toLowerCase()
      return s.includes("clareity.net") && !s.includes("clareityiam.net") && !s.includes("/login")
    },
    { timeout: 20000 },
  ).catch(() => {})
  await page.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => {})
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {})
  await humanPause(800, 1600)

  // Poll the marker for up to 10s in case the shell renders after networkidle.
  const markerDeadline = Date.now() + 10000
  while (Date.now() < markerDeadline) {
    if (await isParagonLoggedIn(page)) break
    await page.waitForTimeout(500)
  }

  // Post-submit captcha check (challenges sometimes appear only after POST)
  const postCaptcha = await detectCaptcha(page)
  if (postCaptcha.present) {
    const shot = await captureLandingScreenshot(page, "captcha_after_submit")
    throw new ScraperHaltError(
      `Captcha detected after login submit (${postCaptcha.kind ?? "unknown"})`,
      VENDOR,
      shot,
    )
  }
}

/** Saves a full-page screenshot to the debug dir and returns its absolute path. */
async function captureLandingScreenshot(page: Page, label: string): Promise<string> {
  try {
    await fs.mkdir(DEBUG_DIR, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, "-")
    const filename = `${VENDOR}_${stamp}_${label}.png`
    const filepath = path.join(DEBUG_DIR, filename)
    await page.screenshot({ path: filepath, fullPage: true })
    return filepath
  } catch {
    return ""
  }
}

export interface ParagonSmokeResult {
  status: "PASS" | "FAIL" | "HALT"
  reason?: string
  loginPath: "fresh" | "reused"
  sessionAgeDays: number | null
  screenshotPath?: string
  durationMs: number
  landingUrl?: string
  landingTitle?: string | null
}

/**
 * Day-2 smoke runner. Single shot. Opens a vendor session, probes
 * authentication, and captures a landing-page screenshot. No search.
 */
export async function paragonSmokeTest(subject: string): Promise<ParagonSmokeResult> {
  const started = Date.now()
  let session: VendorSession | null = null
  try {
    session = await rateLimited(VENDOR, () =>
      openVendorSession({
        vendor: VENDOR,
        probeUrl: process.env.MLS_LOGIN_URL || "about:blank",
        login: paragonLogin,
        isLoggedIn: isParagonLoggedIn,
        sessionMaxAgeDays: 7,
      }),
    )

    const loggedIn = await isParagonLoggedIn(session.page)
    if (!loggedIn) {
      consecutiveLoginFailures += 1
      if (consecutiveLoginFailures >= MAX_CONSECUTIVE_LOGIN_FAILURES) {
        const shot = await captureLandingScreenshot(session.page, "login_halt_repeat_fail")
        throw new ScraperHaltError(
          `${consecutiveLoginFailures} consecutive login failures — halting to protect account`,
          VENDOR,
          shot,
        )
      }
      await captureDebug(VENDOR, session.page, "login_marker_missing")
      const shot = await captureLandingScreenshot(session.page, "login_marker_missing")
      recordFailure(VENDOR)
      await logScrapeRun({ vendor: VENDOR, subject, status: "failure", durationMs: Date.now() - started, error: "login marker missing" })
      return {
        status: "FAIL",
        reason: "Post-login marker not detected",
        loginPath: session.refreshed ? "fresh" : "reused",
        sessionAgeDays: session.sessionAgeDays,
        screenshotPath: shot,
        durationMs: Date.now() - started,
        landingUrl: session.page.url(),
        landingTitle: await session.page.title().catch(() => null),
      }
    }

    consecutiveLoginFailures = 0
    recordSuccess(VENDOR)

    const landingShot = await captureLandingScreenshot(session.page, "landing_post_login")
    const landingUrl = session.page.url()
    const landingTitle = await session.page.title().catch(() => null)

    await logScrapeRun({ vendor: VENDOR, subject, status: "success", durationMs: Date.now() - started })

    return {
      status: "PASS",
      loginPath: session.refreshed ? "fresh" : "reused",
      sessionAgeDays: session.sessionAgeDays,
      screenshotPath: landingShot,
      durationMs: Date.now() - started,
      landingUrl,
      landingTitle,
    }
  } catch (err) {
    if (err instanceof ScraperHaltError) {
      await logScrapeRun({ vendor: VENDOR, subject, status: "failure", durationMs: Date.now() - started, error: err.message })
      return {
        status: "HALT",
        reason: err.reason,
        loginPath: session?.refreshed ? "fresh" : "reused",
        sessionAgeDays: session?.sessionAgeDays ?? null,
        screenshotPath: err.screenshotPath,
        durationMs: Date.now() - started,
        landingUrl: session?.page.url(),
      }
    }
    const message = err instanceof Error ? err.message : String(err)
    recordFailure(VENDOR)
    let shot: string | undefined
    if (session?.page) {
      shot = await captureLandingScreenshot(session.page, "exception")
    }
    await logScrapeRun({ vendor: VENDOR, subject, status: "failure", durationMs: Date.now() - started, error: message })
    return {
      status: "FAIL",
      reason: message,
      loginPath: session?.refreshed ? "fresh" : "reused",
      sessionAgeDays: session?.sessionAgeDays ?? null,
      screenshotPath: shot,
      durationMs: Date.now() - started,
      landingUrl: session?.page.url(),
    }
  } finally {
    if (session?.context) {
      await session.context.close().catch(() => {})
    }
  }
}

// ── Day 3: comp search (ROAM dashboard → Paragon popup → search → parse) ─

export interface RawComp {
  address: string
  soldPrice: number | null
  soldDate: string | null
  sqft: number | null
  beds: number | null
  baths: number | null
  distanceMiles: number | null
  mlsNumber?: string
  status?: string
  rawRow?: string[]
}

export interface ParagonCompSearchResult {
  status: "PASS" | "FAIL" | "HALT"
  reason?: string
  stepReached: "session" | "dashboard" | "popup_opened" | "wizard_dismissed" | "search_tab" | "search_filled" | "results_rendered" | "parsed"
  loginPath: "fresh" | "reused"
  comps: RawComp[]
  screenshots: string[]
  popupUrl?: string
  durationMs: number
}

/** Dismisses the ROAM dashboard announcement modal ("Coming Soon Listings…"). */
async function dismissDashboardModal(page: Page): Promise<boolean> {
  const candidates = [
    'button[aria-label="Close"]',
    'button[aria-label="close"]',
    'button:has-text("Close")',
    'button:has-text("×")',
  ]
  for (const sel of candidates) {
    const el = page.locator(sel).first()
    if (await el.isVisible().catch(() => false)) {
      await el.click({ timeout: 3000 }).catch(() => {})
      await page.waitForTimeout(600)
      return true
    }
  }
  return false
}

/** Injects a `__name` shim into the page context. tsx/esbuild adds
 *  `__name(fn, "name")` calls around named function expressions when
 *  emitting .evaluate() callbacks — the browser has no such global and
 *  throws ReferenceError. Shim is a no-op that returns the function. */
async function injectNameShim(target: Page | import("playwright").Frame): Promise<void> {
  await target.evaluate(() => {
    const w = window as unknown as Record<string, unknown>
    if (typeof w.__name !== "function") {
      w.__name = (fn: unknown) => fn
    }
  }).catch(() => {})
}

/** Opens the Paragon app by clicking the "Paragon" favorites tile icon.
 *  The label is text "Paragon"; the clickable tile is the icon ~50px above it.
 *  Returns the popup page once it loads, or throws. */
async function openParagonPopup(
  page: Page,
  context: import("playwright").BrowserContext,
): Promise<Page> {
  const labelLoc = page.getByText("Paragon", { exact: true }).first()
  const box = await labelLoc.boundingBox()
  if (!box) throw new Error("Paragon tile label not found on dashboard")

  const popupPromise = context.waitForEvent("page", { timeout: 15000 }).catch(() => null)
  await page.mouse.click(box.x + box.width / 2, box.y - 50)

  const popup = await popupPromise
  const allPages = context.pages()
  const target = popup || allPages.find((p) => p !== page)
  if (!target) throw new Error("Paragon popup did not open within 15s")

  await target.waitForLoadState("domcontentloaded", { timeout: 30000 }).catch(() => {})
  await target.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {})
  await target.waitForTimeout(1500)
  // Inject __name shim in main + every existing frame to survive tsx-emitted
  // evaluate() callbacks with named helper expressions.
  await injectNameShim(target)
  for (const f of target.frames()) await injectNameShim(f)
  return target
}

/** Closes the Paragon "User Preferences Wizard" first-run modal. */
async function dismissUserPreferencesWizard(page: Page): Promise<boolean> {
  // The wizard has a "Close" button in the top-right of its header.
  const candidates = [
    'button:has-text("Close")',
    'input[value="Close"]',
    '[aria-label="Close"]',
    // Also try the "Don't show again" checkbox then Close
    'text=/User Preferences Wizard/i',
  ]
  for (const sel of candidates.slice(0, 3)) {
    const el = page.locator(sel).first()
    if (await el.isVisible().catch(() => false)) {
      await el.click({ timeout: 3000 }).catch(() => {})
      await page.waitForTimeout(1000)
      return true
    }
  }
  return false
}

/** Navigates to the SEARCH tab in the Paragon top nav.
 *  Paragon renders tabs as icon+label in a top navbar (not <a> or [role=tab]).
 *  Labels are uppercase "SEARCH". Try text match with uppercase + strict. */
async function clickSearchTab(page: Page): Promise<boolean> {
  // Strategy: locate ANY element whose text is exactly "SEARCH" (the tab
  // label), then click its bounding box. Falls back to several more-specific
  // shapes. Dual-frame handling: iterate frames if main frame misses.
  const frames = [page.mainFrame(), ...page.frames().filter((f) => f !== page.mainFrame())]
  for (const frame of frames) {
    const loc = frame.locator('text=/^SEARCH$/').first()
    if (await loc.isVisible().catch(() => false)) {
      const box = await loc.boundingBox().catch(() => null)
      if (box) {
        // Click slightly above the text (where the icon is) — tabs in Paragon
        // wire their onclick on the icon <img>/container, not the label span.
        await frame.page().mouse.click(box.x + box.width / 2, box.y - 15).catch(() => {})
      } else {
        await loc.click({ timeout: 3000 }).catch(() => {})
      }
      await page.waitForTimeout(2500)
      await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {})
      return true
    }
  }
  // Fallbacks: case-insensitive + tag-agnostic
  const fallbacks = [
    'text=/^\\s*Search\\s*$/i',
    '[class*="tab" i]:has-text("Search")',
    'li:has-text("SEARCH")',
    'td:has-text("SEARCH")',
    'span:has-text("SEARCH")',
  ]
  for (const sel of fallbacks) {
    const el = page.locator(sel).first()
    if (await el.isVisible().catch(() => false)) {
      const box = await el.boundingBox().catch(() => null)
      if (box) {
        await page.mouse.click(box.x + box.width / 2, Math.max(box.y - 15, 0)).catch(() => {})
      } else {
        await el.click({ timeout: 3000 }).catch(() => {})
      }
      await page.waitForTimeout(2500)
      await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {})
      return true
    }
  }
  return false
}

/** Extract comp rows from Paragon's results grid. Paragon uses a classic
 *  <table> or an Ag-grid-like <div role="grid">. Try both. */
async function parseCompResults(page: Page): Promise<RawComp[]> {
  const rows = await page.evaluate(() => {
    const out: string[][] = []
    // Strategy 1: classic <tr>/<td> table
    const tables = Array.from(document.querySelectorAll("table"))
    for (const t of tables) {
      const trs = Array.from(t.querySelectorAll("tbody tr"))
      if (trs.length < 3) continue
      for (const tr of trs) {
        const cells = Array.from(tr.querySelectorAll("td")).map((td) => (td.textContent || "").trim())
        if (cells.length >= 4) out.push(cells)
      }
      if (out.length > 0) return out
    }
    // Strategy 2: role=grid with role=row / role=gridcell
    const grids = Array.from(document.querySelectorAll('[role="grid"]'))
    for (const g of grids) {
      const rws = Array.from(g.querySelectorAll('[role="row"]'))
      for (const r of rws) {
        const cells = Array.from(r.querySelectorAll('[role="gridcell"], [role="cell"]')).map((c) => (c.textContent || "").trim())
        if (cells.length >= 4) out.push(cells)
      }
      if (out.length > 0) return out
    }
    return out
  })

  // Heuristic mapping — Paragon results typically show:
  // [MLS#, Status, Address, City, List$, Sold$, Beds, Baths, Sqft, DOM, CloseDate, ...]
  return rows.slice(0, 25).map((cells) => {
    const priceRegex = /\$?([\d,]{4,})/
    const sqftRegex = /\b([\d,]{3,5})\b/
    const dateRegex = /(\d{1,2}\/\d{1,2}\/\d{2,4})/
    const numbers = cells.map((c) => {
      const m = c.match(priceRegex)
      return m ? parseInt(m[1].replace(/,/g, ""), 10) : null
    })
    // Best-effort extraction
    const prices = numbers.filter((n): n is number => n !== null && n >= 20000 && n < 10_000_000).sort((a, b) => b - a)
    const addressCell = cells.find((c) => /\b\d+\s+[A-Za-z]/.test(c)) || ""
    const dateCell = cells.find((c) => dateRegex.test(c)) || ""
    const sqftCell = cells.find((c) => {
      const m = c.match(sqftRegex)
      if (!m) return false
      const n = parseInt(m[1].replace(/,/g, ""), 10)
      return n >= 400 && n <= 20000
    })
    const bedsCell = cells.find((c) => /^[1-9]$/.test(c.trim()))

    return {
      address: addressCell,
      soldPrice: prices[0] ?? null,
      soldDate: dateCell ? (dateCell.match(dateRegex)?.[1] ?? null) : null,
      sqft: sqftCell ? parseInt((sqftCell.match(sqftRegex)?.[1] ?? "0").replace(/,/g, ""), 10) : null,
      beds: bedsCell ? parseInt(bedsCell.trim(), 10) : null,
      baths: null,
      distanceMiles: null,
      rawRow: cells,
    } satisfies RawComp
  })
}

/** Day-3 comp search. Single shot. Navigates ROAM → Paragon popup →
 *  dismisses wizards → SEARCH tab → screenshots whatever renders.
 *  Conservative: if any step past "popup opened" fails, returns FAIL with
 *  stepReached + screenshots rather than retrying or guessing. */
export async function paragonCompSearch(subject: string): Promise<ParagonCompSearchResult> {
  const started = Date.now()
  const screenshots: string[] = []
  let session: VendorSession | null = null
  let step: ParagonCompSearchResult["stepReached"] = "session"

  const finish = (
    status: ParagonCompSearchResult["status"],
    reason: string | undefined,
    comps: RawComp[],
    popupUrl?: string,
  ): ParagonCompSearchResult => ({
    status,
    reason,
    stepReached: step,
    loginPath: session?.refreshed ? "fresh" : "reused",
    comps,
    screenshots,
    popupUrl,
    durationMs: Date.now() - started,
  })

  try {
    session = await rateLimited(VENDOR, () =>
      openVendorSession({
        vendor: VENDOR,
        probeUrl: "https://roam.clareity.net/layouts",
        login: paragonLogin,
        isLoggedIn: isParagonLoggedIn,
        sessionMaxAgeDays: 7,
      }),
    )
    const { context, page } = session
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(800)
    step = "dashboard"
    screenshots.push(await captureLandingScreenshot(page, "day3_01_dashboard"))

    const modalDismissed = await dismissDashboardModal(page)
    await captureDebug(VENDOR, page, modalDismissed ? "day3_modal_ok" : "day3_modal_missing")

    const popup = await openParagonPopup(page, context).catch((e) => { throw e })
    step = "popup_opened"
    screenshots.push(await captureLandingScreenshot(popup, "day3_02_popup_opened"))

    const wizardDismissed = await dismissUserPreferencesWizard(popup)
    if (wizardDismissed) step = "wizard_dismissed"
    await popup.waitForTimeout(1000)
    screenshots.push(await captureLandingScreenshot(popup, "day3_03_post_wizard"))

    const searchClicked = await clickSearchTab(popup)
    if (!searchClicked) {
      return finish("FAIL", "SEARCH tab not found or not clickable after wizard", [], popup.url())
    }
    step = "search_tab"
    screenshots.push(await captureLandingScreenshot(popup, "day3_04_search_tab"))

    // At this point the Search form should be visible. Paragon's search is
    // a frame-heavy legacy UI; without a confirmed selector chain for the
    // address field + radius + status + sold-date we stop here rather than
    // risk misfiring the search. The screenshot at step="search_tab" is
    // the handoff for Day 3.5.
    //
    // BEST-EFFORT address fill: try the visible Quick Search address field.
    const addressFilled = await (async () => {
      const candidates = [
        'input[name*="Address"]',
        'input[placeholder*="address" i]',
        'input[id*="address" i]',
      ]
      for (const sel of candidates) {
        const el = popup.locator(sel).first()
        if (await el.isVisible().catch(() => false)) {
          await el.fill(subject.split(",")[0]).catch(() => {})
          await popup.waitForTimeout(500)
          return sel
        }
      }
      return null
    })()
    if (addressFilled) {
      step = "search_filled"
      screenshots.push(await captureLandingScreenshot(popup, "day3_05_address_filled"))
    }

    // Attempt to trigger a search. No submit — just parse whatever grid is on screen.
    // (Submitting an unverified search form on a legacy ASP.NET app is the exact
    // thing the "single-shot no-retry" rule protects against.)
    screenshots.push(await captureLandingScreenshot(popup, "day3_06_pre_parse"))

    const comps = await parseCompResults(popup)
    if (comps.length > 0) step = "parsed"
    screenshots.push(await captureLandingScreenshot(popup, "day3_07_post_parse"))

    if (comps.length === 0) {
      return finish(
        "FAIL",
        `Search form reached (step=${step}) but 0 comps parsed. Search submission + results parsing is Day 3.5 — needs a walkthrough of the exact Paragon Search → Sold Status → date range → polygon path.`,
        [],
        popup.url(),
      )
    }

    return finish("PASS", undefined, comps, popup.url())
  } catch (err) {
    if (err instanceof ScraperHaltError) {
      return finish("HALT", err.reason, [], undefined)
    }
    return finish("FAIL", err instanceof Error ? err.message : String(err), [], undefined)
  } finally {
    if (session?.context) {
      await session.context.close().catch(() => {})
    }
  }
}

export async function shutdownParagonScraper() {
  await closeBrowser()
}

// ── Day 4: Saved CMA Presentations harvest (back-engineer Caleb's own CMAs) ─
//
// Flow: ROAM dashboard → Paragon popup → dismiss wizard → CMA tab (dropdown)
//       → "Saved Presentations" sub-item → list view (recon only for Phase 1).
// Phase 2 (separate run) will open each saved CMA, extract subject + comps.
// Phase 1 stops at list-view screenshot per single-shot discipline.

export interface SavedPresentationsReconResult {
  status: "PASS" | "FAIL" | "HALT"
  reason?: string
  stepReached:
    | "session"
    | "dashboard"
    | "popup_opened"
    | "wizard_dismissed"
    | "cma_tab_open"
    | "saved_presentations_clicked"
    | "list_rendered"
  loginPath: "fresh" | "reused"
  listUrl?: string
  listTitle?: string | null
  rowCountHint: number | null
  screenshots: string[]
  domOutlinePath?: string
  durationMs: number
}

/** Opens the CMA dropdown in Paragon's top nav. Paragon renders tabs as
 *  icon+label in a horizontal bar; the clickable handler is usually on the
 *  icon, not the label. Day 3 SEARCH used box.y-15; CMA icon offset may
 *  differ. Fix applied 2026-04-13 after Day 4 Phase 1 FAIL (commit 486e598):
 *   - Probe window 600ms → 2000ms
 *   - 4 click positions tried (icon-30, icon-15, label-center, tab-below)
 *   - Probe ANY of {Saved Presentations, Create Presentation, EasyCMA,
 *     Create an EasyCMA} — not just one label */
/** Read-only diagnostic — dumps every DOM element containing "CMA" text
 *  across every frame. Zero account risk (no clicks, no navigation).
 *  Writes JSON to debug dir so we can write an EXACT selector next run. */
async function dumpCMAElementCandidates(page: Page, label: string): Promise<string> {
  try {
    const allFrames = [page.mainFrame(), ...page.frames().filter((f) => f !== page.mainFrame())]
    const dump: Record<string, unknown> = { frames: [] }
    for (const frame of allFrames) {
      const found = await frame.evaluate(() => {
        const hits: Array<Record<string, unknown>> = []
        const all = document.querySelectorAll("*")
        for (const el of all) {
          const text = (el.textContent || "").trim()
          // direct text, not descendants
          const ownText = Array.from(el.childNodes)
            .filter((n) => n.nodeType === 3)
            .map((n) => (n.textContent || "").trim())
            .join(" ")
            .trim()
          if (/\bCMA\b/i.test(ownText) && ownText.length < 60) {
            const r = (el as HTMLElement).getBoundingClientRect()
            hits.push({
              tag: el.tagName.toLowerCase(),
              id: (el as HTMLElement).id || null,
              className: (el as HTMLElement).className?.toString?.() || null,
              ownText,
              fullText: text.slice(0, 80),
              visible: r.width > 0 && r.height > 0,
              rect: { x: r.x, y: r.y, w: r.width, h: r.height },
              title: el.getAttribute("title"),
              alt: el.getAttribute("alt"),
              href: (el as HTMLAnchorElement).href || null,
              onclick: !!el.getAttribute("onclick"),
              role: el.getAttribute("role"),
            })
          }
        }
        // Also: img alt/title containing CMA (icon-only tabs)
        const imgs = Array.from(document.querySelectorAll("img"))
        const imgHits = imgs
          .filter((i) => /\bCMA\b/i.test(i.alt || "") || /\bCMA\b/i.test(i.title || ""))
          .map((i) => ({
            tag: "img",
            alt: i.alt,
            title: i.title,
            src: i.src,
            rect: (() => {
              const r = i.getBoundingClientRect()
              return { x: r.x, y: r.y, w: r.width, h: r.height }
            })(),
          }))
        return { hits: hits.slice(0, 50), imgHits: imgHits.slice(0, 10), url: location.href, frameCount: window.frames.length }
      }).catch((e) => ({ error: String(e) }))
      ;(dump.frames as unknown[]).push({ url: frame.url(), data: found })
    }
    await fs.mkdir(DEBUG_DIR, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, "-")
    const filepath = path.join(DEBUG_DIR, `${VENDOR}_${stamp}_${label}_cma_dom.json`)
    await fs.writeFile(filepath, JSON.stringify(dump, null, 2), "utf8")
    return filepath
  } catch {
    return ""
  }
}

async function openCMATabDropdown(page: Page): Promise<boolean> {
  const frames = [page.mainFrame(), ...page.frames().filter((f) => f !== page.mainFrame())]
  const dropdownProbe = async (frame: import("playwright").Frame) => {
    const probes = [
      'text=/Saved Presentations/i',
      'text=/Create Presentation/i',
      'text=/EasyCMA/i',
      'text=/Create an EasyCMA/i',
    ]
    for (const p of probes) {
      if (await frame.locator(p).first().isVisible().catch(() => false)) return true
    }
    return false
  }

  for (const frame of frames) {
    const tab = frame.locator('text=/^CMA$/').first()
    if (!(await tab.isVisible().catch(() => false))) continue
    const box = await tab.boundingBox().catch(() => null)
    if (!box) continue

    // Try 4 click positions — icon offsets vary per tab in Paragon's legacy nav.
    const positions: Array<[number, number, string]> = [
      [box.x + box.width / 2, Math.max(box.y - 30, 0), "icon-30"],
      [box.x + box.width / 2, Math.max(box.y - 15, 0), "icon-15"],
      [box.x + box.width / 2, box.y + box.height / 2, "label-center"],
      [box.x + box.width / 2, box.y + box.height + 3, "tab-below"],
    ]
    for (const [x, y, _label] of positions) {
      await frame.page().mouse.click(x, y).catch(() => {})
      // Poll probe for up to 2000ms — dropdown animation + async render
      const deadline = Date.now() + 2000
      while (Date.now() < deadline) {
        if (await dropdownProbe(frame)) return true
        await page.waitForTimeout(200)
      }
    }

    // Hover fallback (Angular Material sometimes binds mouseenter)
    await frame.page().mouse.move(box.x + box.width / 2, box.y + box.height / 2).catch(() => {})
    const deadline = Date.now() + 2000
    while (Date.now() < deadline) {
      if (await dropdownProbe(frame)) return true
      await page.waitForTimeout(200)
    }

    // Native click via locator (real accessibility-tree dispatch)
    await tab.click({ timeout: 2500, force: true }).catch(() => {})
    const deadline2 = Date.now() + 2000
    while (Date.now() < deadline2) {
      if (await dropdownProbe(frame)) return true
      await page.waitForTimeout(200)
    }
  }
  return false
}

/** Clicks the "Saved Presentations" sub-item in the CMA dropdown. */
async function clickSavedPresentations(page: Page): Promise<boolean> {
  const frames = [page.mainFrame(), ...page.frames().filter((f) => f !== page.mainFrame())]
  for (const frame of frames) {
    const loc = frame.locator('text=/^Saved Presentations$/i').first()
    if (await loc.isVisible().catch(() => false)) {
      await loc.click({ timeout: 3000 }).catch(() => {})
      await page.waitForTimeout(2500)
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {})
      return true
    }
  }
  return false
}

/** Best-effort DOM outline — iterates EVERY frame (Paragon is iframe-heavy:
 *  main doc + SessionWarning + Page.mvc + nested content frames). Each
 *  frame's tables/grids/headers/first-row are captured so Phase 2 parser
 *  can find the actual list without a third recon run. */
async function captureListDomOutline(page: Page, label: string): Promise<string> {
  try {
    const allFrames = [page.mainFrame(), ...page.frames().filter((f) => f !== page.mainFrame())]
    const out: Record<string, unknown> = { frames: [] }
    for (const frame of allFrames) {
      const data = await frame.evaluate(() => {
        const tables = Array.from(document.querySelectorAll("table"))
        const tableSummaries = tables.slice(0, 12).map((t, i) => ({
          index: i,
          id: t.id || null,
          className: t.className?.toString?.() || null,
          rowCount: t.querySelectorAll("tbody tr").length,
          firstHeader: Array.from(t.querySelectorAll("thead th, thead td")).slice(0, 20).map((c) => (c.textContent || "").trim()),
          // First 3 rows, all cells, for column-mapping inference
          firstRows: Array.from(t.querySelectorAll("tbody tr")).slice(0, 3).map((r) =>
            Array.from(r.querySelectorAll("td")).map((c) => (c.textContent || "").trim()),
          ),
        }))
        const grids = Array.from(document.querySelectorAll('[role="grid"]'))
        const gridSummaries = grids.slice(0, 4).map((g, i) => ({
          index: i,
          id: (g as HTMLElement).id || null,
          rowCount: g.querySelectorAll('[role="row"]').length,
        }))
        return {
          url: location.href,
          title: document.title,
          tables: tableSummaries,
          grids: gridSummaries,
          headings: Array.from(document.querySelectorAll("h1, h2, h3, legend"))
            .slice(0, 10)
            .map((h) => (h.textContent || "").trim())
            .filter(Boolean),
          buttonsTop20: Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"], a.button, [role="button"]'))
            .slice(0, 20)
            .map((b) => ((b as HTMLElement).innerText || (b as HTMLInputElement).value || "").trim())
            .filter(Boolean),
        }
      }).catch((e) => ({ error: String(e), url: frame.url() }))
      ;(out.frames as unknown[]).push(data)
    }
    await fs.mkdir(DEBUG_DIR, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, "-")
    const filepath = path.join(DEBUG_DIR, `${VENDOR}_${stamp}_${label}_dom.json`)
    await fs.writeFile(filepath, JSON.stringify(out, null, 2), "utf8")
    return filepath
  } catch {
    return ""
  }
}

// ── Day 4 Phase 2: enumerate all saved CMAs across paginated list ─────

export interface SavedCMARow {
  cmaId: string
  name: string
  assignedContact: string
  subjectMls: string
  lastUpdated: string
  comparables: number
}

export interface SavedCMAEnumerateResult {
  status: "PASS" | "FAIL" | "HALT"
  reason?: string
  loginPath: "fresh" | "reused"
  totalCount: number | null          // "View 1 - 10 of 28" → 28
  pagesVisited: number
  rows: SavedCMARow[]
  screenshots: string[]
  durationMs: number
}

/** Locates the nested frame whose URL contains `CMA/Main.mvc`. That's where
 *  #cmaList lives, per Day 4 DOM outline. */
function findCMAFrame(page: Page): import("playwright").Frame | null {
  const frames = [page.mainFrame(), ...page.frames().filter((f) => f !== page.mainFrame())]
  for (const f of frames) {
    if (f.url().includes("/CMA/Main.mvc")) return f
  }
  return null
}

/** Read one page of the #cmaList grid — returns row data + total count
 *  and whether a "next page" control exists. */
async function readCMAListPage(frame: import("playwright").Frame): Promise<{
  rows: SavedCMARow[]
  totalCount: number | null
  currentPage: number | null
  totalPages: number | null
}> {
  return await frame.evaluate(() => {
    const grid = document.querySelector("#cmaList") as HTMLTableElement | null
    if (!grid) return { rows: [], totalCount: null, currentPage: null, totalPages: null }

    // #cmaList is a jqGrid ui-jqgrid-btable. The HEADER columns live in the
    // sibling ui-jqgrid-htable. Column order (verified via DOM outline):
    // ["", "", "CMAID", "Saved CMA Name", "Assigned Contact",
    //  "Subject Property", "Last Updated", "Comparables"]
    const rows: Array<Record<string, string | number>> = []
    const trs = Array.from(grid.querySelectorAll("tbody tr")) as HTMLTableRowElement[]
    for (const tr of trs) {
      const cells = Array.from(tr.querySelectorAll("td")).map((c) => (c.textContent || "").trim())
      if (cells.length < 8) continue
      const [_sel, _col2, cmaId, name, assignedContact, subjectMls, lastUpdated, comparables] = cells
      if (!cmaId || !name) continue
      rows.push({
        cmaId,
        name,
        assignedContact: assignedContact || "",
        subjectMls: subjectMls || "",
        lastUpdated: lastUpdated || "",
        comparables: Number(comparables) || 0,
      })
    }

    // Pagination text: "View 1 - 10 of 28" + "Page X of Y"
    const pageInfo = (document.body.textContent || "").replace(/\s+/g, " ")
    const viewMatch = pageInfo.match(/View\s+\d+\s*-\s*\d+\s+of\s+(\d+)/i)
    const pageMatch = pageInfo.match(/Page\s+(\d+)\s+of\s+(\d+)/i)

    return {
      rows: rows as unknown as SavedCMARow[],
      totalCount: viewMatch ? parseInt(viewMatch[1], 10) : null,
      currentPage: pageMatch ? parseInt(pageMatch[1], 10) : null,
      totalPages: pageMatch ? parseInt(pageMatch[2], 10) : null,
    }
  }) as {
    rows: SavedCMARow[]
    totalCount: number | null
    currentPage: number | null
    totalPages: number | null
  }
}

/** Forces jqGrid page size to the largest option (30). Paragon's saved-CMA
 *  grid exposes "10 20 30" page sizes. Setting 30 is cleaner than pager
 *  clicks when total ≤ 30. Returns the selected size or null if no select. */
async function setCMAPageSizeMax(frame: import("playwright").Frame): Promise<number | null> {
  return await frame.evaluate(() => {
    const selects = Array.from(document.querySelectorAll("select")) as HTMLSelectElement[]
    // jqGrid page-size select typically has class "ui-pg-selbox" and options 10/20/30
    const pager = selects.find((s) => {
      const opts = Array.from(s.options).map((o) => o.value)
      return opts.includes("10") && opts.includes("20") && opts.includes("30")
    })
    if (!pager) return null
    pager.value = "30"
    pager.dispatchEvent(new Event("change", { bubbles: true }))
    return 30
  })
}

/** Advances the jqGrid to the next page. Tries multiple jqGrid pager
 *  selector shapes (ui-icon-seek-next, pg_next buttons, sp_next_* ids). */
async function gotoNextCMAPage(frame: import("playwright").Frame): Promise<boolean> {
  return await frame.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll(
      '.ui-pg-button .ui-icon-seek-next, [id^="next_"], [id^="sp_next_"], td[id*="next"] .ui-pg-button, .pg-next',
    )) as HTMLElement[]
    for (const btn of candidates) {
      const parent = btn.closest(".ui-pg-button") as HTMLElement | null
      const container = parent || btn
      if (container.classList.contains("ui-state-disabled") || container.getAttribute("aria-disabled") === "true") continue
      container.click()
      return true
    }
    return false
  })
}

/** Phase 2 — enumerate every saved CMA across all pages. Read-only.
 *  Does NOT open individual CMAs. Phase 3 drills in per-CMA. */
export async function paragonEnumerateSavedCMAs(): Promise<SavedCMAEnumerateResult> {
  const started = Date.now()
  const screenshots: string[] = []
  const allRows: SavedCMARow[] = []
  let session: VendorSession | null = null

  const finish = (
    status: SavedCMAEnumerateResult["status"],
    reason: string | undefined,
    totalCount: number | null,
    pagesVisited: number,
  ): SavedCMAEnumerateResult => ({
    status,
    reason,
    loginPath: session?.refreshed ? "fresh" : "reused",
    totalCount,
    pagesVisited,
    rows: allRows,
    screenshots,
    durationMs: Date.now() - started,
  })

  try {
    session = await rateLimited(VENDOR, () =>
      openVendorSession({
        vendor: VENDOR,
        probeUrl: "https://roam.clareity.net/layouts",
        login: paragonLogin,
        isLoggedIn: isParagonLoggedIn,
        sessionMaxAgeDays: 7,
      }),
    )
    const { context, page } = session
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(600)

    await dismissDashboardModal(page)
    const popup = await openParagonPopup(page, context)
    await dismissUserPreferencesWizard(popup)
    await popup.waitForTimeout(800)

    // Same JS-dispatch fix that worked in Phase 1 for navigating to Saved Presentations
    const navResult = await popup.evaluate(() => {
      const all = Array.from(document.querySelectorAll("a, li, span, td, div")) as HTMLElement[]
      const candidates = all.filter((el) => {
        const own = Array.from(el.childNodes)
          .filter((n) => n.nodeType === 3)
          .map((n) => (n.textContent || "").trim())
          .join(" ")
          .trim()
        return /^\s*Saved Presentations\s*$/i.test(own)
      })
      const saved = candidates.find((e) => e.tagName === "A") || candidates[0]
      if (!saved) return { ok: false }
      saved.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }))
      return { ok: true }
    })
    if (!navResult?.ok) return finish("FAIL", "Could not dispatch Saved Presentations click", null, 0)

    await popup.waitForTimeout(2500)
    await popup.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {})

    const cap = await detectCaptcha(popup)
    if (cap.present) {
      throw new ScraperHaltError(
        `Captcha detected on Saved Presentations list (${cap.kind ?? "unknown"})`,
        VENDOR,
        await captureLandingScreenshot(popup, "day4p2_captcha"),
      )
    }

    screenshots.push(await captureLandingScreenshot(popup, "day4p2_page1"))

    // Locate the CMA frame
    let cmaFrame = findCMAFrame(popup)
    // Wait up to 10s for the frame to attach if not immediate
    const frameDeadline = Date.now() + 10000
    while (!cmaFrame && Date.now() < frameDeadline) {
      await popup.waitForTimeout(500)
      cmaFrame = findCMAFrame(popup)
    }
    if (!cmaFrame) return finish("FAIL", "CMA/Main.mvc frame not found", null, 0)

    // Strategy A: bump page size to 30 so all 28 fit on one page.
    const sizeSet = await setCMAPageSizeMax(cmaFrame).catch(() => null)
    if (sizeSet) {
      await popup.waitForTimeout(2000)
      await popup.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {})
    }

    // Page 1 (after size bump, this may contain all rows)
    const page1 = await readCMAListPage(cmaFrame)
    allRows.push(...page1.rows)
    let pagesVisited = 1
    const totalCount = page1.totalCount
    const totalPages = page1.totalPages ?? 1

    // Strategy B fallback — if still paginated, click next up to totalPages.
    for (let p = 2; p <= totalPages && allRows.length < (totalCount ?? Infinity); p += 1) {
      const advanced = await gotoNextCMAPage(cmaFrame).catch(() => false)
      if (!advanced) break
      await popup.waitForTimeout(1500)
      await popup.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {})
      const nextPage = await readCMAListPage(cmaFrame)
      const firstNew = nextPage.rows[0]?.cmaId
      const existingIds = new Set(allRows.map((r) => r.cmaId))
      const freshRows = nextPage.rows.filter((r) => !existingIds.has(r.cmaId))
      if (freshRows.length === 0 || (firstNew && existingIds.has(firstNew) && freshRows.length === 0)) break
      allRows.push(...freshRows)
      pagesVisited += 1
      screenshots.push(await captureLandingScreenshot(popup, `day4p2_page${p}`))
    }

    recordSuccess(VENDOR)
    await logScrapeRun({ vendor: VENDOR, subject: "saved_cmas_enumerate", status: "success", durationMs: Date.now() - started })

    return finish("PASS", undefined, totalCount, pagesVisited)
  } catch (err) {
    if (err instanceof ScraperHaltError) return finish("HALT", err.reason, null, 0)
    const message = err instanceof Error ? err.message : String(err)
    recordFailure(VENDOR)
    await logScrapeRun({ vendor: VENDOR, subject: "saved_cmas_enumerate", status: "failure", durationMs: Date.now() - started, error: message })
    return finish("FAIL", message, null, 0)
  } finally {
    if (session?.context) {
      await session.context.close().catch(() => {})
    }
  }
}

// ── Day 4 Phase 3: drill into one saved CMA, extract its comps ─────────

export interface SavedCMAComp {
  mlsNumber: string | null
  address: string | null
  city: string | null
  state: string | null
  propertyClass: string | null
  propertyType: string | null
  area: string | null
  price: number | null
  beds: number | null
  baths: number | null
  sqft: number | null
  dom: number | null
  status: string | null
  rawCells: string[]
}

export interface SavedCMADrillResult {
  status: "PASS" | "FAIL" | "HALT"
  reason?: string
  loginPath: "fresh" | "reused"
  cmaId: string | null
  cmaName: string | null
  subjectMls: string | null
  comps: SavedCMAComp[]
  compTableHeader: string[]
  wizardUrl?: string
  screenshots: string[]
  domDumpPath?: string
  durationMs: number
  stepReached:
    | "list"
    | "row_found"
    | "wizard_opened"
    | "comparables_nav"
    | "comps_extracted"
}

/** Clicks into one CMA from the saved-list jqGrid. Matches by exact CMAID
 *  if `match.cmaId` provided (preferred — unambiguous), else by name
 *  substring. Returns the row's CMAID + subject MLS# on success. */
async function clickSavedCMAByName(
  frame: import("playwright").Frame,
  nameSubstring: string,
  matchCmaId?: string | null,
): Promise<{ ok: boolean; cmaId: string | null; subjectMls: string | null; name: string | null }> {
  return await frame.evaluate((args) => {
    const { needle, exactCmaId } = args
    const grid = document.querySelector("#cmaList") as HTMLTableElement | null
    if (!grid) return { ok: false, cmaId: null, subjectMls: null, name: null }
    const trs = Array.from(grid.querySelectorAll("tbody tr")) as HTMLTableRowElement[]
    for (const tr of trs) {
      const cells = Array.from(tr.querySelectorAll("td")) as HTMLTableCellElement[]
      if (cells.length < 8) continue
      // Column order: [sel, col2, CMAID, Name, AssignedContact, Subject, LastUpdated, Comparables]
      const cmaId = (cells[2].textContent || "").trim()
      const name = (cells[3].textContent || "").trim()
      const subjectMls = (cells[5].textContent || "").trim()
      if (exactCmaId) {
        if (cmaId !== String(exactCmaId)) continue
      } else if (!name.toLowerCase().includes(String(needle).toLowerCase())) continue

      // Try strategies in order:
      // 1) Click the Name <td> directly
      // 2) Click any <a> inside the Name cell
      // 3) Double-click the row (jqGrid default action)
      const nameCell = cells[3]
      const anchor = nameCell.querySelector("a") as HTMLElement | null

      const dispatch = (el: HTMLElement, type: "click" | "dblclick") => {
        el.scrollIntoView?.({ block: "center" })
        const evt = new MouseEvent(type, { bubbles: true, cancelable: true, view: window, button: 0 })
        el.dispatchEvent(evt)
      }

      if (anchor) {
        dispatch(anchor, "click")
      } else {
        dispatch(nameCell, "click")
        dispatch(tr, "dblclick")
      }

      return { ok: true, cmaId, subjectMls, name }
    }
    return { ok: false, cmaId: null, subjectMls: null, name: null }
  }, { needle: nameSubstring, exactCmaId: matchCmaId ?? null }) as Promise<{
    ok: boolean
    cmaId: string | null
    subjectMls: string | null
    name: string | null
  }>
}

/** Clicks the "Comparables" step in the CMA Wizard left sidebar.
 *  Wizard renders sidebar in a different frame than the main content;
 *  iterate every frame and try multiple text shapes. */
async function clickWizardComparables(frame: import("playwright").Frame): Promise<{ ok: boolean; where: string | null }> {
  const result = await frame.evaluate(() => {
    const findTargets = () => {
      const all = Array.from(document.querySelectorAll("a, li, span, td, div, button")) as HTMLElement[]
      const exact = all.filter((el) => {
        const own = Array.from(el.childNodes)
          .filter((n) => n.nodeType === 3)
          .map((n) => (n.textContent || "").trim())
          .join(" ")
          .trim()
        return /^\s*Comparables\s*$/i.test(own)
      })
      if (exact.length > 0) return exact
      // Fallback: contains "Comparables" but isn't a heading/body wrapper
      return all.filter((el) => {
        const own = Array.from(el.childNodes)
          .filter((n) => n.nodeType === 3)
          .map((n) => (n.textContent || "").trim())
          .join(" ")
          .trim()
        return /\bComparables\b/i.test(own) && own.length < 40
      })
    }
    const candidates = findTargets()
    if (candidates.length === 0) return { ok: false, clickedText: null }
    const target = candidates.find((e) => e.tagName === "A") || candidates[0]
    target.scrollIntoView?.({ block: "center" })
    target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }))
    return { ok: true, clickedText: (target.textContent || "").trim().slice(0, 60) }
  }).catch(() => ({ ok: false, clickedText: null }))
  return { ok: result.ok, where: result.ok ? `${frame.url().slice(0, 80)} :: "${result.clickedText}"` : null }
}

/** Dumps every anchor/li/span with short text across all frames —
 *  used to locate sidebar nav items when DOM outline misses them. */
async function dumpNavCandidates(page: Page, label: string): Promise<string> {
  try {
    const allFrames = [page.mainFrame(), ...page.frames().filter((f) => f !== page.mainFrame())]
    const out: Record<string, unknown> = { frames: [] }
    for (const frame of allFrames) {
      const data = await frame.evaluate(() => {
        const items: Array<{ tag: string; text: string; href: string | null; onclick: boolean; visible: boolean }> = []
        const els = Array.from(document.querySelectorAll("a, li, span[onclick], div[onclick], button")) as HTMLElement[]
        for (const el of els) {
          const own = Array.from(el.childNodes)
            .filter((n) => n.nodeType === 3)
            .map((n) => (n.textContent || "").trim())
            .join(" ")
            .trim()
          if (!own || own.length > 60) continue
          const r = el.getBoundingClientRect()
          items.push({
            tag: el.tagName.toLowerCase(),
            text: own,
            href: (el as HTMLAnchorElement).href || null,
            onclick: !!el.getAttribute("onclick") || !!(el as unknown as { onclick?: unknown }).onclick,
            visible: r.width > 0 && r.height > 0,
          })
        }
        return { url: location.href, items: items.slice(0, 200) }
      }).catch((e) => ({ error: String(e), url: frame.url() }))
      ;(out.frames as unknown[]).push(data)
    }
    await fs.mkdir(DEBUG_DIR, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, "-")
    const filepath = path.join(DEBUG_DIR, `${VENDOR}_${stamp}_${label}_nav.json`)
    await fs.writeFile(filepath, JSON.stringify(out, null, 2), "utf8")
    return filepath
  } catch {
    return ""
  }
}

/** Extracts comps from the Step-2 Comparables grid in the CMA Wizard.
 *  jqGrid pattern: header lives in <table class="ui-jqgrid-htable"> and
 *  body rows live in a SEPARATE <table class="ui-jqgrid-btable"> inside
 *  the same .ui-jqgrid-view container. Must pair them by proximity. */
async function extractWizardComps(frame: import("playwright").Frame): Promise<{ header: string[]; rows: SavedCMAComp[] }> {
  return await frame.evaluate(() => {
    const toNum = (s: string): number | null => {
      if (!s) return null
      const cleaned = s.replace(/[$,]/g, "").trim()
      const n = parseFloat(cleaned)
      return Number.isFinite(n) ? n : null
    }
    const toInt = (s: string): number | null => {
      const n = toNum(s)
      return n == null ? null : Math.round(n)
    }

    // Collect ALL candidate (header, body) pairs. For each header table with
    // MLS+Price+Address, locate a body table with matching column count
    // either in the same DOM subtree or in the shared .ui-jqgrid-view parent.
    type Pair = { header: string[]; body: HTMLTableElement; score: number }
    const pairs: Pair[] = []
    const tables = Array.from(document.querySelectorAll("table")) as HTMLTableElement[]

    for (const hdrTable of tables) {
      const hdrCells = Array.from(hdrTable.querySelectorAll("thead th, thead td, th"))
      if (hdrCells.length < 4) continue
      const headerText = hdrCells.map((c) => (c.textContent || "").trim())
      const joined = headerText.join(" | ").toLowerCase()
      if (!joined.includes("mls") || !joined.includes("price") || !joined.includes("address")) continue

      // Same-table body first
      const ownRows = hdrTable.querySelectorAll("tbody tr").length
      if (ownRows > 0) {
        pairs.push({ header: headerText, body: hdrTable, score: ownRows })
        continue
      }

      // Walk up looking for .ui-jqgrid-view (or similar) and find sibling body
      let parent: HTMLElement | null = hdrTable.parentElement
      let bodyTable: HTMLTableElement | null = null
      let hops = 0
      while (parent && hops < 6 && !bodyTable) {
        // Any <table> with >0 tbody rows within this parent subtree
        const candidates = Array.from(parent.querySelectorAll("table")) as HTMLTableElement[]
        for (const c of candidates) {
          if (c === hdrTable) continue
          if (c.querySelectorAll("tbody tr").length > 0) {
            // Prefer tables whose tbody td count matches header length
            const firstRowCells = c.querySelector("tbody tr")?.querySelectorAll("td").length ?? 0
            if (Math.abs(firstRowCells - headerText.length) <= 3) {
              bodyTable = c
              break
            }
          }
        }
        parent = parent.parentElement
        hops += 1
      }
      if (bodyTable) {
        pairs.push({ header: headerText, body: bodyTable, score: bodyTable.querySelectorAll("tbody tr").length })
      }
    }

    if (pairs.length === 0) return { header: [], rows: [] }
    // Pick the pair with most body rows
    pairs.sort((a, b) => b.score - a.score)
    const { header: bestHeader, body: bestBody } = pairs[0]

    const idx = (name: string) =>
      bestHeader.findIndex((h) => h.toLowerCase().includes(name.toLowerCase()))

    const iMls = idx("mls")
    const iPrice = bestHeader.findIndex((h) => /^price$/i.test(h.trim())) >= 0
      ? bestHeader.findIndex((h) => /^price$/i.test(h.trim()))
      : idx("price")
    const iAddress = idx("address")
    const iCity = idx("city")
    const iState = bestHeader.findIndex((h) => /^state$/i.test(h.trim())) >= 0
      ? bestHeader.findIndex((h) => /^state$/i.test(h.trim()))
      : idx("state")
    const iClass = idx("class")
    const iType = idx("type")
    const iArea = idx("area")
    const iBeds = bestHeader.findIndex((h) => /\bbeds?\b|bedrooms/i.test(h))
    const iBaths = bestHeader.findIndex((h) => /\bbaths?\b|bathrooms/i.test(h))
    // Must NOT match "Price Per SQFT" or "List Price/SqFt Liv" — those are
    // unit prices. "SqFt Living" / "Living Area" / "Living SqFt" only.
    const iSqft = bestHeader.findIndex((h) => /sqft living|sq ?ft living|living sqft|living sq ?ft|living area/i.test(h))
    const iDom = bestHeader.findIndex((h) => /\bdom\b/i.test(h))
    const iStatus = idx("status")

    const at = (cells: string[], i: number): string | null =>
      i >= 0 && i < cells.length ? (cells[i] || "").trim() : null

    const bodyRows = Array.from(bestBody.querySelectorAll("tbody tr")) as HTMLTableRowElement[]
    const rows = bodyRows.map((tr) => {
      const cells = Array.from(tr.querySelectorAll("td")).map((c) => (c.textContent || "").trim())
      return {
        mlsNumber: at(cells, iMls),
        address: at(cells, iAddress),
        city: at(cells, iCity),
        state: at(cells, iState),
        propertyClass: at(cells, iClass),
        propertyType: at(cells, iType),
        area: at(cells, iArea),
        price: toNum(at(cells, iPrice) || ""),
        beds: toInt(at(cells, iBeds) || ""),
        baths: toNum(at(cells, iBaths) || ""),
        sqft: toInt(at(cells, iSqft) || ""),
        dom: toInt(at(cells, iDom) || ""),
        status: at(cells, iStatus),
        rawCells: cells,
      }
    }).filter((r) => r.mlsNumber || r.address || r.price)

    return { header: bestHeader, rows }
  }) as Promise<{ header: string[]; rows: SavedCMAComp[] }>
}

/** Walks every frame and returns the one most likely to host the CMA
 *  wizard — frame whose URL contains CMA/Main.mvc or CMA/Presentation. */
function findCMAWizardFrame(page: Page): import("playwright").Frame | null {
  const frames = [page.mainFrame(), ...page.frames().filter((f) => f !== page.mainFrame())]
  // Prefer the deepest CMA-related frame (latest navigated)
  const matches = frames.filter((f) => /\/CMA\//i.test(f.url()))
  return matches[matches.length - 1] || null
}

/** Phase 3 — drill into one saved CMA and extract its comp table.
 *  SINGLE SHOT. No cross-CMA iteration. */
export async function paragonDrillSavedCMA(nameSubstring: string): Promise<SavedCMADrillResult> {
  const started = Date.now()
  const screenshots: string[] = []
  let session: VendorSession | null = null
  let step: SavedCMADrillResult["stepReached"] = "list"

  const finish = (
    status: SavedCMADrillResult["status"],
    reason: string | undefined,
    extra: Partial<SavedCMADrillResult> = {},
  ): SavedCMADrillResult => ({
    status,
    reason,
    loginPath: session?.refreshed ? "fresh" : "reused",
    cmaId: extra.cmaId ?? null,
    cmaName: extra.cmaName ?? null,
    subjectMls: extra.subjectMls ?? null,
    comps: extra.comps ?? [],
    compTableHeader: extra.compTableHeader ?? [],
    wizardUrl: extra.wizardUrl,
    screenshots,
    domDumpPath: extra.domDumpPath,
    durationMs: Date.now() - started,
    stepReached: step,
  })

  try {
    session = await rateLimited(VENDOR, () =>
      openVendorSession({
        vendor: VENDOR,
        probeUrl: "https://roam.clareity.net/layouts",
        login: paragonLogin,
        isLoggedIn: isParagonLoggedIn,
        sessionMaxAgeDays: 7,
      }),
    )
    const { context, page } = session
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {})
    await dismissDashboardModal(page)
    const popup = await openParagonPopup(page, context)
    await dismissUserPreferencesWizard(popup)
    await popup.waitForTimeout(800)

    // Nav to Saved Presentations
    await injectNameShim(popup)
    const navResult = await popup.evaluate(() => {
      const all = Array.from(document.querySelectorAll("a, li, span, td, div")) as HTMLElement[]
      const saved = all.find((el) => {
        const own = Array.from(el.childNodes)
          .filter((n) => n.nodeType === 3)
          .map((n) => (n.textContent || "").trim())
          .join(" ")
          .trim()
        return /^\s*Saved Presentations\s*$/i.test(own)
      })
      if (!saved) return { ok: false }
      saved.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }))
      return { ok: true }
    })
    if (!navResult?.ok) return finish("FAIL", "Could not navigate to Saved Presentations")

    await popup.waitForTimeout(2500)
    await popup.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {})

    let cmaFrame = findCMAFrame(popup)
    const frameDeadline = Date.now() + 10000
    while (!cmaFrame && Date.now() < frameDeadline) {
      await popup.waitForTimeout(500)
      cmaFrame = findCMAFrame(popup)
    }
    if (!cmaFrame) return finish("FAIL", "CMA list frame not found")

    await injectNameShim(cmaFrame)

    // Expand page size so all rows are reachable
    await setCMAPageSizeMax(cmaFrame).catch(() => null)
    await popup.waitForTimeout(1500)

    screenshots.push(await captureLandingScreenshot(popup, "day4p3_01_list"))

    // Click into the target CMA
    await injectNameShim(cmaFrame)
    const clicked = await clickSavedCMAByName(cmaFrame, nameSubstring)
    if (!clicked.ok) {
      return finish("FAIL", `No CMA row matched "${nameSubstring}"`)
    }
    step = "row_found"

    // Wait for wizard to open — new frame nav under /CMA/
    await popup.waitForTimeout(3000)
    await popup.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {})
    screenshots.push(await captureLandingScreenshot(popup, "day4p3_02_post_click"))

    const wizardFrame = findCMAWizardFrame(popup) || cmaFrame
    step = "wizard_opened"
    const wizardUrl = wizardFrame.url()

    // Captcha guard
    const cap = await detectCaptcha(popup)
    if (cap.present) {
      throw new ScraperHaltError(
        `Captcha detected in wizard (${cap.kind ?? "unknown"})`,
        VENDOR,
        await captureLandingScreenshot(popup, "day4p3_captcha"),
      )
    }

    // Inject shim in all current frames (new frames may have attached)
    await injectNameShim(popup)
    for (const f of popup.frames()) await injectNameShim(f)

    // Always dump nav candidates BEFORE click — so we have evidence even on success.
    const preClickNavDump = await dumpNavCandidates(popup, "day4p3_pre_comparables_nav")
    if (preClickNavDump) screenshots.push(preClickNavDump)

    // Iterate WIZARD-SCOPED frames only. Saved-presentations list frame at
    // /CMA/Main.mvc/CMA/0?searchID=... has a jqGrid header cell literally
    // named "Comparables" which was hijacking the click. Wizard shell is at
    // /CMA/Main.mvc?cmaId=... (cmaId query param, no /CMA/0 path segment).
    const isWizardFrame = (f: import("playwright").Frame): boolean => {
      const u = f.url()
      if (!/cmaId=\d+/i.test(u)) return false
      if (/\/CMA\/0/i.test(u)) return false
      return true
    }
    const wizardFrames = popup.frames().filter(isWizardFrame)
    let compsClicked: { ok: boolean; where: string | null } = { ok: false, where: null }
    for (const f of wizardFrames) {
      compsClicked = await clickWizardComparables(f)
      if (compsClicked.ok) break
    }

    if (!compsClicked.ok) {
      // Dump anchors so we can locate the Comparables element exactly.
      const navDump = await dumpNavCandidates(popup, "day4p3_wizard_no_comparables_link")
      const domDump = await captureListDomOutline(popup, "day4p3_wizard_no_comparables_dom")
      return finish("FAIL", `Could not click Comparables step. Nav dump: ${navDump}`, {
        cmaId: clicked.cmaId,
        cmaName: clicked.name,
        subjectMls: clicked.subjectMls,
        wizardUrl,
        domDumpPath: domDump,
      })
    }
    step = "comparables_nav"
    console.log(`[mls] comparables clicked in: ${compsClicked.where}`)
    // Generating CMA animation can run 5-15s per Caleb's screenshots
    await popup.waitForTimeout(5000)
    await popup.waitForLoadState("networkidle", { timeout: 25000 }).catch(() => {})
    screenshots.push(await captureLandingScreenshot(popup, "day4p3_03_comparables_view"))

    // Shim all frames again — comparables click likely spawned new content frames
    for (const f of popup.frames()) await injectNameShim(f)

    // Extract comps from the most likely frame — re-check after Comparables click
    const postClickWizFrame = findCMAWizardFrame(popup) || wizardFrame
    let extract = await extractWizardComps(postClickWizFrame).catch(() => ({ header: [], rows: [] }))
    if (extract.rows.length === 0) {
      // Try every frame
      for (const f of popup.frames()) {
        const r = await extractWizardComps(f).catch(() => ({ header: [], rows: [] }))
        if (r.rows.length > 0) {
          extract = r
          break
        }
      }
    }

    const domDumpPath = await captureListDomOutline(popup, "day4p3_comparables_dom")

    if (extract.rows.length === 0) {
      return finish("FAIL", "Comparables grid not found or empty after step nav", {
        cmaId: clicked.cmaId,
        cmaName: clicked.name,
        subjectMls: clicked.subjectMls,
        wizardUrl,
        compTableHeader: extract.header,
        domDumpPath,
      })
    }
    step = "comps_extracted"

    recordSuccess(VENDOR)
    await logScrapeRun({ vendor: VENDOR, subject: `saved_cma_${clicked.cmaId}`, status: "success", durationMs: Date.now() - started })

    return finish("PASS", undefined, {
      cmaId: clicked.cmaId,
      cmaName: clicked.name,
      subjectMls: clicked.subjectMls,
      comps: extract.rows,
      compTableHeader: extract.header,
      wizardUrl,
      domDumpPath,
    })
  } catch (err) {
    if (err instanceof ScraperHaltError) return finish("HALT", err.reason)
    const message = err instanceof Error ? err.message : String(err)
    recordFailure(VENDOR)
    await logScrapeRun({ vendor: VENDOR, subject: `saved_cma_drill_${nameSubstring}`, status: "failure", durationMs: Date.now() - started, error: message })
    return finish("FAIL", message)
  } finally {
    if (session?.context) {
      await session.context.close().catch(() => {})
    }
  }
}

// ── Day 4 Phase 4: batch harvest comps from many saved CMAs ────────────

export interface SavedCMAHarvestTarget {
  cmaId: string
  name: string
}

export interface SavedCMAHarvestResult {
  cmaId: string
  name: string
  status: "PASS" | "FAIL" | "SKIPPED"
  reason?: string
  compCount: number
  snapshotPath?: string
}

export interface SavedCMABatchResult {
  status: "PASS" | "FAIL" | "HALT"
  reason?: string
  loginPath: "fresh" | "reused"
  results: SavedCMAHarvestResult[]
  durationMs: number
}

/** Navigates the popup back to the saved-CMA list (Saved Presentations). */
async function returnToSavedList(popup: Page): Promise<boolean> {
  await injectNameShim(popup)
  for (const f of popup.frames()) await injectNameShim(f)
  const r = await popup.evaluate(() => {
    const all = Array.from(document.querySelectorAll("a, li, span, td, div")) as HTMLElement[]
    const saved = all.find((el) => {
      const own = Array.from(el.childNodes)
        .filter((n) => n.nodeType === 3)
        .map((n) => (n.textContent || "").trim())
        .join(" ")
        .trim()
      return /^\s*Saved Presentations\s*$/i.test(own)
    })
    if (!saved) return false
    saved.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }))
    return true
  })
  await popup.waitForTimeout(2500)
  await popup.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {})
  return r
}

/** Single-session batch harvester. Opens popup once, iterates targets in
 *  order, saves a per-CMA snapshot. Resumable: skips targets whose
 *  snapshot file already exists at SNAPSHOT_DIR/cma_{id}_{slug}.json. */
export async function paragonHarvestSavedCMAs(
  targets: SavedCMAHarvestTarget[],
  options: { politePauseMs?: number; resumeFromSnapshots?: boolean } = {},
): Promise<SavedCMABatchResult> {
  const started = Date.now()
  const politePauseMs = options.politePauseMs ?? 2000
  const resume = options.resumeFromSnapshots !== false
  const SNAPSHOT_DIR = path.resolve(process.cwd(), "lib/cma/scrapers/snapshots/mls_paragon/saved_cmas")
  await fs.mkdir(SNAPSHOT_DIR, { recursive: true })

  const slug = (s: string) => s.replace(/[^a-z0-9]+/gi, "_").toLowerCase()
  const snapshotPathFor = (cmaId: string, name: string) =>
    path.join(SNAPSHOT_DIR, `cma_${cmaId}_${slug(name)}.json`)

  let session: VendorSession | null = null
  const results: SavedCMAHarvestResult[] = []

  try {
    session = await rateLimited(VENDOR, () =>
      openVendorSession({
        vendor: VENDOR,
        probeUrl: "https://roam.clareity.net/layouts",
        login: paragonLogin,
        isLoggedIn: isParagonLoggedIn,
        sessionMaxAgeDays: 7,
      }),
    )
    const { context, page } = session
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {})
    await dismissDashboardModal(page)

    // Helper: open a fresh popup, dismiss wizard, navigate to Saved list.
    // Used between iterations to discard stale Comparable.mvc frames that
    // Paragon retains across CMA navigations and that caused a state leak
    // (every batched CMA got the previous CMA's comps in the first run).
    const openFreshPopup = async (): Promise<Page> => {
      const p = await openParagonPopup(page, context)
      await dismissUserPreferencesWizard(p)
      await p.waitForTimeout(800)
      await returnToSavedList(p)
      return p
    }

    let popup = await openFreshPopup()
    let isFirst = true

    for (const target of targets) {
      // Tear down + reopen popup BEFORE each iteration after the first.
      // Guarantees the new CMA's wizard loads into a clean DOM with no
      // residual Comparable.mvc frames from the previous CMA.
      if (!isFirst) {
        await popup.close().catch(() => {})
        popup = await openFreshPopup()
        await popup.waitForTimeout(politePauseMs)
      }
      isFirst = false

      const snapPath = snapshotPathFor(target.cmaId, target.name)
      if (resume) {
        const exists = await fs.stat(snapPath).then(() => true).catch(() => false)
        if (exists) {
          results.push({ cmaId: target.cmaId, name: target.name, status: "SKIPPED", reason: "snapshot exists", compCount: 0, snapshotPath: snapPath })
          console.log(`[harvest] SKIP ${target.cmaId} ${target.name} (snapshot exists)`)
          continue
        }
      }

      // Captcha guard each iteration
      const cap = await detectCaptcha(popup)
      if (cap.present) {
        throw new ScraperHaltError(
          `Captcha detected mid-batch (${cap.kind ?? "unknown"})`,
          VENDOR,
          await captureLandingScreenshot(popup, "day4p4_captcha"),
        )
      }

      // Find & inject shim on saved-list frame
      let cmaFrame = findCMAFrame(popup)
      const frameDeadline = Date.now() + 8000
      while (!cmaFrame && Date.now() < frameDeadline) {
        await popup.waitForTimeout(500)
        cmaFrame = findCMAFrame(popup)
      }
      if (!cmaFrame) {
        results.push({ cmaId: target.cmaId, name: target.name, status: "FAIL", reason: "saved-list frame not found", compCount: 0 })
        continue  // popup will be torn down at top of next iteration
      }
      await injectNameShim(cmaFrame)
      await setCMAPageSizeMax(cmaFrame).catch(() => null)
      await popup.waitForTimeout(800)

      // Click into the CMA by exact CMAID
      const clicked = await clickSavedCMAByName(cmaFrame, target.name, target.cmaId)
      if (!clicked.ok) {
        results.push({ cmaId: target.cmaId, name: target.name, status: "FAIL", reason: "row not found by cmaId", compCount: 0 })
        continue
      }

      // Wait for wizard
      await popup.waitForTimeout(3000)
      await popup.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {})
      await injectNameShim(popup)
      for (const f of popup.frames()) await injectNameShim(f)

      // Click Step 2: Comparables in wizard-scoped frames
      const isWizardFrame = (f: import("playwright").Frame): boolean => {
        const u = f.url()
        if (!/cmaId=\d+/i.test(u)) return false
        if (/\/CMA\/0/i.test(u)) return false
        return true
      }
      let compsClicked: { ok: boolean; where: string | null } = { ok: false, where: null }
      for (const f of popup.frames().filter(isWizardFrame)) {
        compsClicked = await clickWizardComparables(f)
        if (compsClicked.ok) break
      }
      if (!compsClicked.ok) {
        results.push({ cmaId: target.cmaId, name: target.name, status: "FAIL", reason: "Comparables click missed", compCount: 0 })
        continue
      }

      await popup.waitForTimeout(5000)
      await popup.waitForLoadState("networkidle", { timeout: 25000 }).catch(() => {})

      // Re-shim, then extract from any frame
      for (const f of popup.frames()) await injectNameShim(f)
      let extract: { header: string[]; rows: SavedCMAComp[] } = { header: [], rows: [] }
      const wizardFrame = findCMAWizardFrame(popup)
      if (wizardFrame) extract = await extractWizardComps(wizardFrame).catch(() => ({ header: [], rows: [] }))
      if (extract.rows.length === 0) {
        for (const f of popup.frames()) {
          const r = await extractWizardComps(f).catch(() => ({ header: [], rows: [] }))
          if (r.rows.length > 0) {
            extract = r
            break
          }
        }
      }

      const snapshot = {
        capturedAt: new Date().toISOString(),
        cmaId: clicked.cmaId,
        cmaName: clicked.name,
        subjectMls: clicked.subjectMls,
        compTableHeader: extract.header,
        comps: extract.rows,
      }
      await fs.writeFile(snapPath, JSON.stringify(snapshot, null, 2), "utf8")

      results.push({
        cmaId: target.cmaId,
        name: target.name,
        status: extract.rows.length > 0 ? "PASS" : "FAIL",
        reason: extract.rows.length === 0 ? "0 comps extracted" : undefined,
        compCount: extract.rows.length,
        snapshotPath: snapPath,
      })
      console.log(`[harvest] ${extract.rows.length > 0 ? "OK  " : "FAIL"} ${target.cmaId} ${target.name} → ${extract.rows.length} comps`)
    }

    recordSuccess(VENDOR)
    await logScrapeRun({ vendor: VENDOR, subject: `harvest_${targets.length}_cmas`, status: "success", durationMs: Date.now() - started })

    return {
      status: "PASS",
      loginPath: session.refreshed ? "fresh" : "reused",
      results,
      durationMs: Date.now() - started,
    }
  } catch (err) {
    if (err instanceof ScraperHaltError) {
      return { status: "HALT", reason: err.reason, loginPath: session?.refreshed ? "fresh" : "reused", results, durationMs: Date.now() - started }
    }
    const message = err instanceof Error ? err.message : String(err)
    recordFailure(VENDOR)
    return { status: "FAIL", reason: message, loginPath: session?.refreshed ? "fresh" : "reused", results, durationMs: Date.now() - started }
  } finally {
    if (session?.context) {
      await session.context.close().catch(() => {})
    }
  }
}

/** Phase 1 recon for saved CMA harvest. Single shot, list view only. */
export async function paragonListSavedPresentations(): Promise<SavedPresentationsReconResult> {
  const started = Date.now()
  const screenshots: string[] = []
  let session: VendorSession | null = null
  let step: SavedPresentationsReconResult["stepReached"] = "session"
  let domOutlinePath: string | undefined

  const finish = (
    status: SavedPresentationsReconResult["status"],
    reason: string | undefined,
    listUrl?: string,
    listTitle?: string | null,
    rowCountHint: number | null = null,
  ): SavedPresentationsReconResult => ({
    status,
    reason,
    stepReached: step,
    loginPath: session?.refreshed ? "fresh" : "reused",
    listUrl,
    listTitle: listTitle ?? null,
    rowCountHint,
    screenshots,
    domOutlinePath,
    durationMs: Date.now() - started,
  })

  try {
    session = await rateLimited(VENDOR, () =>
      openVendorSession({
        vendor: VENDOR,
        probeUrl: "https://roam.clareity.net/layouts",
        login: paragonLogin,
        isLoggedIn: isParagonLoggedIn,
        sessionMaxAgeDays: 7,
      }),
    )
    const { context, page } = session
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(800)
    step = "dashboard"
    screenshots.push(await captureLandingScreenshot(page, "day4_01_dashboard"))

    await dismissDashboardModal(page)
    const popup = await openParagonPopup(page, context)
    step = "popup_opened"
    screenshots.push(await captureLandingScreenshot(popup, "day4_02_popup_opened"))

    await dismissUserPreferencesWizard(popup)
    step = "wizard_dismissed"
    await popup.waitForTimeout(1000)
    screenshots.push(await captureLandingScreenshot(popup, "day4_03_post_wizard"))

    // Read-only DOM dump BEFORE click — evidence for selector writing.
    const cmaDumpPath = await dumpCMAElementCandidates(popup, "day4_pre_cma_click")
    if (cmaDumpPath) screenshots.push(cmaDumpPath)

    // DOM-evidence-driven approach: the CMA dropdown and its sub-items
    // ("Saved Presentations", "Create Presentation", etc.) are pre-rendered
    // in the DOM but CSS-hidden via classic ASP.NET icon-sprite pattern.
    // Their click handlers are active regardless of visibility. Dispatch the
    // click directly via evaluate() — bypasses text-indent:-9999px and
    // legacy nav icon-offset guesswork.
    const directClickResult = await popup.evaluate(() => {
      const result = {
        tabFound: false,
        subItemFound: false,
        subItemText: null as string | null,
        subItemHref: null as string | null,
        navigated: false,
        errors: [] as string[],
      }
      try {
        // Find anchors whose *ownText* (not descendant) is exactly "Saved Presentations"
        const all = Array.from(document.querySelectorAll("a, button, li, span, td, div")) as HTMLElement[]
        const savedCandidates = all.filter((el) => {
          const own = Array.from(el.childNodes)
            .filter((n) => n.nodeType === 3)
            .map((n) => (n.textContent || "").trim())
            .join(" ")
            .trim()
          return /^\s*Saved Presentations\s*$/i.test(own)
        })
        // Prefer an <a>
        const saved = savedCandidates.find((e) => e.tagName === "A") || savedCandidates[0]
        if (!saved) {
          result.errors.push("No 'Saved Presentations' element found in DOM")
          return result
        }
        result.subItemFound = true
        result.subItemText = saved.textContent?.trim() || null
        result.subItemHref = (saved as HTMLAnchorElement).href || saved.getAttribute("data-url") || null

        // Also find CMA tab anchor (for observability only)
        const cmaTab = all.find((el) => {
          const own = Array.from(el.childNodes)
            .filter((n) => n.nodeType === 3)
            .map((n) => (n.textContent || "").trim())
            .join(" ")
            .trim()
          return /^CMA$/i.test(own) && el.tagName === "A"
        })
        result.tabFound = !!cmaTab

        // Nuclear option: dispatch click on the saved-presentations element.
        // Works for most legacy ASP.NET menus — their click handlers are
        // wired at parse time, not on CSS visibility toggles.
        saved.scrollIntoView?.({ block: "center", inline: "center" })
        const evt = new MouseEvent("click", { bubbles: true, cancelable: true, view: window, button: 0 })
        saved.dispatchEvent(evt)
        result.navigated = true
      } catch (e) {
        result.errors.push(String(e))
      }
      return result
    })

    if (!directClickResult.subItemFound) {
      screenshots.push(await captureLandingScreenshot(popup, "day4_04_saved_pres_FAIL"))
      return finish("FAIL", `Saved Presentations element not in DOM. Dump: ${cmaDumpPath}. Detail: ${JSON.stringify(directClickResult)}`, popup.url())
    }
    step = "cma_tab_open"
    await popup.waitForTimeout(1500)
    await popup.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {})
    screenshots.push(await captureLandingScreenshot(popup, "day4_04_saved_pres_dispatched"))
    step = "saved_presentations_clicked"
    await popup.waitForTimeout(1500)
    await popup.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {})
    screenshots.push(await captureLandingScreenshot(popup, "day4_05_saved_presentations_list"))

    // Post-load captcha check (defensive — unlikely on internal CMA page)
    const cap = await detectCaptcha(popup)
    if (cap.present) {
      throw new ScraperHaltError(
        `Captcha detected on Saved Presentations list (${cap.kind ?? "unknown"})`,
        VENDOR,
        await captureLandingScreenshot(popup, "day4_captcha_on_list"),
      )
    }

    step = "list_rendered"
    domOutlinePath = await captureListDomOutline(popup, "day4_05_saved_presentations")

    // Rough row count hint — count first-hit table's tbody rows
    const rowCountHint = await popup
      .evaluate(() => {
        const t = document.querySelector("table")
        return t ? t.querySelectorAll("tbody tr").length : null
      })
      .catch(() => null)

    recordSuccess(VENDOR)
    await logScrapeRun({ vendor: VENDOR, subject: "saved_cmas_recon", status: "success", durationMs: Date.now() - started })

    return finish("PASS", undefined, popup.url(), await popup.title().catch(() => null), rowCountHint ?? null)
  } catch (err) {
    if (err instanceof ScraperHaltError) {
      return finish("HALT", err.reason)
    }
    const message = err instanceof Error ? err.message : String(err)
    recordFailure(VENDOR)
    await logScrapeRun({ vendor: VENDOR, subject: "saved_cmas_recon", status: "failure", durationMs: Date.now() - started, error: message })
    return finish("FAIL", message)
  } finally {
    if (session?.context) {
      await session.context.close().catch(() => {})
    }
  }
}
