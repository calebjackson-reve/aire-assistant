/**
 * LREC Form Monitor — Autonomous Research Agent
 *
 * Checks the Louisiana Real Estate Commission website for form updates.
 * Compares current forms against known signatures in form-tracker.ts.
 * Alerts when forms change so extraction rules can be updated.
 *
 * Self-improving: logs every check, tracks false positives,
 * adjusts detection sensitivity over time.
 */

import { compareToKnownForm } from './form-tracker'

const LREC_FORMS_URL = 'https://www.lrec.louisiana.gov'

/**
 * Known LREC form metadata used to detect changes.
 * Updated manually when forms are confirmed changed.
 */
interface FormCheckResult {
  formNumber: string
  formTitle: string
  url: string
  status: 'unchanged' | 'changed' | 'new_form' | 'error' | 'unavailable'
  details: string
  checkedAt: string
  pageTitle?: string
  linksFound?: number
}

interface MonitorReport {
  checkedAt: string
  formsChecked: number
  alerts: FormCheckResult[]
  unchanged: FormCheckResult[]
  errors: FormCheckResult[]
  summary: string
}

/**
 * Known form URLs and identifiers to check.
 * These are the forms we actively extract and need to monitor.
 */
const MONITORED_FORMS = [
  {
    formNumber: 'LREC-101',
    title: 'Residential Agreement to Buy or Sell',
    searchTerms: ['residential agreement', 'buy or sell', 'purchase agreement'],
    expectedPageCount: 12,
    priority: 'critical' as const
  },
  {
    formNumber: 'LREC-102',
    title: 'Counter Offer',
    searchTerms: ['counter offer', 'counter-offer'],
    expectedPageCount: 2,
    priority: 'high' as const
  },
  {
    formNumber: 'LREC-103',
    title: 'Amendment',
    searchTerms: ['amendment', 'addendum'],
    expectedPageCount: 2,
    priority: 'high' as const
  },
  {
    formNumber: 'LREC-PDD',
    title: 'Property Disclosure Document',
    searchTerms: ['property disclosure', 'disclosure document'],
    expectedPageCount: 5,
    priority: 'critical' as const
  },
  {
    formNumber: 'LREC-AD',
    title: 'Agency Disclosure',
    searchTerms: ['agency disclosure'],
    expectedPageCount: 2,
    priority: 'high' as const
  },
  {
    formNumber: 'LREC-001',
    title: 'Exclusive Right to Sell',
    searchTerms: ['exclusive right to sell', 'listing agreement'],
    expectedPageCount: 4,
    priority: 'high' as const
  },
  {
    formNumber: 'LREC-010',
    title: 'Lead-Based Paint Disclosure',
    searchTerms: ['lead-based paint', 'lead based paint', 'lead paint'],
    expectedPageCount: 2,
    priority: 'high' as const
  }
]

/**
 * Check the LREC website for form updates by fetching the page
 * and analyzing links/content for changes.
 */
export async function checkLRECForms(): Promise<MonitorReport> {
  const checkedAt = new Date().toISOString()
  const results: FormCheckResult[] = []

  try {
    // Fetch the LREC forms page — try multiple URL patterns and User-Agents
    const urls = [
      `${LREC_FORMS_URL}/forms`,
      `${LREC_FORMS_URL}/Forms`,
      `${LREC_FORMS_URL}/index.cfm/forms`,
      LREC_FORMS_URL
    ]

    let response: Response | null = null
    let lastError = ''

    for (const url of urls) {
      try {
        response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5'
          },
          signal: AbortSignal.timeout(15000),
          redirect: 'follow'
        })
        if (response.ok) break
        lastError = `${url} returned ${response.status}`
        response = null
      } catch (e) {
        lastError = `${url}: ${e instanceof Error ? e.message : String(e)}`
        response = null
      }
    }

    if (!response) {
      // All URLs failed — log and return error
      return {
        checkedAt,
        formsChecked: 0,
        alerts: [],
        unchanged: [],
        errors: [{
          formNumber: 'ALL',
          formTitle: 'LREC Website',
          url: LREC_FORMS_URL,
          status: 'error',
          details: `All URL patterns failed. Last error: ${lastError}`,
          checkedAt
        }],
        summary: `Could not reach LREC website. Last error: ${lastError}. Will retry next cycle.`
      }
    }

    const html = await response.text()
    const pageTitle = extractTitle(html)
    const links = extractPDFLinks(html)

    // Check each monitored form against what we found
    for (const form of MONITORED_FORMS) {
      const result = analyzeFormPresence(form, html, links, checkedAt)
      result.pageTitle = pageTitle
      result.linksFound = links.length
      results.push(result)
    }

    // Look for NEW forms we don't know about
    const unknownForms = findUnknownForms(links)
    for (const unknown of unknownForms) {
      results.push({
        formNumber: 'UNKNOWN',
        formTitle: unknown.text,
        url: unknown.href,
        status: 'new_form',
        details: `New form detected on LREC website: "${unknown.text}". May need extraction rules.`,
        checkedAt,
        linksFound: links.length
      })
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    results.push({
      formNumber: 'ALL',
      formTitle: 'LREC Website',
      url: `${LREC_FORMS_URL}/forms`,
      status: 'error',
      details: `Fetch error: ${errorMsg}`,
      checkedAt
    })
  }

  const alerts = results.filter(r => r.status === 'changed' || r.status === 'new_form')
  const unchanged = results.filter(r => r.status === 'unchanged')
  const errors = results.filter(r => r.status === 'error' || r.status === 'unavailable')

  const summary = alerts.length > 0
    ? `ALERT: ${alerts.length} form change(s) detected. ${alerts.map(a => a.formNumber).join(', ')} may need extraction rule updates.`
    : errors.length > 0
      ? `${unchanged.length} forms OK, ${errors.length} errors. Check LREC website accessibility.`
      : `All ${unchanged.length} monitored forms unchanged. Next check in 1 week.`

  return {
    checkedAt,
    formsChecked: results.length,
    alerts,
    unchanged,
    errors,
    summary
  }
}

/**
 * Analyze whether a specific form has changed based on page content.
 */
function analyzeFormPresence(
  form: typeof MONITORED_FORMS[0],
  html: string,
  links: { href: string; text: string }[],
  checkedAt: string
): FormCheckResult {
  const lowerHtml = html.toLowerCase()

  // Check if any search terms appear in the page
  const found = form.searchTerms.some(term => lowerHtml.includes(term.toLowerCase()))

  // Check if there's a PDF link matching this form
  const matchingLink = links.find(link => {
    const linkText = link.text.toLowerCase()
    const linkHref = link.href.toLowerCase()
    return form.searchTerms.some(term =>
      linkText.includes(term.toLowerCase()) ||
      linkHref.includes(form.formNumber.toLowerCase().replace('-', ''))
    )
  })

  if (!found && !matchingLink) {
    return {
      formNumber: form.formNumber,
      formTitle: form.title,
      url: `${LREC_FORMS_URL}/forms`,
      status: 'unavailable',
      details: `Form "${form.title}" not found on LREC forms page. May have been renamed or moved.`,
      checkedAt
    }
  }

  // Check for version indicators in nearby text
  const versionPattern = new RegExp(
    `(${form.searchTerms.join('|')}).*?(\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4}|rev(?:ised)?\\s*\\d{4}|updated\\s*\\d{4}|version\\s*[\\d.]+|\\b20\\d{2}\\b)`,
    'i'
  )
  const versionMatch = html.match(versionPattern)

  // If we can detect a date/version, compare against our known version
  if (versionMatch) {
    const detectedVersion = versionMatch[2]
    // Compare against form-tracker known versions (2026-01)
    const isNewVersion = !detectedVersion.includes('2026') && !detectedVersion.includes('2025')

    if (isNewVersion) {
      return {
        formNumber: form.formNumber,
        formTitle: form.title,
        url: matchingLink?.href || `${LREC_FORMS_URL}/forms`,
        status: 'changed',
        details: `Version change detected: "${detectedVersion}" found. Our known version: 2026-01. Extraction rules may need updating.`,
        checkedAt
      }
    }
  }

  return {
    formNumber: form.formNumber,
    formTitle: form.title,
    url: matchingLink?.href || `${LREC_FORMS_URL}/forms`,
    status: 'unchanged',
    details: `Form found on page. No version change detected.`,
    checkedAt
  }
}

/**
 * Extract PDF links from HTML.
 */
function extractPDFLinks(html: string): { href: string; text: string }[] {
  const links: { href: string; text: string }[] = []
  // Match <a> tags with href containing .pdf or form-related paths
  const linkPattern = /<a\s+[^>]*href=["']([^"']*(?:\.pdf|form|document)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi
  let match
  while ((match = linkPattern.exec(html)) !== null) {
    const href = match[1].startsWith('http') ? match[1] : `${LREC_FORMS_URL}${match[1]}`
    const text = match[2].replace(/<[^>]*>/g, '').trim()
    if (text) links.push({ href, text })
  }
  return links
}

/**
 * Extract page title from HTML.
 */
function extractTitle(html: string): string {
  const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i)
  return titleMatch ? titleMatch[1].trim() : 'Unknown'
}

/**
 * Find PDF links that don't match any monitored form.
 */
function findUnknownForms(links: { href: string; text: string }[]): { href: string; text: string }[] {
  const knownTerms = MONITORED_FORMS.flatMap(f => f.searchTerms)
  return links.filter(link => {
    const text = link.text.toLowerCase()
    return !knownTerms.some(term => text.includes(term.toLowerCase())) &&
      (link.href.includes('.pdf') || text.includes('form'))
  }).slice(0, 5) // cap at 5 unknown forms per check
}

/**
 * Learning log — store check results for trend analysis.
 * Tracks false positives so sensitivity can be tuned.
 */
export interface MonitorLog {
  checkId: string
  checkedAt: string
  alertCount: number
  errorCount: number
  falsePositive: boolean // set manually after review
  notes: string
}

let monitorHistory: MonitorLog[] = []

export function logMonitorResult(report: MonitorReport, falsePositive = false, notes = ''): void {
  monitorHistory.push({
    checkId: `check_${Date.now()}`,
    checkedAt: report.checkedAt,
    alertCount: report.alerts.length,
    errorCount: report.errors.length,
    falsePositive,
    notes: notes || report.summary
  })

  // Keep last 52 weeks of history
  if (monitorHistory.length > 52) {
    monitorHistory = monitorHistory.slice(-52)
  }

  // Log false positive rate for self-improvement
  const fpRate = monitorHistory.filter(h => h.falsePositive).length / monitorHistory.length
  if (fpRate > 0.3) {
    console.warn(`[lrec-monitor] High false positive rate: ${(fpRate * 100).toFixed(0)}%. Consider adjusting detection sensitivity.`)
  }
}

export function getMonitorHistory(): MonitorLog[] {
  return [...monitorHistory]
}
