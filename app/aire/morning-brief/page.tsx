import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import { MorningBriefActions } from "./actions"
import { GenerateBriefButton } from "./GenerateBriefButton"
import { FeedbackButtons } from "@/components/FeedbackButtons"
import { HairlineDivider } from "@/components/ui/primitives/HairlineDivider"
import { SectionLabel } from "@/components/ui/primitives/SectionLabel"
import Link from "next/link"

interface ActionItem { action: string; priority: string; category: string }
interface DeadlineItem { name: string; dueDate: string; transactionAddress: string; urgency: string; transactionId?: string }
interface PipelineItem { address: string; status: string; price: number; daysToClose: number | null; needsAttention: boolean; reason?: string; transactionId?: string }
interface ContactItem { name: string; score: number; lastContact: string | null; category: string }

function parseDeadlines(data: unknown): DeadlineItem[] {
  if (!data || typeof data !== "object") return []
  const d = data as Record<string, unknown>
  const all: DeadlineItem[] = []
  for (const urgency of ["overdue", "today", "urgent", "upcoming"]) {
    const raw = d[urgency]
    const items = Array.isArray(raw) ? (raw as DeadlineItem[]) : []
    all.push(...items.map((item) => ({ ...item, urgency })))
  }
  return all.slice(0, 8)
}

function parsePipeline(data: unknown): PipelineItem[] {
  if (!data || typeof data !== "object") return []
  const d = data as Record<string, unknown>
  return ((d.deals as PipelineItem[]) || []).slice(0, 6)
}

function parseContacts(data: unknown): ContactItem[] {
  if (!data || typeof data !== "object") return []
  const d = data as Record<string, unknown>
  const hot = ((d.hotLeads as ContactItem[]) || []).map((c) => ({ ...c, category: "Hot Lead" }))
  const follow = ((d.needsFollow as ContactItem[]) || []).map((c) => ({ ...c, category: "Needs Follow-up" }))
  return [...hot, ...follow].slice(0, 6)
}

const priorityIndicator: Record<string, string> = {
  urgent: "bg-[#c45c5c]",
  high: "bg-[#d4944c]",
  normal: "bg-[#9aab7e]",
}

const urgencyColor: Record<string, { dot: string; bg: string; text: string }> = {
  overdue: { dot: "bg-[#c45c5c]", bg: "bg-[#c45c5c]/5", text: "text-[#c45c5c]" },
  today: { dot: "bg-[#d4944c]", bg: "bg-[#d4944c]/5", text: "text-[#d4944c]" },
  urgent: { dot: "bg-[#9aab7e]", bg: "bg-[#9aab7e]/5", text: "text-[#9aab7e]" },
  upcoming: { dot: "bg-[#6b7d52]/30", bg: "bg-transparent", text: "text-[#6b7d52]/60" },
}

function getActionLink(item: ActionItem): string {
  const lower = item.action.toLowerCase()
  if (lower.includes("sign") || lower.includes("signature") || lower.includes("envelope")) {
    return "/airsign"
  }
  if (lower.includes("compliance") || lower.includes("scan")) {
    return "/aire/compliance"
  }
  return "/aire/transactions"
}

export default async function MorningBriefPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const user = await prisma.user.findUnique({ where: { clerkId: userId } })
  if (!user) redirect("/sign-in")

  const today = new Date()
  const briefDate = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const brief = await prisma.morningBrief.findUnique({
    where: { userId_briefDate: { userId: user.id, briefDate } },
  })

  const dateStr = today.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  })

  const deadlines = brief ? parseDeadlines(brief.deadlineData) : []
  const pipeline = brief ? parsePipeline(brief.pipelineData) : []
  const contacts = brief ? parseContacts(brief.contactData) : []
  const actionItems = brief?.actionItems && Array.isArray(brief.actionItems)
    ? (brief.actionItems as unknown as ActionItem[])
    : []

  return (
    <div className="min-h-screen bg-[#f5f2ea]">
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-12 sm:py-16">

      {/* ── Header ── */}
      <header className="mb-14">
        <p className="font-mono text-[10px] text-[#6b7d52] tracking-[0.3em] uppercase mb-4">
          AIRE Intelligence
        </p>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <h1 className="font-[family-name:var(--font-cormorant)] italic text-[#1e2416] text-4xl sm:text-5xl leading-[1.1]">
            Morning Brief
          </h1>
          <div className="sm:text-right">
            <p className="text-[#1e2416] text-sm">{dateStr}</p>
            {brief && (
              <div className="flex items-center gap-2 mt-1.5 sm:justify-end">
                <span className={`w-1.5 h-1.5 rounded-full ${
                  brief.status === "pending" ? "bg-[#d4944c] animate-pulse" : "bg-[#6b7d52]"
                }`} />
                <span className="font-mono text-[10px] text-[#6b7d52]/70 uppercase tracking-wider">
                  {brief.status === "pending" ? "Pending approval" : "Approved"}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="mt-6 h-px bg-[#1e2416]" />
      </header>

      {/* ── Empty state ── */}
      {!brief ? (
        <div className="py-24 text-center">
          <p className="font-[family-name:var(--font-cormorant)] italic text-[#1e2416]/30 text-2xl mb-3">
            No brief for today
          </p>
          <p className="text-[#6b7d52]/50 text-sm leading-relaxed max-w-sm mx-auto">
            Your daily intelligence report generates automatically at 6:30 AM CT,
            or you can generate one now.
          </p>
          <GenerateBriefButton />
          <div className="mt-8 h-px w-16 bg-[#e8e4d8] mx-auto" />
        </div>
      ) : (
        <div className="space-y-14">

          {/* ── 01 Executive Summary ── */}
          {brief.summary && (
            <section>
              <SectionLabel number="01" title="Executive Summary" />
              <div className="mt-5">
                <p className="text-[#1e2416]/85 text-base sm:text-[17px] leading-[1.9] whitespace-pre-wrap">
                  {brief.summary}
                </p>
              </div>
            </section>
          )}

          <hr className="border-[#e8e4d8] border-t" />

          {/* ── 02 Priority Actions ── */}
          {actionItems.length > 0 && (
            <>
              <section>
                <SectionLabel number="02" title="Today&rsquo;s Priority Actions" count={actionItems.length} />
                <div className="mt-5 space-y-1.5">
                  {actionItems.map((item, i) => {
                    const link = getActionLink(item)
                    const priority = item.priority?.toLowerCase() || "normal"
                    const dotColor = priorityIndicator[priority] || priorityIndicator.normal
                    return (
                      <Link
                        key={i}
                        href={link}
                        className="group flex items-start gap-4 px-4 py-3.5 rounded-lg hover:bg-[#f5f2ea]/80 transition-colors"
                      >
                        <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${dotColor}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[#1e2416] text-sm leading-relaxed group-hover:text-[#6b7d52] transition-colors">
                            {item.action}
                          </p>
                        </div>
                        <span className="font-mono text-[10px] text-[#6b7d52]/35 uppercase tracking-wider shrink-0 mt-0.5">
                          {item.category}
                        </span>
                      </Link>
                    )
                  })}
                </div>
              </section>
              <hr className="border-[#e8e4d8] border-t" />
            </>
          )}

          {/* ── 03 Pipeline Snapshot ── */}
          {pipeline.length > 0 && (
            <>
              <section>
                <SectionLabel number="03" title="Pipeline Snapshot" count={pipeline.length} />
                <div className="mt-5 space-y-2">
                  {pipeline.map((deal, i) => (
                    <div
                      key={i}
                      className={`card-glass !rounded-lg !p-0 overflow-hidden ${
                        deal.needsAttention ? "ring-1 ring-[#d4944c]/20" : ""
                      }`}
                    >
                      <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2.5">
                            {deal.needsAttention && (
                              <span className="w-1.5 h-1.5 rounded-full bg-[#d4944c] shrink-0" />
                            )}
                            <p className="text-[#1e2416] text-sm font-medium truncate">
                              {deal.transactionId ? (
                                <Link
                                  href={`/aire/transactions/${deal.transactionId}`}
                                  className="hover:text-[#6b7d52] transition-colors"
                                >
                                  {deal.address}
                                </Link>
                              ) : (
                                deal.address
                              )}
                            </p>
                          </div>
                          {deal.reason && (
                            <p className="text-[#d4944c]/80 text-xs mt-1 ml-4 sm:ml-0">
                              {deal.reason}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-5 shrink-0 ml-4 sm:ml-0">
                          <span className="font-mono text-sm text-[#1e2416]">
                            ${(deal.price / 1000).toFixed(0)}K
                          </span>
                          <span className="font-mono text-[10px] text-[#6b7d52]/50 uppercase tracking-wider w-20 text-right">
                            {deal.status.replace(/_/g, " ")}
                          </span>
                          {deal.daysToClose !== null && (
                            <span className="font-mono text-[10px] text-[#1e2416]/40">
                              {deal.daysToClose}d
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
              <hr className="border-[#e8e4d8] border-t" />
            </>
          )}

          {/* ── 04 Deadlines ── */}
          {deadlines.length > 0 && (
            <>
              <section>
                <SectionLabel number="04" title="Deadlines" count={deadlines.length} />

                {/* Desktop */}
                <div className="mt-5 hidden sm:block">
                  <div className="grid grid-cols-[8px_1fr_1fr_80px] gap-x-5 px-5 pb-2">
                    <span />
                    <span className="font-mono text-[10px] text-[#6b7d52]/40 uppercase tracking-wider">Deadline</span>
                    <span className="font-mono text-[10px] text-[#6b7d52]/40 uppercase tracking-wider">Property</span>
                    <span className="font-mono text-[10px] text-[#6b7d52]/40 uppercase tracking-wider text-right">Due</span>
                  </div>
                  {deadlines.map((d, i) => {
                    const colors = urgencyColor[d.urgency] || urgencyColor.upcoming
                    return (
                      <div
                        key={i}
                        className={`grid grid-cols-[8px_1fr_1fr_80px] gap-x-5 px-5 py-3 items-center rounded-lg ${colors.bg} ${
                          i < deadlines.length - 1 ? "mb-0.5" : ""
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                        <span className="text-[#1e2416] text-sm">{d.name}</span>
                        <span className="text-[#6b7d52]/70 text-sm truncate">
                          {d.transactionId ? (
                            <Link href={`/aire/transactions/${d.transactionId}`} className="hover:text-[#6b7d52] transition-colors">
                              {d.transactionAddress}
                            </Link>
                          ) : (
                            d.transactionAddress
                          )}
                        </span>
                        <span className={`font-mono text-xs text-right ${colors.text}`}>
                          {new Date(d.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {/* Mobile */}
                <div className="mt-5 space-y-2 sm:hidden">
                  {deadlines.map((d, i) => {
                    const colors = urgencyColor[d.urgency] || urgencyColor.upcoming
                    return (
                      <div key={i} className={`rounded-lg px-4 py-3.5 flex items-start gap-3 ${colors.bg}`}>
                        <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${colors.dot}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[#1e2416] text-sm">{d.name}</p>
                          <p className="text-[#6b7d52]/50 text-xs mt-0.5 truncate">{d.transactionAddress}</p>
                        </div>
                        <span className={`font-mono text-xs shrink-0 ${colors.text}`}>
                          {new Date(d.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </section>
              <hr className="border-[#e8e4d8] border-t" />
            </>
          )}

          {/* ── 05 Relationship Intelligence ── */}
          {contacts.length > 0 && (
            <section>
              <SectionLabel number="05" title="Relationship Intelligence" count={contacts.length} />
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {contacts.map((c, i) => (
                  <div key={i} className="card-glass !rounded-lg !p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[#1e2416] text-sm font-medium">{c.name}</p>
                        <p className="text-[#6b7d52]/45 text-xs mt-1">{c.category}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-mono text-lg text-[#1e2416]/80">{c.score}</span>
                        <p className="font-mono text-[9px] text-[#6b7d52]/30 uppercase tracking-wider mt-0.5">Score</p>
                      </div>
                    </div>
                    {c.lastContact && (
                      <p className="font-mono text-[10px] text-[#6b7d52]/35 mt-2.5">
                        Last contact: {new Date(c.lastContact).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Approval Footer ── */}
          {brief.status === "pending" && (
            <div className="pt-6">
              <div className="h-px bg-[#1e2416] mb-8" />
              <div className="max-w-md mx-auto text-center">
                <p className="font-mono text-[10px] text-[#6b7d52]/50 uppercase tracking-[0.2em] mb-2">
                  Action Required
                </p>
                <p className="text-[#1e2416]/70 text-sm leading-relaxed mb-6">
                  Approve this brief to authorize AIRE to execute the actions above on your behalf.
                </p>
                <MorningBriefActions briefId={brief.id} />
              </div>
            </div>
          )}

          {/* ── Report footer ── */}
          <div className="pt-8 text-center">
            <div className="h-px w-12 bg-[#e8e4d8] mx-auto mb-4" />
            <FeedbackButtons
              feature="morning_brief"
              metadata={{ briefId: brief.id, briefDate: brief.briefDate.toISOString() }}
              className="justify-center mb-4"
            />
            <p className="font-mono text-[9px] text-[#6b7d52]/30 uppercase tracking-[0.3em]">
              End of Brief
            </p>
          </div>
        </div>
      )}
    </div>
    </div>
  )
}

