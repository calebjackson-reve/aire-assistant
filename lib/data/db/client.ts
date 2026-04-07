/**
 * AIRE Intelligence — Database client for raw SQL queries
 *
 * Uses @neondatabase/serverless (already in package.json) for direct SQL
 * against the intelligence tables (properties_clean, market_snapshots,
 * aire_scores, etc.) that live alongside the Prisma-managed tables.
 *
 * Prisma handles: User, Transaction, Deadline, etc.
 * This client handles: properties_clean, market_snapshots, aire_scores, job_runs, etc.
 */

import { Pool } from '@neondatabase/serverless'

let pool: Pool | null = null

function getPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error('[AIRE DB] DATABASE_URL is not set')
  }
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL })
  }
  return pool
}

/**
 * Execute a parameterized SQL query.
 * Uses Neon's serverless Pool for connection reuse.
 */
export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<{ rows: T[] }> {
  const p = getPool()
  const start = Date.now()
  try {
    const result = await p.query(text, params)
    const duration = Date.now() - start
    if (duration > 2000) {
      console.warn(`[AIRE DB] Slow query (${duration}ms): ${text.slice(0, 80)}`)
    }
    return { rows: result.rows as T[] }
  } catch (err) {
    console.error('[AIRE DB] Query error:', { text: text.slice(0, 120), params, err })
    throw err
  }
}

/**
 * Health check — verify database connectivity.
 */
export async function checkConnection(): Promise<{ ok: boolean; latencyMs: number }> {
  const start = Date.now()
  try {
    await getPool().query('SELECT 1')
    return { ok: true, latencyMs: Date.now() - start }
  } catch {
    return { ok: false, latencyMs: Date.now() - start }
  }
}
