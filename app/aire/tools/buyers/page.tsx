"use client"

import { useState, useCallback } from "react"
import { calculatePITI, LOUISIANA_BUYER_PROGRAMS, type PITIResult, type BuyerProgram } from "@/lib/data/louisiana-live"

// ─── Types ────────────────────────────────────────────────────────────────

interface FloodResult {
  zone: string
  riskLabel: "High" | "Moderate" | "Low" | "Undetermined"
  riskColor: string
  inSFHA: boolean
  description: string
  femaLink: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)

const fmtIncome = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n) + "/yr"

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

function StatBox({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ background: "#f5f2ea", borderLeft: "3px solid #6b7d52", padding: "14px 18px", borderRadius: 8 }}>
      <div style={{ fontFamily: mono ? "'IBM Plex Mono', monospace" : "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 600, color: "#1e2416" }}>
        {value}
      </div>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 11, fontWeight: 500, color: "#8a9070", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 4 }}>
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

function Input({ value, onChange, type = "number", step, min }: {
  value: string | number; onChange: (v: string) => void; type?: string; step?: string; min?: string
}) {
  return (
    <input
      type={type}
      step={step}
      min={min}
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

function Select({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        width: "100%", boxSizing: "border-box",
        background: "#fff", border: "1.5px solid #c5c9b8", borderRadius: 6,
        padding: "10px 14px", fontFamily: "'Space Grotesk', sans-serif",
        fontSize: 15, color: "#2c3520", outline: "none", cursor: "pointer",
      }}
    >
      {children}
    </select>
  )
}

// ─── PITI Calculator ──────────────────────────────────────────────────────

function PITICalculator() {
  const [price, setPrice] = useState("280000")
  const [downPct, setDownPct] = useState("3.5")
  const [rate, setRate] = useState("6.85")
  const [term, setTerm] = useState("30")
  const [taxRate, setTaxRate] = useState("1.08")
  const [insurance, setInsurance] = useState("1800")
  const [flood, setFlood] = useState("0")
  const [hoa, setHoa] = useState("0")

  const result: PITIResult | null = (() => {
    try {
      return calculatePITI({
        purchasePrice: parseFloat(price) || 0,
        downPaymentPct: (parseFloat(downPct) || 0) / 100,
        interestRate: (parseFloat(rate) || 0) / 100,
        loanTermYears: parseInt(term) || 30,
        taxRate: (parseFloat(taxRate) || 0) / 100,
        insuranceAnnual: parseFloat(insurance) || 0,
        floodInsuranceAnnual: parseFloat(flood) || 0,
        hoaMonthly: parseFloat(hoa) || 0,
      })
    } catch { return null }
  })()

  return (
    <div style={{ background: "#f0ece2", border: "1px solid #c5c9b8", borderRadius: 10, padding: 28 }}>
      <SectionHeader
        title="Monthly Payment Calculator"
        subtitle="Principal, interest, taxes, insurance — the full Louisiana picture including flood"
      />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <InputRow label="Purchase Price">
          <Input value={price} onChange={setPrice} />
        </InputRow>
        <InputRow label="Down Payment" hint="%">
          <Input value={downPct} onChange={setDownPct} step="0.5" />
        </InputRow>
        <InputRow label="Interest Rate" hint="% (current: ~6.85%)">
          <Input value={rate} onChange={setRate} step="0.05" />
        </InputRow>
        <InputRow label="Loan Term">
          <Select value={term} onChange={setTerm}>
            <option value="30">30 years</option>
            <option value="20">20 years</option>
            <option value="15">15 years</option>
          </Select>
        </InputRow>
        <InputRow label="Annual Tax Rate" hint="% (EBR avg: 1.08%)">
          <Input value={taxRate} onChange={setTaxRate} step="0.01" />
        </InputRow>
        <InputRow label="Homeowner's Insurance" hint="$/yr">
          <Input value={insurance} onChange={setInsurance} />
        </InputRow>
        <InputRow label="Flood Insurance" hint="$/yr (0 if Zone X)">
          <Input value={flood} onChange={setFlood} />
        </InputRow>
        <InputRow label="HOA" hint="$/month">
          <Input value={hoa} onChange={setHoa} />
        </InputRow>
      </div>

      {result && (
        <div style={{ marginTop: 24 }}>
          <div style={{ background: "#9aab7e", borderRadius: 10, padding: "20px 24px", marginBottom: 16, textAlign: "center" }}>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 13, fontWeight: 500, color: "#1e2416", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
              Total Monthly Payment
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 40, fontWeight: 600, color: "#1e2416" }}>
              {fmt(result.totalMonthly)}
            </div>
            {result.monthlyFloodInsurance > 0 && (
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 13, color: "#1e2416", opacity: 0.7, marginTop: 4 }}>
                {fmt(result.totalMonthlyNoFlood)}/mo without flood insurance
              </div>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            <StatBox label="Principal & Interest" value={fmt(result.monthlyPrincipalInterest)} />
            <StatBox label="Property Tax" value={fmt(result.monthlyTax)} />
            <StatBox label="Homeowner's Ins." value={fmt(result.monthlyInsurance)} />
            {result.monthlyFloodInsurance > 0 && (
              <StatBox label="Flood Insurance" value={fmt(result.monthlyFloodInsurance)} />
            )}
            {result.monthlyPMI > 0 && <StatBox label="PMI" value={fmt(result.monthlyPMI)} />}
            {result.monthlyHOA > 0 && <StatBox label="HOA" value={fmt(result.monthlyHOA)} />}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <StatBox label="Loan Amount" value={fmt(result.loanAmount)} />
            <StatBox label="Down Payment" value={fmt(result.downPayment)} />
            <StatBox label="Income Needed (28% DTI)" value={fmtIncome(result.affordableAt)} />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Flood Zone Lookup ────────────────────────────────────────────────────

function FloodZoneLookup() {
  const [address, setAddress] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<FloodResult | null>(null)
  const [error, setError] = useState("")

  const lookup = useCallback(async () => {
    if (!address.trim()) return
    setLoading(true)
    setError("")
    setResult(null)
    try {
      const res = await fetch(`/api/data/louisiana?action=flood&address=${encodeURIComponent(address)}`)
      const data = await res.json()
      if (data?.zone) setResult(data)
      else setError("No flood zone data found for that address.")
    } catch {
      setError("Lookup failed. Check your connection and try again.")
    } finally {
      setLoading(false)
    }
  }, [address])

  return (
    <div style={{ background: "#f0ece2", border: "1px solid #c5c9b8", borderRadius: 10, padding: 28 }}>
      <SectionHeader
        title="Flood Zone Lookup"
        subtitle="FEMA NFHL real-time lookup — critical for Louisiana transactions. Determines insurance requirements."
      />
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <Input
            type="text"
            value={address}
            onChange={v => setAddress(v)}
          />
        </div>
        <button
          onClick={lookup}
          disabled={loading || !address.trim()}
          style={{
            background: loading ? "#8a9070" : "#6b7d52", color: "#f5f2ea",
            border: "none", borderRadius: 6, padding: "10px 22px",
            fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 500,
            cursor: loading ? "default" : "pointer", whiteSpace: "nowrap",
            transition: "background 0.15s",
          }}
        >
          {loading ? "Looking up..." : "Check Zone"}
        </button>
      </div>

      {error && (
        <div style={{ background: "#f5e8e8", border: "1px solid #c4a0a0", borderRadius: 8, padding: "12px 16px", fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, color: "#5a2a2a" }}>
          {error}
        </div>
      )}

      {result && (
        <div style={{ background: "#fff", border: `2px solid ${result.riskColor}`, borderRadius: 10, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
            <div style={{
              background: result.riskColor, color: "#fff", borderRadius: 8,
              padding: "10px 18px", fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 22, fontWeight: 600,
            }}>
              Zone {result.zone}
            </div>
            <div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, fontWeight: 600, color: result.riskColor }}>
                {result.riskLabel} Flood Risk
              </div>
              {result.inSFHA && (
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, color: "#8b4a4a", fontWeight: 500, marginTop: 2 }}>
                  ⚠ In Special Flood Hazard Area — flood insurance required for federally backed loans
                </div>
              )}
            </div>
          </div>
          <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, color: "#2c3520", lineHeight: 1.6, margin: 0 }}>
            {result.description}
          </p>
          <a
            href={result.femaLink}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "inline-block", marginTop: 12, fontFamily: "'Space Grotesk', sans-serif", fontSize: 13, color: "#6b7d52", textDecoration: "underline" }}
          >
            View on FEMA Flood Map →
          </a>
        </div>
      )}

      <div style={{ marginTop: 16, padding: "12px 16px", background: "#f5f2ea", borderRadius: 8 }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, fontWeight: 500, color: "#8a9070", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
          Louisiana Flood Zones — Quick Reference
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {[
            { zone: "AE / A", label: "High Risk", color: "#8b4a4a" },
            { zone: "X500", label: "Moderate Risk", color: "#b5956a" },
            { zone: "X", label: "Low Risk", color: "#6b7d52" },
          ].map(z => (
            <div key={z.zone} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: z.color, flexShrink: 0 }} />
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, color: "#2c3520" }}>
                <strong>{z.zone}</strong> — {z.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Buyer Programs ───────────────────────────────────────────────────────

function BuyerProgramsSection({ programs }: { programs: BuyerProgram[] }) {
  return (
    <div style={{ background: "#f0ece2", border: "1px solid #c5c9b8", borderRadius: 10, padding: 28 }}>
      <SectionHeader
        title="Louisiana Buyer Assistance Programs"
        subtitle="Down payment grants, forgivable loans, and below-market rates for Louisiana buyers"
      />
      <div style={{ display: "grid", gap: 12 }}>
        {programs.map(p => (
          <div
            key={p.name}
            style={{
              background: "#fff", border: "1px solid #c5c9b8", borderRadius: 8, padding: "16px 20px",
              display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "start",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 600, color: "#1e2416" }}>
                  {p.name}
                </span>
                {p.maxAssistance > 0 && (
                  <span style={{ background: "#e8f0e0", color: "#4a5638", border: "1px solid #9aab7e", borderRadius: 10, padding: "2px 10px", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 500 }}>
                    Up to {fmt(p.maxAssistance)}
                  </span>
                )}
                {p.forgivable && (
                  <span style={{ background: "#f5f2ea", color: "#6b5a3a", border: "1px solid #c5a96a", borderRadius: 10, padding: "2px 10px", fontFamily: "'Space Grotesk', sans-serif", fontSize: 11, fontWeight: 500 }}>
                    Forgivable
                  </span>
                )}
                {p.firstTimeOnly && (
                  <span style={{ background: "#eaecf0", color: "#3a4550", border: "1px solid #a0aab8", borderRadius: 10, padding: "2px 10px", fontFamily: "'Space Grotesk', sans-serif", fontSize: 11, fontWeight: 500 }}>
                    First-Time Only
                  </span>
                )}
              </div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 13, color: "#2c3520", lineHeight: 1.6, marginBottom: 6 }}>
                {p.description}
              </div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, color: "#8a9070" }}>
                Sponsor: {p.sponsor} · Max income: {fmt(p.maxIncome)}/yr · Max price: {fmt(p.maxPurchasePrice)}
              </div>
            </div>
            <a
              href={p.applyUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: "transparent", color: "#6b7d52", border: "1.5px solid #6b7d52",
                borderRadius: 6, padding: "8px 14px", fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 13, fontWeight: 500, textDecoration: "none", whiteSpace: "nowrap",
              }}
            >
              Apply →
            </a>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Affordability Calculator ─────────────────────────────────────────────

function AffordabilityCalculator() {
  const [income, setIncome] = useState("75000")
  const [debtMonthly, setDebtMonthly] = useState("400")
  const [rate, setRate] = useState("6.85")
  const [downPct, setDownPct] = useState("3.5")

  const result = (() => {
    const annualIncome = parseFloat(income) || 0
    const monthlyIncome = annualIncome / 12
    const debt = parseFloat(debtMonthly) || 0
    const r = (parseFloat(rate) || 6.85) / 100

    // 28% front-end DTI for housing, 36% back-end for all debt
    const maxHousingFrontEnd = monthlyIncome * 0.28
    const maxHousingBackEnd = (monthlyIncome * 0.36) - debt
    const maxHousing = Math.min(maxHousingFrontEnd, maxHousingBackEnd)

    // Estimate taxes + insurance (~$300/mo at $250K)
    const estimatedTaxIns = 350
    const piPayment = Math.max(0, maxHousing - estimatedTaxIns)

    // Reverse amortization → max loan
    const monthlyRate = r / 12
    const n = 360
    const maxLoan = monthlyRate > 0
      ? (piPayment * (Math.pow(1 + monthlyRate, n) - 1)) / (monthlyRate * Math.pow(1 + monthlyRate, n))
      : piPayment * n

    const downAmt = maxLoan / (1 - (parseFloat(downPct) || 3.5) / 100) * ((parseFloat(downPct) || 3.5) / 100)
    const maxPrice = maxLoan + downAmt

    return {
      maxPrice: Math.round(maxPrice),
      maxLoan: Math.round(maxLoan),
      maxMonthlyHousing: Math.round(maxHousing),
      downNeeded: Math.round(downAmt),
      frontEndDTI: Math.round((maxHousing / monthlyIncome) * 100),
    }
  })()

  return (
    <div style={{ background: "#f0ece2", border: "1px solid #c5c9b8", borderRadius: 10, padding: 28 }}>
      <SectionHeader
        title="Affordability Calculator"
        subtitle="Max purchase price based on income and existing debt (28/36 DTI rule)"
      />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <InputRow label="Annual Gross Income">
          <Input value={income} onChange={setIncome} />
        </InputRow>
        <InputRow label="Monthly Debt Payments" hint="car, student loans, etc.">
          <Input value={debtMonthly} onChange={setDebtMonthly} />
        </InputRow>
        <InputRow label="Interest Rate" hint="%">
          <Input value={rate} onChange={setRate} step="0.05" />
        </InputRow>
        <InputRow label="Down Payment" hint="%">
          <Input value={downPct} onChange={setDownPct} step="0.5" />
        </InputRow>
      </div>

      <div style={{ background: "#9aab7e", borderRadius: 10, padding: "20px 24px", textAlign: "center", marginBottom: 16 }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 13, fontWeight: 500, color: "#1e2416", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
          Max Purchase Price
        </div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 40, fontWeight: 600, color: "#1e2416" }}>
          {fmt(result.maxPrice)}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <StatBox label="Max Loan" value={fmt(result.maxLoan)} />
        <StatBox label="Down Payment Needed" value={fmt(result.downNeeded)} />
        <StatBox label="Max Housing Budget/mo" value={fmt(result.maxMonthlyHousing)} />
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────

export default function BuyerToolsPage() {
  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px" }}>
      {/* Header */}
      <div style={{ marginBottom: 36 }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, fontWeight: 500, color: "#8a9070", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
          AIRE Intelligence · Buyer Tools
        </div>
        <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 38, fontWeight: 700, color: "#1e2416", margin: 0, lineHeight: 1.15 }}>
          Louisiana Buyer Intelligence
        </h1>
        <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, color: "#8a9070", marginTop: 10, lineHeight: 1.6 }}>
          Real payment calculations, live FEMA flood zones, and Louisiana-specific assistance programs — built for how this market actually works.
        </p>
      </div>

      <div style={{ display: "grid", gap: 20 }}>
        <AffordabilityCalculator />
        <PITICalculator />
        <FloodZoneLookup />
        <BuyerProgramsSection programs={LOUISIANA_BUYER_PROGRAMS} />
      </div>

      <div style={{ marginTop: 20, padding: "14px 18px", background: "#f5f2ea", borderRadius: 8, fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, color: "#8a9070" }}>
        Flood zone data via FEMA NFHL. Program details current as of April 2026. Verify current limits and availability with lender. This is a planning tool — not financial advice.
      </div>
    </div>
  )
}
