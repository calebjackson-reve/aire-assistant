"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

const LA_PARISHES = [
  "East Baton Rouge", "Ascension", "Livingston", "West Baton Rouge",
  "Iberville", "Pointe Coupee", "East Feliciana", "West Feliciana",
  "St. Helena", "Tangipahoa", "St. Tammany", "Orleans",
  "Jefferson", "Lafayette", "Caddo", "Calcasieu",
  "Ouachita", "Rapides", "Terrebonne", "Lafourche",
]

const FINANCING_TYPES = [
  { value: "conventional", label: "Conventional" },
  { value: "fha", label: "FHA" },
  { value: "va", label: "VA" },
  { value: "usda", label: "USDA" },
  { value: "cash", label: "Cash" },
  { value: "seller_finance", label: "Seller Finance" },
]

const SIDE_OPTIONS = [
  { value: "buyer", label: "I represent the Buyer" },
  { value: "seller", label: "I represent the Seller" },
  { value: "dual", label: "Dual Agency" },
]

interface FormData {
  propertyAddress: string
  propertyCity: string
  propertyState: string
  propertyZip: string
  propertyType: string
  mlsNumber: string
  parish: string
  listPrice: string
  offerPrice: string
  acceptedPrice: string
  earnestMoney: string
  financingType: string
  contractDate: string
  closingDate: string
  buyerName: string
  buyerEmail: string
  buyerPhone: string
  sellerName: string
  sellerEmail: string
  sellerPhone: string
  buyerAgent: string
  sellerAgent: string
  lenderName: string
  titleCompany: string
  side: string
}

const INITIAL: FormData = {
  propertyAddress: "",
  propertyCity: "Baton Rouge",
  propertyState: "LA",
  propertyZip: "",
  propertyType: "residential",
  mlsNumber: "",
  parish: "East Baton Rouge",
  listPrice: "",
  offerPrice: "",
  acceptedPrice: "",
  earnestMoney: "",
  financingType: "conventional",
  contractDate: "",
  closingDate: "",
  buyerName: "",
  buyerEmail: "",
  buyerPhone: "",
  sellerName: "",
  sellerEmail: "",
  sellerPhone: "",
  buyerAgent: "",
  sellerAgent: "",
  lenderName: "",
  titleCompany: "",
  side: "buyer",
}

type Mode = "quick" | "full"

export function NewTransactionForm() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>("quick")
  const [step, setStep] = useState(0) // 0=basics, 1=terms, 2=parties
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>(INITIAL)

  function update(key: keyof FormData, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function validate(): string | null {
    if (!form.propertyAddress.trim()) return "Please enter the property address"
    if (mode === "quick") {
      if (!form.buyerName.trim() && !form.sellerName.trim()) return "Please enter at least a buyer or seller name"
      if (!form.closingDate) return "Please pick a closing date"
    }
    if (mode === "full" && step === 2) {
      if (!form.buyerName.trim() && !form.sellerName.trim()) return "Please enter at least a buyer or seller name"
    }
    return null
  }

  async function submit() {
    const err = validate()
    if (err) { setError(err); return }

    setLoading(true)
    setError(null)

    try {
      const today = new Date().toISOString().split("T")[0]
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          contractDate: form.contractDate || today,
          status: "ACTIVE",
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "Failed to create transaction")
        return
      }

      const txn = await res.json()
      router.push(`/aire/transactions/${txn.id}`)
    } catch {
      setError("Network error — please try again")
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (mode === "full" && step < 2) {
      const err = step === 0 && !form.propertyAddress.trim() ? "Please enter the property address" : null
      if (err) { setError(err); return }
      setError(null)
      setStep(step + 1)
    } else {
      submit()
    }
  }

  // Quick Create — 5 fields, done
  if (mode === "quick") {
    return (
      <div>
        <ModeToggle mode={mode} setMode={setMode} />

        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          <div className="card-glass !rounded-xl !p-6">
            <p className="text-[#6b7d52] text-xs font-medium tracking-wide uppercase mb-1">Quick Create</p>
            <p className="text-[#6b7d52]/40 text-xs mb-5">
              Just the essentials. You can add more details later.
            </p>

            <div className="space-y-4">
              <Input
                label="Property Address"
                required
                value={form.propertyAddress}
                onChange={v => update("propertyAddress", v)}
                placeholder="e.g. 456 Oak Drive, Baton Rouge, LA 70808"
                helper="Full street address of the property"
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Buyer Name"
                  value={form.buyerName}
                  onChange={v => update("buyerName", v)}
                  placeholder="e.g. John Smith"
                  helper="Full legal name of buyer(s)"
                />
                <Input
                  label="Seller Name"
                  value={form.sellerName}
                  onChange={v => update("sellerName", v)}
                  placeholder="e.g. Jane Doe"
                  helper="Full legal name of seller(s)"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Offer Price"
                  value={form.offerPrice}
                  onChange={v => update("offerPrice", v)}
                  placeholder="e.g. 250000"
                  helper="Accepted offer amount (numbers only)"
                  type="number"
                />
                <Input
                  label="Closing Date"
                  required
                  value={form.closingDate}
                  onChange={v => update("closingDate", v)}
                  type="date"
                  helper="Estimated closing date"
                />
              </div>
            </div>
          </div>

          <ErrorBanner error={error} />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#6b7d52] text-[#f5f2ea] py-3.5 rounded-xl text-sm font-medium hover:bg-[#6b7d52]/90 disabled:opacity-40 transition"
          >
            {loading ? "Creating Deal..." : "Create Deal"}
          </button>

          <p className="text-[#6b7d52]/30 text-xs text-center">
            Deadlines will be auto-calculated based on Louisiana rules.
          </p>
        </form>
      </div>
    )
  }

  // Full Form — 3 steps
  const STEPS = ["Property", "Deal Terms", "Parties"]

  return (
    <div>
      <ModeToggle mode={mode} setMode={setMode} />

      {/* Progress indicator */}
      <div className="flex items-center gap-2 mt-6 mb-6">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <button
              type="button"
              onClick={() => { if (i < step) setStep(i) }}
              className={`flex items-center gap-2 ${i <= step ? "cursor-pointer" : "cursor-default"}`}
            >
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                i < step
                  ? "bg-[#9aab7e] text-white"
                  : i === step
                  ? "bg-[#6b7d52] text-white"
                  : "bg-[#9aab7e]/10 text-[#6b7d52]/30"
              }`}>
                {i < step ? "✓" : i + 1}
              </span>
              <span className={`text-xs ${
                i === step ? "text-[#1e2416] font-medium" : i < step ? "text-[#6b7d52]" : "text-[#6b7d52]/30"
              }`}>
                {s}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-px ${i < step ? "bg-[#9aab7e]" : "bg-[#9aab7e]/15"}`} />
            )}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Step 1: Property */}
        {step === 0 && (
          <div className="card-glass !rounded-xl !p-6 space-y-4">
            <p className="text-[#6b7d52] text-[10px] font-medium tracking-[0.12em] uppercase mb-1">Property Details</p>

            <Input
              label="Property Address"
              required
              value={form.propertyAddress}
              onChange={v => update("propertyAddress", v)}
              placeholder="e.g. 456 Oak Drive"
              helper="Full street address"
            />
            <div className="grid grid-cols-3 gap-3">
              <Input label="City" value={form.propertyCity} onChange={v => update("propertyCity", v)} />
              <div>
                <label className="text-[#6b7d52]/50 text-[9px] uppercase block mb-1">State</label>
                <select
                  value={form.propertyState}
                  onChange={e => update("propertyState", e.target.value)}
                  className="w-full bg-white border border-[#9aab7e]/20 rounded-lg px-3 py-2 text-sm text-[#1e2416] focus:outline-none focus:border-[#9aab7e]/50"
                >
                  <option value="LA">Louisiana</option>
                  <option value="MS">Mississippi</option>
                  <option value="TX">Texas</option>
                  <option value="AR">Arkansas</option>
                </select>
              </div>
              <Input label="ZIP" value={form.propertyZip} onChange={v => update("propertyZip", v)} placeholder="70808" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[#6b7d52]/50 text-[9px] uppercase block mb-1">Parish</label>
                <select
                  value={form.parish}
                  onChange={e => update("parish", e.target.value)}
                  className="w-full bg-white border border-[#9aab7e]/20 rounded-lg px-3 py-2 text-sm text-[#1e2416] focus:outline-none focus:border-[#9aab7e]/50"
                >
                  {LA_PARISHES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <Input label="MLS #" value={form.mlsNumber} onChange={v => update("mlsNumber", v)} placeholder="Optional" />
              <div>
                <label className="text-[#6b7d52]/50 text-[9px] uppercase block mb-1">Property Type</label>
                <select
                  value={form.propertyType}
                  onChange={e => update("propertyType", e.target.value)}
                  className="w-full bg-white border border-[#9aab7e]/20 rounded-lg px-3 py-2 text-sm text-[#1e2416] focus:outline-none focus:border-[#9aab7e]/50"
                >
                  <option value="residential">Residential</option>
                  <option value="condo">Condo</option>
                  <option value="land">Land</option>
                  <option value="commercial">Commercial</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Deal Terms */}
        {step === 1 && (
          <div className="card-glass !rounded-xl !p-6 space-y-4">
            <p className="text-[#6b7d52] text-[10px] font-medium tracking-[0.12em] uppercase mb-1">Deal Terms</p>

            <div className="grid grid-cols-3 gap-3">
              <Input label="List Price" value={form.listPrice} onChange={v => update("listPrice", v)} placeholder="250000" type="number" helper="Original listing price" />
              <Input label="Offer Price" value={form.offerPrice} onChange={v => update("offerPrice", v)} placeholder="245000" type="number" helper="Your offer amount" />
              <Input label="Accepted Price" value={form.acceptedPrice} onChange={v => update("acceptedPrice", v)} placeholder="247000" type="number" helper="Final agreed price" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Earnest Money" value={form.earnestMoney} onChange={v => update("earnestMoney", v)} placeholder="5000" type="number" helper="Earnest money deposit" />
              <div>
                <label className="text-[#6b7d52]/50 text-[9px] uppercase block mb-1">Financing Type</label>
                <select
                  value={form.financingType}
                  onChange={e => update("financingType", e.target.value)}
                  className="w-full bg-white border border-[#9aab7e]/20 rounded-lg px-3 py-2 text-sm text-[#1e2416] focus:outline-none focus:border-[#9aab7e]/50"
                >
                  {FINANCING_TYPES.map(ft => <option key={ft.value} value={ft.value}>{ft.label}</option>)}
                </select>
                <p className="text-[#6b7d52]/30 text-[9px] mt-0.5">How is the buyer paying?</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Contract Date" value={form.contractDate} onChange={v => update("contractDate", v)} type="date" helper="Date contract was signed" />
              <Input label="Closing Date" value={form.closingDate} onChange={v => update("closingDate", v)} type="date" helper="Expected closing date" />
            </div>

            {form.closingDate && (
              <div className="bg-[#9aab7e]/5 border border-[#9aab7e]/10 rounded-lg p-3">
                <p className="text-[#6b7d52] text-xs font-medium mb-1">Auto-calculated deadlines</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-[#6b7d52]/60">
                  <span>Inspection: {offsetDate(form.closingDate, -14)}</span>
                  <span>Financing: {offsetDate(form.closingDate, -21)}</span>
                  <span>Appraisal: {offsetDate(form.closingDate, -10)}</span>
                  <span>Walk-through: {offsetDate(form.closingDate, -1)}</span>
                  <span>Title: {offsetDate(form.closingDate, -7)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Parties */}
        {step === 2 && (
          <div className="card-glass !rounded-xl !p-6 space-y-5">
            <p className="text-[#6b7d52] text-[10px] font-medium tracking-[0.12em] uppercase mb-1">Parties</p>

            {/* Side selection */}
            <div>
              <label className="text-[#6b7d52]/50 text-[9px] uppercase block mb-2">Your Role</label>
              <div className="flex gap-2">
                {SIDE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => update("side", opt.value)}
                    className={`flex-1 px-3 py-2.5 rounded-lg text-xs border transition ${
                      form.side === opt.value
                        ? "bg-[#6b7d52] text-[#f5f2ea] border-[#6b7d52]"
                        : "bg-white text-[#6b7d52] border-[#9aab7e]/20 hover:bg-[#9aab7e]/5"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-3">
                <p className="text-[#1e2416] text-sm font-medium">Buyer</p>
                <Input label="Full Name" value={form.buyerName} onChange={v => update("buyerName", v)} placeholder="John Smith" />
                <Input label="Email" value={form.buyerEmail} onChange={v => update("buyerEmail", v)} placeholder="john@email.com" type="email" />
                <Input label="Phone" value={form.buyerPhone} onChange={v => update("buyerPhone", v)} placeholder="(225) 555-0100" type="tel" />
              </div>
              <div className="space-y-3">
                <p className="text-[#1e2416] text-sm font-medium">Seller</p>
                <Input label="Full Name" value={form.sellerName} onChange={v => update("sellerName", v)} placeholder="Jane Doe" />
                <Input label="Email" value={form.sellerEmail} onChange={v => update("sellerEmail", v)} placeholder="jane@email.com" type="email" />
                <Input label="Phone" value={form.sellerPhone} onChange={v => update("sellerPhone", v)} placeholder="(225) 555-0200" type="tel" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input label="Buyer's Agent" value={form.buyerAgent} onChange={v => update("buyerAgent", v)} placeholder="Agent name (if not you)" />
              <Input label="Seller's Agent" value={form.sellerAgent} onChange={v => update("sellerAgent", v)} placeholder="Agent name (if not you)" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Lender" value={form.lenderName} onChange={v => update("lenderName", v)} placeholder="Lender + loan officer name" />
              <Input label="Title Company" value={form.titleCompany} onChange={v => update("titleCompany", v)} placeholder="Title company name" />
            </div>
          </div>
        )}

        <ErrorBanner error={error} />

        <div className="flex gap-3">
          {step > 0 && (
            <button
              type="button"
              onClick={() => { setStep(step - 1); setError(null) }}
              className="px-6 py-3 rounded-xl text-sm text-[#6b7d52] border border-[#9aab7e]/20 hover:bg-[#9aab7e]/5 transition"
            >
              Back
            </button>
          )}
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-[#6b7d52] text-[#f5f2ea] py-3.5 rounded-xl text-sm font-medium hover:bg-[#6b7d52]/90 disabled:opacity-40 transition"
          >
            {loading ? "Creating Deal..." : step < 2 ? `Next: ${STEPS[step + 1]}` : "Create Deal"}
          </button>
        </div>

        {step === 2 && (
          <p className="text-[#6b7d52]/30 text-xs text-center">
            Deadlines will be auto-calculated based on Louisiana rules.
          </p>
        )}
      </form>
    </div>
  )
}

function ModeToggle({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  return (
    <div className="flex rounded-xl border border-[#9aab7e]/20 overflow-hidden">
      <button
        type="button"
        onClick={() => setMode("quick")}
        className={`flex-1 px-4 py-2.5 text-sm transition ${
          mode === "quick"
            ? "bg-[#6b7d52] text-[#f5f2ea] font-medium"
            : "bg-white text-[#6b7d52] hover:bg-[#9aab7e]/5"
        }`}
      >
        Quick Create (5 fields)
      </button>
      <button
        type="button"
        onClick={() => setMode("full")}
        className={`flex-1 px-4 py-2.5 text-sm transition ${
          mode === "full"
            ? "bg-[#6b7d52] text-[#f5f2ea] font-medium"
            : "bg-white text-[#6b7d52] hover:bg-[#9aab7e]/5"
        }`}
      >
        Full Details (3 steps)
      </button>
    </div>
  )
}

function ErrorBanner({ error }: { error: string | null }) {
  if (!error) return null
  return (
    <div className="border border-[#c45c5c]/20 bg-[#c45c5c]/5 rounded-lg p-3">
      <p className="text-[#c45c5c] text-sm">{error}</p>
    </div>
  )
}

function Input({ label, value, onChange, placeholder, type = "text", helper, required }: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; type?: string; helper?: string; required?: boolean
}) {
  return (
    <div>
      <label className="text-[#6b7d52]/50 text-[9px] uppercase block mb-1">
        {label}{required && <span className="text-[#c45c5c]"> *</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white border border-[#9aab7e]/20 rounded-lg px-3 py-2 text-sm text-[#1e2416] focus:outline-none focus:border-[#9aab7e]/50 placeholder:text-[#6b7d52]/20"
      />
      {helper && <p className="text-[#6b7d52]/30 text-[9px] mt-0.5">{helper}</p>}
    </div>
  )
}

function offsetDate(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}
