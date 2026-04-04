// Morning Brief V2: Card-Based
// Each brief section as a distinct glass card
// Uses AIRE glass card system + locked palette

import { MorningBriefActions } from "@/app/aire/morning-brief/actions"

interface ActionItem {
  action: string
  priority: string
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

const priorityStyles: Record<string, string> = {
  high: "bg-[#6b7d52]/20 text-[#6b7d52] border-[#6b7d52]/20",
  medium: "bg-[#9aab7e]/15 text-[#6b7d52] border-[#9aab7e]/20",
  low: "bg-[#e8e4d8]/30 text-[#6b7d52]/60 border-[#e8e4d8]/30",
}

export function MorningBriefV2({ brief, dateStr }: { brief: BriefData | null; dateStr: string }) {
  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      {/* Header card */}
      <div className="card-glass mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[#6b7d52] text-xs font-medium tracking-[0.15em] uppercase mb-1">
              Morning Brief
            </p>
            <h1 className="font-[family-name:var(--font-newsreader)] italic text-[#1e2416] text-2xl">
              {dateStr}
            </h1>
          </div>
          {brief && (
            <span
              className={`text-xs px-3 py-1.5 rounded-full font-medium ${
                brief.status === "pending"
                  ? "bg-[#9aab7e]/15 text-[#6b7d52] border border-[#9aab7e]/20"
                  : brief.status === "approved"
                    ? "bg-[#6b7d52]/10 text-[#6b7d52] border border-[#6b7d52]/15"
                    : "bg-[#e8e4d8]/30 text-[#6b7d52]/50 border border-[#e8e4d8]/20"
              }`}
            >
              {brief.status === "pending" ? "Needs approval" : brief.status}
            </span>
          )}
        </div>
      </div>

      {!brief ? (
        <div className="card-glass text-center py-16">
          <div className="w-12 h-12 rounded-full bg-[#9aab7e]/10 border border-[#9aab7e]/15 mx-auto mb-4 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9aab7e" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <p className="text-[#6b7d52]/60 text-sm">No brief for today</p>
          <p className="text-[#6b7d52]/40 text-xs mt-1">Check back after 6:30 AM</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Summary card */}
          {brief.summary && (
            <div className="card-glass">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1.5 h-1.5 rounded-full bg-[#6b7d52]" />
                <p className="text-[#6b7d52] text-xs font-medium tracking-[0.1em] uppercase">Summary</p>
              </div>
              <p className="text-[#1e2416] text-sm leading-[1.8] whitespace-pre-wrap">
                {brief.summary}
              </p>
            </div>
          )}

          {/* Action items — each as a sub-card */}
          {brief.actionItems && brief.actionItems.length > 0 && (
            <div className="card-glass">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#9aab7e]" />
                  <p className="text-[#6b7d52] text-xs font-medium tracking-[0.1em] uppercase">
                    Action Items
                  </p>
                </div>
                <span className="text-[#6b7d52]/40 text-xs">{brief.actionItems.length} items</span>
              </div>

              <div className="space-y-2">
                {brief.actionItems.map((item, i) => {
                  const pStyle = priorityStyles[item.priority] || priorityStyles.medium
                  return (
                    <div
                      key={i}
                      className="bg-[#f5f2ea]/40 border border-[#e8e4d8]/40 rounded-xl p-4 flex items-start gap-3"
                    >
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium shrink-0 mt-0.5 ${pStyle}`}>
                        {item.priority}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[#1e2416] text-sm leading-relaxed">{item.action}</p>
                        <p className="text-[#6b7d52]/50 text-xs mt-1">{item.category}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Approval card */}
          {brief.status === "pending" && (
            <div className="card-sage">
              <p className="text-[#6b7d52] text-xs font-medium mb-3">
                AIRE will not act until you approve this brief.
              </p>
              <MorningBriefActions briefId={brief.id} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
