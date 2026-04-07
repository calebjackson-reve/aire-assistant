"use client"

import { useState, useMemo } from "react"
import Link from "next/link"

interface TransactionItem {
  id: string
  propertyAddress: string
  status: string
  buyerName: string | null
  sellerName: string | null
  mlsNumber: string | null
  acceptedPrice: number | null
  closingDate: string | null
  documents: { id: string }[]
  deadlines: { id: string; dueDate: string; completedAt: string | null }[]
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  PENDING_INSPECTION: "Inspection",
  PENDING_APPRAISAL: "Appraisal",
  PENDING_FINANCING: "Financing",
  CLOSING: "Closing",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-cream-dim/10 text-cream-dim/50",
  ACTIVE: "bg-warm/15 text-warm",
  PENDING_INSPECTION: "bg-[#d4944c]/15 text-[#d4944c]",
  PENDING_APPRAISAL: "bg-[#d4944c]/15 text-[#d4944c]",
  PENDING_FINANCING: "bg-[#d4944c]/15 text-[#d4944c]",
  CLOSING: "bg-warm/20 text-warm",
  CLOSED: "bg-warm/10 text-warm/60",
  CANCELLED: "bg-[#c45c5c]/15 text-[#c45c5c]",
}

const FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "pending", label: "Pending" },
  { value: "closed", label: "Closed" },
]

type SortKey = "updated" | "closing" | "price"

export function TransactionList({ transactions }: { transactions: TransactionItem[] }) {
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("all")
  const [sortBy, setSortBy] = useState<SortKey>("updated")

  const now = new Date()
  const threeDays = new Date(now.getTime() + 3 * 86400000)

  const filtered = useMemo(() => {
    let list = transactions

    if (filter === "active") {
      list = list.filter(t => !["CLOSED", "CANCELLED", "DRAFT"].includes(t.status))
    } else if (filter === "pending") {
      list = list.filter(t => t.status.startsWith("PENDING_"))
    } else if (filter === "closed") {
      list = list.filter(t => t.status === "CLOSED")
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(t =>
        t.propertyAddress.toLowerCase().includes(q) ||
        (t.buyerName && t.buyerName.toLowerCase().includes(q)) ||
        (t.sellerName && t.sellerName.toLowerCase().includes(q)) ||
        (t.mlsNumber && t.mlsNumber.toLowerCase().includes(q))
      )
    }

    if (sortBy === "closing") {
      list = [...list].sort((a, b) => {
        if (!a.closingDate) return 1
        if (!b.closingDate) return -1
        return new Date(a.closingDate).getTime() - new Date(b.closingDate).getTime()
      })
    } else if (sortBy === "price") {
      list = [...list].sort((a, b) => (b.acceptedPrice || 0) - (a.acceptedPrice || 0))
    }

    return list
  }, [transactions, search, filter, sortBy])

  return (
    <div>
      {/* Search + Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="flex-1 relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cream-dim/25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <label htmlFor="txn-search" className="sr-only">Search transactions</label>
          <input
            id="txn-search"
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search address, buyer, seller, MLS..."
            className="w-full bg-forest-card border border-brown-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-cream placeholder:text-cream-dim/25 focus:outline-none focus:border-warm/30 transition-colors"
          />
        </div>
        <div className="flex gap-2">
          <div className="flex rounded-xl border border-brown-border overflow-hidden">
            {FILTER_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setFilter(opt.value)}
                className={`px-3 py-2.5 text-xs font-medium transition-colors ${
                  filter === opt.value
                    ? "bg-warm/15 text-warm"
                    : "bg-forest-card text-cream-dim/40 hover:text-cream-dim/60"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortKey)}
            className="bg-forest-card border border-brown-border rounded-xl px-3 py-2.5 text-xs text-cream-dim/50 focus:outline-none font-mono"
          >
            <option value="updated">Recent</option>
            <option value="closing">Closing</option>
            <option value="price">Price</option>
          </select>
        </div>
      </div>

      {/* Results count */}
      <p className="font-mono text-[10px] text-cream-dim/25 tracking-wider uppercase mb-3">
        {filtered.length} transaction{filtered.length !== 1 ? "s" : ""}
      </p>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="bg-forest-card border border-brown-border rounded-xl text-center py-16">
          <p className="text-cream-dim/40 text-sm">
            {search ? "No transactions match your search" : "No transactions in this view"}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((txn) => {
            const urgentDeadlines = txn.deadlines.filter(d =>
              !d.completedAt && new Date(d.dueDate) <= threeDays
            )
            const daysToClose = txn.closingDate
              ? Math.ceil((new Date(txn.closingDate).getTime() - now.getTime()) / 86400000)
              : null

            return (
              <Link
                key={txn.id}
                href={`/aire/transactions/${txn.id}`}
                className="block bg-forest-card border border-brown-border rounded-xl p-4 hover:border-warm/20 hover:bg-forest-card/80 transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5">
                      <p className="text-cream text-sm font-medium truncate group-hover:text-warm transition-colors">
                        {txn.propertyAddress}
                      </p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 font-mono ${STATUS_COLORS[txn.status] || ""}`}>
                        {STATUS_LABELS[txn.status] || txn.status}
                      </span>
                      {urgentDeadlines.length > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#c45c5c]/15 text-[#c45c5c] shrink-0 font-mono">
                          {urgentDeadlines.length} due
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-cream-dim/40 text-xs">
                        {txn.buyerName || txn.sellerName || "\u2014"}
                      </span>
                      <span className="text-cream-dim/15 text-xs">&middot;</span>
                      <span className="font-mono text-cream-dim/25 text-[10px]">
                        {txn.documents.length} doc{txn.documents.length !== 1 ? "s" : ""}
                      </span>
                      {txn.mlsNumber && (
                        <>
                          <span className="text-cream-dim/15 text-xs">&middot;</span>
                          <span className="font-mono text-cream-dim/20 text-[10px]">
                            MLS {txn.mlsNumber}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <p className="font-mono text-sm text-cream">
                      {txn.acceptedPrice ? `$${(txn.acceptedPrice / 1000).toFixed(0)}K` : "TBD"}
                    </p>
                    {daysToClose !== null && daysToClose >= 0 && (
                      <p className="font-mono text-[10px] text-cream-dim/30 mt-0.5">{daysToClose}d to close</p>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
