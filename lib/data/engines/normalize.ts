/**
 * AIRE Intelligence — Address Normalization Engine
 *
 * Called by every ingestion server before touching properties_clean.
 * Produces a canonical property_id that is stable across sources.
 *
 * property_id format: {zip}-{street_number}-{street_name_slug}
 */

const STREET_TYPES: Record<string, string> = {
  avenue: 'AVE', ave: 'AVE', boulevard: 'BLVD', blvd: 'BLVD',
  circle: 'CIR', cir: 'CIR', court: 'CT', ct: 'CT',
  cove: 'CV', cv: 'CV', crossing: 'XING', xing: 'XING',
  drive: 'DR', dr: 'DR', expressway: 'EXPY', expy: 'EXPY',
  freeway: 'FWY', fwy: 'FWY', highway: 'HWY', hwy: 'HWY',
  lane: 'LN', ln: 'LN', loop: 'LOOP',
  parkway: 'PKWY', pkwy: 'PKWY', place: 'PL', pl: 'PL',
  plaza: 'PLZ', plz: 'PLZ', road: 'RD', rd: 'RD',
  route: 'RTE', rte: 'RTE', square: 'SQ', sq: 'SQ',
  street: 'ST', st: 'ST', terrace: 'TER', ter: 'TER', terr: 'TER',
  trail: 'TRL', trl: 'TRL', way: 'WAY',
}

const DIRECTIONALS: Record<string, string> = {
  north: 'N', n: 'N', south: 'S', s: 'S', east: 'E', e: 'E', west: 'W', w: 'W',
  northeast: 'NE', ne: 'NE', northwest: 'NW', nw: 'NW',
  southeast: 'SE', se: 'SE', southwest: 'SW', sw: 'SW',
}

const UNIT_PATTERN = /\s+(apt|unit|ste|suite|#|lot|bldg|building|floor|fl)\s*[\w-]+/gi

const CITY_TO_PARISH: Record<string, string> = {
  'baton rouge': 'EBR', 'baker': 'EBR', 'central': 'EBR', 'zachary': 'EBR',
  'port allen': 'West Baton Rouge',
  'prairieville': 'Ascension', 'gonzales': 'Ascension', 'sorrento': 'Ascension', 'geismar': 'Ascension',
  'denham springs': 'Livingston', 'walker': 'Livingston', 'watson': 'Livingston',
  'albany': 'Livingston', 'french settlement': 'Livingston',
  'st. francisville': 'West Feliciana', 'saint francisville': 'West Feliciana',
}

export interface NormalizedAddress {
  street_number: string
  street_name: string
  city: string
  state: string
  zip: string
  parish: string | null
  property_id: string
  address_canonical: string
  unit: string | null
}

export function normalizeAddress(raw: string): NormalizedAddress | null {
  if (!raw?.trim()) return null
  let working = raw.trim()

  let unit: string | null = null
  const unitMatch = working.match(UNIT_PATTERN)
  if (unitMatch) { unit = unitMatch[0].trim(); working = working.replace(UNIT_PATTERN, '') }

  working = working.replace(/\./g, '').replace(/,/g, ' ').replace(/\s+/g, ' ').trim()

  const zipMatch = working.match(/\b(\d{5})(?:-\d{4})?\b/)
  const zip = zipMatch ? zipMatch[1] : ''
  if (zipMatch) working = working.replace(zipMatch[0], '').trim()

  const stateMatch = working.match(/\b(LA|MS|TX|AR|AL|FL|GA|TN|SC|NC|VA|MO|KY|OK|NM|AZ|CA|CO|IL|IN|KS|MI|MN|NE|NV|NY|OH|OR|PA|UT|WA|WI)\b/i)
  const state = stateMatch ? stateMatch[1].toUpperCase() : 'LA'
  if (stateMatch) working = working.replace(stateMatch[0], '').trim()

  const tokens = working.split(' ').filter(Boolean)
  let streetNumber = ''
  let tokenIndex = 0
  if (tokens[0] && /^\d/.test(tokens[0])) { streetNumber = tokens[0].toUpperCase(); tokenIndex = 1 }

  const remaining = tokens.slice(tokenIndex)
  const { streetTokens, city } = splitStreetAndCity(remaining)
  const normalizedStreet = normalizeStreetTokens(streetTokens)
  const parish = deriveParish(city, zip)

  const streetSlug = normalizedStreet.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  const zipForId = zip || 'XXXXX'
  const numForId = streetNumber.toLowerCase().replace(/[^a-z0-9]/g, '') || 'x'
  const property_id = `${zipForId}-${numForId}-${streetSlug}`

  const unitPart = unit ? ` ${unit.toUpperCase()}` : ''
  const address_canonical = [
    `${streetNumber} ${normalizedStreet}${unitPart}`.trim(),
    city ? city.toUpperCase() : '',
    `${state} ${zip}`,
  ].filter(Boolean).join(', ')

  return { street_number: streetNumber, street_name: normalizedStreet, city: city ? toTitleCase(city) : '', state, zip, parish, property_id, address_canonical, unit }
}

function normalizeStreetTokens(tokens: string[]): string {
  return tokens.map((token, i) => {
    const lower = token.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (i === 0 && DIRECTIONALS[lower]) return DIRECTIONALS[lower]
    if (i === tokens.length - 1 && STREET_TYPES[lower]) return STREET_TYPES[lower]
    if (DIRECTIONALS[lower]) return DIRECTIONALS[lower]
    return token.toUpperCase()
  }).join(' ')
}

function splitStreetAndCity(tokens: string[]): { streetTokens: string[]; city: string } {
  const lowerTokens = tokens.map(t => t.toLowerCase())
  for (const windowSize of [3, 2, 1]) {
    if (tokens.length <= windowSize) continue
    const cityCandidate = lowerTokens.slice(-windowSize).join(' ')
    if (CITY_TO_PARISH[cityCandidate] !== undefined) {
      return { streetTokens: tokens.slice(0, -windowSize), city: cityCandidate }
    }
  }
  if (tokens.length >= 4) return { streetTokens: tokens.slice(0, -2), city: tokens.slice(-2).join(' ') }
  return { streetTokens: tokens, city: '' }
}

function deriveParish(city: string, zip: string): string | null {
  const cityLower = city.toLowerCase().trim()
  if (CITY_TO_PARISH[cityLower]) return CITY_TO_PARISH[cityLower]
  const EBR_ZIPS = ['70801','70802','70803','70805','70806','70807','70808','70809','70810','70811','70812','70814','70815','70816','70817','70818','70819','70820','70791']
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

export function isFuzzyMatch(id1: string, id2: string): boolean {
  if (id1 === id2) return true
  const [zip1, num1, ...street1] = id1.split('-')
  const [zip2, num2, ...street2] = id2.split('-')
  if (zip1 !== zip2 || num1 !== num2) return false
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

export function applyFieldMap(
  rawRow: Record<string, string>,
  fieldMap: Record<string, string>
): Record<string, string | number | boolean | null> {
  const result: Record<string, string | number | boolean | null> = {}
  for (const [sourceField, canonicalField] of Object.entries(fieldMap)) {
    const rawValue = rawRow[sourceField]
    if (rawValue === undefined || rawValue === '' || rawValue === null) { result[canonicalField] = null; continue }
    result[canonicalField] = coerceValue(canonicalField, rawValue)
  }
  return result
}

function coerceValue(fieldName: string, value: string): string | number | boolean | null {
  const numericFields = ['list_price','sold_price','propstream_avm','assessor_fmv','zillow_estimate','redfin_estimate','equity_amount','lien_amount','last_sale_price','bedrooms','sqft','lot_sqft','year_built','garage_spaces','dom','price_per_sqft','bathrooms_full','bathrooms_half','bathrooms']
  const booleanFields = ['pool']
  const clean = value.toString().replace(/[$,]/g, '').trim()
  if (numericFields.includes(fieldName)) { const n = parseFloat(clean); return isNaN(n) ? null : n }
  if (booleanFields.includes(fieldName)) return ['yes','y','true','1','x'].includes(clean.toLowerCase())
  return value.trim() || null
}
