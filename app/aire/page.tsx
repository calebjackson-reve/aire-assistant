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

  const timeGreeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening"

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-[family-name:var(--font-cormorant)] italic text-[#1e2416] text-3xl sm:text-4xl font-light leading-tight">
            {timeGreeting}, {firstName}.
          </h1>
          <p className="font-[family-name:var(--font-ibm-mono)] text-[10px] text-[#9a9a90] tracking-[0.2em] uppercase mt-2">{dateStr}</p>
          {urgentCount > 0 && (
            <p className="text-[#c45c5c] text-sm mt-2 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#c45c5c] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#c45c5c]" />
              </span>
              {urgentCount} deadline{urgentCount > 1 ? "s" : ""} need attention
            </p>
          )}
        </div>
        <div className="text-right shrink-0 ml-4">
          <p className="font-[family-name:var(--font-ibm-mono)] text-[10px] text-[#9a9a90] tracking-wider uppercase">Pipeline</p>
          <p className="font-[family-name:var(--font-ibm-mono)] text-2xl sm:text-3xl text-[#1e2416] font-light tracking-tight mt-0.5">
            ${pipelineValue >= 1_000_000
              ? `${(pipelineValue / 1_000_000).toFixed(2)}M`
              : `${(pipelineValue / 1000).toFixed(0)}K`}
          </p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard label="Active Deals" value={String(user.transactions.length)} icon="folder" />
        <StatCard label="Urgent" value={String(urgentCount)} highlight={urgentCount > 0} icon="alert" />
        <StatCard label="Avg Value" value={user.transactions.length > 0 ? `$${Math.round(pipelineValue / user.transactions.length / 1000)}K` : "$0"} icon="dollar" />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-8">
        <QuickAction href="/aire/transactions/new" label="New Transaction" shortcut="T" />
        <QuickAction href="/aire/contracts/new" label="Write Contract" shortcut="C" />
        <QuickAction href="/airsign/new" label="Send for Signing" shortcut="S" />
        <QuickAction href="/aire/compliance" label="Compliance Scan" shortcut="R" />
      </div>

      {/* Welcome card for first-time users */}
      {user.transactions.length === 0 && (
        <div className="bg-white border border-[#6b7d52]/15 rounded-xl p-6 mb-6">
          <h3 className="font-[family-name:var(--font-cormorant)] italic text-[#1e2416] text-xl mb-2">
            Welcome to AIRE, {firstName}
          </h3>
          <p className="text-[#6a6a60] text-sm mb-4">
            Here&apos;s how to get started in the next 5 minutes:
          </p>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-[#6b7d52]/15 text-[#6b7d52] text-xs flex items-center justify-center font-medium">1</span>
              <span className="text-[#1e2416] text-sm">Create your first transaction</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-[#6b7d52]/15 text-[#6b7d52] text-xs flex items-center justify-center font-medium">2</span>
              <span className="text-[#1e2416] text-sm">Upload a document to auto-classify it</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-[#6b7d52]/15 text-[#6b7d52] text-xs flex items-center justify-center font-medium">3</span>
              <span className="text-[#1e2416] text-sm">Try a voice command: &quot;Show my pipeline&quot;</span>
            </div>
          </div>
        </div>
      )}

      {/* Two column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
        {/* LEFT COLUMN */}
        <div className="space-y-4">
          {/* Morning brief */}
          {brief && (
            <Link href="/aire/morning-brief" className="block group">
              <div className="bg-[#f5f2ea] border border-[#d4c8b8]/50 rounded-xl p-5 hover:border-[#6b7d52]/30 transition-all duration-200 hover:shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#6b7d52] opacity-50" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#6b7d52]" />
                    </span>
                    <span className="font-mono text-[10px] text-[#9a9a90] tracking-[0.15em] uppercase">
                      Morning Brief
                    </span>
                  </div>
                  <span className={`font-mono text-[10px] px-2 py-0.5 rounded-full ${
                    brief.status === "pending"
                      ? "bg-[#E8B44C]/15 text-[#E8B44C]"
                      : "bg-[#6b7d52]/10 text-[#6b7d52]/60"
                  }`}>
                    {brief.status}
                  </span>
                </div>
                <h3 className="font-[family-name:var(--font-cormorant)] italic text-[#1e2416] text-lg leading-snug mb-1">
                  Today&apos;s Intelligence
                </h3>
                <p className="text-[#6a6a60] text-sm leading-relaxed line-clamp-3">
                  {brief.summary || "Brief ready for review."}
                </p>
                <p className="text-[#6b7d52] text-xs mt-3 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  Read full brief &rarr;
                </p>
              </div>
            </Link>
          )}

          {/* Urgent deadlines */}
          {allUrgentDeadlines.length > 0 && (
            <div className="bg-white border border-[#6b7d52]/15 rounded-xl p-5">
              <p className="font-mono text-[10px] text-[#9a9a90] tracking-[0.15em] uppercase mb-4">
                Upcoming Deadlines
              </p>
              <div className="space-y-3">
                {allUrgentDeadlines.slice(0, 6).map((d, i) => {
                  const due = new Date(d.dueDate)
                  const isOverdue = due < now
                  const isToday = due.toDateString() === now.toDateString()
                  return (
                    <div key={i} className="flex items-start gap-3 group/item">
                      <div className="shrink-0 mt-1.5">
                        <span className={`w-2 h-2 rounded-full block ${
                          isOverdue ? "bg-[#D45B5B]" : isToday ? "bg-[#E8B44C]" : "bg-[#6b7d52]"
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[#1e2416] text-sm truncate">{d.name}</p>
                        <p className="text-[#9a9a90] text-xs truncate">{d.address}</p>
                      </div>
                      <span className={`font-mono text-[11px] shrink-0 ${
                        isOverdue ? "text-[#D45B5B]" : isToday ? "text-[#E8B44C]" : "text-[#9a9a90]"
                      }`}>
                        {isOverdue ? "Overdue" : isToday ? "Today" : due.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* No deadlines? Show system status */}
          {allUrgentDeadlines.length === 0 && (
            <div className="bg-white border border-[#6b7d52]/15 rounded-xl p-5 text-center">
              <p className="text-[#6a6a60] text-sm">No urgent deadlines</p>
              <p className="text-[#9a9a90] text-xs mt-1">All clear for the next 3 days</p>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN — Transactions */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[#1e2416] text-sm font-medium tracking-wide" style={{ fontFamily: "var(--font-body)", fontStyle: "normal" }}>
              Active Transactions
            </h2>
            <Link href="/aire/transactions" className="font-mono text-[10px] text-[#6b7d52]/60 tracking-wider uppercase hover:text-[#6b7d52] transition-colors">
              View all
            </Link>
          </div>

          {user.transactions.length === 0 ? (
            <div className="bg-white border border-[#6b7d52]/15 rounded-xl p-12 text-center">
              <div className="w-12 h-12 rounded-full bg-[#9aab7e]/10 flex items-center justify-center mx-auto mb-4">
                <svg className="w-5 h-5 text-[#6b7d52]/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <p className="text-[#6a6a60] text-sm mb-1">No active transactions</p>
              <p className="text-[#9a9a90] text-xs">Create your first deal to get started</p>
              <Link
                href="/aire/transactions/new"
                className="inline-block mt-5 bg-[#6b7d52]/15 text-[#6b7d52] text-xs font-medium px-4 py-2 rounded-lg hover:bg-[#6b7d52]/25 transition-all duration-200"
              >
                + New Transaction
              </Link>
            </div>
          ) : (
            <div className="space-y-1.5">
              {user.transactions.slice(0, 8).map((txn) => {
                const urgent = txn.deadlines.filter((d) => new Date(d.dueDate) <= threeDays)
                const daysToClose = txn.closingDate
                  ? Math.ceil((new Date(txn.closingDate).getTime() - Date.now()) / 86400000)
                  : null
                const borderClass = urgent.length > 0 ? "txn-border-overdue" : (txn.status === "PENDING_INSPECTION" || txn.status === "PENDING_APPRAISAL" || txn.status === "PENDING_FINANCING") ? "txn-border-pending" : "txn-border-active"

                return (
                  <Link
                    key={txn.id}
                    href={`/aire/transactions/${txn.id}`}
                    className={`block bg-white border border-[#6b7d52]/15 rounded-xl p-4 hover:border-[#6b7d52]/30 hover:shadow-sm transition-all duration-200 group/txn ${borderClass}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-[#1e2416] text-sm font-medium truncate group-hover/txn:text-[#6b7d52] transition-colors">
                            {txn.propertyAddress}
                          </p>
                          {urgent.length > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#D45B5B]/15 text-[#D45B5B] shrink-0 font-mono">
                              {urgent.length} due
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[#9a9a90] text-xs">
                            {txn.buyerName || txn.sellerName || "\u2014"}
                          </span>
                          <span className="text-[#d4c8b8] text-xs">&middot;</span>
                          <span className="font-mono text-[10px] text-[#9a9a90] uppercase tracking-wider">
                            {txn.status.replace(/_/g, " ").toLowerCase()}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <p className="font-mono text-sm text-[#1e2416]">
                          {txn.acceptedPrice ? `$${(txn.acceptedPrice / 1000).toFixed(0)}K` : "TBD"}
                        </p>
                        {daysToClose !== null && daysToClose >= 0 && (
                          <p className="font-mono text-[10px] text-[#9a9a90] mt-0.5">{daysToClose}d to close</p>
                        )}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, highlight, icon }: { label: string; value: string; highlight?: boolean; icon: string }) {
  return (
    <div className="bg-white border border-[#6b7d52]/15 rounded-xl p-4 stat-card-hover">
      <div className="flex items-center gap-2 mb-2">
        {icon === "folder" && (
          <svg className="w-3.5 h-3.5 text-[#6b7d52]/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
        )}
        {icon === "alert" && (
          <svg className="w-3.5 h-3.5 text-[#6b7d52]/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        )}
        {icon === "dollar" && (
          <svg className="w-3.5 h-3.5 text-[#6b7d52]/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        )}
        <p className="font-mono text-[10px] text-[#9a9a90] tracking-wider uppercase">{label}</p>
      </div>
      <p className={`font-mono text-2xl font-light tracking-tight ${highlight ? "text-[#D45B5B]" : "text-[#1e2416]"}`}>
        {value}
      </p>
    </div>
  )
}

function QuickAction({ href, label, shortcut }: { href: string; label: string; shortcut: string }) {
  return (
    <Link
      href={href}
      className="group bg-white border border-[#6b7d52]/15 rounded-xl p-3 text-center hover:border-[#6b7d52]/30 hover:shadow-sm transition-all duration-200"
    >
      <p className="text-[#1e2416]/80 text-xs font-medium group-hover:text-[#6b7d52] transition-colors">{label}</p>
      <p className="font-mono text-[9px] text-[#9a9a90] mt-0.5 tracking-wider">{shortcut}</p>
    </Link>
  )
}
