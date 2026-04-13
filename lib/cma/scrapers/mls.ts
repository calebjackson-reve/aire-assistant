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
