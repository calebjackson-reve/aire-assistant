/**
 * GET /api/cron/data-sync
 *
 * Nightly data sync cron job. Runs at 2:00 AM CT via Vercel Cron.
 *
 * Steps:
 * 1. Audit data freshness (identify stale properties)
 * 2. Run batch ensemble scoring on all active properties
 * 3. Report summary
 *
 * Vercel cron schedule: "0 7 * * *" (7 UTC = 2 AM CT)
 */

import { NextRequest, NextResponse } from 'next/server'
import { runBatchEnsembleScoring } from '@/lib/data/sync/ensemble-scorer'
import { auditDataFreshness } from '@/lib/data/sync/snapshot-refresher'

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log('[Cron:DataSync] Starting nightly data sync...')
  const start = Date.now()

  // Step 1: Audit data freshness
  let freshness
  try {
    freshness = await auditDataFreshness()
    console.log(`[Cron:DataSync] Freshness audit: ${freshness.fresh} fresh, ${freshness.stale} stale, ${freshness.very_stale} very stale`)
  } catch (err) {
    console.error('[Cron:DataSync] Freshness audit failed:', err)
    freshness = { error: 'audit_failed' }
  }

  // Step 2: Run batch ensemble scoring
  let scoring
  try {
    scoring = await runBatchEnsembleScoring()
    console.log(`[Cron:DataSync] Scoring: ${scoring.scored} scored, ${scoring.skipped} skipped, ${scoring.errors} errors`)
  } catch (err) {
    console.error('[Cron:DataSync] Batch scoring failed:', err)
    scoring = { error: 'scoring_failed' }
  }

  const totalMs = Date.now() - start
  console.log(`[Cron:DataSync] Complete in ${(totalMs / 1000).toFixed(1)}s`)

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    duration_ms: totalMs,
    freshness,
    scoring,
  })
}
