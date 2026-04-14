/**
 * Scan local filesystem (Downloads + OneDrive) for PDFs that could be CMA
 * presentations matching the 28 saved Paragon CMAs. Produces a ranked
 * `local_pdf_matches.json` with confidence scores per candidate.
 *
 * Matching strategy (heuristic — tuned for Caleb's file naming):
 *   1) Tokenize CMA name into address-token + client-token
 *   2) For each PDF path, score against each CMA:
 *      - +10 if filename contains address token verbatim
 *      - +5  if filename contains client token
 *      - +3  if PDF filename has "CMA", "Summary Report", "Residential Report"
 *      - -5  if filename contains "contract", "addendum", "agreement",
 *            "inspection", "due diligence", "counter offer", "disclosure",
 *            "pdd", "prequal" (TC documents, NOT a CMA)
 *      - +2  if in Downloads root (not Properties/ subfolder)
 *   3) Keep top-3 candidates per CMA with score > 0
 *
 * Run:  npx tsx lib/cma/backtest/match-local-pdfs.ts
 * Out:  lib/cma/backtest/local_pdf_matches.json
 */

import { promises as fs } from "node:fs"
import path from "node:path"
import { execSync } from "node:child_process"

const INDEX_PATH = "lib/cma/scrapers/snapshots/mls_paragon/saved_cmas_index.json"
const OUT_PATH = "lib/cma/backtest/local_pdf_matches.json"

const SEARCH_ROOTS = ["C:/Users/cjjfr/Downloads", "C:/Users/cjjfr/OneDrive"]

const TC_NEGATIVE_KEYWORDS = [
  "contract",
  "addendum",
  "agreement",
  "inspection",
  "due diligence",
  "ddi",
  "counter offer",
  "counteroffer",
  "counter-offer",
  "disclosure",
  "pdd",
  "prequal",
  "earnest",
  "wire fraud",
  "commissions title",
  "aos ext",
  "sewer repair",
  "estimate",
  "quote",
  "appraisal",
  "seller's response",
  "closing cost",
  "personal items",
  "removal of",
  "multiple offers",
  "general addendum",
  "buyer's presentation",
  "agency disclosure",
  "lrec",
]

const CMA_POSITIVE_KEYWORDS = [
  "cma",
  "summary report",
  "residential report",
  "pricing strategy",
  "property evaluation",
  "listing consultation",
  "market analysis",
  "comparative market",
]

interface SavedCMA {
  cmaId: string
  subjectMls: string
  name: string
  lastUpdated: string
  comparables: number
}

interface Candidate {
  path: string
  filename: string
  score: number
  reasons: string[]
}

interface MatchResult {
  cmaId: string
  cmaName: string
  subjectMls: string
  comparables: number
  candidates: Candidate[]
}

/** Break a CMA name like "1928 E Eagle Drive Jenny Wilcox" into address + client parts. */
function tokenizeCMAName(name: string): { address: string | null; client: string | null; raw: string } {
  const trimmed = name.trim()
  const digits = trimmed.match(/^\s*(\d{2,6}\s+[A-Za-z]+[^,]*?)\s*(?=[A-Z][a-z]|$)/)
  if (digits) {
    const addr = digits[1].trim()
    const rest = trimmed.slice(digits[0].length).trim()
    return { address: addr, client: rest || null, raw: trimmed }
  }
  if (/^\d+$/.test(trimmed)) return { address: null, client: null, raw: trimmed }
  return { address: null, client: trimmed, raw: trimmed }
}

/** Cheap, portable PDF list: Windows-friendly via find on git-bash. */
function listAllPdfs(): string[] {
  const all: string[] = []
  for (const root of SEARCH_ROOTS) {
    try {
      const out = execSync(`find "${root}" -type f -iname "*.pdf" 2>/dev/null`, {
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
        shell: "C:\\Program Files\\Git\\bin\\bash.exe",
      })
      all.push(...out.split("\n").map((l) => l.trim()).filter(Boolean))
    } catch (_err) {
      // Skip root silently if find fails
    }
  }
  return Array.from(new Set(all))
}

function scorePdfAgainstCMA(pdfPath: string, cma: SavedCMA): Candidate | null {
  const filenameLower = path.basename(pdfPath).toLowerCase()
  const fullLower = pdfPath.toLowerCase()
  const reasons: string[] = []
  let score = 0

  const tokens = tokenizeCMAName(cma.name)

  if (tokens.address) {
    const addrLower = tokens.address.toLowerCase()
    // Try the full address first, then just the street number + first word
    if (fullLower.includes(addrLower)) {
      score += 10
      reasons.push(`address match: "${tokens.address}"`)
    } else {
      const num = addrLower.match(/^\d+/)?.[0]
      const streetPart = addrLower.split(/\s+/).slice(1, 3).join(" ")
      if (num && streetPart && fullLower.includes(num) && fullLower.includes(streetPart)) {
        score += 7
        reasons.push(`address fragment: "${num} ... ${streetPart}"`)
      }
    }
  }

  if (tokens.client) {
    const clientLower = tokens.client.toLowerCase().trim()
    const clientTokens = clientLower.split(/\s+/).filter((t) => t.length > 2)
    const hits = clientTokens.filter((t) => fullLower.includes(t))
    if (hits.length > 0) {
      score += 5 * hits.length
      reasons.push(`client tokens: ${hits.join(",")}`)
    }
  }

  if (cma.subjectMls && cma.subjectMls.length > 5 && fullLower.includes(cma.subjectMls.toLowerCase())) {
    score += 15
    reasons.push(`MLS# match: ${cma.subjectMls}`)
  }

  for (const neg of TC_NEGATIVE_KEYWORDS) {
    if (filenameLower.includes(neg)) {
      score -= 5
      reasons.push(`-TC doc: "${neg}"`)
      break // penalize once
    }
  }

  for (const pos of CMA_POSITIVE_KEYWORDS) {
    if (filenameLower.includes(pos)) {
      score += 3
      reasons.push(`+CMA kw: "${pos}"`)
      break
    }
  }

  if (fullLower.includes("/_duplicates")) {
    score -= 3
    reasons.push("-in _DUPLICATES folder")
  }

  if (score <= 0) return null
  return { path: pdfPath, filename: path.basename(pdfPath), score, reasons }
}

async function main() {
  const indexRaw = await fs.readFile(INDEX_PATH, "utf8")
  const index = JSON.parse(indexRaw) as { rows: SavedCMA[] }
  const cmas = index.rows

  console.log(`[match] loaded ${cmas.length} saved CMAs from Paragon index`)

  console.log(`[match] scanning ${SEARCH_ROOTS.join(", ")} for *.pdf ...`)
  const pdfs = listAllPdfs()
  console.log(`[match] found ${pdfs.length} total PDFs`)

  const results: MatchResult[] = []
  for (const cma of cmas) {
    const candidates: Candidate[] = []
    for (const pdf of pdfs) {
      const c = scorePdfAgainstCMA(pdf, cma)
      if (c) candidates.push(c)
    }
    candidates.sort((a, b) => b.score - a.score)
    results.push({
      cmaId: cma.cmaId,
      cmaName: cma.name,
      subjectMls: cma.subjectMls,
      comparables: cma.comparables,
      candidates: candidates.slice(0, 5),
    })
  }

  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true })
  await fs.writeFile(OUT_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), totalPdfsScanned: pdfs.length, results }, null, 2))

  const covered = results.filter((r) => r.candidates.length > 0 && r.candidates[0].score >= 7).length
  const partial = results.filter((r) => r.candidates.length > 0 && r.candidates[0].score < 7 && r.candidates[0].score > 0).length
  const gap = results.filter((r) => r.candidates.length === 0).length

  console.log(`[match] high-confidence matches (score >=7): ${covered}/${cmas.length}`)
  console.log(`[match] weak matches (score 1-6): ${partial}`)
  console.log(`[match] no match found: ${gap}`)
  console.log(`[match] wrote ${OUT_PATH}`)

  console.log("\n--- TOP MATCH PER CMA ---")
  for (const r of results) {
    const best = r.candidates[0]
    const label = best ? `[${best.score}] ${best.filename}` : "(no candidate)"
    console.log(`${r.cmaId.padStart(6)} | ${r.cmaName.padEnd(36)} | ${label}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
