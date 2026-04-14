/**
 * Production Path B scraper — for each saved CMA in Paragon, drill in,
 * scrape the Subject Property + Adjustment frames, and emit a structured
 * JSON snapshot per CMA.
 *
 * The Adjustment frame displays subject + each comp side-by-side with all
 * key fields (List Price, Sold Price, Sqft, Sold Date, Subdivision, etc).
 * That's the richest single page in the wizard — no PDF generation needed.
 *
 * Output:  lib/cma/backtest/cma_data/<cmaId>.json
 * Index:   lib/cma/backtest/cma_data/_index.json (summary of all runs)
 *
 * Usage:
 *   npx tsx lib/cma/backtest/extract-cma-data.ts                # all 23 non-empty
 *   npx tsx lib/cma/backtest/extract-cma-data.ts "28274 lake"   # single match
 *
 * Respects B24140 thrash rules:
 *   - 7-day storageState reuse
 *   - Single-shot per CMA, sequential with 8-15s delay between runs
 *   - Captcha → halt for entire batch
 *   - Two login failures → halt
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

const VENDOR = "mls_paragon" as const
const INDEX_PATH = "lib/cma/scrapers/snapshots/mls_paragon/saved_cmas_index.json"
const OUT_DIR = "lib/cma/backtest/cma_data"
const SNAPSHOT_INDEX = path.join(OUT_DIR, "_index.json")
const DEBUG_DIR = "lib/cma/scrapers/debug"

interface SavedCMA {
  cmaId: string
  subjectMls: string
  name: string
  lastUpdated: string
  comparables: number
}

interface SubjectSnapshot {
  presentationName: string | null
  subjectAddress: string | null
  subjectMls: string | null
  subjectSubdivision: string | null
  subjectBeds: string | null
  subjectBaths: string | null
  subjectSqft: string | null
  subjectYearBuilt: string | null
  subjectLotSize: string | null
  subjectListPrice: string | null
  subjectSoldPrice: string | null
  recommendedListPrice: string | null
  rawText: string
}

interface CompFieldPair {
  field: string
  subjectValue: string
  compValue: string
}

interface AdjustmentCompSnapshot {
  compIndex: number
  compMls: string | null
  compAddress: string | null
  pairs: CompFieldPair[]
  rawTextFragment: string
}

interface CMADataSnapshot {
  capturedAt: string
  cmaId: string
  cmaName: string
  indexSubjectMls: string
  wizardUrl: string | null
  subject: SubjectSnapshot
  comps: AdjustmentCompSnapshot[]
  reportButtonsFound: Array<{ label: string; id: string; selector: string }>
  error?: string
  durationMs: number
}

function tsSlug(): string {
  return new Date().toISOString().replace(/[:.]/g, "-")
}

async function shotPopup(popup: import("playwright").Page, label: string): Promise<string> {
  const filename = `${VENDOR}_${tsSlug()}_${label}.png`
  const full = path.join(DEBUG_DIR, filename)
  await fs.mkdir(DEBUG_DIR, { recursive: true })
  await popup.screenshot({ path: full, fullPage: true }).catch(() => {})
  return full
}

function findFrameByUrl(popup: import("playwright").Page, needle: string | RegExp): import("playwright").Frame | null {
  return popup.frames().find((f) => (typeof needle === "string" ? f.url().includes(needle) : needle.test(f.url()))) || null
}

async function clickSavedCMARow(
  cmaFrame: import("playwright").Frame,
  nameSubstring: string,
): Promise<{ ok: boolean; cmaId: string | null; reason: string | null }> {
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
      if (anchor) dispatch(anchor, "click")
      else {
        dispatch(nameCell, "click")
        dispatch(tr, "dblclick")
      }
      return { ok: true, cmaId, reason: null }
    }
    return { ok: false, cmaId: null, reason: `no row matched "${needle}" (${trs.length} rows)` }
  }, nameSubstring)) as { ok: boolean; cmaId: string | null; reason: string | null }
}

async function extractSubjectFrame(
  frame: import("playwright").Frame,
): Promise<{ subject: SubjectSnapshot; reportButtons: Array<{ label: string; id: string; selector: string }> }> {
  return (await frame.evaluate(() => {
    const getVal = (sel: string): string | null => {
      const el = document.querySelector<HTMLInputElement | HTMLSelectElement>(sel)
      if (!el) return null
      const v = (el.value || el.textContent || "").trim()
      return v || null
    }
    const grabByLabel = (labelRegex: RegExp): string | null => {
      const labels = Array.from(document.querySelectorAll("label, span, div, td")) as HTMLElement[]
      for (const lab of labels) {
        const t = (lab.textContent || "").trim()
        if (!labelRegex.test(t)) continue
        // Prefer a sibling or following input/text
        const sibling = (lab.nextElementSibling ?? null) as HTMLElement | null
        if (sibling) {
          const input = sibling.querySelector("input, select, textarea") as HTMLInputElement | null
          if (input) return (input.value || "").trim() || null
          const txt = (sibling.textContent || "").trim()
          if (txt && txt.length < 120) return txt
        }
      }
      return null
    }

    const bodyText = (document.body?.innerText || "").slice(0, 10000)

    // Collect all report/generate buttons
    const reportKeywords = /generate|preview|print|report|save/i
    const btns = Array.from(document.querySelectorAll("a, button, input[type='button'], input[type='submit']")) as HTMLElement[]
    const reportButtons: Array<{ label: string; id: string; selector: string }> = []
    const seen = new Set<string>()
    for (const el of btns) {
      const label = ((el as HTMLInputElement).value || el.innerText || el.getAttribute("title") || "").trim()
      if (!label || label.length > 60) continue
      if (!reportKeywords.test(label)) continue
      const id = el.id || ""
      const sel = id ? `#${id}` : `a[role='button'][onclick*='${label.slice(0, 20)}']`
      const key = `${label}|${id}`
      if (seen.has(key)) continue
      seen.add(key)
      reportButtons.push({ label, id, selector: sel })
      if (reportButtons.length > 20) break
    }

    const subject: {
      presentationName: string | null
      subjectAddress: string | null
      subjectMls: string | null
      subjectSubdivision: string | null
      subjectBeds: string | null
      subjectBaths: string | null
      subjectSqft: string | null
      subjectYearBuilt: string | null
      subjectLotSize: string | null
      subjectListPrice: string | null
      subjectSoldPrice: string | null
      recommendedListPrice: string | null
      rawText: string
    } = {
      presentationName: getVal("#PresentationName, input[name='PresentationName']") || grabByLabel(/presentation name/i),
      subjectAddress: grabByLabel(/street (number|address)|address line|street name/i),
      subjectMls: grabByLabel(/mls\s*#|listing\s*#/i),
      subjectSubdivision: grabByLabel(/subdivision|neighborhood/i),
      subjectBeds: grabByLabel(/bedrooms|beds total/i),
      subjectBaths: grabByLabel(/baths? total|bathrooms/i),
      subjectSqft: grabByLabel(/sqft living|living\s*(sq)?\s*ft/i),
      subjectYearBuilt: grabByLabel(/year built/i),
      subjectLotSize: grabByLabel(/lot size|acres/i),
      subjectListPrice: grabByLabel(/list\s*price/i),
      subjectSoldPrice: grabByLabel(/sold\s*price/i),
      recommendedListPrice: grabByLabel(/recommended|suggested|target/i),
      rawText: bodyText,
    }
    return { subject, reportButtons }
  })) as { subject: SubjectSnapshot; reportButtons: Array<{ label: string; id: string; selector: string }> }
}

async function captureCurrentAdjustmentComp(frame: import("playwright").Frame): Promise<AdjustmentCompSnapshot> {
  return (await frame.evaluate(() => {
    const text = (document.body?.innerText || "").slice(0, 12000)
    const indexMatch = text.match(/Prev Comp[\s\S]*?(\d+)\s+of\s+\d+[\s\S]*?Next Comp/i)
    const idx = indexMatch ? parseInt(indexMatch[1], 10) - 1 : 0
    const mlsMatch = text.match(/MLS#\t(\S+)\s/)
    const addrMatch = text.match(/Address\t([^\t\n]+)/)
    return {
      compIndex: idx,
      compMls: mlsMatch?.[1] || null,
      compAddress: addrMatch?.[1]?.trim() || null,
      pairs: [],
      rawTextFragment: text,
    }
  })) as AdjustmentCompSnapshot
}

async function totalCompsCount(frame: import("playwright").Frame): Promise<number> {
  return await frame.evaluate(() => {
    const text = document.body?.innerText || ""
    const m = text.match(/Prev Comp[\s\S]*?\d+\s+of\s+(\d+)[\s\S]*?Next Comp/i)
    return m ? parseInt(m[1], 10) : 0
  })
}

async function clickNextComp(frame: import("playwright").Frame): Promise<boolean> {
  return await frame.evaluate(() => {
    const all = Array.from(document.querySelectorAll("a, button, span, div, td")) as HTMLElement[]
    const next = all.find((el) => {
      const own = Array.from(el.childNodes)
        .filter((n) => n.nodeType === 3)
        .map((n) => (n.textContent || "").trim())
        .join(" ")
        .trim()
      return /^\s*Next Comp\s*$/i.test(own)
    })
    if (!next) return false
    next.scrollIntoView?.({ block: "center" })
    next.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }))
    return true
  })
}

async function extractAdjustmentFrame(
  popup: import("playwright").Page,
  frame: import("playwright").Frame,
): Promise<AdjustmentCompSnapshot[]> {
  const snapshots: AdjustmentCompSnapshot[] = []
  const total = await totalCompsCount(frame).catch(() => 0)
  const maxIters = total > 0 ? Math.min(total, 12) : 10

  // Capture current comp
  snapshots.push(await captureCurrentAdjustmentComp(frame))

  // Iterate forward with "Next Comp" button
  const seenMls = new Set<string>()
  if (snapshots[0].compMls) seenMls.add(snapshots[0].compMls)

  for (let i = 1; i < maxIters; i += 1) {
    const ok = await clickNextComp(frame).catch(() => false)
    if (!ok) break
    await popup.waitForTimeout(1200)
    await popup.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {})
    const snap = await captureCurrentAdjustmentComp(frame).catch(() => null)
    if (!snap) break
    // Stop if we've wrapped around to a seen MLS
    if (snap.compMls && seenMls.has(snap.compMls)) break
    if (snap.compMls) seenMls.add(snap.compMls)
    snapshots.push(snap)
  }

  return snapshots
}

async function scrapeOneCMA(
  popup: import("playwright").Page,
  cma: SavedCMA,
): Promise<CMADataSnapshot> {
  const started = Date.now()
  const snapshot: CMADataSnapshot = {
    capturedAt: new Date().toISOString(),
    cmaId: cma.cmaId,
    cmaName: cma.name,
    indexSubjectMls: cma.subjectMls,
    wizardUrl: null,
    subject: {
      presentationName: null,
      subjectAddress: null,
      subjectMls: null,
      subjectSubdivision: null,
      subjectBeds: null,
      subjectBaths: null,
      subjectSqft: null,
      subjectYearBuilt: null,
      subjectLotSize: null,
      subjectListPrice: null,
      subjectSoldPrice: null,
      recommendedListPrice: null,
      rawText: "",
    },
    comps: [],
    reportButtonsFound: [],
    durationMs: 0,
  }

  try {
    // Navigate back to Saved Presentations between CMAs
    await popup.waitForTimeout(1500)
    await injectNameShim(popup)
    const navBack = await popup.evaluate(() => {
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
    if (!navBack) throw new Error("Could not re-nav to Saved Presentations")

    await popup.waitForTimeout(2500)
    await popup.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {})

    const cmaFrame = findFrameByUrl(popup, /\/CMA\/Main\.mvc\/CMA\/0/i)
    if (!cmaFrame) throw new Error("CMA list frame not found")
    await injectNameShim(cmaFrame)
    await setCMAPageSizeMax(cmaFrame).catch(() => null)
    await popup.waitForTimeout(1500)

    const clicked = await clickSavedCMARow(cmaFrame, cma.name)
    if (!clicked.ok) throw new Error(`Row click failed: ${clicked.reason}`)

    await popup.waitForTimeout(3500)
    await popup.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {})

    const cap = await detectCaptcha(popup)
    if (cap.present) throw new ScraperHaltError(`Captcha at cma ${cma.cmaId}`, VENDOR)

    for (const f of popup.frames()) await injectNameShim(f)

    // Capture report buttons from Subject Property page (Generate Presentation lives here)
    const subjFrame0 = findFrameByUrl(popup, /SubjectProperty\.mvc/i)
    if (subjFrame0) {
      const res0 = await extractSubjectFrame(subjFrame0)
      snapshot.reportButtonsFound = res0.reportButtons
      snapshot.subject.presentationName = res0.subject.presentationName
    }
    snapshot.wizardUrl = subjFrame0?.url() || null

    // Step 1: click "Comparables" — this loads the comp list + full subject data
    const clickStep = async (stepName: string): Promise<boolean> => {
      let ok = false
      for (const f of popup.frames()) {
        try {
          const hit = await f.evaluate((name: string) => {
            const all = Array.from(document.querySelectorAll("a, li, span, div, td")) as HTMLElement[]
            const found = all.find((el) => {
              const own = Array.from(el.childNodes)
                .filter((n) => n.nodeType === 3)
                .map((n) => (n.textContent || "").trim())
                .join(" ")
                .trim()
              return own.toLowerCase() === name.toLowerCase()
            })
            if (!found) return false
            found.scrollIntoView?.({ block: "center" })
            found.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }))
            return true
          }, stepName)
          if (hit) { ok = true; break }
        } catch {
          // try next frame
        }
      }
      if (ok) {
        await popup.waitForTimeout(3500)
        await popup.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {})
        for (const f of popup.frames()) await injectNameShim(f)
      }
      return ok
    }

    // Walk the steps that load the data frames we want
    await clickStep("Comparables")
    await clickStep("Adjustments")

    // Now scrape the Subject Property frame AGAIN — by this point Paragon
    // auto-populates the full subject details once comps are resolved.
    const subjFrame = findFrameByUrl(popup, /SubjectProperty\.mvc/i)
    if (subjFrame) {
      const res = await extractSubjectFrame(subjFrame)
      // Merge — don't lose report buttons from the first pass
      snapshot.subject = { ...res.subject, presentationName: snapshot.subject.presentationName || res.subject.presentationName }
      if (res.reportButtons.length > snapshot.reportButtonsFound.length) {
        snapshot.reportButtonsFound = res.reportButtons
      }
    }

    // Adjustment frame (subject + comps side-by-side)
    const adjFrame = findFrameByUrl(popup, /Adjustment\.mvc/i)
    if (adjFrame) {
      snapshot.comps = await extractAdjustmentFrame(popup, adjFrame)
    }

    await shotPopup(popup, `backtest_cma_${cma.cmaId}`)
    recordSuccess(VENDOR)
  } catch (err) {
    if (err instanceof ScraperHaltError) throw err
    snapshot.error = err instanceof Error ? err.message : String(err)
    recordFailure(VENDOR)
  } finally {
    snapshot.durationMs = Date.now() - started
  }

  return snapshot
}

export async function extractAllCMAData(nameFilter?: string | null): Promise<void> {
  const indexRaw = await fs.readFile(INDEX_PATH, "utf8")
  const index = JSON.parse(indexRaw) as { rows: SavedCMA[] }
  const targets = index.rows
    .filter((r) => r.comparables > 0)
    .filter((r) => (nameFilter ? r.name.toLowerCase().includes(nameFilter.toLowerCase()) : true))

  console.log(`[extract] targets: ${targets.length} CMAs`)

  await fs.mkdir(OUT_DIR, { recursive: true })

  let session: VendorSession | null = null
  const batchStarted = Date.now()
  const results: Array<{ cmaId: string; cmaName: string; ok: boolean; error?: string; path?: string }> = []

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

    for (let i = 0; i < targets.length; i += 1) {
      const cma = targets[i]
      console.log(`[extract] ${i + 1}/${targets.length}  cmaId=${cma.cmaId}  name="${cma.name}"`)

      let snapshot: CMADataSnapshot
      try {
        snapshot = await scrapeOneCMA(popup, cma)
      } catch (err) {
        if (err instanceof ScraperHaltError) {
          console.error(`[extract] HALT: ${err.reason}`)
          break
        }
        snapshot = {
          capturedAt: new Date().toISOString(),
          cmaId: cma.cmaId,
          cmaName: cma.name,
          indexSubjectMls: cma.subjectMls,
          wizardUrl: null,
          subject: {
            presentationName: null,
            subjectAddress: null,
            subjectMls: null,
            subjectSubdivision: null,
            subjectBeds: null,
            subjectBaths: null,
            subjectSqft: null,
            subjectYearBuilt: null,
            subjectLotSize: null,
            subjectListPrice: null,
            subjectSoldPrice: null,
            recommendedListPrice: null,
            rawText: "",
          },
          comps: [],
          reportButtonsFound: [],
          durationMs: 0,
          error: err instanceof Error ? err.message : String(err),
        }
      }

      const outPath = path.join(OUT_DIR, `${cma.cmaId}.json`)
      await fs.writeFile(outPath, JSON.stringify(snapshot, null, 2))
      results.push({ cmaId: cma.cmaId, cmaName: cma.name, ok: !snapshot.error, error: snapshot.error, path: outPath })

      const ok = snapshot.error ? "❌" : "✅"
      console.log(`  ${ok} ${snapshot.durationMs}ms  list=${snapshot.subject.subjectListPrice ?? "-"}  comps=${snapshot.comps.length}`)

      // B24140 thrash guard — sleep 8-15s between CMAs
      if (i + 1 < targets.length) {
        const nap = 8000 + Math.floor(Math.random() * 7000)
        await popup.waitForTimeout(nap)
      }
    }
  } finally {
    if (session?.context) await session.context.close().catch(() => {})
  }

  await fs.writeFile(
    SNAPSHOT_INDEX,
    JSON.stringify(
      {
        batchStarted: new Date(batchStarted).toISOString(),
        batchEnded: new Date().toISOString(),
        totalTargets: targets.length,
        successes: results.filter((r) => r.ok).length,
        failures: results.filter((r) => !r.ok).length,
        results,
      },
      null,
      2,
    ),
  )

  await logScrapeRun({
    vendor: VENDOR,
    subject: `backtest_extract_${targets.length}`,
    status: "success",
    durationMs: Date.now() - batchStarted,
  })

  console.log(`\n[extract] batch complete — wrote ${SNAPSHOT_INDEX}`)
}

if (require.main === module) {
  const nameFilter = process.argv[2] || null
  extractAllCMAData(nameFilter).catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
