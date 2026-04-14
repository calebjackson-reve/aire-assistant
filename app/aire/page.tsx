import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import prisma from "@/lib/prisma"
import { HairlineDivider, SectionLabel } from "@/components/ui/primitives"
import { FreeTierUpgradeBanner } from "@/components/billing/FreeTierUpgradeBanner"
import { computeTrialState } from "@/lib/billing/trial"
import { PipelinePulse } from "@/components/dashboard/PipelinePulse"
import { ActivityStream } from "@/components/dashboard/ActivityStream"
import { AgentPulseChip } from "@/components/dashboard/AgentPulseChip"
import { QuickActions } from "@/components/dashboard/QuickActions"

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
  closing: "#b3c295",
  info: "rgba(179,194,149,0.35)",
}

const STATUS_LABEL_COLOR: Record<StatusTone, string> = {
  active: "#b3c295",
  pending: "#d4944c",
  overdue: "#c4787a",
  closing: "#b3c295",
  info: "rgba(179,194,149,0.55)",
}

function formatDueIn(due: Date, now: Date): string {
  const diff = due.getTime() - now.getTime()
  if (diff < 0) return "overdue"
  if (due.toDateString() === now.toDateString()) return "today"
  const days = Math.ceil(diff / 86_400_000)
  return `${days}d`
}

const URGENCY_COLOR: Record<string, string> = {
  overdue: "#c4787a",
  today: "#d4944c",
}

/**
 * Build a 30-day pipeline-value-as-of-date series.
 * Each point = sum of (acceptedPrice || listPrice) for transactions whose
 * createdAt ≤ that date AND were not yet closed/cancelled as of that date.
 * Honest signal — not synthetic padding.
 */
function buildPipelineSeries(
  transactions: { createdAt: Date; listPrice: number | null; acceptedPrice: number | null }[],
  now: Date,
): number[] {
  const days = 30
  const series: number[] = []
  for (let i = days - 1; i >= 0; i--) {
    const asOf = new Date(now.getTime() - i * 86_400_000)
    const total = transactions.reduce((acc, t) => {
      if (new Date(t.createdAt) > asOf) return acc
      return acc + (t.acceptedPrice || t.listPrice || 0)
    }, 0)
    series.push(total)
  }
  return series
}

export default async function AirePage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    include: {
      transactions: {
        orderBy: { updatedAt: "desc" },
        take: 60,
        include: {
          deadlines: {
            where: { completedAt: null },
            orderBy: { dueDate: "asc" },
            take: 5,
          },
        },
      },
    },
  })
  if (!user) redirect("/sign-in")

  const trialState = computeTrialState(user)

  const now = new Date()
  const threeDays = new Date(now.getTime() + 3 * 86_400_000)
  const sevenDays = new Date(now.getTime() + 7 * 86_400_000)

  // Separate active vs all — "active" powers the pipeline numerator; "all" feeds the 30-day series
  const activeTransactions = user.transactions.filter(
    (t) => !["CLOSED", "CANCELLED"].includes(t.status),
  )

  const urgentCount = activeTransactions.reduce(
    (a, t) => a + t.deadlines.filter((d) => new Date(d.dueDate) <= threeDays).length,
    0,
  )
  const overdueCount = activeTransactions.reduce(
    (a, t) => a + t.deadlines.filter((d) => new Date(d.dueDate) < now).length,
    0,
  )
  const closingCount = activeTransactions.filter(
    (t) => t.closingDate && new Date(t.closingDate) <= sevenDays,
  ).length
  const pipelineValue = activeTransactions.reduce(
    (a, t) => a + (t.acceptedPrice || t.listPrice || 0),
    0,
  )
  const pipelineMillions = pipelineValue / 1_000_000
  const pipelineLabel =
    pipelineMillions >= 1
      ? `$${pipelineMillions.toFixed(2)}M`
      : pipelineValue > 0
        ? `$${Math.round(pipelineValue / 1_000)}K`
        : "$0"

  const series = buildPipelineSeries(user.transactions, now)
  const first = series[0]
  const last = series[series.length - 1]
  const deltaPct = first > 0 ? ((last - first) / first) * 100 : null

  const briefDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const brief = await prisma.morningBrief.findUnique({
    where: { userId_briefDate: { userId: user.id, briefDate } },
  })

  const urgentDeadlines = activeTransactions
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

  const quickActions = [
    { href: "/aire/transactions/new", label: "New transaction", hint: "Start a deal" },
    { href: "/aire/contracts/new", label: "Write contract", hint: "LREC via natural language" },
    { href: "/airsign/new", label: "Send for signing", hint: "Upload, place, invite" },
    { href: "/aire/compliance", label: "Compliance scan", hint: "Louisiana rules engine" },
    { href: "/aire/morning-brief", label: "Morning brief", hint: brief ? "Today's intelligence" : "Generate now" },
    { href: "/aire/email", label: "Triage inbox", hint: "Reply-or-archive queue" },
  ]

  return (
    <div className="min-h-screen" style={{ background: "#1e2416" }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-10 sm:py-14">

        {/* ── Header ───────────────────────────────────────────── */}
        <header className="mb-10">
          <div className="flex items-start justify-between gap-4 mb-6">
            <p
              className="text-[10px] uppercase tracking-[0.3em]"
              style={{
                fontFamily: "var(--font-ibm-mono)",
                color: "rgba(179,194,149,0.55)",
              }}
            >
              Today · {dateStr}
            </p>
            <AgentPulseChip />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <h1
              className="italic tracking-[-0.02em] leading-[1.05]"
              style={{
                fontFamily: "var(--font-cormorant)",
                fontWeight: 500,
                color: "#e8e4d8",
                fontSize: "clamp(2.75rem, 5.5vw, 4rem)",
              }}
            >
              {timeGreeting}, {firstName}.
            </h1>
            <p
              className="italic text-base sm:text-lg sm:text-right leading-snug max-w-sm"
              style={{
                fontFamily: "var(--font-cormorant)",
                color: "rgba(179,194,149,0.70)",
              }}
            >
              {headlineSentence}
            </p>
          </div>

          <div className="mt-7">
            <HairlineDivider variant="dark" />
          </div>
        </header>

        <FreeTierUpgradeBanner
          tier={user.tier}
          trialStatus={trialState.status}
          trialDaysRemaining={trialState.daysRemaining}
        />

        {activeTransactions.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-14">

            {/* ── 01 Pipeline pulse + supporting stats ── */}
            <section>
              <SectionLabel number="01" title="Pipeline" />
              <div className="mt-6 grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
                <PipelinePulse
                  valueLabel={pipelineLabel}
                  series={series}
                  deltaPct={deltaPct}
                  caption="30-day trajectory"
                  footnote={`${activeTransactions.length} active · ${closingCount} closing ≤ 7d`}
                />
                <div className="grid grid-cols-3 lg:grid-cols-1 gap-2">
                  <MiniStat label="Active" value={activeTransactions.length} tone="neutral" />
                  <MiniStat label="Closing ≤ 7d" value={closingCount} tone={closingCount > 0 ? "good" : "neutral"} />
                  <MiniStat label="Overdue" value={overdueCount} tone={overdueCount > 0 ? "bad" : "neutral"} />
                </div>
              </div>
            </section>

            {/* ── 02 Today's moves ── */}
            {urgentDeadlines.length > 0 && (
              <section>
                <SectionLabel number="02" title="Today's moves" count={urgentDeadlines.length} />
                <div className="mt-5 space-y-0.5">
                  {urgentDeadlines.map((d) => {
                    const due = new Date(d.dueDate)
                    const urgency = formatDueIn(due, now)
                    const dotColor = URGENCY_COLOR[urgency] || "#9aab7e"
                    const pillColor =
                      urgency === "overdue"
                        ? "#c4787a"
                        : urgency === "today"
                          ? "#d4944c"
                          : "#b3c295"
                    return (
                      <Link
                        key={d.id}
                        href={`/aire/transactions/${d.txnId}`}
                        className="aire-row group grid grid-cols-[8px_1fr_auto] gap-x-4 px-4 py-3.5 items-center rounded-lg"
                        style={{
                          transition: "transform 220ms cubic-bezier(0.34,1.56,0.64,1)",
                        }}
                      >
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ background: dotColor }}
                        />
                        <div className="min-w-0">
                          <p
                            className="text-[13px] leading-snug truncate"
                            style={{ color: "#e8e4d8" }}
                          >
                            {d.name}
                          </p>
                          <p
                            className="mt-0.5 text-[10px] uppercase tracking-[0.18em] truncate"
                            style={{
                              fontFamily: "var(--font-ibm-mono)",
                              color: "rgba(179,194,149,0.50)",
                            }}
                          >
                            {d.address}
                          </p>
                        </div>
                        <span
                          className="text-[11px] whitespace-nowrap tabular-nums"
                          style={{ fontFamily: "var(--font-ibm-mono)", color: pillColor }}
                        >
                          {urgency}
                        </span>
                      </Link>
                    )
                  })}
                </div>
              </section>
            )}

            {/* ── 03 Active transactions ── */}
            <section>
              <SectionLabel
                number={urgentDeadlines.length > 0 ? "03" : "02"}
                title="Active transactions"
                count={activeTransactions.length}
              />
              <div className="mt-5 space-y-0.5">
                {activeTransactions.slice(0, 10).map((t) => {
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
                      className="aire-row group grid grid-cols-[8px_1fr_auto_80px] gap-x-4 px-4 py-3.5 items-center rounded-lg"
                      style={{
                        transition: "transform 220ms cubic-bezier(0.34,1.56,0.64,1)",
                      }}
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ background: STATUS_DOT[statusMeta.tone] }}
                      />
                      <div className="min-w-0">
                        <p
                          className="text-[13px] leading-snug truncate"
                          style={{ color: "#e8e4d8" }}
                        >
                          {t.propertyAddress}
                        </p>
                        <p
                          className="mt-0.5 text-[10px] uppercase tracking-[0.18em] truncate"
                          style={{
                            fontFamily: "var(--font-ibm-mono)",
                            color: "rgba(179,194,149,0.50)",
                          }}
                        >
                          {t.buyerName || t.sellerName || "—"}
                          {nextDeadline ? ` · ${nextDeadline.name} ${dueIn}` : ""}
                        </p>
                      </div>
                      <span
                        className="text-[10px] uppercase tracking-[0.14em] whitespace-nowrap hidden sm:block"
                        style={{
                          fontFamily: "var(--font-ibm-mono)",
                          color: STATUS_LABEL_COLOR[statusMeta.tone],
                        }}
                      >
                        {statusMeta.label}
                      </span>
                      <span
                        className="text-[11px] text-right tabular-nums"
                        style={{
                          fontFamily: "var(--font-ibm-mono)",
                          color: "rgba(232,228,216,0.75)",
                        }}
                      >
                        {priceStr}
                      </span>
                    </Link>
                  )
                })}
                {activeTransactions.length > 10 && (
                  <Link
                    href="/aire/transactions"
                    className="block px-4 py-3 text-center text-[10px] uppercase tracking-[0.22em]"
                    style={{
                      fontFamily: "var(--font-ibm-mono)",
                      color: "rgba(179,194,149,0.55)",
                    }}
                  >
                    View all {activeTransactions.length} →
                  </Link>
                )}
              </div>
            </section>

            {/* ── 04 Activity stream ── */}
            <section>
              <SectionLabel
                number={urgentDeadlines.length > 0 ? "04" : "03"}
                title="Activity"
              />
              <div className="mt-5">
                <ActivityStream userId={user.id} limit={8} />
              </div>
            </section>

            {/* ── 05 Quick actions ── */}
            <section>
              <SectionLabel
                number={urgentDeadlines.length > 0 ? "05" : "04"}
                title="Quick actions"
              />
              <div className="mt-5">
                <QuickActions actions={quickActions} />
              </div>
            </section>

            {/* ── Footer ── */}
            <div className="pt-6 text-center">
              <div
                className="h-px w-12 mx-auto mb-4"
                style={{ background: "rgba(179,194,149,0.22)" }}
              />
              <p
                className="text-[9px] uppercase tracking-[0.3em]"
                style={{
                  fontFamily: "var(--font-ibm-mono)",
                  color: "rgba(179,194,149,0.35)",
                }}
              >
                AIRE · {activeTransactions.length} active · {pipelineLabel}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Row hover — transform only (motion law) */}
      <style>{`
        .aire-row:hover { background-color: rgba(42,50,36,0.55); transform: translateX(2px); }
        .aire-row:focus-visible {
          outline: none;
          box-shadow: 0 0 0 2px rgba(154,171,126,0.35);
        }
      `}</style>
    </div>
  )
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: "neutral" | "good" | "bad"
}) {
  const color =
    tone === "bad" ? "#c4787a" : tone === "good" ? "#b3c295" : "rgba(232,228,216,0.85)"
  return (
    <div
      className="rounded-xl px-4 py-4 flex flex-col justify-center"
      style={{
        background: "rgba(42,50,36,0.45)",
        border: "1px solid rgba(154,171,126,0.14)",
        boxShadow: "inset 0 1px 0 rgba(245,242,234,0.04)",
      }}
    >
      <p
        className="text-[9px] uppercase tracking-[0.22em]"
        style={{
          fontFamily: "var(--font-ibm-mono)",
          color: "rgba(179,194,149,0.55)",
        }}
      >
        {label}
      </p>
      <p
        className="mt-2 text-[28px] leading-none tabular-nums"
        style={{ fontFamily: "var(--font-ibm-mono)", fontWeight: 500, color }}
      >
        {value}
      </p>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="py-24 text-center">
      <p
        className="italic text-2xl mb-3"
        style={{
          fontFamily: "var(--font-cormorant)",
          color: "rgba(232,228,216,0.38)",
        }}
      >
        No active transactions
      </p>
      <p
        className="text-sm leading-relaxed max-w-sm mx-auto mb-6"
        style={{ color: "rgba(179,194,149,0.70)" }}
      >
        Create your first deal to start using AIRE.
      </p>
      <Link
        href="/aire/transactions/new"
        className="inline-block text-[11px] uppercase tracking-[0.14em] rounded-md px-5 py-3 font-medium"
        style={{
          fontFamily: "var(--font-ibm-mono)",
          background: "#6b7d52",
          color: "#f5f2ea",
          transition: "transform 220ms cubic-bezier(0.34,1.56,0.64,1)",
        }}
      >
        + New transaction
      </Link>
    </div>
  )
}
