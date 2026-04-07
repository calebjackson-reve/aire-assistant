/**
 * GET /api/data/admin?tier=LOW&search=main&limit=50&offset=0
 *
 * Lists scored properties with optional confidence tier filter and address search.
 * Returns properties joined with their latest AIRE score.
 */

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import { query } from '@/lib/data/db/client'

export async function GET(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify user is PRO or INVESTOR
  const user = await prisma.user.findUnique({ where: { clerkId: userId }, select: { tier: true } })
  if (!user || !['PRO', 'INVESTOR'].includes(user.tier)) {
    return NextResponse.json({ error: 'Requires PRO or INVESTOR tier' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const tier = searchParams.get('tier') // HIGH, MEDIUM, LOW, or null for all
  const search = searchParams.get('search') || ''
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)
  const offset = parseInt(searchParams.get('offset') || '0', 10)

  const conditions: string[] = []
  const params: (string | number)[] = []
  let paramIdx = 1

  if (tier && ['HIGH', 'MEDIUM', 'LOW'].includes(tier)) {
    conditions.push(`s.confidence_tier = $${paramIdx++}`)
    params.push(tier)
  }
  if (search.trim()) {
    conditions.push(`p.address_canonical ILIKE $${paramIdx++}`)
    params.push(`%${search.trim()}%`)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  try {
    const [rows, countResult] = await Promise.all([
      query<{
        property_id: string
        address_canonical: string
        list_price: number | null
        aire_estimate: number | null
        confidence_tier: string | null
        source_disagreement_pct: number | null
        pps_total: number | null
        assessor_gap_pct: number | null
        score_date: string
        is_manually_reviewed: boolean
        review_notes: string | null
      }>(
        `SELECT DISTINCT ON (s.property_id)
           s.property_id, p.address_canonical, p.list_price,
           s.aire_estimate, s.confidence_tier, s.source_disagreement_pct,
           s.pps_total, s.assessor_gap_pct, s.score_date,
           s.is_manually_reviewed, s.review_notes
         FROM aire_scores s
         JOIN properties_clean p ON p.property_id = s.property_id
         ${whereClause}
         ORDER BY s.property_id, s.score_date DESC
         LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
        [...params, limit, offset]
      ),
      query<{ count: string }>(
        `SELECT COUNT(DISTINCT s.property_id) as count
         FROM aire_scores s
         JOIN properties_clean p ON p.property_id = s.property_id
         ${whereClause}`,
        params
      ),
    ])

    return NextResponse.json({
      properties: rows.rows,
      total: parseInt(countResult.rows[0]?.count ?? '0', 10),
      limit,
      offset,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Query failed', detail: msg }, { status: 500 })
  }
}
