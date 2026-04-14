import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import Link from "next/link"
import { TransactionList } from "./TransactionList"

export default async function TransactionsPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    include: {
      transactions: {
        include: {
          deadlines: { orderBy: { dueDate: "asc" }, take: 5 },
          documents: { select: { id: true } },
        },
        orderBy: { updatedAt: "desc" },
      },
    },
  })
  if (!user) redirect("/sign-in")

  const now = new Date()
  const threeDays = new Date(now.getTime() + 3 * 86400000)
  const sevenDays = new Date(now.getTime() + 7 * 86400000)

  const active = user.transactions.filter((t) => !["CLOSED", "CANCELLED"].includes(t.status))
  const closed = user.transactions.filter((t) => t.status === "CLOSED")
  const pending = user.transactions.filter((t) => t.status.startsWith("PENDING_"))
  const closingSoon = active.filter(
    (t) => t.closingDate && new Date(t.closingDate) <= sevenDays,
  ).length
  const overdueCount = active.reduce(
    (a, t) =>
      a + t.deadlines.filter((d) => !d.completedAt && new Date(d.dueDate) < now).length,
    0,
  )
  const urgentCount = active.reduce(
    (a, t) =>
      a +
      t.deadlines.filter(
        (d) => !d.completedAt && new Date(d.dueDate) <= threeDays,
      ).length,
    0,
  )
  const pipelineValue = active.reduce(
    (a, t) => a + (t.acceptedPrice || t.listPrice || 0),
    0,
  )
  const pipelineMillions = pipelineValue / 1_000_000
  const closedValue = closed.reduce((a, t) => a + (t.acceptedPrice || 0), 0)

  // Average DOM across active deals with a contract date
  const domDeals = active.filter((t) => t.contractDate)
  const avgDom = domDeals.length
    ? Math.round(
        domDeals.reduce(
          (a, t) =>
            a +
            Math.max(
              0,
              Math.ceil(
                (now.getTime() - new Date(t.contractDate as Date).getTime()) /
                  86400000,
              ),
            ),
          0,
        ) / domDeals.length,
      )
    : null

  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  })

  return (
    <div
      className="relative min-h-screen overflow-x-hidden"
      style={{
        background: "var(--surface-base)",
        color: "var(--text-body)",
        fontFamily: "var(--font-body)",
      }}
    >
      {/* Nocturne grid atmosphere — only visible under nocturne via --grid-opacity */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          opacity: "var(--grid-opacity, 0)",
          backgroundImage:
            "linear-gradient(rgba(154,171,126,1) 1px, transparent 1px), linear-gradient(90deg, rgba(154,171,126,1) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <main className="relative z-10 px-4 sm:px-6 md:px-8 pt-5 md:pt-6 pb-10 max-w-[1280px] mx-auto">
        {/* Greeting bar */}
        <div className="mb-5 md:mb-6 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1
              className="text-[28px] sm:text-[32px] leading-tight"
              style={{
                fontFamily: "var(--font-cormorant)",
                fontStyle: "italic",
                fontWeight: 500,
                color: "var(--text-strong)",
                letterSpacing: "-0.01em",
              }}
            >
              Transactions
            </h1>
            <p
              className="mt-1 text-[10px] tracking-[0.22em] uppercase"
              style={{ fontFamily: "var(--font-ibm-mono)", color: "var(--text-muted)" }}
            >
              {dateStr} · {active.length} active · {closed.length} closed
            </p>
          </div>
          <div className="flex items-center gap-2">
            {urgentCount > 0 && (
              <span
                className="inline-flex items-center gap-2 text-[11px] px-2.5 py-1 rounded-full"
                style={{
                  background: "rgba(139,74,74,0.14)",
                  color: "#c4787a",
                  border: "1px solid rgba(139,74,74,0.35)",
                  fontFamily: "var(--font-ibm-mono)",
                }}
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inset-0 rounded-full bg-[#c4787a] opacity-70 animate-ping" />
                  <span className="relative rounded-full h-1.5 w-1.5 bg-[#c4787a]" />
                </span>
                {urgentCount} urgent
              </span>
            )}
            <Link
              href="/aire/transactions/new"
              className="text-[11px] uppercase tracking-[0.1em] rounded-md px-3 py-1.5 transition-[background-color,transform,box-shadow] duration-[160ms] ease-out active:translate-y-px"
              style={{
                color: "var(--accent-primary-fg)",
                background: "var(--accent-primary-bg)",
                border: "1px solid var(--accent-primary-bg)",
                boxShadow: "var(--glow-cta)",
              }}
            >
              + New deal
            </Link>
          </div>
        </div>

        {/* Hero stat row — pipeline anchor + 4 tile stats */}
        <section className="mb-6 md:mb-7" style={{ perspective: "1400px" }}>
          <div className="flex items-end justify-between mb-1.5">
            <p
              className="text-[10px] tracking-[0.22em] uppercase"
              style={{ fontFamily: "var(--font-ibm-mono)", color: "var(--text-accent)" }}
            >
              01 / Pipeline
            </p>
            <p
              className="text-[10px] tracking-[0.18em] uppercase"
              style={{ fontFamily: "var(--font-ibm-mono)", color: "var(--text-muted)" }}
            >
              All time
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-12 gap-3 md:gap-5 items-stretch">
            {/* Anchor pipeline tile */}
            <div className="col-span-2 lg:col-span-6 ulb-card-float ulb-tilt ulb-specular p-5 md:p-6 overflow-hidden">
              <div className="flex items-baseline gap-3 flex-wrap">
                <span
                  className="ulb-num text-[40px] sm:text-[44px] md:text-[60px] leading-none tracking-[-0.02em]"
                  style={{ color: "var(--text-strong)", fontWeight: 500 }}
                >
                  {pipelineMillions >= 1
                    ? `$${pipelineMillions.toFixed(2)}M`
                    : `$${(pipelineValue / 1000).toFixed(0)}K`}
                </span>
                <span
                  className="text-[11px] sm:text-[12px] tracking-[0.18em] uppercase"
                  style={{ fontFamily: "var(--font-ibm-mono)", color: "var(--text-accent)" }}
                >
                  pipeline
                </span>
              </div>
              <p
                className="mt-2 text-[13px] sm:text-[15px]"
                style={{
                  fontFamily: "var(--font-cormorant)",
                  fontStyle: "italic",
                  color: "var(--text-soft)",
                }}
              >
                {active.length === 0
                  ? "No active deals. The slate is clean."
                  : closingSoon > 0
                    ? `${closingSoon} closing within the week. Keep momentum.`
                    : avgDom !== null
                      ? `Average ${avgDom} days under contract. Steady pace.`
                      : "Active pipeline. Steady work."}
              </p>
              {closedValue > 0 && (
                <p
                  className="mt-3 text-[10px] tracking-[0.18em] uppercase"
                  style={{ fontFamily: "var(--font-ibm-mono)", color: "var(--text-muted)" }}
                >
                  ${(closedValue / 1_000_000).toFixed(2)}M closed all-time
                </p>
              )}
            </div>

            <StatTile
              label="Active"
              value={String(active.length)}
              caption="in pipeline"
            />
            <StatTile
              label="Pending"
              value={String(pending.length)}
              caption="under contract"
              tone={pending.length > 0 ? "warning" : "default"}
            />
            <StatTile
              label="Overdue"
              value={String(overdueCount)}
              caption="needs attention"
              tone={overdueCount > 0 ? "error" : "default"}
              extraClasses="col-span-2 lg:col-span-2"
            />
          </div>
        </section>

        {/* Client-side list (search + filter + sort + responsive table/cards) */}
        <TransactionList
          transactions={JSON.parse(JSON.stringify(user.transactions))}
        />
      </main>
    </div>
  )
}

// ─────────────────────────────── sub-components

type StatTone = "default" | "warning" | "error"

function StatTile({
  label,
  value,
  caption,
  tone = "default",
  extraClasses = "",
}: {
  label: string
  value: string
  caption: string
  tone?: StatTone
  extraClasses?: string
}) {
  const dotColor =
    tone === "warning" ? "#b5956a" : tone === "error" ? "#8b4a4a" : "var(--accent-dot)"
  const valueColor =
    tone === "error" ? "#c4787a" : tone === "warning" ? "#c69a6a" : "var(--text-strong)"
  return (
    <div
      className={`col-span-2 lg:col-span-2 ulb-card-elev ulb-tilt ulb-specular px-5 py-5 flex flex-col justify-between overflow-hidden ${extraClasses}`}
    >
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: dotColor }} />
        <p
          className="text-[10px] tracking-[0.18em] uppercase"
          style={{ fontFamily: "var(--font-ibm-mono)", color: "var(--text-muted)" }}
        >
          {label}
        </p>
      </div>
      <div>
        <p
          className="ulb-num text-[28px] md:text-[34px] leading-none mt-2"
          style={{ color: valueColor, fontWeight: 500 }}
        >
          {value}
        </p>
        <p className="text-[11px] mt-1.5" style={{ color: "var(--text-muted)" }}>
          {caption}
        </p>
      </div>
    </div>
  )
}
