/**
 * GET /api/cron/lrec-monitor
 * Weekly cron: checks LREC website for form updates.
 * Alerts when forms change so extraction rules can be updated.
 * Also callable manually for on-demand checks.
 */

import { NextResponse } from 'next/server'
import { checkLRECForms, logMonitorResult } from '@/lib/research/lrec-monitor'

export const maxDuration = 30

export async function GET(request: Request) {
  // Verify cron secret in production
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // Allow in development
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    console.log('[lrec-monitor] Starting LREC form check...')
    const report = await checkLRECForms()

    // Log the result for learning
    logMonitorResult(report)

    // Log alerts prominently
    if (report.alerts.length > 0) {
      console.warn('[lrec-monitor] FORM CHANGES DETECTED:')
      for (const alert of report.alerts) {
        console.warn(`  ${alert.formNumber}: ${alert.details}`)
      }
    }

    console.log(`[lrec-monitor] Check complete: ${report.summary}`)

    return NextResponse.json({
      success: true,
      ...report
    })
  } catch (error) {
    console.error('[lrec-monitor] Cron error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
