/**
 * POST /api/data/import
 *
 * Import MLS or PropStream CSV data directly via API.
 * Replaces the need for standalone MCP servers for manual imports.
 *
 * Body: { source: "mls" | "propstream", records: [...] }
 * Each record: { address, list_price, sold_price, bedrooms, sqft, ... }
 */

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { query } from '@/lib/data/db/client'
import { normalizeAddress } from '@/lib/data/engines/normalize'

interface ImportRecord {
  address: string
  city?: string
  zip?: string
  property_type?: string
  bedrooms?: number
  bathrooms?: number
  sqft?: number
  lot_sqft?: number
  year_built?: number
  list_price?: number
  sold_price?: number
  dom?: number
  status?: string
  list_date?: string
  sold_date?: string
  mls_id?: string
  propstream_avm?: number
  assessor_fmv?: number
  parcel_id?: string
}

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { source, records } = body as { source: string; records: ImportRecord[] }

  if (!source || !['mls', 'propstream'].includes(source)) {
    return NextResponse.json({ error: 'source must be "mls" or "propstream"' }, { status: 400 })
  }
  if (!records?.length) {
    return NextResponse.json({ error: 'records array is required' }, { status: 400 })
  }

  // Create job run
  const { rows: [job] } = await query<{ id: string }>(
    `INSERT INTO job_runs (job_name, source, status, triggered_by) VALUES ($1, $2, 'running', 'manual') RETURNING id`,
    [`${source}-import`, source]
  )

  let imported = 0
  let skipped = 0
  let errored = 0
  const today = new Date().toISOString().split('T')[0]

  for (const rec of records) {
    try {
      const normalized = normalizeAddress(rec.address)
      if (!normalized) { skipped++; continue }

      // Upsert property
      await query(
        `INSERT INTO properties_clean (
           property_id, address_canonical, street_number, street_name,
           city, state, zip, parish, property_type,
           bedrooms, bathrooms, sqft, lot_sqft, year_built,
           mls_id, propstream_id, parcel_id
         ) VALUES ($1,$2,$3,$4,$5,'LA',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         ON CONFLICT (property_id) DO UPDATE SET
           mls_id = COALESCE(EXCLUDED.mls_id, properties_clean.mls_id),
           propstream_id = COALESCE(EXCLUDED.propstream_id, properties_clean.propstream_id),
           parcel_id = COALESCE(EXCLUDED.parcel_id, properties_clean.parcel_id),
           bedrooms = COALESCE(EXCLUDED.bedrooms, properties_clean.bedrooms),
           bathrooms = COALESCE(EXCLUDED.bathrooms, properties_clean.bathrooms),
           sqft = COALESCE(EXCLUDED.sqft, properties_clean.sqft),
           year_built = COALESCE(EXCLUDED.year_built, properties_clean.year_built),
           updated_at = NOW()`,
        [
          normalized.property_id, normalized.address_canonical,
          normalized.street_number, normalized.street_name,
          normalized.city, normalized.zip, normalized.parish,
          rec.property_type ?? null, rec.bedrooms ?? null, rec.bathrooms ?? null,
          rec.sqft ?? null, rec.lot_sqft ?? null, rec.year_built ?? null,
          rec.mls_id ?? null,
          source === 'propstream' ? (rec.parcel_id ?? null) : null,
          rec.parcel_id ?? null,
        ]
      )

      // Insert snapshot
      await query(
        `INSERT INTO market_snapshots (
           property_id, snapshot_date, source,
           list_price, sold_price, propstream_avm, assessor_fmv,
           dom, status, list_date, sold_date
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          normalized.property_id,
          rec.sold_date ?? rec.list_date ?? today,
          source,
          rec.list_price ?? null, rec.sold_price ?? null,
          rec.propstream_avm ?? null, rec.assessor_fmv ?? null,
          rec.dom ?? null, rec.status ?? 'active',
          rec.list_date ?? null, rec.sold_date ?? null,
        ]
      )

      imported++
    } catch {
      errored++
    }
  }

  // Complete job
  const status = errored === 0 ? 'success' : imported > 0 ? 'partial' : 'failed'
  await query(
    `UPDATE job_runs SET status=$1, completed_at=NOW(), records_attempted=$2, records_imported=$3, records_skipped=$4, records_errored=$5 WHERE id=$6`,
    [status, records.length, imported, skipped, errored, job.id]
  )

  return NextResponse.json({
    job_run_id: job.id,
    status,
    total: records.length,
    imported,
    skipped,
    errored,
  })
}
