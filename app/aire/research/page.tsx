'use client'

import { useState, useEffect } from 'react'

interface ExtractionStats {
  totalProcessed: number
  flaggedForReview: number
  averageConfidence: number
  byFormType: Record<string, {
    count: number
    avgConfidence: number
    completionRate: number
    topMissedFields: string[]
  }>
}

interface DealStats {
  totalDeals: number
  avgListToSaleRatio: number
  avgDaysToClose: number
  totalVolume: number
  recentInsights: string[]
}

interface FormStats {
  knownForms: number
  formTypes: { type: string; formNumber: string; version: string }[]
  versionAlerts: string[]
}

interface ResearchData {
  extraction: ExtractionStats | null
  deals: DealStats | null
  forms: FormStats | null
  generatedAt: string
}

export default function ResearchPage() {
  const [data, setData] = useState<ResearchData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/research/stats')
      .then(r => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-[#e8e4d8] mb-4">Research Intelligence</h1>
        <p className="text-[#e8e4d8]/60">Loading research data...</p>
      </div>
    )
  }

  const ext = data?.extraction
  const deals = data?.deals
  const forms = data?.forms

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#e8e4d8]">Research Intelligence</h1>
        <p className="text-[#e8e4d8]/60 text-sm mt-1">
          System learning metrics — updated {data?.generatedAt ? new Date(data.generatedAt).toLocaleString() : 'never'}
        </p>
      </div>

      {/* Document Intelligence */}
      <section className="bg-[#1e2416]/50 border border-[#6b7d52]/30 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-[#9aab7e] mb-4">Document Intelligence</h2>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <StatCard label="Docs Processed" value={ext?.totalProcessed ?? 0} />
          <StatCard
            label="Avg Confidence"
            value={ext?.averageConfidence ? `${(ext.averageConfidence * 100).toFixed(1)}%` : '—'}
          />
          <StatCard
            label="Flagged for Review"
            value={ext?.flaggedForReview ?? 0}
            alert={ext?.flaggedForReview ? ext.flaggedForReview > 0 : false}
          />
        </div>

        {ext?.byFormType && Object.keys(ext.byFormType).length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-[#e8e4d8]/80">By Form Type</h3>
            {Object.entries(ext.byFormType).map(([type, stats]) => (
              <div key={type} className="bg-[#1e2416]/60 rounded p-3 flex items-center justify-between">
                <div>
                  <span className="text-[#e8e4d8] font-medium">{type.replace(/_/g, ' ')}</span>
                  <span className="text-[#e8e4d8]/50 text-sm ml-2">({stats.count} docs)</span>
                </div>
                <div className="text-right">
                  <span className="text-[#9aab7e] text-sm">
                    {(stats.completionRate * 100).toFixed(0)}% fields extracted
                  </span>
                  {stats.topMissedFields.length > 0 && (
                    <p className="text-[#e8e4d8]/40 text-xs mt-1">
                      Top miss: {stats.topMissedFields[0]}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {(!ext || ext.totalProcessed === 0) && (
          <p className="text-[#e8e4d8]/40 text-sm">No documents processed yet. Upload PDFs to start building intelligence.</p>
        )}
      </section>

      {/* Deal Intelligence */}
      <section className="bg-[#1e2416]/50 border border-[#6b7d52]/30 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-[#9aab7e] mb-4">Deal Intelligence</h2>
        <div className="grid grid-cols-4 gap-4 mb-6">
          <StatCard label="Deals Analyzed" value={deals?.totalDeals ?? 0} />
          <StatCard
            label="Avg List-to-Sale"
            value={deals?.avgListToSaleRatio ? `${(deals.avgListToSaleRatio * 100).toFixed(1)}%` : '—'}
          />
          <StatCard
            label="Avg Days to Close"
            value={deals?.avgDaysToClose ?? '—'}
          />
          <StatCard
            label="Total Volume"
            value={deals?.totalVolume ? `$${(deals.totalVolume / 1000000).toFixed(2)}M` : '$0'}
          />
        </div>

        {deals?.recentInsights && deals.recentInsights.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-[#e8e4d8]/80">Recent Insights</h3>
            {deals.recentInsights.map((insight, i) => (
              <div key={i} className="bg-[#1e2416]/60 rounded p-3 text-[#e8e4d8]/80 text-sm">
                {insight}
              </div>
            ))}
          </div>
        )}

        {(!deals || deals.totalDeals === 0) && (
          <p className="text-[#e8e4d8]/40 text-sm">No closed deals yet. Intelligence builds as transactions close.</p>
        )}
      </section>

      {/* Form Version Tracking */}
      <section className="bg-[#1e2416]/50 border border-[#6b7d52]/30 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-[#9aab7e] mb-4">Form Version Tracking</h2>

        {forms?.versionAlerts && forms.versionAlerts.length > 0 && (
          <div className="mb-4 space-y-2">
            {forms.versionAlerts.map((alert, i) => (
              <div key={i} className="bg-red-900/20 border border-red-500/30 rounded p-3 text-red-300 text-sm">
                {alert}
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {forms?.formTypes?.map(form => (
            <div key={form.formNumber} className="bg-[#1e2416]/60 rounded p-3">
              <div className="text-[#e8e4d8] font-medium text-sm">{form.formNumber}</div>
              <div className="text-[#e8e4d8]/50 text-xs">{form.type.replace(/_/g, ' ')}</div>
              <div className="text-[#9aab7e] text-xs mt-1">v{form.version}</div>
            </div>
          ))}
        </div>

        {(!forms || forms.knownForms === 0) && (
          <p className="text-[#e8e4d8]/40 text-sm">No forms tracked yet.</p>
        )}
      </section>
    </div>
  )
}

function StatCard({ label, value, alert }: { label: string; value: string | number; alert?: boolean }) {
  return (
    <div className="bg-[#1e2416]/60 rounded p-4">
      <div className="text-[#e8e4d8]/50 text-xs uppercase tracking-wider">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${alert ? 'text-red-400' : 'text-[#e8e4d8]'}`}>
        {value}
      </div>
    </div>
  )
}
