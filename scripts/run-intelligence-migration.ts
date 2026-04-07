/**
 * Run intelligence table migration against Neon PostgreSQL.
 * Usage: npx tsx scripts/run-intelligence-migration.ts
 */

import { Pool } from '@neondatabase/serverless'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import 'dotenv/config'

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set')
    process.exit(1)
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const sqlPath = resolve(__dirname, '../prisma/migrations/intelligence_tables.sql')
  const sql = readFileSync(sqlPath, 'utf-8')

  console.log('Running intelligence table migration...')
  console.log(`Database: ${process.env.DATABASE_URL.split('@')[1]?.split('/')[0] || 'unknown'}`)

  try {
    await pool.query(sql)
    console.log('Migration complete.')

    // Verify
    const tables = ['properties_clean', 'market_snapshots', 'aire_scores', 'job_runs', 'error_logs', 'raw_imports', 'backtest_results']
    for (const table of tables) {
      const result = await pool.query(`SELECT COUNT(*) as count FROM ${table}`)
      console.log(`  ✓ ${table}: ${result.rows[0].count} rows`)
    }
  } catch (err) {
    console.error('Migration failed:', err)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

main()
