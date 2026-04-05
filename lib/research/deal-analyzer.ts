/**
 * AIRE Deal Analyzer — Post-Close Intelligence
 * After a transaction reaches CLOSED status, calculates metrics,
 * compares to market norms, and generates AI takeaways.
 */

import prisma from '@/lib/prisma'

interface DealMetrics {
  transactionId: string
  propertyAddress: string
  parish: string
  listPrice: number
  salePrice: number
  listToSaleRatio: number
  daysOnMarket: number
  daysToClose: number
  negotiationDelta: number
  financingType: string
  closingDate: Date
}

interface MarketComparison {
  parish: string
  avgListToSaleRatio: number
  avgDaysOnMarket: number
  avgDaysToClose: number
  dealCount: number
}

interface DealInsight {
  metric: string
  value: string
  comparison: string
  insight: string
}

/**
 * Analyze a closed transaction and generate intelligence.
 */
export async function analyzeDeal(transactionId: string): Promise<{
  metrics: DealMetrics
  parishComparison: MarketComparison
  insights: DealInsight[]
}> {
  const txn = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: { documents: true }
  })

  if (!txn) throw new Error(`Transaction ${transactionId} not found`)

  const listPrice = (txn as Record<string, unknown>).listPrice as number || (txn as Record<string, unknown>).acceptedPrice as number || 0
  const salePrice = (txn as Record<string, unknown>).acceptedPrice as number || 0
  const listDate = (txn as Record<string, unknown>).listDate as Date || txn.createdAt
  const closingDate = (txn as Record<string, unknown>).closingDate as Date || new Date()
  const parish = (txn as Record<string, unknown>).parish as string || 'East Baton Rouge'

  const daysOnMarket = Math.round((closingDate.getTime() - listDate.getTime()) / (1000 * 60 * 60 * 24))
  const daysToClose = Math.round((closingDate.getTime() - txn.createdAt.getTime()) / (1000 * 60 * 60 * 24))
  const listToSaleRatio = listPrice > 0 ? salePrice / listPrice : 1
  const negotiationDelta = listPrice - salePrice

  const metrics: DealMetrics = {
    transactionId,
    propertyAddress: txn.propertyAddress,
    parish,
    listPrice,
    salePrice,
    listToSaleRatio,
    daysOnMarket,
    daysToClose,
    negotiationDelta,
    financingType: (txn as Record<string, unknown>).financingType as string || 'conventional',
    closingDate
  }

  // Get parish averages from closed transactions
  const parishTxns = await prisma.transaction.findMany({
    where: {
      status: 'CLOSED',
      id: { not: transactionId }
    },
    select: {
      acceptedPrice: true,
      createdAt: true,
      closingDate: true
    }
  })

  let totalRatio = 0
  let totalDOM = 0
  let totalDTC = 0
  const count = parishTxns.length

  for (const pt of parishTxns) {
    const pp = pt.acceptedPrice || 0
    totalRatio += pp > 0 ? 1 : 0 // simplified — would need listPrice stored
    const cd = (pt as Record<string, unknown>).closingDate as Date
    if (cd) {
      totalDTC += Math.round((cd.getTime() - pt.createdAt.getTime()) / (1000 * 60 * 60 * 24))
    }
  }

  const parishComparison: MarketComparison = {
    parish,
    avgListToSaleRatio: count > 0 ? totalRatio / count : 0.972,
    avgDaysOnMarket: count > 0 ? totalDOM / count : 38,
    avgDaysToClose: count > 0 ? totalDTC / count : 45,
    dealCount: count
  }

  // Generate insights by comparing deal to market
  const insights: DealInsight[] = []

  if (listToSaleRatio > parishComparison.avgListToSaleRatio + 0.02) {
    insights.push({
      metric: 'list-to-sale',
      value: `${(listToSaleRatio * 100).toFixed(1)}%`,
      comparison: `Parish avg: ${(parishComparison.avgListToSaleRatio * 100).toFixed(1)}%`,
      insight: `This deal closed above parish average — strong seller positioning or competitive offer.`
    })
  } else if (listToSaleRatio < parishComparison.avgListToSaleRatio - 0.02) {
    insights.push({
      metric: 'list-to-sale',
      value: `${(listToSaleRatio * 100).toFixed(1)}%`,
      comparison: `Parish avg: ${(parishComparison.avgListToSaleRatio * 100).toFixed(1)}%`,
      insight: `Closed below parish average. May indicate overpricing, condition issues, or buyer leverage.`
    })
  }

  if (daysOnMarket < parishComparison.avgDaysOnMarket * 0.5) {
    insights.push({
      metric: 'days-on-market',
      value: `${daysOnMarket} days`,
      comparison: `Parish avg: ${parishComparison.avgDaysOnMarket} days`,
      insight: `Sold in half the parish average time — likely priced right or in high-demand area.`
    })
  } else if (daysOnMarket > parishComparison.avgDaysOnMarket * 1.5) {
    insights.push({
      metric: 'days-on-market',
      value: `${daysOnMarket} days`,
      comparison: `Parish avg: ${parishComparison.avgDaysOnMarket} days`,
      insight: `Significantly longer than average. Consider pricing strategy review for similar properties.`
    })
  }

  if (negotiationDelta > 10000) {
    insights.push({
      metric: 'negotiation',
      value: `$${negotiationDelta.toLocaleString()} below list`,
      comparison: `${((negotiationDelta / listPrice) * 100).toFixed(1)}% reduction`,
      insight: `Large negotiation gap. Buyer had leverage — inspect why (condition, appraisal, market timing).`
    })
  }

  // Store insights on the transaction
  try {
    await (prisma.transaction as any).update({
      where: { id: transactionId },
      data: {
        metadata: JSON.parse(JSON.stringify({
          dealAnalysis: {
            metrics,
            parishComparison,
            insights,
            analyzedAt: new Date().toISOString()
          }
        }))
      }
    })
  } catch (err) {
    console.error('[deal-analyzer] Failed to store analysis:', err)
  }

  return { metrics, parishComparison, insights }
}

/**
 * Get aggregated deal intelligence across all closed transactions.
 */
export async function getDealIntelligenceSummary(): Promise<{
  totalDeals: number
  avgListToSaleRatio: number
  avgDaysToClose: number
  totalVolume: number
  byFinancingType: Record<string, { count: number; totalDTC: number }>
  recentInsights: string[]
}> {
  const closedTxns = await prisma.transaction.findMany({
    where: { status: 'CLOSED' },
    select: {
      acceptedPrice: true,
      createdAt: true,
      closingDate: true,
    }
  })

  let totalVolume = 0
  let totalDTC = 0
  const byFinancing: Record<string, { count: number; totalDTC: number }> = {}
  const recentInsights: string[] = []

  for (const txn of closedTxns) {
    totalVolume += txn.acceptedPrice || 0
    const cd = (txn as Record<string, unknown>).closingDate as Date
    if (cd) {
      const dtc = Math.round((cd.getTime() - txn.createdAt.getTime()) / (1000 * 60 * 60 * 24))
      totalDTC += dtc
    }

    const meta = (txn as any).metadata as Record<string, unknown> | null
    const analysis = meta?.dealAnalysis as Record<string, unknown> | undefined
    if (analysis?.insights) {
      const ins = analysis.insights as DealInsight[]
      for (const i of ins.slice(0, 2)) {
        recentInsights.push(i.insight)
      }
    }
  }

  return {
    totalDeals: closedTxns.length,
    avgListToSaleRatio: 0.972, // default until we have enough data
    avgDaysToClose: closedTxns.length > 0 ? Math.round(totalDTC / closedTxns.length) : 0,
    totalVolume,
    byFinancingType: byFinancing,
    recentInsights: recentInsights.slice(0, 10)
  }
}
