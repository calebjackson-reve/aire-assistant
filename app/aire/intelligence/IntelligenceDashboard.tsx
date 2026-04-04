"use client"

import { useState } from "react"

interface Transaction {
  id: string
  propertyAddress: string
  propertyCity: string
  propertyState: string
  propertyZip: string | null
  listPrice: number | null
  acceptedPrice: number | null
  status: string
}

interface AVMResult {
  estimatedValue?: number
  confidenceScore?: number
  valueLow?: number
  valueHigh?: number
  comparables?: Array<{
    address: string
    soldPrice: number
    soldDate: string
    sqft?: number
    distance?: number
  }>
  marketTrend?: string
  error?: string
}

export function IntelligenceDashboard({ transactions }: { transactions: Transaction[] }) {
  const [address, setAddress] = useState("")
  const [city, setCity] = useState("Baton Rouge")
  const [zip, setZip] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AVMResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function runEstimate(addr?: string, c?: string, z?: string) {
    const queryAddr = addr || address
    if (!queryAddr.trim()) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch("/api/intelligence/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: queryAddr,
          city: c || city,
          state: "LA",
          zip: z || zip,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "AVM request failed")
      } else {
        setResult(data)
      }
    } catch {
      setError("Network error — could not reach AIRE Intelligence")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Search */}
      <div className="border border-brown-border rounded-xl p-5 mb-8">
        <p className="text-cream text-sm font-medium mb-3">Property Valuation</p>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Property address..."
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runEstimate()}
            className="flex-1 bg-forest-deep border border-brown-border rounded-lg px-4 py-2.5 text-cream text-sm placeholder:text-cream-dark/50 focus:outline-none focus:border-copper/40"
          />
          <input
            type="text"
            placeholder="City"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-36 bg-forest-deep border border-brown-border rounded-lg px-3 py-2.5 text-cream text-sm placeholder:text-cream-dark/50 focus:outline-none focus:border-copper/40"
          />
          <input
            type="text"
            placeholder="ZIP"
            value={zip}
            onChange={(e) => setZip(e.target.value)}
            className="w-24 bg-forest-deep border border-brown-border rounded-lg px-3 py-2.5 text-cream text-sm placeholder:text-cream-dark/50 focus:outline-none focus:border-copper/40"
          />
          <button
            onClick={() => runEstimate()}
            disabled={loading || !address.trim()}
            className="bg-copper hover:bg-copper-light disabled:opacity-40 text-forest-deep font-medium text-sm px-5 py-2.5 rounded-lg transition-colors"
          >
            {loading ? "Analyzing..." : "Estimate"}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="border border-status-red/30 bg-status-red/5 rounded-lg p-4 mb-6">
          <p className="text-status-red text-sm">{error}</p>
          <p className="text-cream-dim text-xs mt-1">
            Ensure AIRE_INTELLIGENCE_API_URL and AIRE_INTELLIGENCE_API_KEY are set in environment variables.
          </p>
        </div>
      )}

      {/* Result */}
      {result && !result.error && (
        <div className="border border-brown-border rounded-xl p-6 mb-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-cream-dim text-xs uppercase tracking-wider mb-1">AIRE Estimate</p>
              <p className="text-cream text-3xl font-light">
                {result.estimatedValue
                  ? `$${result.estimatedValue.toLocaleString()}`
                  : "N/A"}
              </p>
              {result.valueLow && result.valueHigh && (
                <p className="text-cream-dim text-xs mt-1">
                  Range: ${result.valueLow.toLocaleString()} — ${result.valueHigh.toLocaleString()}
                </p>
              )}
            </div>
            {result.confidenceScore !== undefined && (
              <div className="text-right">
                <p className="text-cream-dim text-xs mb-1">Confidence</p>
                <p className={`text-lg font-medium ${
                  result.confidenceScore >= 80 ? "text-status-green" :
                  result.confidenceScore >= 60 ? "text-status-amber" :
                  "text-status-red"
                }`}>
                  {result.confidenceScore}%
                </p>
              </div>
            )}
          </div>

          {result.marketTrend && (
            <div className="border-t border-brown-border pt-4 mb-4">
              <p className="text-cream-dim text-xs uppercase tracking-wider mb-1">Market Trend</p>
              <p className="text-cream text-sm">{result.marketTrend}</p>
            </div>
          )}

          {result.comparables && result.comparables.length > 0 && (
            <div className="border-t border-brown-border pt-4">
              <p className="text-cream-dim text-xs uppercase tracking-wider mb-3">Comparable Sales</p>
              <div className="space-y-2">
                {result.comparables.map((comp, i) => (
                  <div key={i} className="flex items-center justify-between text-sm border border-brown-border/50 rounded-lg px-4 py-2.5">
                    <div>
                      <p className="text-cream">{comp.address}</p>
                      <p className="text-cream-dim text-xs">
                        {comp.soldDate}
                        {comp.sqft ? ` · ${comp.sqft.toLocaleString()} sqft` : ""}
                        {comp.distance ? ` · ${comp.distance.toFixed(1)} mi` : ""}
                      </p>
                    </div>
                    <p className="text-cream font-medium">${comp.soldPrice.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Active transactions quick-run */}
      {transactions.length > 0 && (
        <div>
          <h2 className="text-cream font-medium mb-4">Quick estimate from active deals</h2>
          <div className="space-y-2">
            {transactions.map((txn) => (
              <div key={txn.id} className="border border-brown-border rounded-lg p-4 flex items-center justify-between">
                <div>
                  <p className="text-cream text-sm">{txn.propertyAddress}</p>
                  <p className="text-cream-dim text-xs mt-0.5">
                    {txn.propertyCity}, {txn.propertyState}
                    {txn.listPrice ? ` · List $${txn.listPrice.toLocaleString()}` : ""}
                    {txn.acceptedPrice ? ` · Accepted $${txn.acceptedPrice.toLocaleString()}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setAddress(txn.propertyAddress)
                    setCity(txn.propertyCity)
                    setZip(txn.propertyZip || "")
                    runEstimate(txn.propertyAddress, txn.propertyCity, txn.propertyZip || "")
                  }}
                  className="text-xs text-copper hover:text-copper-light transition-colors shrink-0"
                >
                  Run AVM
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
