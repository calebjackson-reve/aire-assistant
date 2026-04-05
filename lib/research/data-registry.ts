/**
 * AIRE Data Registry — Structured catalog of all external data sources.
 * Used by intelligence engines to know where to fetch property, market, and compliance data.
 */

export interface DataSource {
  id: string
  name: string
  type: 'api' | 'scrape' | 'manual' | 'file'
  url: string
  dataProvided: string[]
  updateFrequency: 'realtime' | 'daily' | 'weekly' | 'monthly' | 'manual'
  cost: 'free' | 'freemium' | 'paid'
  integrated: boolean
  priority: number // 1=critical, 5=nice-to-have
  notes: string
}

export const DATA_SOURCES: DataSource[] = [
  // --- PUBLIC REAL ESTATE APIs ---
  {
    id: 'census-acs',
    name: 'US Census Bureau ACS',
    type: 'api',
    url: 'https://api.census.gov/data.html',
    dataProvided: ['demographics', 'median_income', 'housing_stats', 'population', 'vacancy_rates'],
    updateFrequency: 'monthly',
    cost: 'free',
    integrated: false,
    priority: 2,
    notes: 'Free API key required. ACS 5-year estimates for parish-level demographics. Use for market snapshots and neighborhood scoring.'
  },
  {
    id: 'fema-nfhl',
    name: 'FEMA National Flood Hazard Layer',
    type: 'api',
    url: 'https://hazards.fema.gov/gis/nfhl/rest/services',
    dataProvided: ['flood_zone', 'flood_risk', 'base_flood_elevation', 'floodway'],
    updateFrequency: 'monthly',
    cost: 'free',
    integrated: false,
    priority: 1,
    notes: 'Critical for Louisiana. ArcGIS REST API — query by lat/lng or address. Returns SFHA zone (A, AE, X, etc). Must-have for compliance and property scoring.'
  },
  {
    id: 'attom-data',
    name: 'ATTOM Data Solutions',
    type: 'api',
    url: 'https://api.gateway.attomdata.com/propertyapi/v1.0.0/',
    dataProvided: ['property_value', 'tax_assessment', 'sales_history', 'avm', 'owner_info', 'school_ratings'],
    updateFrequency: 'daily',
    cost: 'paid',
    integrated: false,
    priority: 2,
    notes: 'Most comprehensive property data API. Free tier: 100 calls/month. Paid starts ~$200/mo. Powers AVM and AIRE Estimate.'
  },
  {
    id: 'geocoding-census',
    name: 'Census Geocoder',
    type: 'api',
    url: 'https://geocoding.geo.census.gov/geocoder/',
    dataProvided: ['lat_lng', 'census_tract', 'county_fips', 'state_fips'],
    updateFrequency: 'realtime',
    cost: 'free',
    integrated: false,
    priority: 3,
    notes: 'Free geocoding. Convert addresses to lat/lng + census tract. Use to enrich property records before querying FEMA or Census APIs.'
  },
  {
    id: 'hud-fmr',
    name: 'HUD Fair Market Rents',
    type: 'api',
    url: 'https://www.huduser.gov/portal/dataset/fmr-api.html',
    dataProvided: ['fair_market_rent', 'small_area_fmr', 'rent_by_bedroom'],
    updateFrequency: 'monthly',
    cost: 'free',
    integrated: false,
    priority: 3,
    notes: 'Free. Fair market rents by ZIP. Useful for investor deal analysis and rental income projections.'
  },
  {
    id: 'freddie-mac-pmms',
    name: 'Freddie Mac PMMS (Mortgage Rates)',
    type: 'api',
    url: 'https://www.freddiemac.com/pmms',
    dataProvided: ['mortgage_rate_30yr', 'mortgage_rate_15yr', 'rate_trend'],
    updateFrequency: 'weekly',
    cost: 'free',
    integrated: false,
    priority: 2,
    notes: 'Weekly mortgage rate data. Use in morning brief market section and deal affordability calculations.'
  },

  // --- LOUISIANA-SPECIFIC DATA ---
  {
    id: 'ebrpa',
    name: 'East Baton Rouge Parish Assessor',
    type: 'scrape',
    url: 'https://www.ebrpa.org/',
    dataProvided: ['tax_assessment', 'legal_description', 'lot_size', 'owner_name', 'homestead_exemption'],
    updateFrequency: 'monthly',
    cost: 'free',
    integrated: false,
    priority: 1,
    notes: 'Primary market. Property search at ebrpa.org. No official API — would need to scrape or use their GIS portal. Legal descriptions critical for contract writing.'
  },
  {
    id: 'ascension-assessor',
    name: 'Ascension Parish Assessor',
    type: 'scrape',
    url: 'https://www.ascensionassessor.com/',
    dataProvided: ['tax_assessment', 'legal_description', 'lot_size', 'owner_name'],
    updateFrequency: 'monthly',
    cost: 'free',
    integrated: false,
    priority: 2,
    notes: 'Second-most active parish for Caleb. Similar scrape approach to EBRPA.'
  },
  {
    id: 'livingston-assessor',
    name: 'Livingston Parish Assessor',
    type: 'scrape',
    url: 'https://www.livingstonassessor.com/',
    dataProvided: ['tax_assessment', 'legal_description', 'lot_size', 'owner_name'],
    updateFrequency: 'monthly',
    cost: 'free',
    integrated: false,
    priority: 3,
    notes: 'Third parish. Same pattern as EBR and Ascension.'
  },
  {
    id: 'lrec',
    name: 'Louisiana Real Estate Commission',
    type: 'scrape',
    url: 'https://www.lrec.louisiana.gov/',
    dataProvided: ['license_verification', 'rule_updates', 'form_updates', 'disciplinary_actions'],
    updateFrequency: 'monthly',
    cost: 'free',
    integrated: false,
    priority: 2,
    notes: 'Form updates and rule changes. Check quarterly for new form versions. License lookup for agent verification in compliance scanner.'
  },
  {
    id: 'la-sos',
    name: 'Louisiana Secretary of State',
    type: 'api',
    url: 'https://www.sos.la.gov/BusinessServices/',
    dataProvided: ['entity_lookup', 'registered_agent', 'filing_status'],
    updateFrequency: 'daily',
    cost: 'free',
    integrated: false,
    priority: 4,
    notes: 'Entity lookup for LLC buyers/sellers. Useful for compliance verification on commercial deals.'
  },

  // --- DOCUMENT & FORM DATA ---
  {
    id: 'lrec-forms',
    name: 'LREC Official Forms',
    type: 'file',
    url: 'https://www.lrec.louisiana.gov/forms',
    dataProvided: ['form_templates', 'field_definitions', 'form_versions'],
    updateFrequency: 'monthly',
    cost: 'free',
    integrated: false,
    priority: 1,
    notes: 'Download official LREC form PDFs for extraction testing and template matching. Check for version updates quarterly.'
  },

  // --- MARKET & ECONOMIC DATA ---
  {
    id: 'bls-cpi',
    name: 'Bureau of Labor Statistics CPI',
    type: 'api',
    url: 'https://api.bls.gov/publicAPI/v2/timeseries/data/',
    dataProvided: ['cpi', 'inflation_rate', 'housing_cpi'],
    updateFrequency: 'monthly',
    cost: 'free',
    integrated: false,
    priority: 4,
    notes: 'Free API. Housing CPI for market trend analysis. Low priority but adds depth to market intelligence.'
  },
  {
    id: 'fred-api',
    name: 'FRED (Federal Reserve Economic Data)',
    type: 'api',
    url: 'https://fred.stlouisfed.org/docs/api/fred/',
    dataProvided: ['mortgage_rates', 'housing_starts', 'home_price_index', 'unemployment'],
    updateFrequency: 'weekly',
    cost: 'free',
    integrated: false,
    priority: 3,
    notes: 'Free API key. Comprehensive economic data. Case-Shiller index, housing starts, mortgage rates. Good for morning brief market context.'
  }
]

/**
 * Get data sources filtered by criteria.
 */
export function getDataSources(filter?: {
  integrated?: boolean
  cost?: 'free' | 'freemium' | 'paid'
  maxPriority?: number
  dataType?: string
}): DataSource[] {
  let sources = [...DATA_SOURCES]

  if (filter?.integrated !== undefined) {
    sources = sources.filter(s => s.integrated === filter.integrated)
  }
  if (filter?.cost) {
    sources = sources.filter(s => s.cost === filter.cost)
  }
  if (filter?.maxPriority) {
    sources = sources.filter(s => s.priority <= filter.maxPriority!)
  }
  if (filter?.dataType) {
    sources = sources.filter(s => s.dataProvided.includes(filter.dataType!))
  }

  return sources.sort((a, b) => a.priority - b.priority)
}

/**
 * Get the top N unintegrated free data sources by priority.
 */
export function getTopFreeSourcesForIntegration(n: number = 5): DataSource[] {
  return getDataSources({ integrated: false, cost: 'free', maxPriority: 3 }).slice(0, n)
}
