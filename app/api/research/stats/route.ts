/**
 * GET /api/research/stats
 * Aggregated stats from all learning subsystems:
 * - Document extraction accuracy
 * - Deal intelligence summary
 * - Form version tracking
 */

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getExtractionStats } from '@/lib/research/document-learner'
import { getDealIntelligenceSummary } from '@/lib/research/deal-analyzer'
import { getFormTrackingSummary } from '@/lib/research/form-tracker'

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const [extraction, deals, forms] = await Promise.all([
      getExtractionStats().catch(() => null),
      getDealIntelligenceSummary().catch(() => null),
      getFormTrackingSummary().catch(() => null)
    ])

    return NextResponse.json({
      extraction,
      deals,
      forms,
      generatedAt: new Date().toISOString()
    })
  } catch (error) {
    console.error('[research/stats] Error:', error)
    return NextResponse.json({ error: 'Failed to generate stats' }, { status: 500 })
  }
}
