import { Pool } from '@neondatabase/serverless'
import 'dotenv/config'

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })

  const tables = ['properties_clean', 'market_snapshots', 'aire_scores', 'job_runs', 'error_logs', 'raw_imports', 'backtest_results']

  for (const table of tables) {
    try {
      const result = await pool.query(`SELECT COUNT(*) as count FROM ${table}`)
      console.log(`✓ ${table}: ${result.rows[0].count} rows`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('does not exist')) {
        console.log(`✗ ${table}: DOES NOT EXIST`)
      } else {
        console.log(`✗ ${table}: ERROR — ${msg.slice(0, 80)}`)
      }
    }
  }

  await pool.end()
}

main().catch(console.error)
