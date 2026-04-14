/**
 * AIRE — Properties query functions
 * All reads and writes to properties_clean and market_snapshots go through here.
 */

import { query, withTransaction } from '../client'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PropertyClean {
  id: string
  property_id: string
  address_canonical: string
  street_number: string | null
  street_name: string | null
  city: string | null
  state: string
  zip: string | null
  parish: string | null
  lat: number | null
  lng: number | null
  property_type: string | null
  bedrooms: number | null
  bathrooms: number | null
  sqft: number | null
  lot_sqft: number | null
  year_built: number | null
  garage_spaces: number | null
  pool: boolean
  subdivision: string | null
  school_district: string | null
  parcel_id: string | null
  mls_id: string | null
  propstream_id: string | null
  assessor_id: string | null
  created_at: Date
  updated_at: Date
}

export interface MarketSnapshot {
  id: string
  property_id: string
  snapshot_date: string
  source: string
  list_price: number | null
  sold_price: number | null
  zillow_estimate: number | null
  redfin_estimate: number | null
  propstream_avm: number | null
  assessor_fmv: number | null
  dom: number | null
  price_reductions: number
  compete_score: number | null
  status: string | null
  list_date: string | null
  sold_date: string | null
  price_per_sqft: number | null
  created_at: Date
}

export interface PropertyInsert {
  property_id: string
  address_canonical: string
  street_number?: string
  street_name?: string
  city?: string
  zip?: string
  parish?: string
  property_type?: string
  bedrooms?: number
  bathrooms?: number
  sqft?: number
  lot_sqft?: number
  year_built?: number
  garage_spaces?: number
  pool?: boolean
  subdivision?: string
  school_district?: string
  parcel_id?: string
  mls_id?: string
  propstream_id?: string
}

// ── Reads ─────────────────────────────────────────────────────────────────────

export async function findByPropertyId(propertyId: string): Promise<PropertyClean | null> {
  const { rows } = await query<PropertyClean>(
    'SELECT * FROM properties_clean WHERE property_id = $1',
    [propertyId]
  )
  return rows[0] ?? null
}

export async function findActiveByZip(zip: string): Promise<PropertyClean[]> {
  const { rows } = await query<PropertyClean>(
    `SELECT p.* FROM properties_clean p
     INNER JOIN (
       SELECT DISTINCT ON (property_id) property_id, status
       FROM market_snapshots
       ORDER BY property_id, snapshot_date DESC
     ) ms ON ms.property_id = p.property_id
     WHERE p.zip = $1 AND ms.status = 'active'`,
    [zip]
  )
  return rows
}

export async function getLatestSnapshot(propertyId: string): Promise<MarketSnapshot | null> {
  const { rows } = await query<MarketSnapshot>(
    `SELECT * FROM market_snapshots
     WHERE property_id = $1
     ORDER BY snapshot_date DESC, created_at DESC
     LIMIT 1`,
    [propertyId]
  )
  return rows[0] ?? null
}

export async function countByParish(parish: string): Promise<number> {
  const { rows } = await query<{ count: string }>(
    'SELECT COUNT(*) as count FROM properties_clean WHERE parish = $1',
    [parish]
  )
  return parseInt(rows[0]?.count ?? '0', 10)
}

export async function countActiveListings(): Promise<number> {
  const { rows } = await query<{ count: string }>(
    `SELECT COUNT(DISTINCT property_id) as count
     FROM market_snapshots
     WHERE status = 'active'
       AND snapshot_date >= NOW() - INTERVAL '7 days'`
  )
  return parseInt(rows[0]?.count ?? '0', 10)
}

export async function countSoldComps(): Promise<number> {
  const { rows } = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM market_snapshots WHERE sold_price IS NOT NULL`
  )
  return parseInt(rows[0]?.count ?? '0', 10)
}

// ── Writes ────────────────────────────────────────────────────────────────────

/**
 * Upsert a property into properties_clean.
 * On conflict (property_id), updates enrichment fields only — does not
 * overwrite bedrooms/sqft/etc. with nulls if we already have good data.
 */
export async function upsertProperty(p: PropertyInsert): Promise<PropertyClean> {
  const { rows } = await query<PropertyClean>(
    `INSERT INTO properties_clean (
       property_id, address_canonical, street_number, street_name,
       city, zip, parish, property_type, bedrooms, bathrooms,
       sqft, lot_sqft, year_built, garage_spaces, pool,
       subdivision, school_district, parcel_id, mls_id, propstream_id
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
       $11,$12,$13,$14,$15,$16,$17,$18,$19,$20
     )
     ON CONFLICT (property_id) DO UPDATE SET
       mls_id          = COALESCE(EXCLUDED.mls_id, properties_clean.mls_id),
       propstream_id   = COALESCE(EXCLUDED.propstream_id, properties_clean.propstream_id),
       parcel_id       = COALESCE(EXCLUDED.parcel_id, properties_clean.parcel_id),
       bedrooms        = COALESCE(EXCLUDED.bedrooms, properties_clean.bedrooms),
       bathrooms       = COALESCE(EXCLUDED.bathrooms, properties_clean.bathrooms),
       sqft            = COALESCE(EXCLUDED.sqft, properties_clean.sqft),
       year_built      = COALESCE(EXCLUDED.year_built, properties_clean.year_built),
       subdivision     = COALESCE(EXCLUDED.subdivision, properties_clean.subdivision),
       school_district = COALESCE(EXCLUDED.school_district, properties_clean.school_district),
       updated_at      = NOW()
     RETURNING *`,
    [
      p.property_id, p.address_canonical, p.street_number ?? null, p.street_name ?? null,
      p.city ?? null, p.zip ?? null, p.parish ?? null, p.property_type ?? null,
      p.bedrooms ?? null, p.bathrooms ?? null,
      p.sqft ?? null, p.lot_sqft ?? null, p.year_built ?? null,
      p.garage_spaces ?? null, p.pool ?? false,
      p.subdivision ?? null, p.school_district ?? null,
      p.parcel_id ?? null, p.mls_id ?? null, p.propstream_id ?? null,
    ]
  )
  return rows[0]
}

export async function insertSnapshot(snap: Omit<MarketSnapshot, 'id' | 'created_at'>): Promise<void> {
  await query(
    `INSERT INTO market_snapshots (
       property_id, snapshot_date, source,
       list_price, sold_price, zillow_estimate, redfin_estimate,
       propstream_avm, assessor_fmv, dom, price_reductions,
       compete_score, status, list_date, sold_date, price_per_sqft
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16
     )`,
    [
      snap.property_id, snap.snapshot_date, snap.source,
      snap.list_price, snap.sold_price, snap.zillow_estimate, snap.redfin_estimate,
      snap.propstream_avm, snap.assessor_fmv, snap.dom, snap.price_reductions ?? 0,
      snap.compete_score, snap.status, snap.list_date, snap.sold_date, snap.price_per_sqft,
    ]
  )
}

/**
 * Update a single source's AVM in the most recent snapshot for a property.
 * Called by zillow-fetcher, redfin-fetcher, assessor-fetcher.
 */
export async function updateSnapshotField(
  propertyId: string,
  field: 'zillow_estimate' | 'redfin_estimate' | 'assessor_fmv' | 'compete_score',
  value: number
): Promise<void> {
  await query(
    `UPDATE market_snapshots SET ${field} = $1
     WHERE id = (
       SELECT id FROM market_snapshots
       WHERE property_id = $2
       ORDER BY snapshot_date DESC, created_at DESC
       LIMIT 1
     )`,
    [value, propertyId]
  )
}
