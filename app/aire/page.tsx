import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import Link from "next/link"
import { HairlineDivider } from "@/components/ui/primitives/HairlineDivider"
import { SectionLabel } from "@/components/ui/primitives/SectionLabel"

type StatusTone = "active" | "pending" | "overdue" | "info" | "closing"

const STATUS_TO_LABEL: Record<string, { label: string; tone: StatusTone }> = {
  DRAFT: { label: "Draft", tone: "info" },
  ACTIVE: { label: "Active", tone: "active" },
  PENDING_INSPECTION: { label: "Inspection", tone: "pending" },
  PENDING_APPRAISAL: { label: "Appraisal", tone: "pending" },
  PENDING_FINANCING: { label: "Financing", tone: "pending" },
  CLOSING: { label: "Closing", tone: "closing" },
  CLOSED: { label: "Closed", tone: "info" },
  CANCELLED: { label: "Cancelled", tone: "overdue" },
}

const STATUS_DOT: Record<StatusTone, string> = {
  active: "#9aab7e",
  pending: "#d4944c",
  overdue: "#c4787a",
  closing: "#6b7d52",
  info: "rgba(30,36,22,0.30)",
}

const STATUS_LABEL_COLOR: Record<StatusTone, string> = {
  active: "#4a5638",
  pending: "#9a6b2c",
  overdue: "#8a3a3a",
  closing: "#4a5638",
  info: "rgba(30,36,22,0.45)",
}

function formatDueIn(due: Date, now: Date): string {
  const diff = due.getTime() - now.getTime()
  if (diff < 0) return "overdue"
  if (due.toDateString() === now.toDateString()) return "today"
  const days = Math.ceil(diff / 86_400_000)
  return `${days}d`
}

const URGENCY_DOT: Record<string, string> = {
  overdue: "#c4787a",
  today: "#d4944c",
}

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
        take: 20,
      },
    },
  })
  if (!user) redirect("/sign-in")

  const now = new Date()
  const threeDays = new Date(now.getTime() + 3 * 86_400_000)
  const sevenDays = new Date(now.getTime() + 7 * 86_400_000)

  const urgentCount = user.transactions.reduce(
    (a, t) => a + t.deadlines.filter((d) => new Date(d.dueDate) <= threeDays).length,
    0,
  )
  const overdueCount = user.transactions.reduce(
    (a, t) => a + t.deadlines.filter((d) => new Date(d.dueDate) < now).length,
    0,
  )
  const closingCount = user.transactions.filter(
    (t) => t.closingDate && new Date(t.closingDate) <= sevenDays,
  ).length
  const pipelineValue = user.transactions.reduce(
    (a, t) => a + (t.acceptedPrice || t.listPrice || 0),
    0,
  )
  const pipelineMillions = pipelineValue / 1_000_000
  const pipelineLabel =
    pipelineMillions >= 1
      ? `$${pipelineMillions.toFixed(2)}M`
      : `$${Math.round(pipelineValue / 1_000)}K`

  const briefDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const brief = await prisma.morningBrief.findUnique({
    where: { userId_briefDate: { userId: user.id, briefDate } },
  })

  const urgentDeadlines = user.transactions
    .flatMap((txn) =>
      txn.deadlines
        .filter((d) => new Date(d.dueDate) <= threeDays)
        .map((d) => ({
          id: d.id,
          name: d.name,
          dueDate: d.dueDate,
          address: txn.propertyAddress,
          txnId: txn.id,
        })),
    )
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 5)

  const firstName = user.firstName || "Agent"
  const timeGreeting =
    now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening"
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })

  const headlineSentence = (() => {
    if (overdueCount > 0)
      return `${overdueCount} deadline${overdueCount === 1 ? "" : "s"} overdue. Clear those first.`
    if (urgentCount > 0)
      return `${urgentCount} move${urgentCount === 1 ? "" : "s"} today. The day clears after.`
    if (closingCount > 0)
      return `${closingCount} closing${closingCount === 1 ? "" : "s"} this week. Steady run.`
    return "Nothing urgent. Quiet pipeline — time to build."
  })()

  return (
    <div data-theme="daylight" className="min-h-screen bg-[#f5f2ea]">
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-12 sm:py-16">

        {/* ── Header ── */}
        <header className="mb-12">
          <p className="font-mono text-[10px] text-[#6b7d52] tracking-[0.3em] uppercase mb-4">
            AIRE Intelligence
          </p>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <h1 className="font-[family-name:var(--font-cormorant)] italic text-[#1e2416] text-4xl sm:text-5xl leading-[1.1]">
              {timeGreeting}, {firstName}.
            </h1>
            <div className="sm:text-right">
              <p className="text-[#1e2416] text-sm">{dateStr}</p>
              <div className="flex items-center gap-2 mt-1.5 sm:justify-end">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    overdueCount > 0
                      ? "bg-[#c4787a] animate-pulse"
                      : urgentCount > 0
                        ? "bg-[#d4944c] animate-pulse"
                        : "bg-[#6b7d52]/60"
                  }`}
                />
                <span className="font-mono text-[10px] text-[#6b7d52]/70 uppercase tracking-wider">
                  {user.transactions.length} active · {pipelineLabel} pipeline
                </span>
              </div>
            </div>
          </div>
          <p className="mt-4 font-[family-name:var(--font-cormorant)] italic text-[#6b7d52]/80 text-lg leading-snug">
            {headlineSentence}
          </p>
          <div className="mt-6">
            <HairlineDivider tone="light" />
          </div>
        </header>

        {user.transactions.length === 0 ? (
          <div className="py-24 text-center">
            <p className="font-[family-name:var(--font-cormorant)] italic text-[#1e2416]/30 text-2xl mb-3">
              No active transactions
            </p>
            <p className="text-[#6b7d52]/60 text-sm leading-relaxed max-w-sm mx-auto mb-6">
              Create your first deal to start using AIRE.
            </p>
            <Link
              href="/aire/transactions/new"
              className="inline-block text-[11px] uppercase tracking-[0.14em] rounded-md px-5 py-2.5 bg-[#6b7d52] text-[#f5f2ea] font-medium hover:bg-[#5a6b43] transition-colors"
            >
              + New transaction
            </Link>
            <div className="mt-8 h-px w-16 bg-[#e8e4d8] mx-auto" />
          </div>
        ) : (
          <div className="space-y-14">

            {/* ── 01 Pipeline ── */}
            <section>
              <SectionLabel number="01" title="Pipeline" />
              <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-0.5">
                <div className="px-4 py-4">
                  <p
                    className="font-mono text-[28px] sm:text-[32px] leading-none tabular-nums text-[#1e2416]"
                    style={{ fontWeight: 500, letterSpacing: "-0.02em" }}
                  >
                    {pipelineLabel}
                  </p>
                  <p className="font-mono text-[9px] text-[#6b7d52]/50 uppercase tracking-[0.18em] mt-2">
                    Total value
                  </p>
                </div>
                <div className="px-4 py-4">
                  <p className="font-mono text-[28px] sm:text-[32px] leading-none tabular-nums text-[#1e2416]" style={{ fontWeight: 500 }}>
                    {user.transactions.length}
                  </p>
                  <p className="font-mono text-[9px] text-[#6b7d52]/50 uppercase tracking-[0.18em] mt-2">
                    Active deals
                  </p>
                </div>
                <div className="px-4 py-4">
                  <p
                    className={`font-mono text-[28px] sm:text-[32px] leading-none tabular-nums ${
                      closingCount > 0 ? "text-[#6b7d52]" : "text-[#1e2416]/30"
                    }`}
                    style={{ fontWeight: 500 }}
                  >
                    {closingCount}
                  </p>
                  <p className="font-mono text-[9px] text-[#6b7d52]/50 uppercase tracking-[0.18em] mt-2">
                    Closing ≤ 7d
                  </p>
                </div>
                <div className="px-4 py-4">
                  <p
                    className={`font-mono text-[28px] sm:text-[32px] leading-none tabular-nums ${
                      overdueCount > 0 ? "text-[#c4787a]" : "text-[#1e2416]/30"
                    }`}
                    style={{ fontWeight: 500 }}
                  >
                    {overdueCount}
                  </p>
                  <p className="font-mono text-[9px] text-[#6b7d52]/50 uppercase tracking-[0.18em] mt-2">
                    Overdue
                  </p>
                </div>
              </div>
            </section>

            <hr className="border-0 h-px bg-[#e8e4d8]" />

            {/* ── 02 Today's moves (only if any urgent) ── */}
            {urgentDeadlines.length > 0 && (
              <>
                <section>
                  <SectionLabel number="02" title="Today's moves" count={urgentDeadlines.length} />
                  <div className="mt-5 space-y-0.5">
                    {urgentDeadlines.map((d) => {
                      const due = new Date(d.dueDate)
                      const urgency = formatDueIn(due, now)
                      const dotColor = URGENCY_DOT[urgency] || "#9aab7e"
                      return (
                        <Link
                          key={d.id}
                          href={`/aire/transactions/${d.txnId}`}
                          className="group grid grid-cols-[8px_1fr_auto] gap-x-4 px-4 py-3.5 items-center rounded-lg hover:bg-[#e8e4d8]/45 transition-colors"
                        >
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ background: dotColor }}
                          />
                          <div className="min-w-0">
                            <p className="text-[#1e2416] text-sm leading-snug truncate group-hover:text-[#6b7d52] transition-colors">
                              {d.name}
                            </p>
                            <p className="font-mono text-[10px] text-[#6b7d52]/50 uppercase tracking-wider mt-0.5 truncate">
                              {d.address}
                            </p>
                          </div>
                          <span
                            className="font-mono text-[11px] whitespace-nowrap tabular-nums"
                            style={{
                              color:
                                urgency === "overdue"
                                  ? "#8a3a3a"
                                  : urgency === "today"
                                    ? "#9a6b2c"
                                    : "#1e2416",
                            }}
                          >
                            {urgency}
                          </span>
                        </Link>
                      )
                    })}
                  </div>
                </section>
                <hr className="border-0 h-px bg-[#e8e4d8]" />
              </>
            )}

            {/* ── 03 Active transactions ── */}
            <section>
              <SectionLabel
                number={urgentDeadlines.length > 0 ? "03" : "02"}
                title="Active transactions"
                count={user.transactions.length}
              />
              <div className="mt-5 space-y-0.5">
                {user.transactions.slice(0, 10).map((t) => {
                  const nextDeadline = t.deadlines[0]
                  const dueIn = nextDeadline
                    ? formatDueIn(new Date(nextDeadline.dueDate), now)
                    : "—"
                  const statusMeta =
                    STATUS_TO_LABEL[t.status] ?? { label: t.status, tone: "info" as StatusTone }
                  const priceStr = t.acceptedPrice
                    ? `$${Math.round(t.acceptedPrice / 1000)}K`
                    : t.listPrice
                      ? `$${Math.round(t.listPrice / 1000)}K`
                      : "—"
                  return (
                    <Link
                      key={t.id}
                      href={`/aire/transactions/${t.id}`}
                      className="group grid grid-cols-[8px_1fr_auto_80px] gap-x-4 px-4 py-3.5 items-center rounded-lg hover:bg-[#e8e4d8]/45 transition-colors"
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ background: STATUS_DOT[statusMeta.tone] }}
                      />
                      <div className="min-w-0">
                        <p className="text-[#1e2416] text-sm leading-snug truncate group-hover:text-[#6b7d52] transition-colors">
                          {t.propertyAddress}
                        </p>
                        <p className="font-mono text-[10px] text-[#6b7d52]/50 uppercase tracking-wider mt-0.5 truncate">
                          {t.buyerName || t.sellerName || "—"}
                          {nextDeadline ? ` · ${nextDeadline.name} ${dueIn}` : ""}
                        </p>
                      </div>
                      <span
                        className="font-mono text-[10px] uppercase tracking-[0.14em] whitespace-nowrap hidden sm:block"
                        style={{ color: STATUS_LABEL_COLOR[statusMeta.tone] }}
                      >
                        {statusMeta.label}
                      </span>
                      <span className="font-mono text-[11px] text-[#1e2416]/65 text-right tabular-nums">
                        {priceStr}
                      </span>
                    </Link>
                  )
                })}
                {user.transactions.length > 10 && (
                  <Link
                    href="/aire/transactions"
                    className="block px-4 py-3 text-center font-mono text-[10px] text-[#6b7d52]/60 uppercase tracking-[0.2em] hover:text-[#6b7d52] transition-colors"
                  >
                    View all {user.transactions.length} →
                  </Link>
                )}
              </div>
            </section>

            <hr className="border-0 h-px bg-[#e8e4d8]" />

            {/* ── 04 Quick actions ── */}
            <section>
              <SectionLabel
                number={urgentDeadlines.length > 0 ? "04" : "03"}
                title="Quick actions"
              />
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-0.5">
                {[
                  { href: "/aire/transactions/new", label: "New transaction", hint: "Start a deal" },
                  { href: "/aire/contracts/new", label: "Write contract", hint: "LREC forms via natural language" },
                  { href: "/airsign/new", label: "Send for signing", hint: "Upload PDF, place fields, invite" },
                  { href: "/aire/compliance", label: "Compliance scan", hint: "Louisiana rules engine" },
                  { href: "/aire/morning-brief", label: "Morning brief", hint: brief ? "Today's intelligence" : "Generate now" },
                  { href: "/aire/email", label: "Triage inbox", hint: "Reply-or-archive queue" },
                ].map((a) => (
                  <Link
                    key={a.href}
                    href={a.href}
                    className="group flex items-center justify-between gap-3 px-4 py-3.5 rounded-lg hover:bg-[#e8e4d8]/45 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-[#1e2416] text-sm leading-snug truncate group-hover:text-[#6b7d52] transition-colors">
                        {a.label}
                      </p>
                      <p className="font-mono text-[10px] text-[#6b7d52]/50 uppercase tracking-wider mt-0.5 truncate">
                        {a.hint}
                      </p>
                    </div>
                    <span className="font-mono text-[12px] text-[#6b7d52]/40 group-hover:text-[#6b7d52] group-hover:translate-x-0.5 transition-all">
                      →
                    </span>
                  </Link>
                ))}
              </div>
            </section>

            {/* ── Footer ── */}
            <div className="pt-8 text-center">
              <div className="h-px w-12 bg-[#e8e4d8] mx-auto mb-4" />
              <p className="font-mono text-[9px] text-[#6b7d52]/30 uppercase tracking-[0.3em]">
                AIRE · {user.transactions.length} active · {pipelineLabel}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
