/**
 * CMA WIZARD FULL RECON — drills into ONE saved CMA, then iterates every
 * wizard step (Subject, Search, Comparables, Adjustments, Pricing, Pages,
 * Reports, Finish) and dumps the complete DOM surface of each frame.
 *
 * Writes to lib/cma/backtest/recon/<cmaId>_wizard_map.json with shape:
 *   {
 *     cmaId, cmaName, wizardSteps: [
 *       { stepName, clicked, frameUrl, visibleText, buttons: [{label, selector}], ... }
 *     ]
 *   }
 *
 * Purpose: give us a single dump that reveals exactly where the "Generate
 * Report" / "Print Preview" / "Suggested List Price" controls live in the
 * wizard. After one run we build the production generators from this map.
 *
 * Run:  npx tsx lib/cma/backtest/recon-wizard-full.ts "28274 lake bruin"
 * Output lives in lib/cma/backtest/recon/
 *
 * Safety:
 * - Single-shot, one CMA per invocation (respects B24140 thrash rules)
 * - Captcha → halt (inherits detectCaptcha from scrapers/base)
 * - Reuses 7-day storageState session
 * - Read-only: NO "Send CMA", NO "Save", NO destructive actions
 */

import { promises as fs } from "node:fs"
import path from "node:path"
import {
  openVendorSession,
  rateLimited,
  recordFailure,
  recordSuccess,
  logScrapeRun,
  ScraperHaltError,
  detectCaptcha,
  type VendorSession,
} from "../scrapers/base"
import {
  paragonLogin,
  isParagonLoggedIn,
  dismissDashboardModal,
  openParagonPopup,
  dismissUserPreferencesWizard,
  injectNameShim,
  setCMAPageSizeMax,
} from "../scrapers/mls"

// Re-export types kept minimal — importer only needs to know the shape
export interface WizardStepDump {
  stepName: string
  stepIndex: number
  clicked: boolean
  clickedVia: string | null
  frameUrls: string[]
  visibleTextPerFrame: Array<{ url: string; text: string }>
  buttonsPerFrame: Array<{ url: string; buttons: Array<{ label: string; tag: string; id: string; classes: string }> }>
  screenshotPath?: string
  error?: string
}

export interface WizardMap {
  capturedAt: string
  cmaName: string
  cmaId: string | null
  steps: WizardStepDump[]
}

const VENDOR = "mls_paragon" as const
const OUT_DIR = "lib/cma/backtest/recon"
const SCREENSHOT_DIR = "lib/cma/scrapers/debug"

/** Standard Paragon CMA wizard step labels (Black Knight / Paragon Connect). */
const CANDIDATE_STEP_NAMES = [
  "Subject",
  "Subject Property",
  "Search",
  "Comparables",
  "Adjustments",
  "Pricing",
  "Pricing Analysis",
  "Pages",
  "Cover",
  "Cover Page",
  "Reports",
  "Reports Setup",
  "Finish",
  "Preview",
  "Print",
]

function tsSlug(): string {
  return new Date().toISOString().replace(/[:.]/g, "-")
}

async function shotAll(popup: import("playwright").Page, label: string): Promise<string> {
  const filename = `${VENDOR}_${tsSlug()}_${label}.png`
  const full = path.join(SCREENSHOT_DIR, filename)
  await fs.mkdir(SCREENSHOT_DIR, { recursive: true })
  await popup.screenshot({ path: full, fullPage: true }).catch(() => {})
  return full
}

async function dumpFrameSurface(frame: import("playwright").Frame): Promise<{
  url: string
  text: string
  buttons: Array<{ label: string; tag: string; id: string; classes: string }>
}> {
  const url = frame.url()
  try {
    const result = await frame.evaluate(() => {
      const txt = (document.body?.innerText || "").slice(0, 20000)
      const selectors = ["button", "input[type='button']", "input[type='submit']", "a", "[role='button']", "[onclick]"]
      const found: Array<{ label: string; tag: string; id: string; classes: string }> = []
      const seen = new Set<string>()
      for (const sel of selectors) {
        const els = Array.from(document.querySelectorAll(sel)) as HTMLElement[]
        for (const el of els) {
          const raw = (el.innerText || (el as HTMLInputElement).value || el.getAttribute("title") || el.getAttribute("aria-label") || "").trim()
          if (!raw || raw.length > 80) continue
          const key = `${el.tagName}|${raw}|${el.id}`
          if (seen.has(key)) continue
          seen.add(key)
          found.push({
            label: raw,
            tag: el.tagName.toLowerCase(),
            id: el.id || "",
            classes: (el.className || "").toString().slice(0, 100),
          })
          if (found.length > 200) break
        }
        if (found.length > 200) break
      }
      return { text: txt, buttons: found }
    })
    return { url, text: result.text, buttons: result.buttons }
  } catch (err) {
    return { url, text: `[error: ${(err as Error).message}]`, buttons: [] }
  }
}

async function clickStepByName(
  popup: import("playwright").Page,
  stepName: string,
): Promise<{ clicked: boolean; clickedVia: string | null }> {
  // Try every frame to find a clickable element whose own text matches exactly
  for (const f of popup.frames()) {
    try {
      const hit = await f.evaluate((name: string) => {
        const all = Array.from(document.querySelectorAll("a, li, span, div, td, button")) as HTMLElement[]
        const candidates = all.filter((el) => {
          const own = Array.from(el.childNodes)
            .filter((n) => n.nodeType === 3)
            .map((n) => (n.textContent || "").trim())
            .join(" ")
            .trim()
          return own.toLowerCase() === name.toLowerCase()
        })
        if (candidates.length === 0) return null
        // Prefer the tallest candidate (likely the tab label container)
        candidates.sort((a, b) => (b.getBoundingClientRect().height - a.getBoundingClientRect().height))
        const el = candidates[0]
        el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }))
        return { tag: el.tagName.toLowerCase(), cls: (el.className || "").toString().slice(0, 80) }
      }, stepName)
      if (hit) {
        return { clicked: true, clickedVia: `frame=${f.url().slice(0, 90)} tag=${hit.tag}` }
      }
    } catch {
      // swallow and try next frame
    }
  }
  return { clicked: false, clickedVia: null }
}

async function walkWizardSteps(popup: import("playwright").Page): Promise<WizardStepDump[]> {
  const dumps: WizardStepDump[] = []

  for (let i = 0; i < CANDIDATE_STEP_NAMES.length; i += 1) {
    const stepName = CANDIDATE_STEP_NAMES[i]
    const dump: WizardStepDump = {
      stepName,
      stepIndex: i,
      clicked: false,
      clickedVia: null,
      frameUrls: [],
      visibleTextPerFrame: [],
      buttonsPerFrame: [],
    }

    try {
      const clickResult = await clickStepByName(popup, stepName)
      dump.clicked = clickResult.clicked
      dump.clickedVia = clickResult.clickedVia

      if (!clickResult.clicked) {
        dumps.push(dump)
        continue
      }

      await popup.waitForTimeout(2500)
      await popup.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {})

      // Shim all frames (new ones may have attached)
      for (const f of popup.frames()) await injectNameShim(f)

      // Captcha guard
      const cap = await detectCaptcha(popup)
      if (cap.present) {
        throw new ScraperHaltError(`Captcha detected at step "${stepName}"`, VENDOR)
      }

      const frames = popup.frames()
      dump.frameUrls = frames.map((f) => f.url())

      for (const f of frames) {
        const url = f.url()
        // Skip empty / chrome-iframe URLs
        if (!url || url === "about:blank") continue
        const surface = await dumpFrameSurface(f)
        dump.visibleTextPerFrame.push({ url: surface.url, text: surface.text.slice(0, 8000) })
        dump.buttonsPerFrame.push({ url: surface.url, buttons: surface.buttons })
      }

      dump.screenshotPath = await shotAll(popup, `recon_step_${String(i).padStart(2, "0")}_${stepName.replace(/\s+/g, "_")}`)
    } catch (err) {
      dump.error = err instanceof Error ? err.message : String(err)
    }

    dumps.push(dump)
  }

  return dumps
}

/** Click into a saved CMA by name substring.
 *  Mirrors working logic in mls.ts clickSavedCMAByName: uses #cmaList + 8-col
 *  jqGrid schema [sel, col2, CMAID, Name, AssignedContact, Subject, LastUpdated, Comparables]. */
async function clickSavedCMARow(
  cmaFrame: import("playwright").Frame,
  nameSubstring: string,
): Promise<{ ok: boolean; cmaId: string | null; reason?: string | null }> {
  return (await cmaFrame.evaluate((needle: string) => {
    const grid = document.querySelector("#cmaList") as HTMLTableElement | null
    if (!grid) return { ok: false, cmaId: null, reason: "no #cmaList" }
    const trs = Array.from(grid.querySelectorAll("tbody tr")) as HTMLTableRowElement[]
    for (const tr of trs) {
      const cells = Array.from(tr.querySelectorAll("td")) as HTMLTableCellElement[]
      if (cells.length < 8) continue
      const cmaId = (cells[2].textContent || "").trim()
      const name = (cells[3].textContent || "").trim()
      if (!name.toLowerCase().includes(needle.toLowerCase())) continue
      const nameCell = cells[3]
      const anchor = nameCell.querySelector("a") as HTMLElement | null
      const dispatch = (el: HTMLElement, type: "click" | "dblclick") => {
        el.scrollIntoView?.({ block: "center" })
        el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window, button: 0 }))
      }
      if (anchor) {
        dispatch(anchor, "click")
      } else {
        dispatch(nameCell, "click")
        dispatch(tr, "dblclick")
      }
      return { ok: true, cmaId, reason: null }
    }
    return { ok: false, cmaId: null, reason: `no row matched "${needle}" in #cmaList (${trs.length} rows)` }
  }, nameSubstring)) as { ok: boolean; cmaId: string | null; reason: string | null }
}

function findCMAListFrame(popup: import("playwright").Page): import("playwright").Frame | null {
  return (
    popup.frames().find((f) => /\/CMA\/Main\.mvc\/CMA\/0/i.test(f.url())) || null
  )
}

export async function reconCMAWizardFull(nameSubstring: string): Promise<{ ok: boolean; path?: string; reason?: string }> {
  const started = Date.now()
  let session: VendorSession | null = null

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
    if (!navResult?.ok) return { ok: false, reason: "Saved Presentations nav failed" }

    await popup.waitForTimeout(2500)
    await popup.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {})

    let cmaFrame = findCMAListFrame(popup)
    const deadline = Date.now() + 10000
    while (!cmaFrame && Date.now() < deadline) {
      await popup.waitForTimeout(500)
      cmaFrame = findCMAListFrame(popup)
    }
    if (!cmaFrame) return { ok: false, reason: "CMA list frame not found" }
    await injectNameShim(cmaFrame)

    // Bump page size to 30 so every row is reachable (Paragon default = 10).
    await setCMAPageSizeMax(cmaFrame).catch(() => null)
    await popup.waitForTimeout(1500)

    const clicked = await clickSavedCMARow(cmaFrame, nameSubstring)
    if (!clicked.ok) return { ok: false, reason: `Row click failed: ${clicked.reason || "unknown"}` }

    await popup.waitForTimeout(3500)
    await popup.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {})

    // Shim all frames
    for (const f of popup.frames()) await injectNameShim(f)

    // Walk every wizard step — the heart of recon
    const steps = await walkWizardSteps(popup)

    const map: WizardMap = {
      capturedAt: new Date().toISOString(),
      cmaName: nameSubstring,
      cmaId: clicked.cmaId,
      steps,
    }

    await fs.mkdir(OUT_DIR, { recursive: true })
    const outPath = path.join(OUT_DIR, `${clicked.cmaId || "unknown"}_wizard_map.json`)
    await fs.writeFile(outPath, JSON.stringify(map, null, 2))

    recordSuccess(VENDOR)
    await logScrapeRun({ vendor: VENDOR, subject: `recon_wizard_${clicked.cmaId}`, status: "success", durationMs: Date.now() - started })

    return { ok: true, path: outPath }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (err instanceof ScraperHaltError) {
      recordFailure(VENDOR)
      return { ok: false, reason: `HALT: ${err.reason}` }
    }
    recordFailure(VENDOR)
    await logScrapeRun({ vendor: VENDOR, subject: `recon_wizard_${nameSubstring}`, status: "failure", durationMs: Date.now() - started, error: message })
    return { ok: false, reason: message }
  } finally {
    if (session?.context) await session.context.close().catch(() => {})
  }
}

// CLI entrypoint
if (require.main === module) {
  const name = process.argv[2] || "28274 lake bruin"
  console.log(`[recon] drilling saved CMA: "${name}"`)
  reconCMAWizardFull(name).then((r) => {
    if (r.ok) {
      console.log(`[recon] ✅ wizard map written: ${r.path}`)
      console.log(`[recon] next: inspect the file to find generate-report controls`)
    } else {
      console.error(`[recon] ❌ ${r.reason}`)
      process.exit(1)
    }
  })
}
