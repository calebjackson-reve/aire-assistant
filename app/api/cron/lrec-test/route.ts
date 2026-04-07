/**
 * GET /api/research/lrec-test
 * Test endpoint: feeds mock LREC HTML to the monitor to verify detection logic.
 * Only available in development.
 */

import { NextResponse } from 'next/server'

// Simulate LREC forms page HTML
const MOCK_LREC_HTML_UNCHANGED = `
<html>
<head><title>LREC - Forms</title></head>
<body>
<h1>Louisiana Real Estate Commission - Forms</h1>
<h2>Residential Forms</h2>
<ul>
  <li><a href="/forms/LREC101.pdf">Residential Agreement to Buy or Sell (Revised 2026)</a></li>
  <li><a href="/forms/LREC102.pdf">Counter Offer (Revised 2026)</a></li>
  <li><a href="/forms/LREC103.pdf">Amendment (Revised 2026)</a></li>
  <li><a href="/forms/LRECPDD.pdf">Property Disclosure Document (Revised 2026)</a></li>
  <li><a href="/forms/LRECAD.pdf">Agency Disclosure (Revised 2025)</a></li>
  <li><a href="/forms/LREC001.pdf">Exclusive Right to Sell (Revised 2026)</a></li>
  <li><a href="/forms/LREC010.pdf">Lead-Based Paint Disclosure (Revised 2025)</a></li>
</ul>
</body>
</html>
`

const MOCK_LREC_HTML_CHANGED = `
<html>
<head><title>LREC - Forms</title></head>
<body>
<h1>Louisiana Real Estate Commission - Forms</h1>
<h2>Residential Forms</h2>
<ul>
  <li><a href="/forms/LREC101_v2.pdf">Residential Agreement to Buy or Sell (Revised July 2027)</a></li>
  <li><a href="/forms/LREC102.pdf">Counter Offer (Revised 2026)</a></li>
  <li><a href="/forms/LREC103.pdf">Amendment (Revised 2026)</a></li>
  <li><a href="/forms/LRECPDD_v2.pdf">Property Disclosure Document (Revised March 2027)</a></li>
  <li><a href="/forms/LRECAD.pdf">Agency Disclosure (Revised 2025)</a></li>
  <li><a href="/forms/LREC001.pdf">Exclusive Right to Sell (Revised 2026)</a></li>
  <li><a href="/forms/LREC010.pdf">Lead-Based Paint Disclosure (Revised 2025)</a></li>
  <li><a href="/forms/LREC020.pdf">New Flood Disclosure Form (Effective 2027)</a></li>
</ul>
</body>
</html>
`

// Import the analysis functions by re-implementing the test inline
// (can't easily mock fetch in the monitor, so we test the parsing logic directly)
function extractPDFLinks(html: string): { href: string; text: string }[] {
  const links: { href: string; text: string }[] = []
  const linkPattern = /<a\s+[^>]*href=["']([^"']*(?:\.pdf|form|document)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi
  let match
  while ((match = linkPattern.exec(html)) !== null) {
    const href = match[1].startsWith('http') ? match[1] : `https://www.lrec.louisiana.gov${match[1]}`
    const text = match[2].replace(/<[^>]*>/g, '').trim()
    if (text) links.push({ href, text })
  }
  return links
}

export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Test endpoint not available in production' }, { status: 403 })
  }

  const url = new URL(request.url)
  const scenario = url.searchParams.get('scenario') || 'unchanged'

  const html = scenario === 'changed' ? MOCK_LREC_HTML_CHANGED : MOCK_LREC_HTML_UNCHANGED
  const links = extractPDFLinks(html)

  // Check for version changes
  const searchTerms: Record<string, string[]> = {
    'LREC-101': ['residential agreement', 'buy or sell'],
    'LREC-102': ['counter offer', 'counter-offer'],
    'LREC-103': ['amendment', 'addendum'],
    'LREC-PDD': ['property disclosure'],
    'LREC-AD': ['agency disclosure'],
    'LREC-001': ['exclusive right to sell', 'listing agreement'],
    'LREC-010': ['lead-based paint', 'lead paint']
  }

  const results: Record<string, unknown>[] = []

  for (const [formNumber, terms] of Object.entries(searchTerms)) {
    const matchingLink = links.find(link =>
      terms.some(term => link.text.toLowerCase().includes(term))
    )

    if (!matchingLink) {
      results.push({ formNumber, status: 'unavailable', detail: 'Not found on page' })
      continue
    }

    // Check for version year
    const yearMatch = matchingLink.text.match(/\b(20\d{2})\b/)
    const detectedYear = yearMatch ? parseInt(yearMatch[1]) : null

    if (detectedYear && detectedYear > 2026) {
      results.push({
        formNumber,
        status: 'CHANGED',
        link: matchingLink,
        detectedYear,
        detail: `Version updated to ${detectedYear}. Extraction rules need updating!`
      })
    } else {
      results.push({
        formNumber,
        status: 'unchanged',
        link: matchingLink,
        detectedYear
      })
    }
  }

  // Check for unknown new forms
  const knownTerms = Object.values(searchTerms).flat()
  const unknownForms = links.filter(link =>
    !knownTerms.some(term => link.text.toLowerCase().includes(term))
  )

  const alerts = results.filter(r => r.status === 'CHANGED')

  return NextResponse.json({
    scenario,
    linksFound: links.length,
    results,
    alerts,
    unknownForms,
    summary: alerts.length > 0
      ? `ALERT: ${alerts.length} form(s) changed! ${alerts.map(a => a.formNumber).join(', ')}`
      : `All ${results.length} forms unchanged.`
  })
}
