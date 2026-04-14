"use client"

import { useEffect, useState } from "react"

/**
 * Loop Autofill Drawer — canonical editor for a Transaction's Loop Data Model.
 * Reads GET /api/airsign/v2/autofill?transactionId=... and writes patches via POST.
 * Saving re-hydrates every DRAFT envelope on the transaction automatically.
 *
 * Styled per DESIGN.md: Cream surface, Olive accents, IBM Plex Mono for numbers.
 */

interface LoopData {
  loop?: {
    mlsNumber?: string
    property?: {
      streetNumber?: string
      streetName?: string
      unit?: string
      city?: string
      state?: string
      zip?: string
      parish?: string
    }
    financials?: {
      listPrice?: number
      offerPrice?: number
      salePrice?: number
      earnestMoney?: number
    }
    dates?: {
      contract?: string
      offer?: string
      inspection?: string
      appraisal?: string
      financing?: string
      closing?: string
    }
    buyer?: Array<{ name?: string; email?: string; phone?: string }>
    seller?: Array<{ name?: string; email?: string; phone?: string }>
    listingAgent?: { name?: string; email?: string; phone?: string; license?: string }
    buyingAgent?: { name?: string; email?: string; phone?: string; license?: string }
    title?: { company?: string }
    lender?: { company?: string }
  }
}

export function LoopAutofillDrawer({
  transactionId,
  open,
  onClose,
}: {
  transactionId: string
  open: boolean
  onClose: () => void
}) {
  const [data, setData] = useState<LoopData>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    fetch(`/api/airsign/v2/autofill?transactionId=${transactionId}`)
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setData(j.loopData ?? {})
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, transactionId])

  function update<K extends keyof NonNullable<LoopData["loop"]>>(
    group: K,
    patch: Partial<NonNullable<NonNullable<LoopData["loop"]>[K]>>
  ) {
    setDirty(true)
    setData((prev) => ({
      loop: {
        ...(prev.loop ?? {}),
        [group]: { ...((prev.loop?.[group] as object | undefined) ?? {}), ...patch },
      },
    }))
  }

  function updateBuyer(idx: number, patch: { name?: string; email?: string; phone?: string }) {
    setDirty(true)
    setData((prev) => {
      const buyers = [...(prev.loop?.buyer ?? [])]
      buyers[idx] = { ...(buyers[idx] ?? {}), ...patch }
      return { loop: { ...(prev.loop ?? {}), buyer: buyers } }
    })
  }

  function updateSeller(idx: number, patch: { name?: string; email?: string; phone?: string }) {
    setDirty(true)
    setData((prev) => {
      const sellers = [...(prev.loop?.seller ?? [])]
      sellers[idx] = { ...(sellers[idx] ?? {}), ...patch }
      return { loop: { ...(prev.loop ?? {}), seller: sellers } }
    })
  }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch("/api/airsign/v2/autofill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId, patch: data }),
      })
      if (res.ok) {
        const j = await res.json()
        setData(j.loopData ?? {})
        setDirty(false)
      }
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const p = data.loop?.property ?? {}
  const f = data.loop?.financials ?? {}
  const d = data.loop?.dates ?? {}
  const buyers = data.loop?.buyer?.length ? data.loop.buyer : [{}]
  const sellers = data.loop?.seller?.length ? data.loop.seller : [{}]
  const la = data.loop?.listingAgent ?? {}
  const ba = data.loop?.buyingAgent ?? {}
  const ttl = data.loop?.title ?? {}
  const lnd = data.loop?.lender ?? {}

  return (
    <>
      <div className="fixed inset-0 z-40 bg-[#1e2416]/60 backdrop-blur-sm" onClick={onClose} />
      <aside className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[560px] bg-[#f5f2ea] border-l border-[#c5c9b8] shadow-[0_24px_64px_rgba(30,36,22,0.25)] overflow-y-auto">
        <header className="sticky top-0 bg-[#f5f2ea]/95 backdrop-blur-sm border-b border-[#c5c9b8] px-6 py-4 flex items-center justify-between z-10">
          <div>
            <p className="text-[#8a9070] text-[10px] tracking-[0.1em] uppercase">Loop Data</p>
            <h2 className="font-[family-name:var(--font-cormorant)] text-[#1e2416] text-xl">Autofill</h2>
          </div>
          <div className="flex items-center gap-3">
            {dirty && (
              <button
                onClick={save}
                disabled={saving}
                className="bg-[#6b7d52] text-[#f5f2ea] text-xs font-medium px-4 py-2 rounded-md hover:bg-[#5a6b43] disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving..." : "Save + re-hydrate drafts"}
              </button>
            )}
            <button onClick={onClose} className="text-[#8a9070] hover:text-[#1e2416] transition-colors" aria-label="Close">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                <line x1="4" y1="4" x2="16" y2="16" />
                <line x1="16" y1="4" x2="4" y2="16" />
              </svg>
            </button>
          </div>
        </header>

        {loading ? (
          <div className="p-12 text-center text-[#8a9070] text-sm">Loading...</div>
        ) : (
          <div className="px-6 py-6 space-y-8">
            <Section title="Property">
              <div className="grid grid-cols-[80px_1fr_80px] gap-3">
                <SmallField label="Street #" value={p.streetNumber} onChange={(v) => update("property", { streetNumber: v })} />
                <SmallField label="Street name" value={p.streetName} onChange={(v) => update("property", { streetName: v })} />
                <SmallField label="Unit" value={p.unit} onChange={(v) => update("property", { unit: v })} />
              </div>
              <div className="grid grid-cols-[1fr_60px_90px] gap-3 mt-3">
                <SmallField label="City" value={p.city} onChange={(v) => update("property", { city: v })} />
                <SmallField label="State" value={p.state} onChange={(v) => update("property", { state: v })} />
                <SmallField label="ZIP" value={p.zip} onChange={(v) => update("property", { zip: v })} mono />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <SmallField label="Parish" value={p.parish} onChange={(v) => update("property", { parish: v })} />
                <SmallField
                  label="MLS #"
                  value={data.loop?.mlsNumber}
                  onChange={(v) => setData((x) => ({ loop: { ...(x.loop ?? {}), mlsNumber: v } }))}
                  mono
                />
              </div>
            </Section>

            <Section title="Financials">
              <div className="grid grid-cols-2 gap-3">
                <MoneyField label="List price" value={f.listPrice} onChange={(v) => update("financials", { listPrice: v })} />
                <MoneyField label="Offer price" value={f.offerPrice} onChange={(v) => update("financials", { offerPrice: v })} />
                <MoneyField label="Sale price" value={f.salePrice} onChange={(v) => update("financials", { salePrice: v })} />
                <MoneyField label="Earnest money" value={f.earnestMoney} onChange={(v) => update("financials", { earnestMoney: v })} />
              </div>
            </Section>

            <Section title="Dates">
              <div className="grid grid-cols-2 gap-3">
                <DateField label="Contract" value={d.contract} onChange={(v) => update("dates", { contract: v })} />
                <DateField label="Offer" value={d.offer} onChange={(v) => update("dates", { offer: v })} />
                <DateField label="Inspection" value={d.inspection} onChange={(v) => update("dates", { inspection: v })} />
                <DateField label="Appraisal" value={d.appraisal} onChange={(v) => update("dates", { appraisal: v })} />
                <DateField label="Financing" value={d.financing} onChange={(v) => update("dates", { financing: v })} />
                <DateField label="Closing" value={d.closing} onChange={(v) => update("dates", { closing: v })} />
              </div>
            </Section>

            <Section title="Buyers">
              {buyers.map((b, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_130px] gap-3 mb-3">
                  <SmallField label={`Buyer ${i + 1} name`} value={b.name} onChange={(v) => updateBuyer(i, { name: v })} />
                  <SmallField label="Email" value={b.email} onChange={(v) => updateBuyer(i, { email: v })} />
                  <SmallField label="Phone" value={b.phone} onChange={(v) => updateBuyer(i, { phone: v })} mono />
                </div>
              ))}
              <button
                onClick={() => updateBuyer(buyers.length, {})}
                className="text-[#6b7d52] text-xs hover:text-[#5a6b43] transition-colors"
              >
                + Add buyer
              </button>
            </Section>

            <Section title="Sellers">
              {sellers.map((s, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_130px] gap-3 mb-3">
                  <SmallField label={`Seller ${i + 1} name`} value={s.name} onChange={(v) => updateSeller(i, { name: v })} />
                  <SmallField label="Email" value={s.email} onChange={(v) => updateSeller(i, { email: v })} />
                  <SmallField label="Phone" value={s.phone} onChange={(v) => updateSeller(i, { phone: v })} mono />
                </div>
              ))}
              <button
                onClick={() => updateSeller(sellers.length, {})}
                className="text-[#6b7d52] text-xs hover:text-[#5a6b43] transition-colors"
              >
                + Add seller
              </button>
            </Section>

            <Section title="Agents">
              <p className="text-[#8a9070] text-[10px] tracking-[0.08em] uppercase mb-2">Listing agent</p>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <SmallField label="Name" value={la.name} onChange={(v) => update("listingAgent", { name: v })} />
                <SmallField label="Email" value={la.email} onChange={(v) => update("listingAgent", { email: v })} />
                <SmallField label="Phone" value={la.phone} onChange={(v) => update("listingAgent", { phone: v })} mono />
                <SmallField label="License #" value={la.license} onChange={(v) => update("listingAgent", { license: v })} mono />
              </div>
              <p className="text-[#8a9070] text-[10px] tracking-[0.08em] uppercase mb-2">Buying agent</p>
              <div className="grid grid-cols-2 gap-3">
                <SmallField label="Name" value={ba.name} onChange={(v) => update("buyingAgent", { name: v })} />
                <SmallField label="Email" value={ba.email} onChange={(v) => update("buyingAgent", { email: v })} />
                <SmallField label="Phone" value={ba.phone} onChange={(v) => update("buyingAgent", { phone: v })} mono />
                <SmallField label="License #" value={ba.license} onChange={(v) => update("buyingAgent", { license: v })} mono />
              </div>
            </Section>

            <Section title="Title & Lender">
              <div className="grid grid-cols-2 gap-3">
                <SmallField label="Title company" value={ttl.company} onChange={(v) => update("title", { company: v })} />
                <SmallField label="Lender company" value={lnd.company} onChange={(v) => update("lender", { company: v })} />
              </div>
            </Section>

            {dirty && (
              <div className="sticky bottom-0 bg-[#f5f2ea]/95 backdrop-blur-sm pt-4 pb-2 -mx-6 px-6 border-t border-[#c5c9b8]">
                <button
                  onClick={save}
                  disabled={saving}
                  className="w-full bg-[#6b7d52] text-[#f5f2ea] font-medium py-3 rounded-md text-sm hover:bg-[#5a6b43] disabled:opacity-50 transition-colors"
                >
                  {saving ? "Saving..." : "Save changes + re-hydrate drafts"}
                </button>
              </div>
            )}
          </div>
        )}
      </aside>
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="font-[family-name:var(--font-cormorant)] text-[#1e2416] text-lg mb-3 pb-1.5 border-b border-[#c5c9b8]/60">
        {title}
      </h3>
      {children}
    </section>
  )
}

function SmallField({
  label,
  value,
  onChange,
  mono,
}: {
  label: string
  value: string | undefined
  onChange: (v: string) => void
  mono?: boolean
}) {
  return (
    <div>
      <label className="block text-[#8a9070] text-[9px] tracking-[0.08em] uppercase mb-1">{label}</label>
      <input
        type="text"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full bg-white border border-[#c5c9b8] rounded px-2.5 py-1.5 text-[#2c3520] text-sm focus:outline-none focus:border-[#6b7d52] focus:ring-2 focus:ring-[#9aab7e]/20 ${
          mono ? "font-[family-name:var(--font-mono)]" : ""
        }`}
      />
    </div>
  )
}

function MoneyField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number | undefined
  onChange: (v: number | undefined) => void
}) {
  return (
    <div>
      <label className="block text-[#8a9070] text-[9px] tracking-[0.08em] uppercase mb-1">{label}</label>
      <div className="relative">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8a9070] text-sm">$</span>
        <input
          type="number"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
          className="w-full bg-white border border-[#c5c9b8] rounded pl-6 pr-2.5 py-1.5 text-[#2c3520] text-sm font-[family-name:var(--font-mono)] focus:outline-none focus:border-[#6b7d52] focus:ring-2 focus:ring-[#9aab7e]/20"
        />
      </div>
    </div>
  )
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string | undefined
  onChange: (v: string | undefined) => void
}) {
  const asInput = value ? value.slice(0, 10) : ""
  return (
    <div>
      <label className="block text-[#8a9070] text-[9px] tracking-[0.08em] uppercase mb-1">{label}</label>
      <input
        type="date"
        value={asInput}
        onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : undefined)}
        className="w-full bg-white border border-[#c5c9b8] rounded px-2.5 py-1.5 text-[#2c3520] text-sm focus:outline-none focus:border-[#6b7d52] focus:ring-2 focus:ring-[#9aab7e]/20"
      />
    </div>
  )
}
