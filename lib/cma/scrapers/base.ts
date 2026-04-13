/**
 * CMA Scraper Base
 *
 * Playwright session management, rate limiting, and audit logging shared by
 * MLS / PropStream / RPR scrapers. Loads credentials from .env.agents.local.
 *
 * Design tenets:
 *  - One browser context per vendor, reused across calls within a process.
 *  - Persistent storageState per vendor → avoid re-login on every scrape.
 *  - ≥ 2s between requests to the same vendor (serial queue).
 *  - Circuit breaker: 3 consecutive failures → pause vendor 15 min.
 *  - Every scrape row recorded in ScraperSession + (later) a job_runs log.
 *  - Never persist raw HTML (Caleb: screenshots + JSON only).
 */

import { chromium, Browser, BrowserContext, Page } from "playwright"
import fs from "node:fs/promises"
import fsSync from "node:fs"
import path from "node:path"
import crypto from "node:crypto"

// ── Credentials loader (minimal parser for .env.agents.local) ────────────

const AGENTS_ENV_PATH = path.resolve(process.cwd(), ".env.agents.local")
let agentsEnvLoaded = false

function loadAgentsEnv() {
  if (agentsEnvLoaded) return
  agentsEnvLoaded = true
  let raw: string
  try {
    raw = fsSync.readFileSync(AGENTS_ENV_PATH, "utf8")
  } catch {
    return // file missing — getVendorCredentials will throw a clear error
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}

export type VendorKey = "mls_paragon" | "propstream" | "rpr"

export interface VendorCredentials {
  loginUrl: string
  username: string
  password: string
}

export function getVendorCredentials(vendor: VendorKey): VendorCredentials {
  loadAgentsEnv()
  const prefix = vendor === "mls_paragon" ? "MLS" : vendor === "propstream" ? "PROPSTREAM" : "RPR"
  const loginUrl = process.env[`${prefix}_LOGIN_URL`]
  const username = process.env[`${prefix}_USERNAME`]
  const password = process.env[`${prefix}_PASSWORD`]
  if (!loginUrl || !username || !password) {
    throw new Error(`Missing credentials for ${vendor} — expected ${prefix}_LOGIN_URL, ${prefix}_USERNAME, ${prefix}_PASSWORD in .env.agents.local`)
  }
  return { loginUrl, username, password }
}

// ── Paths ────────────────────────────────────────────────────────────────

const SESSIONS_DIR = path.resolve(process.cwd(), "lib/cma/scrapers/sessions")
const DEBUG_DIR = path.resolve(process.cwd(), "lib/cma/scrapers/debug")

export function sessionPath(vendor: VendorKey) {
  return path.join(SESSIONS_DIR, `${vendor}.json`)
}

async function ensureDirs() {
  await fs.mkdir(SESSIONS_DIR, { recursive: true })
  await fs.mkdir(DEBUG_DIR, { recursive: true })
}

// ── Rate-limit queues (one per vendor) ───────────────────────────────────

const MIN_GAP_MS = 2000
const lastRequestAt: Record<string, number> = {}
const vendorQueues: Record<string, Promise<unknown>> = {}

export async function rateLimited<T>(vendor: VendorKey, fn: () => Promise<T>): Promise<T> {
  const prior = vendorQueues[vendor] ?? Promise.resolve()
  const next = prior.then(async () => {
    const now = Date.now()
    const elapsed = now - (lastRequestAt[vendor] ?? 0)
    if (elapsed < MIN_GAP_MS) {
      await sleep(MIN_GAP_MS - elapsed + jitter(200, 800))
    }
    lastRequestAt[vendor] = Date.now()
    return fn()
  })
  vendorQueues[vendor] = next.catch(() => void 0) // swallow so queue doesn't deadlock
  return next as Promise<T>
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function jitter(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min))
}

// ── Circuit breaker (in-process + DB mirror) ─────────────────────────────

interface CircuitState {
  failures: number
  openUntil: number | null
}
const circuits: Record<string, CircuitState> = {}
const FAILURE_THRESHOLD = 3
const COOLDOWN_MS = 15 * 60 * 1000

export function assertCircuitClosed(vendor: VendorKey) {
  const c = circuits[vendor]
  if (c?.openUntil && Date.now() < c.openUntil) {
    const remaining = Math.round((c.openUntil - Date.now()) / 1000)
    throw new Error(`Circuit open for ${vendor} — cooling down ${remaining}s`)
  }
}

export function recordSuccess(vendor: VendorKey) {
  circuits[vendor] = { failures: 0, openUntil: null }
}

export function recordFailure(vendor: VendorKey) {
  const prev = circuits[vendor] ?? { failures: 0, openUntil: null }
  const failures = prev.failures + 1
  const openUntil = failures >= FAILURE_THRESHOLD ? Date.now() + COOLDOWN_MS : null
  circuits[vendor] = { failures, openUntil }
}

// ── Browser + context management ─────────────────────────────────────────

let browserPromise: Promise<Browser> | null = null

export function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      headless: true,
      args: ["--disable-blink-features=AutomationControlled"],
    })
  }
  return browserPromise
}

export async function closeBrowser() {
  if (!browserPromise) return
  const browser = await browserPromise
  await browser.close()
  browserPromise = null
}

const COMMON_CONTEXT_OPTS = {
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  viewport: { width: 1440, height: 900 },
  locale: "en-US",
  timezoneId: "America/Chicago",
  extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" },
}

async function maskAutomationFlags(context: BrowserContext) {
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false })
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] as unknown as PluginArray })
    Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] })
  })
}

export interface VendorSessionOpts {
  vendor: VendorKey
  login: (page: Page, creds: VendorCredentials) => Promise<void>
  probeUrl: string
  isLoggedIn: (page: Page) => Promise<boolean>
  /** Session reuse window in days. Defaults: mls_paragon=7, propstream=1, rpr=1. */
  sessionMaxAgeDays?: number
}

/** Per-vendor session TTL defaults (days). */
export const DEFAULT_SESSION_TTL_DAYS: Record<VendorKey, number> = {
  mls_paragon: 7,
  propstream: 1,
  rpr: 1,
}

export interface VendorSession {
  context: BrowserContext
  page: Page
  refreshed: boolean
  sessionAgeDays: number | null
}

async function sessionAgeDays(storagePath: string): Promise<number | null> {
  try {
    const s = await fs.stat(storagePath)
    const ms = Date.now() - s.mtimeMs
    return ms / (24 * 3600 * 1000)
  } catch {
    return null
  }
}

/**
 * Returns a ready-to-use authenticated context for the vendor.
 * Reuses storageState when: file exists AND age < sessionMaxAgeDays AND
 * the login probe succeeds. Otherwise re-logs in.
 */
export async function openVendorSession(opts: VendorSessionOpts): Promise<VendorSession> {
  assertCircuitClosed(opts.vendor)
  await ensureDirs()

  const browser = await getBrowser()
  const storagePath = sessionPath(opts.vendor)
  const hasSession = await fileExists(storagePath)
  const ageDays = hasSession ? await sessionAgeDays(storagePath) : null
  const ttlDays = opts.sessionMaxAgeDays ?? DEFAULT_SESSION_TTL_DAYS[opts.vendor]
  const sessionFresh = hasSession && ageDays !== null && ageDays < ttlDays

  const context = await browser.newContext({
    ...COMMON_CONTEXT_OPTS,
    storageState: sessionFresh ? storagePath : undefined,
  })
  await maskAutomationFlags(context)

  const page = await context.newPage()
  let refreshed = false

  if (sessionFresh) {
    await page.goto(opts.probeUrl, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {})
    const stillLoggedIn = await safeBool(() => opts.isLoggedIn(page))
    if (!stillLoggedIn) {
      refreshed = true
      await loginAndPersist(opts, page, storagePath, context)
    }
  } else {
    refreshed = true
    await loginAndPersist(opts, page, storagePath, context)
  }

  return { context, page, refreshed, sessionAgeDays: ageDays }
}

async function loginAndPersist(
  opts: VendorSessionOpts,
  page: Page,
  storagePath: string,
  context: BrowserContext,
) {
  const creds = getVendorCredentials(opts.vendor)
  try {
    await page.goto(creds.loginUrl, { waitUntil: "domcontentloaded", timeout: 45000 })
    await page.waitForTimeout(jitter(600, 1400))
    await opts.login(page, creds)
    const ok = await safeBool(() => opts.isLoggedIn(page))
    if (!ok) {
      await captureDebug(opts.vendor, page, "login_failed_no_marker")
      throw new Error(`${opts.vendor} login appeared to succeed but no logged-in marker found`)
    }
    await context.storageState({ path: storagePath })
  } catch (err) {
    await captureDebug(opts.vendor, page, "login_exception")
    throw err
  }
}

async function safeBool(fn: () => Promise<boolean>): Promise<boolean> {
  try {
    return await fn()
  } catch {
    return false
  }
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

// ── Debug capture (screenshot + JSON, no HTML) ───────────────────────────

export async function captureDebug(vendor: VendorKey, page: Page, label: string) {
  try {
    await ensureDirs()
    const stamp = new Date().toISOString().replace(/[:.]/g, "-")
    const runId = crypto.randomBytes(4).toString("hex")
    const dir = path.join(DEBUG_DIR, `${vendor}_${stamp}_${label}_${runId}`)
    await fs.mkdir(dir, { recursive: true })
    await page.screenshot({ path: path.join(dir, "screenshot.png"), fullPage: true }).catch(() => {})
    const meta = {
      vendor,
      label,
      url: page.url(),
      title: await page.title().catch(() => null),
      capturedAt: new Date().toISOString(),
    }
    await fs.writeFile(path.join(dir, "meta.json"), JSON.stringify(meta, null, 2), "utf8")
    await rotateDebugDirs()
  } catch {
    // debug capture must never throw
  }
}

const MAX_DEBUG_DIRS = 20
async function rotateDebugDirs() {
  try {
    const entries = await fs.readdir(DEBUG_DIR, { withFileTypes: true })
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort()
    const excess = dirs.length - MAX_DEBUG_DIRS
    if (excess > 0) {
      for (let i = 0; i < excess; i++) {
        await fs.rm(path.join(DEBUG_DIR, dirs[i]), { recursive: true, force: true })
      }
    }
  } catch {
    // noop
  }
}

// ── Run logging (DB mirror + console) ────────────────────────────────────

export interface ScrapeRunLog {
  vendor: VendorKey
  subject: string
  status: "success" | "failure"
  durationMs: number
  compsReturned?: number
  error?: string
}

export async function logScrapeRun(log: ScrapeRunLog) {
  // ScraperSession upsert — full job_runs table comes later. For now mirror
  // circuit state + last activity to DB via Prisma if available.
  try {
    const { prisma } = await import("@/lib/prisma")
    await prisma.scraperSession.upsert({
      where: { vendor: log.vendor },
      update: {
        status: log.status === "success" ? "healthy" : "expired",
        lastProbeAt: new Date(),
        failureCount: log.status === "failure" ? { increment: 1 } : 0,
        notes: log.error ? `${new Date().toISOString()} ${log.error}`.slice(0, 500) : null,
      },
      create: {
        vendor: log.vendor,
        storagePath: sessionPath(log.vendor),
        lastLoginAt: new Date(),
        lastProbeAt: new Date(),
        status: log.status === "success" ? "healthy" : "expired",
        failureCount: log.status === "failure" ? 1 : 0,
      },
    })
  } catch {
    // DB might not be migrated yet in dev — fall back to console
  }
  const tag = log.status === "success" ? "[cma:scrape]" : "[cma:scrape:fail]"
  // eslint-disable-next-line no-console
  console.log(`${tag} ${log.vendor} subj="${log.subject}" dur=${log.durationMs}ms comps=${log.compsReturned ?? 0}${log.error ? ` err=${log.error}` : ""}`)
}

// ── Human-ish interaction helpers ────────────────────────────────────────

export async function humanType(page: Page, selector: string, value: string) {
  await page.click(selector)
  for (const char of value) {
    await page.keyboard.type(char, { delay: jitter(50, 150) })
  }
}

export async function humanPause(min = 600, max = 1400) {
  await sleep(jitter(min, max))
}

/**
 * Detects captcha/challenge walls on a page. If found, the caller MUST HALT.
 * Never attempt to solve or bypass — see error-log "Paragon MLS access risk".
 */
export async function detectCaptcha(page: Page): Promise<{ present: boolean; kind?: string }> {
  try {
    const html = (await page.content()).toLowerCase()
    if (html.includes("g-recaptcha") || html.includes("recaptcha")) return { present: true, kind: "reCAPTCHA" }
    if (html.includes("h-captcha") || html.includes("hcaptcha")) return { present: true, kind: "hCaptcha" }
    if (html.includes("cf-challenge") || html.includes("cloudflare") && html.includes("challenge")) return { present: true, kind: "Cloudflare" }
    if (html.includes("arkoselabs") || html.includes("funcaptcha")) return { present: true, kind: "Arkose" }
    if (html.includes("px-captcha") || html.includes("perimeterx")) return { present: true, kind: "PerimeterX" }
    // Generic keywords — only fire if in an actual challenge context
    if (/verify (you are|that you are) (human|not a robot)/i.test(html)) return { present: true, kind: "generic" }
    return { present: false }
  } catch {
    return { present: false }
  }
}

/** Halt sentinel — scraper throws this and the caller must stop all activity. */
export class ScraperHaltError extends Error {
  constructor(public reason: string, public vendor: VendorKey, public screenshotPath?: string) {
    super(`HALT: ${reason}`)
    this.name = "ScraperHaltError"
  }
}
