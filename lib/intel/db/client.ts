/**
 * AIRE Intelligence — Postgres client
 *
 * Supports two modes:
 *  1. Direct Postgres via `pg` Pool (DATABASE_URL=postgresql://...)
 *  2. Supabase via @supabase/supabase-js (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
 *
 * For MCP servers and the scheduler, use the `pool` export directly.
 * For Next.js API routes, use the `query` helper (handles pool lifecycle).
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg'

// ── Lazy connection pool ──────────────────────────────────────────────────────
// AIRE Intelligence uses a SEPARATE raw-Postgres DB (INTEL_DATABASE_URL), distinct
// from aire-assistant's Prisma/Neon connection (DATABASE_URL). Lazy-init so the
// module can be imported even when INTEL_DATABASE_URL is not configured (e.g.
// dev environments not using the intel AVM). Routes that call query() will
// throw at request time with a clear message instead of at module-load.
let _pool: Pool | null = null

function getConnectionString(): string {
  const url = process.env.INTEL_DATABASE_URL ?? process.env.AIRE_INTEL_DATABASE_URL
  if (!url) {
    throw new Error(
      '[AIRE Intel DB] INTEL_DATABASE_URL is not set. Add it to .env.local to enable the AVM/flood/neighborhood/backtest APIs. Falls back to static data when unavailable.',
    )
  }
  return url
}

export const pool: Pool = new Proxy({} as Pool, {
  get(_target, prop) {
    if (!_pool) {
      const connectionString = getConnectionString()
      _pool = new Pool({
        connectionString,
        ssl: connectionString.includes('supabase')
          ? { rejectUnauthorized: false }
          : process.env.DATABASE_SSL === 'true'
            ? { rejectUnauthorized: false }
            : undefined,
        max: 10,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 10_000,
      })
      _pool.on('error', (err) => {
        console.error('[AIRE Intel DB] Unexpected pool error:', err.message)
      })
    }
    return (_pool as unknown as Record<string | symbol, unknown>)[prop as string | symbol]
  },
})

// ── Typed query helper ────────────────────────────────────────────────────────
/**
 * Execute a parameterized query against the pool.
 *
 * @example
 *   const result = await query<{ id: string }>(
 *     'SELECT id FROM properties_clean WHERE zip = $1',
 *     ['70816']
 *   )
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const start = Date.now()
  try {
    const result = await pool.query<T>(text, params)
    const duration = Date.now() - start
    if (duration > 2000) {
      console.warn(`[AIRE DB] Slow query (${duration}ms): ${text.slice(0, 80)}`)
    }
    return result
  } catch (err) {
    console.error('[AIRE DB] Query error:', { text: text.slice(0, 120), params, err })
    throw err
  }
}

// ── Transaction helper ────────────────────────────────────────────────────────
/**
 * Execute multiple queries inside a single transaction.
 * Rolls back automatically on error.
 *
 * @example
 *   await withTransaction(async (client) => {
 *     await client.query('INSERT INTO ...')
 *     await client.query('UPDATE ...')
 *   })
 */
export async function withTransaction(
  fn: (client: PoolClient) => Promise<void>
): Promise<void> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await fn(client)
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// ── Health check ──────────────────────────────────────────────────────────────
export async function checkConnection(): Promise<{ ok: boolean; latencyMs: number }> {
  const start = Date.now()
  try {
    await pool.query('SELECT 1')
    return { ok: true, latencyMs: Date.now() - start }
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - start }
  }
}

// ── Graceful shutdown (for scheduler process) ─────────────────────────────────
export async function closePool(): Promise<void> {
  await pool.end()
}
