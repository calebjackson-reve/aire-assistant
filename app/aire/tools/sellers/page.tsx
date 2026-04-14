"use client"

import { useState, useCallback } from "react"
import { calculateNetProceeds, getMarketSnapshot, type NetProceedsResult, type MarketSnapshot } from "@/lib/data/louisiana-live"

// ─── Helpers ──────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)

const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`

// ─── Sub-components ───────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-6">
      <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: "#1e2416", fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
        {title}
      </h2>
      <p style={{ fontFamily: "'Space Grotesk', sans-serif", color: "#8a9070", fontSize: 14 }}>{subtitle}</p>
    </div>
  )
}

function StatBox({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{
      background: highlight ? "#9aab7e" : "#f5f2ea",
      borderLeft: highlight ? "none" : "3px solid #6b7d52",
      padding: "14px 18px", borderRadius: 8,
    }}>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: highlight ? 28 : 22, fontWeight: 600, color: "#1e2416" }}>
        {value}
      </div>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 11, fontWeight: 500, color: highlight ? "#1e2416" : "#8a9070", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 4 }}>
        {label}
      </div>
    </div>
  )
}

function InputRow({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontFamily: "'Space Grotesk', sans-serif", fontSize: 13, fontWeight: 500, color: "#2c3520", marginBottom: 6 }}>
        {label}
        {hint && <span style={{ color: "#8a9070", fontWeight: 400, marginLeft: 6 }}>{hint}</span>}
      </label>
      {children}
    </div>
  )
}

function Input({ value, onChange, type = "number", step }: {
  value: string | number; onChange: (v: string) => void; type?: string; step?: string
}) {
  return (
    <input
      type={type}
      step={step}
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        width: "100%", boxSizing: "border-box",
        background: "#fff", border: "1.5px solid #c5c9b8", borderRadius: 6,
        padding: "10px 14px", fontFamily: "'Space Grotesk', sans-serif",
        fontSize: 15, color: "#2c3520", outline: "none",
      }}
      onFocus={e => { e.target.style.borderColor = "#6b7d52"; e.target.style.boxShadow = "0 0 0 3px rgba(154,171,126,0.2)" }}
      onBlur={e => { e.target.style.borderColor = "#c5c9b8"; e.target.style.boxShadow = "none" }}
    />
  )
}

// ─── Net Proceeds Calculator ──────────────────────────────────────────────

function NetProceedsCalculator() {
  const [salePrice, setSalePrice] = useState("295000")
  const [payoff, setPayoff] = useState("180000")
  const [commission, setCommission] = useState("6")
  const [closingPct, setClosingPct] = useState("1.5")
  const [repairs, setRepairs] = useState("0")
  const [transferTax, setTransferTax] = useState("500")
  const [other, setOther] = useState("0")

  const result: NetProceedsResult | null = (() => {
    try {
      return calculateNetProceeds({
        salePrice: parseFloat(salePrice) || 0,
        mortgagePayoff: parseFloat(payoff) || 0,
        agentCommissionPct: (parseFloat(commission) || 0) / 100,
        closingCostsPct: (parseFloat(closingPct) || 0) / 100,
        repairConcessions: parseFloat(repairs) || 0,
        transferTax: parseFloat(transferTax) || 0,
        otherFees: parseFloat(other) || 0,
      })
    } catch { return null }
  })()

  return (
    <div style={{ background: "#f0ece2", border: "1px solid #c5c9b8", borderRadius: 10, padding: 28 }}>
      <SectionHeader
        title="Seller Net Proceeds"
        subtitle="Exactly what your client walks away with — Louisiana closing costs included"
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <InputRow label="Sale Price">
          <Input value={salePrice} onChange={setSalePrice} />
        </InputRow>
        <InputRow label="Mortgage Payoff">
          <Input value={payoff} onChange={setPayoff} />
        </InputRow>
        <InputRow label="Commission" hint="% (typically 5-6%)">
          <Input value={commission} onChange={setCommission} step="0.5" />
        </InputRow>
        <InputRow label="Seller Closing Costs" hint="% (LA avg: 1-2%)">
          <Input value={closingPct} onChange={setClosingPct} step="0.1" />
        </InputRow>
        <InputRow label="Repairs / Concessions" hint="$">
          <Input value={repairs} onChange={setRepairs} />
        </InputRow>
        <InputRow label="Transfer / Deed Tax" hint="$ (typically ~$500 in LA)">
          <Input value={transferTax} onChange={setTransferTax} />
        </InputRow>
        <InputRow label="Other Fees" hint="HOA, title holdback, etc.">
          <Input value={other} onChange={setOther} />
        </InputRow>
      </div>

      {result && (
        <div style={{ marginTop: 20 }}>
          {/* Net to seller highlight */}
          <div style={{
            background: result.netToSeller >= 0 ? "#9aab7e" : "#f5e8e8",
            borderRadius: 10, padding: "20px 24px", marginBottom: 16, textAlign: "center",
          }}>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 13, fontWeight: 500, color: "#1e2416", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
              Net to Seller at Closing
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 44, fontWeight: 600, color: "#1e2416" }}>
              {fmt(result.netToSeller)}
            </div>
          </div>

          {/* Breakdown table */}
          <div style={{ background: "#fff", border: "1px solid #d8d4c8", borderRadius: 8, overflow: "hidden" }}>
            <div style={{ background: "#f5f2ea", padding: "10px 16px", fontFamily: "'Space Grotesk', sans-serif", fontSize: 11, fontWeight: 500, color: "#8a9070", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Breakdown
            </div>
            {result.breakdown.map((item, i) => (
              <div
                key={i}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "11px 16px", borderBottom: i < result.breakdown.length - 1 ? "1px solid #ede9e0" : "none",
                }}
              >
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, color: "#2c3520" }}>
                  {item.label}
                </span>
                <span style={{
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: 14, fontWeight: 500,
                  color: item.negative ? "#8b4a4a" : "#1e2416",
                }}>
                  {item.negative ? "−" : "+"}{fmt(item.amount)}
                </span>
              </div>
            ))}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "14px 16px", background: "#f5f2ea", borderTop: "2px solid #c5c9b8",
            }}>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 600, color: "#1e2416" }}>Net to Seller</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 18, fontWeight: 700, color: result.netToSeller >= 0 ? "#6b7d52" : "#8b4a4a" }}>
                {fmt(result.netToSeller)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── CMA Quick Pull ───────────────────────────────────────────────────────

interface CMAComp {
  address: string
  price: number
  beds: number
  baths: number
  sqft: number
  dom: number
  saleDate: string
  pricePerSqft: number
}

function CMAGenerator() {
  const [address, setAddress] = useState("")
  const [loading, setLoading] = useState(false)
  const [snapshot, setSnapshot] = useState<MarketSnapshot | null>(null)
  const [comps, setComps] = useState<CMAComp[] | null>(null)

  const runCMA = useCallback(async () => {
    if (!address.trim()) return
    setLoading(true)
    setComps(null)

    // Get market snapshot
    try {
      const res = await fetch(`/api/data/louisiana?action=market&address=${encodeURIComponent(address)}`)
      const data = await res.json()
      setSnapshot(data)
    } catch { /* non-blocking */ }

    // Request Firecrawl CMA via API
    try {
      const res = await fetch("/api/data/cma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      })
      const data = await res.json()
      if (data?.comps) setComps(data.comps)
    } catch { /* handled below */ } finally {
      setLoading(false)
    }
  }, [address])

  const suggestedRange = snapshot && address ? {
    low: Math.round(snapshot.medianPrice * 0.95),
    mid: snapshot.medianPrice,
    high: Math.round(snapshot.medianPrice * 1.08),
  } : null

  return (
    <div style={{ background: "#f0ece2", border: "1px solid #c5c9b8", borderRadius: 10, padding: 28 }}>
      <SectionHeader
        title="Comparative Market Analysis"
        subtitle="Parish market data + live comp search. Shows pricing range based on recent sales."
      />

      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <div style={{ flex: 1 }}>
          <Input type="text" value={address} onChange={v => setAddress(v)} />
        </div>
        <button
          onClick={runCMA}
          disabled={loading || !address.trim()}
          style={{
            background: loading ? "#8a9070" : "#6b7d52", color: "#f5f2ea",
            border: "none", borderRadius: 6, padding: "10px 22px",
            fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 500,
            cursor: loading ? "default" : "pointer", whiteSpace: "nowrap",
          }}
        >
          {loading ? "Pulling data..." : "Run CMA"}
        </button>
      </div>

      {snapshot && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, fontWeight: 500, color: "#8a9070", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
            {snapshot.parish} Parish — Market Snapshot
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            <StatBox label="Median Price" value={fmt(snapshot.medianPrice)} />
            <StatBox label="Avg DOM" value={`${snapshot.avgDom} days`} />
            <StatBox label="Price/sqft" value={`$${snapshot.pricePerSqft}`} />
            <StatBox label="Months Supply" value={snapshot.monthsSupply.toFixed(1)} />
          </div>

          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              background: snapshot.hotness === "Hot" ? "#e8f0e0" : snapshot.hotness === "Balanced" ? "#f0ece2" : "#eaecf0",
              color: snapshot.hotness === "Hot" ? "#4a5638" : snapshot.hotness === "Balanced" ? "#6b5a3a" : "#3a4550",
              border: `1px solid ${snapshot.hotness === "Hot" ? "#9aab7e" : snapshot.hotness === "Balanced" ? "#c5a96a" : "#a0aab8"}`,
              borderRadius: 10, padding: "3px 12px",
              fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, fontWeight: 500,
            }}>
              {snapshot.hotness}
            </div>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, color: "#8a9070" }}>
              List-to-sale: {fmtPct(snapshot.listToSaleRatio)} · Source: {snapshot.source}
            </span>
          </div>
        </div>
      )}

      {suggestedRange && (
        <div style={{ background: "#fff", border: "1px solid #c5c9b8", borderRadius: 8, padding: 20, marginBottom: 16 }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, fontWeight: 500, color: "#8a9070", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
            Suggested List Price Range
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <div style={{ textAlign: "center", padding: "12px 8px", borderRadius: 8, background: "#f5f2ea" }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 18, fontWeight: 600, color: "#8a9070" }}>{fmt(suggestedRange.low)}</div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 11, color: "#8a9070", marginTop: 4 }}>Conservative</div>
            </div>
            <div style={{ textAlign: "center", padding: "12px 8px", borderRadius: 8, background: "#9aab7e" }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 22, fontWeight: 700, color: "#1e2416" }}>{fmt(suggestedRange.mid)}</div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 11, color: "#1e2416", marginTop: 4 }}>Market Rate</div>
            </div>
            <div style={{ textAlign: "center", padding: "12px 8px", borderRadius: 8, background: "#f5f2ea" }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 18, fontWeight: 600, color: "#6b7d52" }}>{fmt(suggestedRange.high)}</div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 11, color: "#8a9070", marginTop: 4 }}>Aggressive</div>
            </div>
          </div>
        </div>
      )}

      {!comps && snapshot && (
        <div style={{ padding: "12px 16px", background: "#f5f2ea", borderRadius: 8, fontFamily: "'Space Grotesk', sans-serif", fontSize: 13, color: "#8a9070" }}>
          Live comp scraping requires <code style={{ background: "#e8e4d8", padding: "1px 6px", borderRadius: 4, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>FIRECRAWL_API_KEY</code> in environment.
          Set it in Vercel to enable real-time Zillow comp pulls.
        </div>
      )}

      {comps && comps.length > 0 && (
        <div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, fontWeight: 500, color: "#8a9070", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
            Recent Comparable Sales
          </div>
          <div style={{ background: "#fff", border: "1px solid #c5c9b8", borderRadius: 8, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr", background: "#f5f2ea", padding: "10px 14px", fontFamily: "'Space Grotesk', sans-serif", fontSize: 11, fontWeight: 500, color: "#8a9070", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              <span>Address</span><span>Price</span><span>Beds/Ba</span><span>Sqft</span><span>$/sqft</span><span>DOM</span>
            </div>
            {comps.map((c, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr", padding: "11px 14px", borderTop: "1px solid #ede9e0", fontFamily: "'Space Grotesk', sans-serif", fontSize: 13, color: "#2c3520" }}>
                <span style={{ fontWeight: 500 }}>{c.address}</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(c.price)}</span>
                <span>{c.beds}/{c.baths}</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{c.sqft.toLocaleString()}</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>${c.pricePerSqft}</span>
                <span>{c.dom}d</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Listing Checklist Generator ──────────────────────────────────────────

const LISTING_CHECKLIST = [
  { phase: "Pre-Listing", items: ["Comparative Market Analysis completed", "Pre-listing inspection scheduled", "Staging consultation booked", "Professional photography scheduled", "Disclosure forms prepared (LREC)", "Flood zone certification obtained", "HOA documents requested (if applicable)", "Survey pulled from parish records"] },
  { phase: "MLS Entry", items: ["Accurate beds/baths/sqft verified", "Year built confirmed with assessor", "Legal description from parish assessor", "Flood zone noted in MLS (required in LA)", "Showing instructions entered", "Lockbox installed", "Sign installed", "Open house scheduled"] },
  { phase: "Marketing", items: ["Zillow/Realtor.com syndication verified", "Instagram listing posts created (AIRE)", "Facebook Marketplace posted", "Listing flyer distributed (AIRE Canva)", "Agent network blast email sent", "MLS tour/caravan scheduled"] },
  { phase: "Active Monitoring", items: ["Weekly showing feedback collected", "Price reduction analysis at 14 days", "Offer presentation process defined", "Seller communication cadence set"] },
]

function ListingChecklist() {
  const [checked, setChecked] = useState<Set<string>>(new Set())

  const toggle = (key: string) => setChecked(prev => {
    const n = new Set(prev)
    n.has(key) ? n.delete(key) : n.add(key)
    return n
  })

  const total = LISTING_CHECKLIST.reduce((s, p) => s + p.items.length, 0)
  const done = checked.size
  const pct = Math.round((done / total) * 100)

  return (
    <div style={{ background: "#f0ece2", border: "1px solid #c5c9b8", borderRadius: 10, padding: 28 }}>
      <SectionHeader
        title="Listing Launch Checklist"
        subtitle="Every step from pre-listing to MLS live — Louisiana-specific requirements included"
      />

      {/* Progress */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 13, color: "#2c3520" }}>{done} of {total} complete</span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 600, color: "#6b7d52" }}>{pct}%</span>
        </div>
        <div style={{ background: "#c5c9b8", borderRadius: 100, height: 8 }}>
          <div style={{ background: "#6b7d52", borderRadius: 100, height: 8, width: `${pct}%`, transition: "width 0.3s ease" }} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {LISTING_CHECKLIST.map(phase => (
          <div key={phase.phase} style={{ background: "#fff", border: "1px solid #d8d4c8", borderRadius: 8, overflow: "hidden" }}>
            <div style={{ background: "#f5f2ea", padding: "10px 14px", fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, fontWeight: 600, color: "#1e2416", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {phase.phase}
            </div>
            {phase.items.map(item => {
              const key = `${phase.phase}:${item}`
              const isChecked = checked.has(key)
              return (
                <div
                  key={item}
                  onClick={() => toggle(key)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "9px 14px",
                    borderTop: "1px solid #f0ece2", cursor: "pointer",
                    background: isChecked ? "#f5f2ea" : "#fff",
                    transition: "background 0.1s",
                  }}
                >
                  <div style={{
                    width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                    background: isChecked ? "#6b7d52" : "#fff",
                    border: `1.5px solid ${isChecked ? "#6b7d52" : "#c5c9b8"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {isChecked && <span style={{ color: "#fff", fontSize: 10, fontWeight: 700 }}>✓</span>}
                  </div>
                  <span style={{
                    fontFamily: "'Space Grotesk', sans-serif", fontSize: 13, color: isChecked ? "#8a9070" : "#2c3520",
                    textDecoration: isChecked ? "line-through" : "none",
                  }}>
                    {item}
                  </span>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────

export default function SellerToolsPage() {
  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px" }}>
      <div style={{ marginBottom: 36 }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, fontWeight: 500, color: "#8a9070", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
          AIRE Intelligence · Seller Tools
        </div>
        <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 38, fontWeight: 700, color: "#1e2416", margin: 0, lineHeight: 1.15 }}>
          Louisiana Seller Intelligence
        </h1>
        <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, color: "#8a9070", marginTop: 10, lineHeight: 1.6 }}>
          CMA with real parish data, exact net proceeds at any sale price, and a full listing launch checklist built for Louisiana transactions.
        </p>
      </div>

      <div style={{ display: "grid", gap: 20 }}>
        <CMAGenerator />
        <NetProceedsCalculator />
        <ListingChecklist />
      </div>

      <div style={{ marginTop: 20, padding: "14px 18px", background: "#f5f2ea", borderRadius: 8, fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, color: "#8a9070" }}>
        Market data sourced from GBRAR MLS InfoSparks (Feb 2026). Net proceeds are estimates — actual figures depend on title company, payoff amount, and negotiated terms. Not financial advice.
      </div>
    </div>
  )
}
