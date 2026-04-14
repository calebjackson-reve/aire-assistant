"use client"

import Link from "next/link"
import { type MarketSnapshot } from "@/lib/data/louisiana-live"

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)

const hotnessStyle = (h: MarketSnapshot["hotness"]) => {
  if (h === "Hot") return { bg: "#e8f0e0", text: "#4a5638", border: "#9aab7e" }
  if (h === "Balanced") return { bg: "#f0ece2", text: "#6b5a3a", border: "#c5a96a" }
  return { bg: "#eaecf0", text: "#3a4550", border: "#a0aab8" }
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 18, fontWeight: 600, color: "#1e2416" }}>
        {value}
      </div>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 11, fontWeight: 500, color: "#8a9070", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 3 }}>
        {label}
      </div>
    </div>
  )
}

export function MarketSnapshotPanel({ markets }: { markets: MarketSnapshot[] }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, fontWeight: 500, color: "#8a9070", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Baton Rouge Metro — Parish Market Snapshots
        </div>
        <Link
          href="/aire/tools/sellers"
          style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 13, color: "#6b7d52", textDecoration: "none", fontWeight: 500 }}
        >
          Run CMA →
        </Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        {markets.map(m => {
          const hs = hotnessStyle(m.hotness)
          return (
            <div
              key={m.parish}
              style={{ background: "#f0ece2", border: "1px solid #c5c9b8", borderRadius: 10, padding: 20 }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div>
                  <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 17, fontWeight: 700, color: "#1e2416" }}>
                    {m.parish}
                  </div>
                  <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 11, color: "#8a9070", marginTop: 2 }}>
                    {m.lastUpdated}
                  </div>
                </div>
                <span style={{
                  background: hs.bg, color: hs.text, border: `1px solid ${hs.border}`,
                  borderRadius: 10, padding: "3px 10px",
                  fontFamily: "'Space Grotesk', sans-serif", fontSize: 11, fontWeight: 500,
                }}>
                  {m.hotness}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <StatCell label="Median Price" value={fmt(m.medianPrice)} />
                <StatCell label="Avg DOM" value={`${m.avgDom}d`} />
                <StatCell label="Price/sqft" value={`$${m.pricePerSqft}`} />
                <StatCell label="Months Supply" value={m.monthsSupply.toFixed(1)} />
                <StatCell label="List-to-Sale" value={`${(m.listToSaleRatio * 100).toFixed(1)}%`} />
                <StatCell label="Active Listings" value={m.activeListings.toLocaleString()} />
              </div>

              <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #d8d4c8" }}>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 11, color: "#8a9070" }}>
                  Source: {m.source}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Caleb Q1 Performance vs Market */}
      <div style={{ marginTop: 14, background: "#1e2416", borderRadius: 10, padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, fontWeight: 500, color: "#8a9070", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Q1 2026 — Caleb Jackson Performance
          </div>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 11, color: "#8a9070" }}>
            vs. EBR market avg
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
          {[
            { label: "Transactions", value: "18", benchmark: null },
            { label: "Total Volume", value: "$3.38M", benchmark: null },
            { label: "Avg DOM", value: "10d", benchmark: "45d avg" },
            { label: "Equity Created", value: "$114K+", benchmark: null },
            { label: "Cash Flow", value: "$7K+", benchmark: null },
          ].map(s => (
            <div key={s.label}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 20, fontWeight: 600, color: "#9aab7e" }}>
                {s.value}
              </div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 11, fontWeight: 500, color: "#8a9070", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 3 }}>
                {s.label}
              </div>
              {s.benchmark && (
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 10, color: "#6b7d52", marginTop: 2 }}>
                  Market: {s.benchmark}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
