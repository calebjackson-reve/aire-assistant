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
  listPrice: number | null
  closingDate: string | null
  documents: { id: string }[]
  deadlines: { id: string; dueDate: string; completedAt: string | null; name: string }[]
}

type StatusTone = "active" | "pending" | "overdue" | "info" | "closing"

const STATUS_TO_TONE: Record<string, { label: string; tone: StatusTone }> = {
  DRAFT: { label: "Draft", tone: "info" },
  ACTIVE: { label: "Active", tone: "active" },
  PENDING_INSPECTION: { label: "Inspection", tone: "pending" },
  PENDING_APPRAISAL: { label: "Appraisal", tone: "pending" },
  PENDING_FINANCING: { label: "Financing", tone: "pending" },
  CLOSING: { label: "Closing", tone: "closing" },
  CLOSED: { label: "Closed", tone: "info" },
  CANCELLED: { label: "Cancelled", tone: "overdue" },
}

type SortKey = "updated" | "closing" | "price"

export function TransactionList({
  transactions,
}: {
  transactions: TransactionItem[]
}) {
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<"all" | "active" | "pending" | "closing" | "overdue" | "closed">("all")
  const [sortBy, setSortBy] = useState<SortKey>("updated")

  const now = new Date()
  const threeDays = new Date(now.getTime() + 3 * 86400000)
  const sevenDays = new Date(now.getTime() + 7 * 86400000)

  const counts = useMemo(() => {
    const active = transactions.filter((t) => !["CLOSED", "CANCELLED"].includes(t.status))
    const pending = transactions.filter((t) => t.status.startsWith("PENDING_"))
    const closingSoon = active.filter(
      (t) => t.closingDate && new Date(t.closingDate) <= sevenDays,
    ).length
    const overdueCount = active.reduce(
      (a, t) =>
        a +
        t.deadlines.filter(
          (d) => !d.completedAt && new Date(d.dueDate) < now,
        ).length,
      0,
    )
    const closedCount = transactions.filter((t) => t.status === "CLOSED").length
    return {
      all: transactions.length,
      active: active.length,
      pending: pending.length,
      closing: closingSoon,
      overdue: overdueCount,
      closed: closedCount,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions])

  const filtered = useMemo(() => {
    let list = transactions

    if (filter === "active") {
      list = list.filter((t) => !["CLOSED", "CANCELLED"].includes(t.status))
    } else if (filter === "pending") {
      list = list.filter((t) => t.status.startsWith("PENDING_"))
    } else if (filter === "closing") {
      list = list.filter(
        (t) => t.closingDate && new Date(t.closingDate) <= sevenDays,
      )
    } else if (filter === "overdue") {
      list = list.filter((t) =>
        t.deadlines.some((d) => !d.completedAt && new Date(d.dueDate) < now),
      )
    } else if (filter === "closed") {
      list = list.filter((t) => t.status === "CLOSED")
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (t) =>
          t.propertyAddress.toLowerCase().includes(q) ||
          (t.buyerName && t.buyerName.toLowerCase().includes(q)) ||
          (t.sellerName && t.sellerName.toLowerCase().includes(q)) ||
          (t.mlsNumber && t.mlsNumber.toLowerCase().includes(q)),
      )
    }

    if (sortBy === "closing") {
      list = [...list].sort((a, b) => {
        if (!a.closingDate) return 1
        if (!b.closingDate) return -1
        return (
          new Date(a.closingDate).getTime() - new Date(b.closingDate).getTime()
        )
      })
    } else if (sortBy === "price") {
      list = [...list].sort(
        (a, b) =>
          (b.acceptedPrice || b.listPrice || 0) -
          (a.acceptedPrice || a.listPrice || 0),
      )
    }

    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, search, filter, sortBy])

  const tabs: { id: typeof filter; label: string; count: number }[] = [
    { id: "all", label: "All", count: counts.all },
    { id: "active", label: "Active", count: counts.active },
    { id: "pending", label: "Pending", count: counts.pending },
    { id: "closing", label: "Closing ≤ 7d", count: counts.closing },
    { id: "overdue", label: "Overdue", count: counts.overdue },
    { id: "closed", label: "Closed", count: counts.closed },
  ]

  return (
    <div>
      {/* View tabs */}
      <div
        className="flex items-end justify-between mb-3 border-b overflow-x-auto gap-3"
        style={{ borderColor: "var(--border-base)" }}
      >
        <nav className="flex gap-1 min-w-0 flex-shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className="relative px-3 pb-2.5 pt-2 text-[13px] tracking-tight whitespace-nowrap transition-[color] duration-[160ms]"
              style={{
                color:
                  filter === tab.id ? "var(--text-strong)" : "var(--text-muted)",
                fontWeight: filter === tab.id ? 500 : 400,
              }}
            >
              {tab.label}
              <span
                className="ml-1.5 text-[10px] tracking-wider align-text-top"
                style={{
                  fontFamily: "var(--font-ibm-mono)",
                  color: "var(--text-muted)",
                }}
              >
                {tab.count}
              </span>
              {filter === tab.id && (
                <span
                  className="absolute -bottom-px left-2 right-2 h-[2px] rounded-full"
                  style={{
                    background: "var(--text-accent)",
                    boxShadow: "0 0 12px var(--glow-hairline)",
                  }}
                />
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Section number + toolbar */}
      <div className="flex items-end justify-between mb-2.5 mt-4 gap-3 flex-wrap">
        <p
          className="text-[10px] tracking-[0.22em] uppercase"
          style={{
            fontFamily: "var(--font-ibm-mono)",
            color: "var(--text-accent)",
          }}
        >
          02 / Deals
        </p>
        <p
          className="text-[10px] tracking-[0.18em] uppercase"
          style={{
            fontFamily: "var(--font-ibm-mono)",
            color: "var(--text-muted)",
          }}
        >
          {filtered.length} shown
        </p>
      </div>

      {/* Search + sort */}
      <div className="flex flex-col sm:flex-row gap-2.5 mb-4">
        <div className="flex-1 relative">
          <svg
            aria-hidden
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: "var(--text-muted)" }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <label htmlFor="txn-search" className="sr-only">
            Search transactions
          </label>
          <input
            id="txn-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search address, buyer, seller, MLS#..."
            className="w-full rounded-md pl-10 pr-4 py-2.5 text-[13px] focus:outline-none transition-[border-color,box-shadow] duration-[160ms]"
            style={{
              background: "var(--surface-card-soft)",
              border: "1px solid var(--border-base)",
              color: "var(--text-strong)",
            }}
          />
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          className="rounded-md px-3 py-2.5 text-[12px] focus:outline-none cursor-pointer transition-[border-color] duration-[160ms]"
          style={{
            background: "var(--surface-card-soft)",
            border: "1px solid var(--border-base)",
            color: "var(--text-soft)",
            fontFamily: "var(--font-ibm-mono)",
          }}
          aria-label="Sort by"
        >
          <option value="updated">Recent</option>
          <option value="closing">Closing</option>
          <option value="price">Price</option>
        </select>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="ulb-card-elev p-12 text-center">
          <p className="text-[14px]" style={{ color: "var(--text-soft)" }}>
            {search
              ? "No transactions match your search"
              : filter === "all"
                ? "No transactions yet"
                : "Nothing in this view"}
          </p>
          <p
            className="text-[12px] mt-1.5"
            style={{ color: "var(--text-muted)" }}
          >
            {search
              ? "Try a different keyword or clear the filter"
              : "Create your first deal to get started"}
          </p>
          {!search && filter === "all" && (
            <Link
              href="/aire/transactions/new"
              className="inline-block mt-5 text-[11px] uppercase tracking-[0.1em] rounded-md px-4 py-2"
              style={{
                color: "var(--accent-primary-fg)",
                background: "var(--accent-primary-bg)",
                boxShadow: "var(--glow-cta)",
              }}
            >
              + New transaction
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* Desktop + tablet table */}
          <div
            className="hidden md:block ulb-card-float ulb-specular ulb-tilt overflow-hidden"
            style={{ perspective: "1600px" }}
          >
            <table
              className="w-full text-left text-[13px]"
              style={{ color: "var(--text-body)" }}
            >
              <thead>
                <tr
                  style={{
                    background: "var(--surface-card-soft)",
                    borderBottom: "1px solid var(--border-base)",
                  }}
                >
                  {[
                    { label: "Property", align: "left", showAt: "md" },
                    { label: "Party", align: "left", showAt: "md" },
                    { label: "Status", align: "left", showAt: "md" },
                    { label: "Next deadline", align: "left", showAt: "md" },
                    { label: "Closing", align: "right", showAt: "lg" },
                    { label: "Docs", align: "right", showAt: "xl" },
                    { label: "Value", align: "right", showAt: "md" },
                  ].map((h) => (
                    <th
                      key={h.label}
                      className={`px-4 py-2.5 text-[10px] uppercase tracking-[0.12em] font-medium ${
                        h.align === "right" ? "text-right" : ""
                      } ${h.showAt === "lg" ? "hidden lg:table-cell" : ""} ${h.showAt === "xl" ? "hidden xl:table-cell" : ""}`}
                      style={{
                        color: "var(--text-muted)",
                        fontFamily: "var(--font-body)",
                      }}
                    >
                      {h.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => {
                  const urgent = t.deadlines.filter(
                    (d) => !d.completedAt && new Date(d.dueDate) <= threeDays,
                  )
                  const nextDeadline = t.deadlines.find((d) => !d.completedAt)
                  const dueIn = nextDeadline
                    ? formatDueIn(new Date(nextDeadline.dueDate), now)
                    : "—"
                  const closingStr = t.closingDate
                    ? new Date(t.closingDate).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })
                    : "—"
                  const statusMeta =
                    STATUS_TO_TONE[t.status] ?? {
                      label: t.status,
                      tone: "info" as StatusTone,
                    }
                  const value = t.acceptedPrice || t.listPrice
                  return (
                    <tr
                      key={t.id}
                      className="ulb-row border-b last:border-0 cursor-pointer"
                      style={{ borderColor: "var(--border-soft)" }}
                    >
                      <td className="px-4 py-3.5">
                        <Link
                          href={`/aire/transactions/${t.id}`}
                          className="flex items-center gap-2.5"
                        >
                          {urgent.length > 0 && (
                            <span style={{ color: "#b5956a" }} title="Urgent deadline">
                              ★
                            </span>
                          )}
                          <span
                            style={{
                              color: "var(--text-strong)",
                              fontWeight: 500,
                            }}
                          >
                            {t.propertyAddress}
                          </span>
                        </Link>
                      </td>
                      <td
                        className="px-4 py-3.5"
                        style={{ color: "var(--text-soft)" }}
                      >
                        {t.buyerName || t.sellerName || "—"}
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusChip tone={statusMeta.tone}>
                          {statusMeta.label}
                        </StatusChip>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <UrgencyDot urgency={dueIn} />
                          <span style={{ color: "var(--text-soft)" }}>
                            {nextDeadline ? nextDeadline.name : "No deadline"}
                          </span>
                          <span
                            className="text-[11px]"
                            style={{
                              fontFamily: "var(--font-ibm-mono)",
                              color: "var(--text-muted)",
                            }}
                          >
                            · {dueIn}
                          </span>
                        </div>
                      </td>
                      <td
                        className="hidden lg:table-cell px-4 py-3.5 text-right"
                        style={{
                          fontFamily: "var(--font-ibm-mono)",
                          color: "var(--text-soft)",
                        }}
                      >
                        {closingStr}
                      </td>
                      <td
                        className="hidden xl:table-cell px-4 py-3.5 text-right"
                        style={{
                          fontFamily: "var(--font-ibm-mono)",
                          color: "var(--text-muted)",
                        }}
                      >
                        {t.documents.length}
                      </td>
                      <td
                        className="px-4 py-3.5 text-right tabular-nums"
                        style={{
                          fontFamily: "var(--font-ibm-mono)",
                          color: "var(--text-strong)",
                        }}
                      >
                        {value ? `$${Math.round(value / 1000)}K` : "TBD"}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile card stack */}
          <div className="md:hidden space-y-2.5">
            {filtered.map((t) => {
              const urgent = t.deadlines.filter(
                (d) => !d.completedAt && new Date(d.dueDate) <= threeDays,
              )
              const nextDeadline = t.deadlines.find((d) => !d.completedAt)
              const dueIn = nextDeadline
                ? formatDueIn(new Date(nextDeadline.dueDate), now)
                : "—"
              const closingStr = t.closingDate
                ? new Date(t.closingDate).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
                : "—"
              const statusMeta =
                STATUS_TO_TONE[t.status] ?? {
                  label: t.status,
                  tone: "info" as StatusTone,
                }
              const value = t.acceptedPrice || t.listPrice
              return (
                <Link
                  key={t.id}
                  href={`/aire/transactions/${t.id}`}
                  className="block ulb-card ulb-specular p-4 overflow-hidden"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {urgent.length > 0 && (
                          <span style={{ color: "#b5956a" }}>★</span>
                        )}
                        <p
                          className="text-[14px] font-medium truncate"
                          style={{ color: "var(--text-strong)" }}
                        >
                          {t.propertyAddress}
                        </p>
                      </div>
                      <p
                        className="text-[12px] mt-0.5 truncate"
                        style={{ color: "var(--text-soft)" }}
                      >
                        {t.buyerName || t.sellerName || "—"}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p
                        className="ulb-num text-[15px] font-medium tabular-nums"
                        style={{ color: "var(--text-strong)" }}
                      >
                        {value ? `$${Math.round(value / 1000)}K` : "TBD"}
                      </p>
                      <p
                        className="text-[11px]"
                        style={{
                          fontFamily: "var(--font-ibm-mono)",
                          color: "var(--text-muted)",
                        }}
                      >
                        {closingStr}
                      </p>
                    </div>
                  </div>
                  <div
                    className="mt-3 pt-3 flex items-center justify-between gap-2"
                    style={{ borderTop: "1px solid var(--border-soft)" }}
                  >
                    <StatusChip tone={statusMeta.tone}>
                      {statusMeta.label}
                    </StatusChip>
                    <div className="flex items-center gap-2 text-[12px]">
                      <UrgencyDot urgency={dueIn} />
                      <span style={{ color: "var(--text-soft)" }}>
                        {nextDeadline ? nextDeadline.name : "—"}
                      </span>
                      <span
                        style={{
                          fontFamily: "var(--font-ibm-mono)",
                          color: "var(--text-muted)",
                        }}
                      >
                        · {dueIn}
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────── sub-components

function formatDueIn(due: Date, now: Date): string {
  const diff = due.getTime() - now.getTime()
  if (diff < 0) return "overdue"
  if (due.toDateString() === now.toDateString()) return "today"
  const days = Math.ceil(diff / 86400000)
  return `${days}d`
}

function StatusChip({
  children,
  tone,
}: {
  children: React.ReactNode
  tone: StatusTone
}) {
  const map: Record<StatusTone, { bg: string; fg: string; border: string }> = {
    active: { bg: "#e8f0e0", fg: "#4a5638", border: "#9aab7e" },
    pending: { bg: "#f0ece2", fg: "#6b5a3a", border: "#c5a96a" },
    overdue: { bg: "#f5e8e8", fg: "#5a2a2a", border: "#c4a0a0" },
    info: { bg: "#eaecf0", fg: "#3a4550", border: "#a0aab8" },
    closing: { bg: "#e8f0e0", fg: "#4a5638", border: "#6b7d52" },
  }
  const c = map[tone]
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.45)",
      }}
    >
      {tone === "closing" && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inset-0 rounded-full bg-[#6b7d52] opacity-60 animate-ping" />
          <span className="relative rounded-full h-1.5 w-1.5 bg-[#6b7d52]" />
        </span>
      )}
      {children}
    </span>
  )
}

function UrgencyDot({ urgency }: { urgency: string }) {
  const map: Record<string, string> = {
    overdue: "#8b4a4a",
    today: "#b5956a",
    "—": "#c5c9b8",
  }
  const color = map[urgency] || "#6b7d52"
  return (
    <span
      className="w-1.5 h-1.5 rounded-full inline-block"
      style={{ background: color }}
    />
  )
}
