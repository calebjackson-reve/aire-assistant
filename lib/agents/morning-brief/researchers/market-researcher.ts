/**
 * Morning Brief — Market Intelligence Researcher
 *
 * Pulls real-time market data from AIRE_DATA and intelligence tables
 * to give the agent a market context snapshot in their daily brief.
 */

import { AIRE_DATA } from '@/lib/data/market-data'
import { query } from '@/lib/data/db/client'
import { getLowConfidenceProperties } from '@/lib/data/db/queries/scores'

export interface LowConfidenceProperty {
  propertyId: string
  address: string
  disagreementPct: number
  aireEstimate: number | null
}

export interface ScoringDistribution {
  highConfidence: number
  mediumConfidence: number
  lowConfidence: number
  avgDisagreement: number | null
}

export interface MarketResearchResult {
  metro: {
    medianPrice: number
    medianPriceChange: number
    dom: number
    monthsSupply: number
    inventory: number
  }
  hotNeighborhoods: Array<{
    name: string
    heatScore: number
    medianPrice: number
    dom: number
    recommendation: string
  }>
  intelligenceStats: {
    totalProperties: number
    totalScores: number
    recentScores: number  // scored in last 7 days
  } | null
  scoringHealth: ScoringDistribution | null
  lowConfidenceFlags: LowConfidenceProperty[]
  mortgageRate: number
}

export async function researchMarket(): Promise<MarketResearchResult> {
  // Static market data (updated quarterly)
  const metro = {
    medianPrice: AIRE_DATA.metro.medianPrice,
    medianPriceChange: AIRE_DATA.metro.medianPriceChange,
    dom: AIRE_DATA.metro.dom,
    monthsSupply: AIRE_DATA.metro.monthsSupply,
    inventory: AIRE_DATA.metro.inventory,
  }

  // Top 3 hottest neighborhoods
  const hotNeighborhoods = [...AIRE_DATA.markets]
    .sort((a, b) => b.heatScore - a.heatScore)
    .slice(0, 3)
    .map(m => ({
      name: m.name,
      heatScore: m.heatScore,
      medianPrice: m.medianPrice,
      dom: m.dom,
      recommendation: m.recommendation,
    }))

  // Try to get live intelligence stats + scoring health
  let intelligenceStats = null
  let scoringHealth: ScoringDistribution | null = null
  let lowConfidenceFlags: LowConfidenceProperty[] = []

  try {
    const [propCount, scoreCount, recentCount, tierDist, avgDisag, lowConf] = await Promise.all([
      query<{ count: string }>('SELECT COUNT(*) as count FROM properties_clean'),
      query<{ count: string }>('SELECT COUNT(*) as count FROM aire_scores'),
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM aire_scores WHERE score_date >= CURRENT_DATE - INTERVAL '7 days'`
      ),
      query<{ confidence_tier: string; cnt: string }>(
        `SELECT confidence_tier, COUNT(*) as cnt FROM aire_scores
         WHERE score_date >= CURRENT_DATE - INTERVAL '7 days'
         GROUP BY confidence_tier`
      ),
      query<{ avg_disag: string }>(
        `SELECT AVG(source_disagreement_pct) as avg_disag FROM aire_scores
         WHERE score_date >= CURRENT_DATE - INTERVAL '7 days' AND source_disagreement_pct IS NOT NULL`
      ),
      getLowConfidenceProperties(5),
    ])

    intelligenceStats = {
      totalProperties: parseInt(propCount.rows[0]?.count ?? '0', 10),
      totalScores: parseInt(scoreCount.rows[0]?.count ?? '0', 10),
      recentScores: parseInt(recentCount.rows[0]?.count ?? '0', 10),
    }

    const tierMap: Record<string, number> = {}
    for (const row of tierDist.rows) tierMap[row.confidence_tier] = parseInt(row.cnt, 10)
    scoringHealth = {
      highConfidence: tierMap['HIGH'] ?? 0,
      mediumConfidence: tierMap['MEDIUM'] ?? 0,
      lowConfidence: tierMap['LOW'] ?? 0,
      avgDisagreement: avgDisag.rows[0]?.avg_disag ? parseFloat(avgDisag.rows[0].avg_disag) : null,
    }

    lowConfidenceFlags = lowConf.map(p => ({
      propertyId: p.property_id,
      address: p.address_canonical,
      disagreementPct: p.source_disagreement_pct,
      aireEstimate: p.aire_estimate,
    }))
  } catch {
    // Tables may not have data yet
  }

  return {
    metro,
    hotNeighborhoods,
    intelligenceStats,
    scoringHealth,
    lowConfidenceFlags,
    mortgageRate: AIRE_DATA.national.thirtyYearRate,
  }
}
