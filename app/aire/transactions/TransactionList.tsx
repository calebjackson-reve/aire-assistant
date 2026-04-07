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
  DRAFT: "bg-[#6b7d52]/10 text-[#6b7d52]/60",
  ACTIVE: "bg-[#9aab7e]/15 text-[#6b7d52]",
  PENDING_INSPECTION: "bg-[#d4944c]/10 text-[#d4944c]",
  PENDING_APPRAISAL: "bg-[#d4944c]/10 text-[#d4944c]",
  PENDING_FINANCING: "bg-[#d4944c]/10 text-[#d4944c]",
  CLOSING: "bg-[#9aab7e]/20 text-[#6b7d52]",
  CLOSED: "bg-[#6b7d52]/15 text-[#6b7d52]",
  CANCELLED: "bg-[#c45c5c]/10 text-[#c45c5c]",
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

    // Filter by status
    if (filter === "active") {
      list = list.filter(t => !["CLOSED", "CANCELLED", "DRAFT"].includes(t.status))
    } else if (filter === "pending") {
      list = list.filter(t => t.status.startsWith("PENDING_"))
    } else if (filter === "closed") {
      list = list.filter(t => t.status === "CLOSED")
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(t =>
        t.propertyAddress.toLowerCase().includes(q) ||
        (t.buyerName && t.buyerName.toLowerCase().includes(q)) ||
        (t.sellerName && t.sellerName.toLowerCase().includes(q)) ||
        (t.mlsNumber && t.mlsNumber.toLowerCase().includes(q))
      )
    }

    // Sort
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
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search address, buyer, seller, MLS..."
          className="flex-1 bg-white border border-[#9aab7e]/20 rounded-lg px-3 py-2 text-sm text-[#1e2416] focus:outline-none focus:border-[#9aab7e]/50 placeholder:text-[#6b7d52]/30"
        />
        <div className="flex gap-2">
          <div className="flex rounded-lg border border-[#9aab7e]/20 overflow-hidden">
            {FILTER_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setFilter(opt.value)}
                className={`px-3 py-2 text-xs transition ${
                  filter === opt.value
                    ? "bg-[#6b7d52] text-[#f5f2ea]"
                    : "bg-white text-[#6b7d52] hover:bg-[#9aab7e]/10"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortKey)}
            className="bg-white border border-[#9aab7e]/20 rounded-lg px-2 py-2 text-xs text-[#6b7d52] focus:outline-none"
          >
            <option value="updated">Recent</option>
            <option value="closing">Closing Date</option>
            <option value="price">Price</option>
          </select>
        </div>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="card-glass text-center py-16">
          <p className="text-[#6b7d52]/50 text-sm">
            {search ? "No transactions match your search" : "No transactions in this view"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
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
                className="block card-glass !p-4 !rounded-xl hover:border-[#9aab7e]/30 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[#1e2416] text-sm font-medium truncate">
                        {txn.propertyAddress}
                      </p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${STATUS_COLORS[txn.status] || ""}`}>
                        {STATUS_LABELS[txn.status] || txn.status}
                      </span>
                      {urgentDeadlines.length > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#c45c5c]/10 text-[#c45c5c] shrink-0">
                          {urgentDeadlines.length} due
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[#6b7d52]/50 text-xs">
                        {txn.buyerName || txn.sellerName || "—"}
                      </span>
                      <span className="text-[#6b7d52]/20 text-xs">·</span>
                      <span className="text-[#6b7d52]/40 text-xs">
                        {txn.documents.length} doc{txn.documents.length !== 1 ? "s" : ""}
                      </span>
                      {txn.mlsNumber && (
                        <>
                          <span className="text-[#6b7d52]/20 text-xs">·</span>
                          <span className="font-mono text-[#6b7d52]/30 text-[10px]">
                            MLS {txn.mlsNumber}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <p className="font-mono text-sm text-[#1e2416]">
                      {txn.acceptedPrice ? `$${(txn.acceptedPrice / 1000).toFixed(0)}K` : "TBD"}
                    </p>
                    {daysToClose !== null && daysToClose >= 0 && (
                      <p className="text-[#6b7d52]/40 text-[10px] mt-0.5">{daysToClose}d to close</p>
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
