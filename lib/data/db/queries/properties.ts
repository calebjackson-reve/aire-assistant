/**
 * AIRE — Properties query functions
 * All reads and writes to properties_clean and market_snapshots.
 */

import { query } from '../client'

export interface PropertyClean {
  id: string; property_id: string; address_canonical: string
  street_number: string | null; street_name: string | null
  city: string | null; state: string; zip: string | null
  parish: string | null; lat: number | null; lng: number | null
  property_type: string | null; bedrooms: number | null; bathrooms: number | null
  sqft: number | null; lot_sqft: number | null; year_built: number | null
  garage_spaces: number | null; pool: boolean; subdivision: string | null
  school_district: string | null; parcel_id: string | null
  mls_id: string | null; propstream_id: string | null; assessor_id: string | null
  created_at: Date; updated_at: Date
}

export interface MarketSnapshot {
  id: string; property_id: string; snapshot_date: string; source: string
  list_price: number | null; sold_price: number | null
  zillow_estimate: number | null; redfin_estimate: number | null
  propstream_avm: number | null; assessor_fmv: number | null
  dom: number | null; price_reductions: number; compete_score: number | null
  status: string | null; list_date: string | null; sold_date: string | null
  price_per_sqft: number | null; created_at: Date
}

export async function findByPropertyId(propertyId: string): Promise<PropertyClean | null> {
  const { rows } = await query<PropertyClean>('SELECT * FROM properties_clean WHERE property_id = $1', [propertyId])
  return rows[0] ?? null
}

export async function findActiveByZip(zip: string): Promise<PropertyClean[]> {
  const { rows } = await query<PropertyClean>(
    `SELECT p.* FROM properties_clean p
     INNER JOIN (
       SELECT DISTINCT ON (property_id) property_id, status
       FROM market_snapshots ORDER BY property_id, snapshot_date DESC
     ) ms ON ms.property_id = p.property_id
     WHERE p.zip = $1 AND ms.status = 'active'`, [zip])
  return rows
}

export async function getLatestSnapshot(propertyId: string): Promise<MarketSnapshot | null> {
  const { rows } = await query<MarketSnapshot>(
    `SELECT * FROM market_snapshots WHERE property_id = $1
     ORDER BY snapshot_date DESC, created_at DESC LIMIT 1`, [propertyId])
  return rows[0] ?? null
}

export async function countActiveListings(): Promise<number> {
  const { rows } = await query<{ count: string }>(
    `SELECT COUNT(DISTINCT property_id) as count FROM market_snapshots
     WHERE status = 'active' AND snapshot_date >= NOW() - INTERVAL '7 days'`)
  return parseInt(rows[0]?.count ?? '0', 10)
}

export async function countSoldComps(): Promise<number> {
  const { rows } = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM market_snapshots WHERE sold_price IS NOT NULL`)
  return parseInt(rows[0]?.count ?? '0', 10)
}
