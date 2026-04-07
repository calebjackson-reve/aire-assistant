// Morning Brief V3: Executive Summary
// PDF-quality report layout — structured sections, data rows, formal hierarchy
// Uses AIRE locked palette + IBM Plex Mono for data

import { MorningBriefActions } from "@/app/aire/morning-brief/actions"

interface ActionItem {
  action: string
  priority: string
  category: string
}

interface DeadlineItem {
  name: string
  dueDate: string
  transactionAddress: string
  urgency: string
}

interface PipelineItem {
  address: string
  status: string
  price: number
  daysToClose: number | null
  needsAttention: boolean
  reason?: string
}

interface ContactItem {
  name: string
  score: number
  lastContact: string | null
  category: string
}

interface BriefData {
  id: string
  status: string
  summary: string | null
  actionItems: ActionItem[] | null
  briefDate: Date
  deadlineData: unknown
  pipelineData: unknown
  contactData: unknown
}

function parseDeadlines(data: unknown): DeadlineItem[] {
  if (!data || typeof data !== "object") return []
  const d = data as Record<string, unknown>
  const all: DeadlineItem[] = []
  for (const urgency of ["overdue", "today", "urgent", "upcoming"]) {
    const items = (d[urgency] as DeadlineItem[]) || []
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

const urgencyDot: Record<string, string> = {
  overdue: "bg-[#c45c5c]",
  today: "bg-[#d4944c]",
  urgent: "bg-[#9aab7e]",
  upcoming: "bg-[#6b7d52]/40",
}

export function MorningBriefV3({ brief, dateStr }: { brief: BriefData | null; dateStr: string }) {
  const deadlines = brief ? parseDeadlines(brief.deadlineData) : []
  const pipeline = brief ? parsePipeline(brief.pipelineData) : []
  const contacts = brief ? parseContacts(brief.contactData) : []

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      {/* Report header — formal, structured */}
      <div className="border-b-2 border-[#1e2416] pb-4 mb-8">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[#6b7d52] text-[10px] font-medium tracking-[0.25em] uppercase">
              AIRE Intelligence
            </p>
            <h1 className="font-[family-name:var(--font-cormorant)] italic text-[#1e2416] text-3xl mt-1">
              Morning Brief
            </h1>
          </div>
          <div className="text-right">
            <p className="text-[#1e2416] text-sm font-medium">{dateStr}</p>
            {brief && (
              <p className="font-[family-name:var(--font-ibm-plex-mono)] text-[10px] text-[#6b7d52]/50 mt-0.5">
                ID: {brief.id.slice(0, 8)}
              </p>
            )}
          </div>
        </div>
      </div>

      {!brief ? (
        <div className="py-20 text-center border border-dashed border-[#9aab7e]/20 rounded-lg">
          <p className="text-[#6b7d52]/50 text-sm">No brief generated for today.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Status bar */}
          <div className="flex items-center justify-between bg-[#f5f2ea] rounded-lg px-4 py-3">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${
                brief.status === "pending" ? "bg-[#d4944c] animate-pulse-dot" : "bg-[#6b7d52]"
              }`} />
              <span className="text-[#1e2416] text-sm font-medium">
                {brief.status === "pending" ? "Pending Approval" : "Approved"}
              </span>
            </div>
            <span className="font-[family-name:var(--font-ibm-plex-mono)] text-[10px] text-[#6b7d52]/50">
              Generated 06:30 CT
            </span>
          </div>

          {/* Executive summary */}
          {brief.summary && (
            <section>
              <SectionHeader number="01" title="Executive Summary" />
              <p className="text-[#1e2416]/80 text-[15px] leading-[1.85] whitespace-pre-wrap mt-3">
                {brief.summary}
              </p>
            </section>
          )}

          {/* Deadlines table */}
          {deadlines.length > 0 && (
            <section>
              <SectionHeader number="02" title="Deadlines" count={deadlines.length} />
              <div className="mt-3 border border-[#e8e4d8] rounded-lg overflow-hidden">
                <div className="grid grid-cols-[auto_1fr_1fr_auto] gap-x-4 px-4 py-2 bg-[#f5f2ea] border-b border-[#e8e4d8]">
                  <span className="text-[10px] text-[#6b7d52]/60 font-medium tracking-wider uppercase w-2" />
                  <span className="text-[10px] text-[#6b7d52]/60 font-medium tracking-wider uppercase">Deadline</span>
                  <span className="text-[10px] text-[#6b7d52]/60 font-medium tracking-wider uppercase">Property</span>
                  <span className="text-[10px] text-[#6b7d52]/60 font-medium tracking-wider uppercase">Due</span>
                </div>
                {deadlines.map((d, i) => (
                  <div key={i} className={`grid grid-cols-[auto_1fr_1fr_auto] gap-x-4 px-4 py-2.5 items-center ${
                    i < deadlines.length - 1 ? "border-b border-[#e8e4d8]/50" : ""
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${urgencyDot[d.urgency] || urgencyDot.upcoming}`} />
                    <span className="text-[#1e2416] text-sm">{d.name}</span>
                    <span className="text-[#6b7d52] text-sm truncate">{d.transactionAddress}</span>
                    <span className="font-[family-name:var(--font-ibm-plex-mono)] text-xs text-[#1e2416]/60">
                      {new Date(d.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Pipeline summary */}
          {pipeline.length > 0 && (
            <section>
              <SectionHeader number="03" title="Active Pipeline" count={pipeline.length} />
              <div className="mt-3 space-y-2">
                {pipeline.map((deal, i) => (
                  <div key={i} className={`flex items-center justify-between px-4 py-3 rounded-lg ${
                    deal.needsAttention ? "bg-[#9aab7e]/8 border border-[#9aab7e]/15" : "bg-[#f5f2ea]/60"
                  }`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-[#1e2416] text-sm font-medium truncate">{deal.address}</p>
                      {deal.reason && (
                        <p className="text-[#6b7d52] text-xs mt-0.5">{deal.reason}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-4 shrink-0 ml-4">
                      <span className="font-[family-name:var(--font-ibm-plex-mono)] text-sm text-[#1e2416]">
                        ${(deal.price / 1000).toFixed(0)}K
                      </span>
                      <span className="text-[#6b7d52]/60 text-xs w-16 text-right">
                        {deal.status.replace(/_/g, " ").toLowerCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Contacts */}
          {contacts.length > 0 && (
            <section>
              <SectionHeader number="04" title="Relationship Intelligence" count={contacts.length} />
              <div className="mt-3 grid grid-cols-2 gap-2">
                {contacts.map((c, i) => (
                  <div key={i} className="bg-[#f5f2ea]/60 rounded-lg px-4 py-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[#1e2416] text-sm font-medium">{c.name}</p>
                      <span className="font-[family-name:var(--font-ibm-plex-mono)] text-xs text-[#6b7d52]">
                        {c.score}
                      </span>
                    </div>
                    <p className="text-[#6b7d52]/50 text-xs mt-1">{c.category}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Action items */}
          {brief.actionItems && brief.actionItems.length > 0 && (
            <section>
              <SectionHeader number="05" title="Required Actions" count={brief.actionItems.length} />
              <div className="mt-3 space-y-1">
                {brief.actionItems.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-2.5">
                    <span className="font-[family-name:var(--font-ibm-plex-mono)] text-[11px] text-[#9aab7e]/60 mt-0.5 w-4 shrink-0">
                      {i + 1}.
                    </span>
                    <div className="flex-1">
                      <p className="text-[#1e2416] text-sm leading-relaxed">{item.action}</p>
                    </div>
                    <span className="text-[#6b7d52]/40 text-[10px] uppercase tracking-wider shrink-0">
                      {item.category}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Approval */}
          {brief.status === "pending" && (
            <div className="border-t-2 border-[#1e2416] pt-6">
              <p className="text-[#6b7d52] text-xs mb-4">
                This brief requires your approval before AIRE takes action.
              </p>
              <MorningBriefActions briefId={brief.id} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SectionHeader({ number, title, count }: { number: string; title: string; count?: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-[family-name:var(--font-ibm-plex-mono)] text-[10px] text-[#9aab7e]/40">
        {number}
      </span>
      <h2 className="text-[#1e2416] text-sm font-semibold tracking-wide uppercase" style={{ fontStyle: "normal", fontSize: "0.8125rem" }}>
        {title}
      </h2>
      {count !== undefined && (
        <span className="font-[family-name:var(--font-ibm-plex-mono)] text-[10px] text-[#6b7d52]/40">
          ({count})
        </span>
      )}
      <div className="flex-1 h-px bg-[#e8e4d8]" />
    </div>
  )
}
