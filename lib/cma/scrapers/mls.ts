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

/** Login marker heuristic — post-login pages drop the /login path and expose a nav shell. */
async function isParagonLoggedIn(page: Page): Promise<boolean> {
  const url = page.url().toLowerCase()
  if (url.includes("login") || url.includes("signin") || url.includes("authenticate")) return false
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
  await page.waitForLoadState("domcontentloaded", { timeout: 45000 }).catch(() => {})
  await humanPause(1200, 2400)

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

export async function shutdownParagonScraper() {
  await closeBrowser()
}
