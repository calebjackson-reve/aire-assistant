// Dashboard V1: Single Column Mobile-Optimized
// Stacked vertical flow, touch-friendly targets, progressive disclosure
// Uses AIRE locked palette + glass card system

import Link from "next/link"

interface Transaction {
  id: string
  propertyAddress: string
  propertyCity: string | null
  buyerName: string | null
  sellerName: string | null
  acceptedPrice: number | null
  listPrice: number | null
  status: string
  closingDate: Date | null
  deadlines: { id: string; name: string; dueDate: Date }[]
}

interface Brief {
  id: string
  status: string
  summary: string | null
}

interface DashboardProps {
  firstName: string
  dateStr: string
  transactions: Transaction[]
  urgentCount: number
  pipelineValue: number
  brief: Brief | null
}

export function DashboardV1Mobile({
  firstName, dateStr, transactions, urgentCount, pipelineValue, brief,
}: DashboardProps) {
  const now = new Date()
  const threeDays = new Date(now.getTime() + 3 * 86400000)

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
      {/* Greeting — compact, warm */}
      <div>
        <p className="text-[#6b7d52] text-xs tracking-[0.15em] uppercase">{dateStr}</p>
        <h1 className="font-[family-name:var(--font-newsreader)] italic text-[#1e2416] text-2xl mt-1">
          Good morning, {firstName}.
        </h1>
        {urgentCount > 0 && (
          <p className="text-[#c45c5c] text-sm mt-1 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#c45c5c] animate-pulse-dot" />
            {urgentCount} deadline{urgentCount > 1 ? "s" : ""} due within 3 days
          </p>
        )}
      </div>

      {/* Stats row — horizontal scroll on small screens */}
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4 snap-x">
        <StatPill label="Active" value={String(transactions.length)} />
        <StatPill label="Urgent" value={String(urgentCount)} highlight={urgentCount > 0} />
        <StatPill label="Pipeline" value={`$${(pipelineValue / 1000).toFixed(0)}K`} />
      </div>

      {/* Morning brief — prominent CTA */}
      {brief && (
        <Link href="/aire/morning-brief" className="block card-sage !p-4 active:scale-[0.98] transition-transform">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#9aab7e] animate-pulse-dot" />
              <span className="text-[#6b7d52] text-xs font-medium tracking-wider uppercase">
                Morning Brief
              </span>
            </div>
            <span className={`text-[10px] px-2.5 py-1 rounded-full font-medium ${
              brief.status === "pending"
                ? "bg-[#9aab7e]/15 text-[#6b7d52]"
                : "bg-[#6b7d52]/10 text-[#6b7d52]/60"
            }`}>
              {brief.status === "pending" ? "Review" : brief.status}
            </span>
          </div>
          <p className="text-[#1e2416]/70 text-sm line-clamp-2 leading-relaxed">
            {brief.summary ? brief.summary.slice(0, 140) + "..." : "Brief ready for review."}
          </p>
          <p className="text-[#9aab7e] text-xs mt-2 font-medium">Tap to review →</p>
        </Link>
      )}

      {/* Transactions — full-width cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[#1e2416] text-sm font-semibold" style={{ fontStyle: "normal" }}>
            Active Transactions
          </h2>
          <Link href="/dashboard/transactions" className="text-[#6b7d52] text-xs font-medium">
            View all
          </Link>
        </div>

        {transactions.length === 0 ? (
          <div className="card-glass text-center py-12">
            <p className="text-[#6b7d52]/50 text-sm">No active transactions</p>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.slice(0, 5).map((txn) => {
              const urgent = txn.deadlines.filter((d) => new Date(d.dueDate) <= threeDays)
              const daysToClose = txn.closingDate
                ? Math.ceil((new Date(txn.closingDate).getTime() - Date.now()) / 86400000)
                : null

              return (
                <div key={txn.id} className="card-glass !p-4 !rounded-xl">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-[#1e2416] text-sm font-medium truncate">
                        {txn.propertyAddress}
                      </p>
                      <p className="text-[#6b7d52]/60 text-xs mt-0.5">
                        {txn.buyerName || txn.sellerName || "—"}
                      </p>
                    </div>
                    <span className="font-[family-name:var(--font-ibm-plex-mono)] text-sm text-[#1e2416] shrink-0 ml-3">
                      {txn.acceptedPrice ? `$${(txn.acceptedPrice / 1000).toFixed(0)}K` : "TBD"}
                    </span>
                  </div>

                  {/* Bottom row — status + urgency */}
                  <div className="flex items-center gap-2 mt-2.5">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#f5f2ea] text-[#6b7d52]/60 border border-[#e8e4d8]/50">
                      {txn.status.replace(/_/g, " ").toLowerCase()}
                    </span>
                    {urgent.length > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#c45c5c]/10 text-[#c45c5c] border border-[#c45c5c]/15">
                        {urgent.length} due
                      </span>
                    )}
                    {daysToClose !== null && daysToClose >= 0 && (
                      <span className="text-[#6b7d52]/40 text-[10px] ml-auto">
                        {daysToClose}d to close
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function StatPill({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="snap-start shrink-0 bg-[#f5f2ea]/60 border border-[#e8e4d8]/50 rounded-2xl px-5 py-3 min-w-[110px]">
      <p className="text-[#6b7d52]/60 text-[10px] tracking-wider uppercase">{label}</p>
      <p className={`text-xl font-light mt-0.5 ${highlight ? "text-[#c45c5c]" : "text-[#1e2416]"}`}>
        {value}
      </p>
    </div>
  )
}
