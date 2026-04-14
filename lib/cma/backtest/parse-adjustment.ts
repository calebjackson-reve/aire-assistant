/**
 * Offline parser for Paragon CMA Adjustment-frame raw text.
 *
 * Paragon renders each comp's adjustment sheet as a 4-column table
 * (Feature | Subject | Comparable | Adjustment). When scraped as innerText
 * the result is a predictable pattern:
 *
 *   FieldName<TAB>SubjectValue<TAB>
 *   <SP>CompValue<TAB>
 *
 * Repeated for every row. This module parses that blob into structured
 * {subject, comp} dictionaries.
 *
 * Used by extract-cma-data.ts post-scrape, and testable in isolation.
 */

export interface ParsedAdjustment {
  subject: Record<string, string>
  comp: Record<string, string>
  pairCount: number
}

export function parseAdjustmentText(raw: string): ParsedAdjustment {
  const subject: Record<string, string> = {}
  const comp: Record<string, string> = {}

  // Lines where the label starts. Fields in the Paragon adjustment grid always
  // appear as "FIELD_NAME\tSUBJECT_VALUE\t" on one line followed by
  // " COMP_VALUE\t" on the next (with leading space on the comp line).
  const lines = raw.split(/\r?\n/)
  const KNOWN_FIELDS = new Set([
    "MLS#",
    "Status",
    "Class",
    "Property Type",
    "Address",
    "City",
    "Zip",
    "Parish",
    "Area",
    "Subdivision",
    "List Price",
    "List Price/SqFt Liv",
    "Sold Date",
    "Sold Price",
    "Sold Price/LvSqFt",
    "Sold Terms",
    "Concessions Comments",
    "Days On Market",
    "Cumulative DOM",
    "STYLE",
    "PARKING",
    "CONSTRUCT",
    "Beds",
    "Baths Display",
    "SqFt Living",
    "Year Built",
    "Apprx. Age",
    "Lot Dimensions",
    "Acres",
    "School system",
    "SPECIAL SALES TYPE",
    "Interest Rate",
    "Price Per SQFT",
    "Baths Full",
    "Concessions",
    "Condition",
    "Pending Date",
    "Sold Price Per SQFT",
  ])

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    // Split on tab — first cell is the field label.
    const parts = line.split("\t").map((p) => p.trim())
    if (parts.length < 2) continue
    const label = parts[0]
    if (!label || !KNOWN_FIELDS.has(label)) continue

    const subjVal = parts[1] || ""
    subject[label] = subjVal

    // Comp value is on the next non-empty tab-split line, typically leading space.
    for (let j = i + 1; j < Math.min(i + 5, lines.length); j += 1) {
      const next = lines[j]
      if (!next.trim()) continue
      const nextParts = next.split("\t").map((p) => p.trim())
      // Comp line starts with blank or space — label is missing, first token is the value.
      const first = nextParts[0]
      // Skip if this line has a known field label (means we're at the next row)
      if (first && KNOWN_FIELDS.has(first)) break
      comp[label] = first || ""
      break
    }
  }

  return { subject, comp, pairCount: Object.keys(subject).length }
}

/** Convenience — derive backtest-relevant numerics from a parsed adjustment. */
export interface ParsedSubjectCore {
  mls: string | null
  address: string | null
  subdivision: string | null
  city: string | null
  zip: string | null
  status: string | null
  listPrice: number | null
  soldPrice: number | null
  soldDate: string | null
  ppsf: number | null
  beds: number | null
  bathsDisplay: string | null
  sqft: number | null
  yearBuilt: number | null
  daysOnMarket: number | null
  concessions: number | null
  acres: number | null
}

export interface ParsedCompCore extends ParsedSubjectCore {
  soldTerms: string | null
}

function toNum(s: string | undefined): number | null {
  if (!s) return null
  const cleaned = s.replace(/[$,]/g, "").trim()
  if (!cleaned) return null
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : null
}

function toInt(s: string | undefined): number | null {
  const n = toNum(s)
  return n == null ? null : Math.round(n)
}

export function deriveSubjectCore(subject: Record<string, string>): ParsedSubjectCore {
  return {
    mls: subject["MLS#"] || null,
    address: subject["Address"] || null,
    subdivision: subject["Subdivision"] || null,
    city: subject["City"] || null,
    zip: subject["Zip"] || null,
    status: subject["Status"] || null,
    listPrice: toNum(subject["List Price"]),
    soldPrice: toNum(subject["Sold Price"]),
    soldDate: subject["Sold Date"] || null,
    ppsf: toNum(subject["Price Per SQFT"]) ?? toNum(subject["Sold Price/LvSqFt"]),
    beds: toInt(subject["Beds"]),
    bathsDisplay: subject["Baths Display"] || null,
    sqft: toInt(subject["SqFt Living"]),
    yearBuilt: toInt(subject["Year Built"]),
    daysOnMarket: toInt(subject["Days On Market"]),
    concessions: toNum(subject["Concessions Comments"]),
    acres: toNum(subject["Acres"]),
  }
}

export function deriveCompCore(comp: Record<string, string>): ParsedCompCore {
  return {
    ...deriveSubjectCore(comp),
    soldTerms: comp["Sold Terms"] || null,
  }
}

// CLI: test against one JSON
if (require.main === module) {
  const fs = require("node:fs")
  const p = process.argv[2] || "lib/cma/backtest/cma_data/52880.json"
  const d = JSON.parse(fs.readFileSync(p, "utf8"))
  for (const compBlock of d.comps) {
    const parsed = parseAdjustmentText(compBlock.rawTextFragment)
    console.log(`--- comp ${compBlock.compIndex} ---`)
    console.log("pair count:", parsed.pairCount)
    console.log("subject:", JSON.stringify(deriveSubjectCore(parsed.subject), null, 2))
    console.log("comp:", JSON.stringify(deriveCompCore(parsed.comp), null, 2))
  }
}
