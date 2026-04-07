// Morning Brief V1: Minimalist
// Lots of whitespace, clean typography, editorial feel
// Uses locked AIRE palette: Sage, Olive, Cream, Linen, Deep Forest

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

export function MorningBriefV1({ brief, dateStr }: { brief: BriefData | null; dateStr: string }) {
  return (
    <div className="max-w-xl mx-auto px-6 py-16">
      {/* Minimal header — date as hero */}
      <div className="mb-16">
        <p className="text-[#6b7d52] text-xs font-medium tracking-[0.2em] uppercase mb-4">
          Morning Brief
        </p>
        <h1 className="font-[family-name:var(--font-cormorant)] italic text-[#1e2416] text-4xl leading-tight">
          {dateStr}
        </h1>
      </div>

      {!brief ? (
        <div className="py-20 text-center">
          <p className="text-[#6b7d52]/60 text-sm">
            No brief for today.
          </p>
          <p className="text-[#6b7d52]/40 text-xs mt-2">
            Check back after 6:30 AM.
          </p>
        </div>
      ) : (
        <div className="space-y-12">
          {/* Status — ultra minimal */}
          {brief.status === "pending" && (
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-[#9aab7e] animate-pulse-dot" />
              <p className="text-[#6b7d52] text-sm">Awaiting your approval</p>
            </div>
          )}
          {brief.status === "approved" && (
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-[#6b7d52]" />
              <p className="text-[#6b7d52]/60 text-sm">Approved — actions are live</p>
            </div>
          )}

          {/* Summary — generous line height, no box */}
          {brief.summary && (
            <div>
              <p className="text-[#1e2416] text-[15px] leading-[1.9] whitespace-pre-wrap">
                {brief.summary}
              </p>
            </div>
          )}

          {/* Divider */}
          <hr className="border-[#9aab7e]/15" />

          {/* Action items — clean list with category tags */}
          {brief.actionItems && brief.actionItems.length > 0 && (
            <div>
              <p className="text-[#6b7d52] text-xs font-medium tracking-[0.15em] uppercase mb-6">
                Action Items
              </p>
              <div className="space-y-4">
                {brief.actionItems.map((item, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <span className="text-[#9aab7e]/50 text-xs font-[family-name:var(--font-ibm-plex-mono)] mt-0.5 w-5 shrink-0">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="flex-1">
                      <p className="text-[#1e2416] text-sm leading-relaxed">{item.action}</p>
                      <span className="text-[#6b7d52]/50 text-xs mt-1 inline-block">{item.category}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Approve/dismiss — full width, generous padding */}
          {brief.status === "pending" && (
            <div className="pt-4">
              <MorningBriefActions briefId={brief.id} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
