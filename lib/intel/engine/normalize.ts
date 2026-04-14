/**
 * AIRE Intelligence — Address Normalization Engine
 *
 * Called by every MCP ingestion server before touching properties_clean.
 * Produces a canonical property_id that is stable across sources.
 *
 * property_id format: {zip}-{street_number}-{street_name_slug}
 * Example: "70816-123-n-oak-dr"
 *
 * Rules (from Section 11):
 *  - Strip unit/apt numbers from the property_id slug
 *  - Normalize street type abbreviations (St → ST, Drive → DR, etc.)
 *  - Normalize directionals (North → N, Southeast → SE, etc.)
 *  - slug: lowercase, spaces to hyphens, strip punctuation
 */

// ── Lookup tables ─────────────────────────────────────────────────────────────

const STREET_TYPES: Record<string, string> = {
  // Full → abbreviation
  avenue: 'AVE', ave: 'AVE',
  boulevard: 'BLVD', blvd: 'BLVD',
  circle: 'CIR', cir: 'CIR',
  court: 'CT', ct: 'CT',
  cove: 'CV', cv: 'CV',
  crossing: 'XING', xing: 'XING',
  drive: 'DR', dr: 'DR',
  expressway: 'EXPY', expy: 'EXPY',
  freeway: 'FWY', fwy: 'FWY',
  highway: 'HWY', hwy: 'HWY',
  lane: 'LN', ln: 'LN',
  loop: 'LOOP',
  parkway: 'PKWY', pkwy: 'PKWY',
  place: 'PL', pl: 'PL',
  plaza: 'PLZ', plz: 'PLZ',
  road: 'RD', rd: 'RD',
  route: 'RTE', rte: 'RTE',
  square: 'SQ', sq: 'SQ',
  street: 'ST', st: 'ST',
  terrace: 'TER', ter: 'TER', terr: 'TER',
  trail: 'TRL', trl: 'TRL',
  way: 'WAY',
}

const DIRECTIONALS: Record<string, string> = {
  north: 'N', n: 'N',
  south: 'S', s: 'S',
  east: 'E', e: 'E',
  west: 'W', w: 'W',
  northeast: 'NE', ne: 'NE',
  northwest: 'NW', nw: 'NW',
  southeast: 'SE', se: 'SE',
  southwest: 'SW', sw: 'SW',
}

// Patterns that indicate a unit/apartment number
const UNIT_PATTERN = /\s+(apt|unit|ste|suite|#|lot|bldg|building|floor|fl)\s*[\w-]+/gi

// Louisiana city → parish mapping for known Baton Rouge metro cities
const CITY_TO_PARISH: Record<string, string> = {
  'baton rouge': 'EBR',
  'baker': 'EBR',
  'central': 'EBR',
  'zachary': 'EBR',
  'port allen': 'West Baton Rouge',
  'prairieville': 'Ascension',
  'gonzales': 'Ascension',
  'sorrento': 'Ascension',
  'geismar': 'Ascension',
  'denham springs': 'Livingston',
  'walker': 'Livingston',
  'watson': 'Livingston',
  'albany': 'Livingston',
  'french settlement': 'Livingston',
  'st. francisville': 'West Feliciana',
  'saint francisville': 'West Feliciana',
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NormalizedAddress {
  street_number: string
  street_name: string       // normalized uppercase: "N OAK DR"
  city: string
  state: string
  zip: string
  parish: string | null
  property_id: string       // slug: "70816-123-n-oak-dr"
  address_canonical: string // "123 N OAK DR, BATON ROUGE LA 70816"
  unit: string | null       // extracted unit (stored separately, excluded from property_id)
}

// ── Core normalization ────────────────────────────────────────────────────────

/**
 * Parse and normalize a raw address string into AIRE canonical form.
 *
 * @example
 *   normalizeAddress("123 N. Oak Drive, Baton Rouge, LA 70816")
 *   // → { property_id: "70816-123-n-oak-dr", street_number: "123", ... }
 */
export function normalizeAddress(raw: string): NormalizedAddress | null {
  if (!raw?.trim()) return null

  let working = raw.trim()

  // ── 1. Extract unit number (keep it, exclude from property_id) ────────────
  let unit: string | null = null
  const unitMatch = working.match(UNIT_PATTERN)
  if (unitMatch) {
    unit = unitMatch[0].trim()
    working = working.replace(UNIT_PATTERN, '')
  }

  // ── 2. Split address into parts ───────────────────────────────────────────
  // Expected formats:
  //   "123 N Oak Dr, Baton Rouge, LA 70816"
  //   "123 N Oak Dr Baton Rouge LA 70816"
  //   "123 N Oak Drive"

  // Normalize punctuation
  working = working.replace(/\./g, '').replace(/,/g, ' ').replace(/\s+/g, ' ').trim()

  // Extract ZIP (5-digit or ZIP+4)
  const zipMatch = working.match(/\b(\d{5})(?:-\d{4})?\b/)
  const zip = zipMatch ? zipMatch[1] : ''
  if (zipMatch) working = working.replace(zipMatch[0], '').trim()

  // Extract state abbreviation (2 uppercase letters at end of string or before ZIP)
  const stateMatch = working.match(/\b(LA|MS|TX|AR|AL|FL|GA|TN|SC|NC|VA|MO|KY|OK|NM|AZ|CA|CO|IL|IN|KS|MI|MN|NE|NV|NY|OH|OR|PA|UT|WA|WI)\b/i)
  const state = stateMatch ? stateMatch[1].toUpperCase() : 'LA'
  if (stateMatch) working = working.replace(stateMatch[0], '').trim()

  // ── 3. Tokenize remaining (street number + street name + city) ────────────
  const tokens = working.split(' ').filter(Boolean)

  // Street number = leading token(s) that are numeric (handle "123B", "123-A")
  let streetNumber = ''
  let tokenIndex = 0
  if (tokens[0] && /^\d/.test(tokens[0])) {
    streetNumber = tokens[0].toUpperCase()
    tokenIndex = 1
  }

  // City heuristic: last 1–3 tokens that don't look like street words
  // We use the ZIP → city approach as fallback; for now, detect common BR cities
  const remaining = tokens.slice(tokenIndex)
  const { streetTokens, city } = splitStreetAndCity(remaining)

  // ── 4. Normalize street tokens ────────────────────────────────────────────
  const normalizedStreet = normalizeStreetTokens(streetTokens)

  // ── 5. Derive parish ──────────────────────────────────────────────────────
  const parish = deriveParish(city, zip)

  // ── 6. Build property_id slug ─────────────────────────────────────────────
  const streetSlug = normalizedStreet
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')

  const zipForId = zip || 'XXXXX'
  const numForId = streetNumber.toLowerCase().replace(/[^a-z0-9]/g, '') || 'x'
  const property_id = `${zipForId}-${numForId}-${streetSlug}`

  // ── 7. Canonical address string ───────────────────────────────────────────
  const unitPart = unit ? ` ${unit.toUpperCase()}` : ''
  const address_canonical = [
    `${streetNumber} ${normalizedStreet}${unitPart}`.trim(),
    city ? city.toUpperCase() : '',
    `${state} ${zip}`,
  ].filter(Boolean).join(', ')

  return {
    street_number: streetNumber,
    street_name: normalizedStreet,
    city: city ? toTitleCase(city) : '',
    state,
    zip,
    parish,
    property_id,
    address_canonical,
    unit,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeStreetTokens(tokens: string[]): string {
  return tokens
    .map((token, i) => {
      const lower = token.toLowerCase().replace(/[^a-z0-9]/g, '')

      // First token might be a directional
      if (i === 0 && DIRECTIONALS[lower]) return DIRECTIONALS[lower]

      // Last token is usually a street type
      if (i === tokens.length - 1 && STREET_TYPES[lower]) return STREET_TYPES[lower]

      // Mid-token directionals (e.g. "North Oak Dr" → "N OAK DR")
      if (DIRECTIONALS[lower]) return DIRECTIONALS[lower]

      return token.toUpperCase()
    })
    .join(' ')
}

/**
 * Attempt to split the remaining tokens into street name vs city name.
 * Strategy: known Louisiana city names are checked from the end of the token list.
 */
function splitStreetAndCity(tokens: string[]): { streetTokens: string[]; city: string } {
  const lowerTokens = tokens.map(t => t.toLowerCase())

  // Try matching 3-word, 2-word, then 1-word cities from end
  for (const windowSize of [3, 2, 1]) {
    if (tokens.length <= windowSize) continue
    const cityCandidate = lowerTokens.slice(-windowSize).join(' ')
    if (CITY_TO_PARISH[cityCandidate] !== undefined) {
      return {
        streetTokens: tokens.slice(0, -windowSize),
        city: cityCandidate,
      }
    }
  }

  // No recognized city — assume last 2 tokens are city if tokens are long enough
  if (tokens.length >= 4) {
    return {
      streetTokens: tokens.slice(0, -2),
      city: tokens.slice(-2).join(' '),
    }
  }

  return { streetTokens: tokens, city: '' }
}

function deriveParish(city: string, zip: string): string | null {
  const cityLower = city.toLowerCase().trim()
  if (CITY_TO_PARISH[cityLower]) return CITY_TO_PARISH[cityLower]

  // ZIP-based fallback for EBR zips
  const EBR_ZIPS = ['70801','70802','70803','70805','70806','70807','70808','70809',
    '70810','70811','70812','70814','70815','70816','70817','70818','70819','70820','70791']
  if (EBR_ZIPS.includes(zip)) return 'EBR'

  const ASCENSION_ZIPS = ['70737','70769','70346','70725','70734','70772','70778']
  if (ASCENSION_ZIPS.includes(zip)) return 'Ascension'

  const LIVINGSTON_ZIPS = ['70706','70726','70744','70754','70785','70402','70711']
  if (LIVINGSTON_ZIPS.includes(zip)) return 'Livingston'

  return null
}

function toTitleCase(str: string): string {
  return str.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase())
}

// ── Fuzzy match detection ─────────────────────────────────────────────────────

/**
 * Detect if two property_ids are likely the same property with formatting differences.
 * Used to flag records for admin review instead of creating duplicates.
 *
 * @example
 *   isFuzzyMatch("70816-123-oak-dr", "70816-123-oak-drive") → true
 */
export function isFuzzyMatch(id1: string, id2: string): boolean {
  if (id1 === id2) return true
  const [zip1, num1, ...street1] = id1.split('-')
  const [zip2, num2, ...street2] = id2.split('-')
  if (zip1 !== zip2 || num1 !== num2) return false
  // Same zip + street number — compare street name similarity
  const s1 = street1.join('-')
  const s2 = street2.join('-')
  return levenshteinDistance(s1, s2) <= 2
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []
  for (let i = 0; i <= b.length; i++) matrix[i] = [i]
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] = b[i - 1] === a[j - 1]
        ? matrix[i - 1][j - 1]
        : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
    }
  }
  return matrix[b.length][a.length]
}

// ── Apply field map ───────────────────────────────────────────────────────────

/**
 * Map a raw CSV row using a field-map config JSON.
 * Returns a new object with AIRE canonical field names.
 *
 * @example
 *   applyFieldMap(rawRow, mlsFieldMap)
 *   // rawRow: { "ListingNumber": "MLS123", "ListPrice": "350000" }
 *   // returns: { "mls_id": "MLS123", "list_price": 350000 }
 */
export function applyFieldMap(
  rawRow: Record<string, string>,
  fieldMap: Record<string, string>
): Record<string, string | number | boolean | null> {
  const result: Record<string, string | number | boolean | null> = {}
  for (const [sourceField, canonicalField] of Object.entries(fieldMap)) {
    const rawValue = rawRow[sourceField]
    if (rawValue === undefined || rawValue === '' || rawValue === null) {
      result[canonicalField] = null
      continue
    }
    result[canonicalField] = coerceValue(canonicalField, rawValue)
  }
  return result
}

/** Coerce raw string values to appropriate types based on field name patterns */
function coerceValue(fieldName: string, value: string): string | number | boolean | null {
  const numericFields = [
    'list_price','sold_price','propstream_avm','assessor_fmv','zillow_estimate',
    'redfin_estimate','equity_amount','lien_amount','last_sale_price',
    'bedrooms','sqft','lot_sqft','year_built','garage_spaces','dom',
    'price_per_sqft','bathrooms_full','bathrooms_half','bathrooms',
  ]
  const booleanFields = ['pool']

  const clean = value.toString().replace(/[$,]/g, '').trim()

  if (numericFields.includes(fieldName)) {
    const n = parseFloat(clean)
    return isNaN(n) ? null : n
  }
  if (booleanFields.includes(fieldName)) {
    return ['yes','y','true','1','x'].includes(clean.toLowerCase())
  }
  return value.trim() || null
}
