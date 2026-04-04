import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import Link from "next/link"

export default async function AirePage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    include: {
      transactions: {
        where: { status: { notIn: ["CLOSED", "CANCELLED"] } },
        include: {
          deadlines: { where: { completedAt: null }, orderBy: { dueDate: "asc" }, take: 5 },
        },
        orderBy: { updatedAt: "desc" },
        take: 10,
      },
    },
  })

  if (!user) redirect("/sign-in")

  const now = new Date()
  const threeDays = new Date(now.getTime() + 3 * 86400000)
  const urgentCount = user.transactions.reduce(
    (a: number, t) => a + t.deadlines.filter((d) => new Date(d.dueDate) <= threeDays).length, 0
  )
  const pipelineValue = user.transactions.reduce(
    (a: number, t) => a + (t.acceptedPrice || t.listPrice || 0), 0
  )

  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
  const firstName = user.firstName || "Agent"

  const briefDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const brief = await prisma.morningBrief.findUnique({
    where: { userId_briefDate: { userId: user.id, briefDate } },
  })

  // Collect all urgent deadlines across transactions
  const allUrgentDeadlines = user.transactions.flatMap((txn) =>
    txn.deadlines
      .filter((d) => new Date(d.dueDate) <= threeDays)
      .map((d) => ({ ...d, address: txn.propertyAddress }))
  ).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <p className="text-[#6b7d52] text-xs tracking-[0.15em] uppercase">{dateStr}</p>
        <h1 className="font-[family-name:var(--font-newsreader)] italic text-[#1e2416] text-3xl mt-1">
          Good morning, {firstName}.
        </h1>
        {urgentCount > 0 && (
          <p className="text-[#c45c5c] text-sm mt-1 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#c45c5c] animate-pulse-dot" />
            {urgentCount} deadline{urgentCount > 1 ? "s" : ""} due within 3 days
          </p>
        )}
      </div>

      {/* Two column grid — collapses on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
        {/* LEFT COLUMN */}
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            <StatCard label="Active" value={String(user.transactions.length)} />
            <StatCard label="Urgent" value={String(urgentCount)} highlight={urgentCount > 0} />
            <StatCard label="Pipeline" value={`$${(pipelineValue / 1000).toFixed(0)}K`} />
          </div>

          {/* Morning brief */}
          {brief && (
            <Link href="/aire/morning-brief" className="block card-sage !rounded-xl group">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#9aab7e] animate-pulse-dot" />
                  <span className="text-[#6b7d52] text-xs font-medium tracking-wider uppercase">
                    Morning Brief
                  </span>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                  brief.status === "pending"
                    ? "bg-[#9aab7e]/15 text-[#6b7d52]"
                    : "bg-[#6b7d52]/10 text-[#6b7d52]/60"
                }`}>
                  {brief.status}
                </span>
              </div>
              <p className="text-[#1e2416]/70 text-sm leading-relaxed line-clamp-4">
                {brief.summary || "Brief ready for review."}
              </p>
              <p className="text-[#9aab7e] text-xs mt-3 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                View full brief →
              </p>
            </Link>
          )}

          {/* Urgent deadlines sidebar */}
          {allUrgentDeadlines.length > 0 && (
            <div className="card-glass !rounded-xl">
              <p className="text-[#6b7d52] text-[10px] font-medium tracking-[0.15em] uppercase mb-3">
                Upcoming Deadlines
              </p>
              <div className="space-y-2">
                {allUrgentDeadlines.slice(0, 6).map((d, i) => {
                  const due = new Date(d.dueDate)
                  const isOverdue = due < now
                  const isToday = due.toDateString() === now.toDateString()
                  return (
                    <div key={i} className="flex items-start gap-3">
                      <div className="shrink-0 mt-1">
                        <span className={`w-2 h-2 rounded-full block ${
                          isOverdue ? "bg-[#c45c5c]" : isToday ? "bg-[#d4944c]" : "bg-[#9aab7e]"
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[#1e2416] text-sm truncate">{d.name}</p>
                        <p className="text-[#6b7d52]/50 text-xs truncate">{d.address}</p>
                      </div>
                      <span className="font-mono text-[11px] text-[#1e2416]/50 shrink-0">
                        {due.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN — Transactions */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[#1e2416] text-sm font-semibold" style={{ fontStyle: "normal" }}>
              Active Transactions
            </h2>
            <Link href="/dashboard/transactions" className="text-[#6b7d52] text-xs font-medium hover:underline">
              View all
            </Link>
          </div>

          {user.transactions.length === 0 ? (
            <div className="card-glass text-center py-16">
              <p className="text-[#6b7d52]/50 text-sm">No active transactions</p>
            </div>
          ) : (
            <div className="space-y-2">
              {user.transactions.slice(0, 8).map((txn) => {
                const urgent = txn.deadlines.filter((d) => new Date(d.dueDate) <= threeDays)
                const daysToClose = txn.closingDate
                  ? Math.ceil((new Date(txn.closingDate).getTime() - Date.now()) / 86400000)
                  : null

                return (
                  <div key={txn.id} className="card-glass !p-4 !rounded-xl flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[#1e2416] text-sm font-medium truncate">
                          {txn.propertyAddress}
                        </p>
                        {urgent.length > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#c45c5c]/10 text-[#c45c5c] shrink-0">
                            {urgent.length} due
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[#6b7d52]/50 text-xs">
                          {txn.buyerName || txn.sellerName || "—"}
                        </span>
                        <span className="text-[#e8e4d8] text-xs">·</span>
                        <span className="text-[10px] text-[#6b7d52]/40">
                          {txn.status.replace(/_/g, " ").toLowerCase()}
                        </span>
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
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="card-glass !p-3 !rounded-xl text-center">
      <p className="text-[#6b7d52]/60 text-[10px] tracking-wider uppercase">{label}</p>
      <p className={`text-xl font-light mt-0.5 ${highlight ? "text-[#c45c5c]" : "text-[#1e2416]"}`}>
        {value}
      </p>
    </div>
  )
}
