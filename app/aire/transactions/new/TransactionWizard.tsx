"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { TRANSACTION_TEMPLATES, type TransactionTemplate } from "@/lib/tc/templates"

const STEPS = [
  { num: 1, label: "Address" },
  { num: 2, label: "Template" },
  { num: 3, label: "Details" },
  { num: 4, label: "Finish" },
]

interface MlsSuggestion {
  address: string
  city: string
  state: string
  zip: string
  mlsNumber: string
  listAgent: string
  listPrice: number
}

export function TransactionWizard() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [address, setAddress] = useState("")
  const [suggestions, setSuggestions] = useState<MlsSuggestion[]>([])
  const [selectedMls, setSelectedMls] = useState<MlsSuggestion | null>(null)
  const [template, setTemplate] = useState<TransactionTemplate | null>(null)
  const [details, setDetails] = useState({
    listPrice: "",
    acceptedPrice: "",
    contractDate: "",
    closingDate: "",
    buyerName: "",
    buyerEmail: "",
    buyerPhone: "",
    sellerName: "",
    sellerEmail: "",
    sellerPhone: "",
    financingType: "conventional",
    side: "buyer",
  })
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState("")
  const [createdId, setCreatedId] = useState<string | null>(null)

  // MLS address autocomplete — searches as you type
  async function searchAddress(query: string) {
    setAddress(query)
    setSelectedMls(null)
    if (query.length < 3) { setSuggestions([]); return }

    try {
      const res = await fetch(`/api/data/paragon/listings?search=${encodeURIComponent(query)}&limit=5`)
      if (res.ok) {
        const data = await res.json()
        setSuggestions(data.listings || [])
      }
    } catch {
      // MLS not available yet — that's fine, manual entry works
    }
  }

  function selectSuggestion(s: MlsSuggestion) {
    setAddress(`${s.address}, ${s.city} ${s.state} ${s.zip}`)
    setSelectedMls(s)
    setSuggestions([])
    setDetails(prev => ({
      ...prev,
      listPrice: s.listPrice?.toString() || "",
    }))
  }

  async function createTransaction() {
    if (!address.trim()) { setError("Address is required"); return }
    if (!template) { setError("Select a template"); return }

    setCreating(true)
    setError("")

    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyAddress: address,
          mlsNumber: selectedMls?.mlsNumber || undefined,
          transactionType: template.type === "BUYING" ? "purchase" : template.type === "LISTING" ? "listing" : "other",
          templateId: template.id,
          listPrice: details.listPrice ? parseFloat(details.listPrice) : undefined,
          acceptedPrice: details.acceptedPrice ? parseFloat(details.acceptedPrice) : undefined,
          contractDate: details.contractDate || undefined,
          closingDate: details.closingDate || undefined,
          buyerName: details.buyerName || undefined,
          buyerEmail: details.buyerEmail || undefined,
          buyerPhone: details.buyerPhone || undefined,
          sellerName: details.sellerName || undefined,
          sellerEmail: details.sellerEmail || undefined,
          sellerPhone: details.sellerPhone || undefined,
          financingType: details.financingType,
          agentSide: details.side,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setCreatedId(data.id)
        setStep(4)
      } else {
        const err = await res.json()
        setError(err.error || "Failed to create transaction")
      }
    } catch {
      setError("Network error")
    } finally {
      setCreating(false)
    }
  }

  const canContinue =
    step === 1 ? address.trim().length > 2 :
    step === 2 ? template !== null :
    step === 3 ? true :
    false

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-0 mb-10">
        {STEPS.map((s, i) => (
          <div key={s.num} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                step > s.num
                  ? "bg-sage text-cream"
                  : step === s.num
                    ? "bg-olive text-cream ring-4 ring-sage/20"
                    : "bg-cream-warm text-olive/40"
              }`}>
                {step > s.num ? (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : s.num}
              </div>
              <span className={`text-[10px] mt-1.5 font-medium tracking-wide ${
                step >= s.num ? "text-olive" : "text-olive/30"
              }`}>{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-16 h-0.5 mx-2 mt-[-14px] ${step > s.num ? "bg-sage" : "bg-olive/10"}`} />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-[#c45c5c]/10 border border-[#c45c5c]/20 rounded-xl px-4 py-3 mb-6">
          <p className="text-[#c45c5c] text-sm">{error}</p>
        </div>
      )}

      {/* Step 1: Address */}
      {step === 1 && (
        <div>
          <h2 className="font-[family-name:var(--font-cormorant)] italic text-cream text-2xl mb-2 text-center">
            Add a new deal
          </h2>
          <p className="text-cream/40 text-sm text-center mb-8">
            Start typing the property address or MLS number
          </p>

          <div className="relative">
            <label className="text-sage text-[10px] font-medium tracking-[0.12em] uppercase block mb-1.5">
              Property Address or MLS #
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => searchAddress(e.target.value)}
              placeholder="554 Avenue F, Port Allen LA"
              spellCheck={false}
              autoFocus
              className="w-full bg-cream/5 border border-cream/15 rounded-xl px-5 py-4 text-cream text-base focus:outline-none focus:border-sage/40 placeholder:text-cream/20"
            />

            {/* MLS autocomplete dropdown */}
            {suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-forest-deep border border-cream/15 rounded-xl shadow-2xl z-10 overflow-hidden">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => selectSuggestion(s)}
                    className="w-full text-left px-5 py-3 hover:bg-cream/5 transition border-b border-cream/5 last:border-0"
                  >
                    <p className="text-cream text-sm font-medium">{s.address}, {s.city} {s.state} {s.zip}</p>
                    <p className="text-cream/40 text-xs">
                      {s.listAgent && `Listed by ${s.listAgent}`}
                      {s.listPrice > 0 && ` · $${s.listPrice.toLocaleString()}`}
                      {s.mlsNumber && <span className="float-right text-sage/60">MLS #{s.mlsNumber}</span>}
                    </p>
                  </button>
                ))}
              </div>
            )}

            {selectedMls && (
              <div className="mt-3 bg-sage/10 border border-sage/20 rounded-xl px-4 py-3">
                <p className="text-cream text-sm font-medium">{selectedMls.address}, {selectedMls.city} {selectedMls.state} {selectedMls.zip}</p>
                <p className="text-cream/50 text-xs">
                  {selectedMls.listAgent} · ${selectedMls.listPrice?.toLocaleString()} · MLS #{selectedMls.mlsNumber}
                </p>
              </div>
            )}
          </div>

          <p className="text-cream/20 text-xs mt-3">
            Don&apos;t have the address yet? Enter your client&apos;s name — you can update it later.
          </p>
        </div>
      )}

      {/* Step 2: Template */}
      {step === 2 && (
        <div>
          <h2 className="font-[family-name:var(--font-cormorant)] italic text-cream text-2xl mb-2 text-center">
            Choose a template
          </h2>
          <p className="text-cream/40 text-sm text-center mb-8">
            This determines your document checklist and TC tasks
          </p>

          <div className="space-y-2">
            {/* Buying templates */}
            <p className="text-sage text-[10px] font-medium tracking-[0.12em] uppercase pt-2">Buying</p>
            {TRANSACTION_TEMPLATES.filter(t => t.type === "BUYING").map(t => (
              <button
                key={t.id}
                onClick={() => setTemplate(t)}
                className={`w-full text-left px-5 py-4 rounded-xl border transition-all ${
                  template?.id === t.id
                    ? "border-sage bg-sage/10 text-cream"
                    : "border-cream/10 text-cream/70 hover:border-cream/20 hover:bg-cream/5"
                }`}
              >
                <span className="text-sm font-medium">{t.label}</span>
                <span className="text-cream/30 text-xs ml-3">{t.documents.length} documents · {t.tasks.length} tasks</span>
              </button>
            ))}

            {/* Listing templates */}
            <p className="text-sage text-[10px] font-medium tracking-[0.12em] uppercase pt-4">Listing</p>
            {TRANSACTION_TEMPLATES.filter(t => t.type === "LISTING").map(t => (
              <button
                key={t.id}
                onClick={() => setTemplate(t)}
                className={`w-full text-left px-5 py-4 rounded-xl border transition-all ${
                  template?.id === t.id
                    ? "border-sage bg-sage/10 text-cream"
                    : "border-cream/10 text-cream/70 hover:border-cream/20 hover:bg-cream/5"
                }`}
              >
                <span className="text-sm font-medium">{t.label}</span>
                <span className="text-cream/30 text-xs ml-3">{t.documents.length} documents · {t.tasks.length} tasks</span>
              </button>
            ))}

            {/* Other */}
            <p className="text-sage text-[10px] font-medium tracking-[0.12em] uppercase pt-4">Other</p>
            {TRANSACTION_TEMPLATES.filter(t => t.type === "OTHER").map(t => (
              <button
                key={t.id}
                onClick={() => setTemplate(t)}
                className={`w-full text-left px-5 py-4 rounded-xl border transition-all ${
                  template?.id === t.id
                    ? "border-sage bg-sage/10 text-cream"
                    : "border-cream/10 text-cream/70 hover:border-cream/20 hover:bg-cream/5"
                }`}
              >
                <span className="text-sm font-medium">{t.label}</span>
                <span className="text-cream/30 text-xs ml-3">{t.documents.length} documents · {t.tasks.length} tasks</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Details */}
      {step === 3 && (
        <div>
          <h2 className="font-[family-name:var(--font-cormorant)] italic text-cream text-2xl mb-2 text-center">
            Deal details
          </h2>
          <p className="text-cream/40 text-sm text-center mb-8">
            Fill in what you know — you can always update later
          </p>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-cream/50 text-[10px] uppercase block mb-1">List Price</label>
                <input type="text" value={details.listPrice} onChange={e => setDetails(p => ({ ...p, listPrice: e.target.value }))}
                  placeholder="$295,000" className="w-full bg-cream/5 border border-cream/15 rounded-lg px-4 py-2.5 text-cream text-sm focus:outline-none focus:border-sage/40 placeholder:text-cream/15" />
              </div>
              <div>
                <label className="text-cream/50 text-[10px] uppercase block mb-1">Accepted Price</label>
                <input type="text" value={details.acceptedPrice} onChange={e => setDetails(p => ({ ...p, acceptedPrice: e.target.value }))}
                  placeholder="$285,000" className="w-full bg-cream/5 border border-cream/15 rounded-lg px-4 py-2.5 text-cream text-sm focus:outline-none focus:border-sage/40 placeholder:text-cream/15" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-cream/50 text-[10px] uppercase block mb-1">Contract Date</label>
                <input type="date" value={details.contractDate} onChange={e => setDetails(p => ({ ...p, contractDate: e.target.value }))}
                  className="w-full bg-cream/5 border border-cream/15 rounded-lg px-4 py-2.5 text-cream text-sm focus:outline-none focus:border-sage/40" />
              </div>
              <div>
                <label className="text-cream/50 text-[10px] uppercase block mb-1">Closing Date</label>
                <input type="date" value={details.closingDate} onChange={e => setDetails(p => ({ ...p, closingDate: e.target.value }))}
                  className="w-full bg-cream/5 border border-cream/15 rounded-lg px-4 py-2.5 text-cream text-sm focus:outline-none focus:border-sage/40" />
              </div>
            </div>

            <div>
              <label className="text-cream/50 text-[10px] uppercase block mb-1">Financing</label>
              <select value={details.financingType} onChange={e => setDetails(p => ({ ...p, financingType: e.target.value }))}
                className="w-full bg-forest-deep border border-cream/15 rounded-lg px-4 py-2.5 text-cream text-sm focus:outline-none">
                <option value="conventional">Conventional</option>
                <option value="fha">FHA</option>
                <option value="va">VA</option>
                <option value="usda">USDA</option>
                <option value="cash">Cash</option>
                <option value="seller_finance">Seller Finance</option>
              </select>
            </div>

            <hr className="border-cream/10" />
            <p className="text-sage text-[10px] font-medium tracking-[0.12em] uppercase">Buyer</p>
            <div className="grid grid-cols-3 gap-3">
              <input type="text" value={details.buyerName} onChange={e => setDetails(p => ({ ...p, buyerName: e.target.value }))}
                placeholder="Full name" className="bg-cream/5 border border-cream/15 rounded-lg px-4 py-2.5 text-cream text-sm focus:outline-none focus:border-sage/40 placeholder:text-cream/15" />
              <input type="email" value={details.buyerEmail} onChange={e => setDetails(p => ({ ...p, buyerEmail: e.target.value }))}
                placeholder="Email" className="bg-cream/5 border border-cream/15 rounded-lg px-4 py-2.5 text-cream text-sm focus:outline-none focus:border-sage/40 placeholder:text-cream/15" />
              <input type="tel" value={details.buyerPhone} onChange={e => setDetails(p => ({ ...p, buyerPhone: e.target.value }))}
                placeholder="Phone" className="bg-cream/5 border border-cream/15 rounded-lg px-4 py-2.5 text-cream text-sm focus:outline-none focus:border-sage/40 placeholder:text-cream/15" />
            </div>

            <p className="text-sage text-[10px] font-medium tracking-[0.12em] uppercase">Seller</p>
            <div className="grid grid-cols-3 gap-3">
              <input type="text" value={details.sellerName} onChange={e => setDetails(p => ({ ...p, sellerName: e.target.value }))}
                placeholder="Full name" className="bg-cream/5 border border-cream/15 rounded-lg px-4 py-2.5 text-cream text-sm focus:outline-none focus:border-sage/40 placeholder:text-cream/15" />
              <input type="email" value={details.sellerEmail} onChange={e => setDetails(p => ({ ...p, sellerEmail: e.target.value }))}
                placeholder="Email" className="bg-cream/5 border border-cream/15 rounded-lg px-4 py-2.5 text-cream text-sm focus:outline-none focus:border-sage/40 placeholder:text-cream/15" />
              <input type="tel" value={details.sellerPhone} onChange={e => setDetails(p => ({ ...p, sellerPhone: e.target.value }))}
                placeholder="Phone" className="bg-cream/5 border border-cream/15 rounded-lg px-4 py-2.5 text-cream text-sm focus:outline-none focus:border-sage/40 placeholder:text-cream/15" />
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Finish */}
      {step === 4 && (
        <div className="text-center py-8">
          <div className="w-20 h-20 rounded-full bg-sage/20 flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-sage" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="font-[family-name:var(--font-cormorant)] italic text-cream text-2xl mb-2">
            Deal created
          </h2>
          <p className="text-cream/50 text-sm mb-2">{address}</p>
          {template && (
            <p className="text-cream/30 text-xs mb-8">
              {template.label} · {template.documents.filter(d => d.status === "REQUIRED").length} required documents · {template.tasks.length} TC tasks
            </p>
          )}

          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => { setStep(1); setAddress(""); setTemplate(null); setCreatedId(null); setDetails({ listPrice: "", acceptedPrice: "", contractDate: "", closingDate: "", buyerName: "", buyerEmail: "", buyerPhone: "", sellerName: "", sellerEmail: "", sellerPhone: "", financingType: "conventional", side: "buyer" }) }}
              className="px-6 py-3 rounded-xl border border-cream/15 text-cream/60 text-sm hover:bg-cream/5 transition"
            >
              Create Another Deal
            </button>
            <button
              onClick={() => router.push(createdId ? `/aire/transactions/${createdId}` : "/aire/transactions")}
              className="px-6 py-3 rounded-xl bg-sage text-cream text-sm font-medium hover:bg-olive transition"
            >
              View Deal
            </button>
          </div>
        </div>
      )}

      {/* Navigation buttons */}
      {step < 4 && (
        <div className="flex items-center justify-between mt-10">
          <button
            onClick={() => step > 1 ? setStep(step - 1) : router.push("/aire/transactions")}
            className="text-cream/40 text-sm hover:text-cream/60 transition"
          >
            {step === 1 ? "Cancel" : "← Back"}
          </button>
          <button
            onClick={() => {
              if (step === 3) createTransaction()
              else if (canContinue) setStep(step + 1)
            }}
            disabled={!canContinue || creating}
            className="px-8 py-3 rounded-xl bg-sage text-cream text-sm font-medium hover:bg-olive disabled:opacity-30 transition"
          >
            {creating ? "Creating..." : step === 3 ? "Create Deal" : "Continue"}
          </button>
        </div>
      )}
    </div>
  )
}
