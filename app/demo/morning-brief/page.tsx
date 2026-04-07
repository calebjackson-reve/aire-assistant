import Link from "next/link"

// ── Sample data — realistic Baton Rouge pipeline ──────────────────

const DEMO_DATE = "Friday, April 4, 2026"

const SUMMARY = `Your pipeline is strong this week — 6 active transactions totaling $1.24M. Two deadlines need immediate attention: the inspection period on Guice Dr expired yesterday, and the appraisal for Highland Rd is due today. Three contacts are overdue for follow-up, including a hot lead from last week's open house at Perkins Rd. Market conditions in 70810 remain competitive with a 4.2% price increase month-over-month. Your AirSign envelope for the Burbank Dr purchase agreement is pending one signature.`

const DEADLINES = [
  { name: "Inspection Period", address: "5834 Guice Dr", due: "Apr 3", urgency: "overdue" },
  { name: "Appraisal Due", address: "1420 Highland Rd", due: "Apr 4", urgency: "today" },
  { name: "Financing Contingency", address: "8900 Burbank Dr", due: "Apr 7", urgency: "urgent" },
  { name: "Title Search", address: "2215 Perkins Rd", due: "Apr 9", urgency: "upcoming" },
  { name: "Act of Sale", address: "5834 Guice Dr", due: "Apr 30", urgency: "upcoming" },
  { name: "Home Warranty Deadline", address: "445 Lobdell Ave", due: "Apr 12", urgency: "upcoming" },
]

const PIPELINE = [
  { address: "5834 Guice Dr, BR 70805", status: "Under Contract", price: 160000, daysToClose: 26, needsAttention: true, reason: "Inspection overdue — call buyer's agent" },
  { address: "1420 Highland Rd, BR 70808", status: "Appraisal", price: 285000, daysToClose: 18, needsAttention: true, reason: "Appraisal due today" },
  { address: "8900 Burbank Dr, BR 70810", status: "Financing", price: 225000, daysToClose: 30, needsAttention: false },
  { address: "2215 Perkins Rd, BR 70808", status: "Title Review", price: 340000, daysToClose: 22, needsAttention: false },
  { address: "445 Lobdell Ave, BR 70806", status: "Under Contract", price: 135000, daysToClose: 35, needsAttention: false },
  { address: "7701 Stumberg Ln, BR 70810", status: "Listed", price: 95000, daysToClose: null, needsAttention: false },
]

const CONTACTS = [
  { name: "Marcus Thompson", score: 92, category: "Hot Lead", note: "Open house visitor — asked about Perkins Rd comps" },
  { name: "Jennifer & David Nguyen", score: 85, category: "Hot Lead", note: "Pre-approved, looking in 70810" },
  { name: "Robert Williams", score: 78, category: "Needs Follow-up", note: "Last contact 12 days ago — closing on Burbank" },
  { name: "Amanda Foster", score: 71, category: "Needs Follow-up", note: "Listing appointment scheduled, confirm time" },
  { name: "Chris & Laura Martinez", score: 65, category: "Needs Follow-up", note: "Referred by past client — first-time buyers" },
  { name: "Dr. Patricia Chen", score: 60, category: "Investor", note: "Looking for multi-family in 70802" },
]

const MARKET = [
  { metric: "Median Sale Price (70810)", value: "$268,500", change: "+4.2%", direction: "up" },
  { metric: "Days on Market (BR Metro)", value: "10", change: "-3 days", direction: "up" },
  { metric: "New Listings This Week", value: "47", change: "+12%", direction: "neutral" },
  { metric: "List-to-Sale Ratio", value: "98.4%", change: "+0.6%", direction: "up" },
]

const ACTIONS = [
  { action: "Call buyer's agent on 5834 Guice Dr — inspection period expired yesterday. Get status or request extension.", priority: "Critical", category: "Deadline" },
  { action: "Follow up on appraisal for 1420 Highland Rd — due today. Confirm appraiser has access.", priority: "High", category: "Deadline" },
  { action: "Resend AirSign envelope to Sarah Davis — purchase agreement for Burbank Dr still pending signature.", priority: "High", category: "AirSign" },
  { action: "Call Marcus Thompson — hot lead from Perkins Rd open house. Score: 92. Window is closing.", priority: "High", category: "Relationship" },
  { action: "Confirm listing appointment with Amanda Foster for Tuesday.", priority: "Medium", category: "Relationship" },
  { action: "Review comp data for 70810 — prices up 4.2% MoM. Update CMAs for active listings.", priority: "Medium", category: "Market" },
]

const urgencyDot: Record<string, string> = {
  overdue: "bg-[#c45c5c]",
  today: "bg-[#d4944c]",
  urgent: "bg-[#9aab7e]",
  upcoming: "bg-[#6b7d52]/40",
}

const urgencyLabel: Record<string, string> = {
  overdue: "text-[#c45c5c]",
  today: "text-[#d4944c]",
  urgent: "text-[#9aab7e]",
  upcoming: "text-[#6b7d52]/40",
}

function SectionHeader({ number, title, count }: { number: string; title: string; count?: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-[10px] text-[#9aab7e]/40">{number}</span>
      <h2 className="text-[#1e2416] text-sm font-semibold tracking-wide uppercase" style={{ fontStyle: "normal", fontSize: "0.8125rem" }}>
        {title}
      </h2>
      {count !== undefined && (
        <span className="font-mono text-[10px] text-[#6b7d52]/40">({count})</span>
      )}
      <div className="flex-1 h-px bg-[#e8e4d8]" />
    </div>
  )
}

export default function DemoMorningBriefPage() {
  return (
    <div className="min-h-screen bg-[#f4f1ec]">
      {/* Demo banner */}
      <div className="bg-[#1e2416] text-center py-3 px-4">
        <p className="text-[#f4f1ec]/60 text-xs">
          This is a demo brief with sample data.{" "}
          <Link href="/sign-up" className="text-[#9aab7e] hover:underline">
            Sign up free
          </Link>{" "}
          to get yours every morning at 7 AM.
        </p>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Report header */}
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
              <p className="text-[#1e2416] text-sm font-medium">{DEMO_DATE}</p>
              <p className="font-mono text-[10px] text-[#6b7d52]/50 mt-0.5">
                Demo · Sample Data
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {/* Status bar */}
          <div className="flex items-center justify-between bg-[#f5f2ea] rounded-lg px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#d4944c] animate-pulse" />
              <span className="text-[#1e2416] text-sm font-medium">Pending Approval</span>
            </div>
            <span className="font-mono text-[10px] text-[#6b7d52]/50">Generated 06:30 CT</span>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white/60 border border-[#e8e4d8] rounded-lg px-4 py-3 text-center">
              <p className="font-[family-name:var(--font-ibm-mono)] text-2xl font-light text-[#1e2416]">6</p>
              <p className="text-[10px] text-[#6b7d52]/50 tracking-wider uppercase mt-1">Active Deals</p>
            </div>
            <div className="bg-white/60 border border-[#e8e4d8] rounded-lg px-4 py-3 text-center">
              <p className="font-[family-name:var(--font-ibm-mono)] text-2xl font-light text-[#1e2416]">$1.24M</p>
              <p className="text-[10px] text-[#6b7d52]/50 tracking-wider uppercase mt-1">Pipeline Value</p>
            </div>
            <div className="bg-white/60 border border-[#c45c5c]/20 rounded-lg px-4 py-3 text-center">
              <p className="font-[family-name:var(--font-ibm-mono)] text-2xl font-light text-[#c45c5c]">2</p>
              <p className="text-[10px] text-[#c45c5c]/60 tracking-wider uppercase mt-1">Urgent Items</p>
            </div>
            <div className="bg-white/60 border border-[#e8e4d8] rounded-lg px-4 py-3 text-center">
              <p className="font-[family-name:var(--font-ibm-mono)] text-2xl font-light text-[#1e2416]">3</p>
              <p className="text-[10px] text-[#6b7d52]/50 tracking-wider uppercase mt-1">Follow-ups Due</p>
            </div>
          </div>

          {/* 01 — Executive Summary */}
          <section>
            <SectionHeader number="01" title="Executive Summary" />
            <p className="text-[#1e2416]/80 text-[15px] leading-[1.85] mt-3">
              {SUMMARY}
            </p>
          </section>

          {/* 02 — Deadlines */}
          <section>
            <SectionHeader number="02" title="Deadlines" count={DEADLINES.length} />
            <div className="mt-3 border border-[#e8e4d8] rounded-lg overflow-hidden hidden sm:block">
              <div className="grid grid-cols-[auto_1fr_1fr_auto] gap-x-4 px-4 py-2 bg-[#f5f2ea] border-b border-[#e8e4d8]">
                <span className="text-[10px] text-[#6b7d52]/60 font-medium tracking-wider uppercase w-2" />
                <span className="text-[10px] text-[#6b7d52]/60 font-medium tracking-wider uppercase">Deadline</span>
                <span className="text-[10px] text-[#6b7d52]/60 font-medium tracking-wider uppercase">Property</span>
                <span className="text-[10px] text-[#6b7d52]/60 font-medium tracking-wider uppercase">Due</span>
              </div>
              {DEADLINES.map((d, i) => (
                <div key={i} className={`grid grid-cols-[auto_1fr_1fr_auto] gap-x-4 px-4 py-2.5 items-center ${
                  i < DEADLINES.length - 1 ? "border-b border-[#e8e4d8]/50" : ""
                }`}>
                  <span className={`w-2 h-2 rounded-full ${urgencyDot[d.urgency]}`} />
                  <span className="text-[#1e2416] text-sm">{d.name}</span>
                  <span className="text-[#6b7d52] text-sm truncate">{d.address}</span>
                  <span className={`font-mono text-xs ${urgencyLabel[d.urgency]}`}>{d.due}</span>
                </div>
              ))}
            </div>
            {/* Mobile */}
            <div className="mt-3 space-y-2 sm:hidden">
              {DEADLINES.map((d, i) => (
                <div key={i} className="bg-[#f5f2ea]/60 rounded-lg px-4 py-3 flex items-start gap-3">
                  <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${urgencyDot[d.urgency]}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[#1e2416] text-sm">{d.name}</p>
                    <p className="text-[#6b7d52]/60 text-xs truncate">{d.address}</p>
                  </div>
                  <span className={`font-mono text-xs shrink-0 ${urgencyLabel[d.urgency]}`}>{d.due}</span>
                </div>
              ))}
            </div>
          </section>

          {/* 03 — Pipeline */}
          <section>
            <SectionHeader number="03" title="Active Pipeline" count={PIPELINE.length} />
            <div className="mt-3 space-y-2">
              {PIPELINE.map((deal, i) => (
                <div key={i} className={`flex items-center justify-between px-4 py-3 rounded-lg ${
                  deal.needsAttention ? "bg-[#9aab7e]/8 border border-[#9aab7e]/15" : "bg-[#f5f2ea]/60"
                }`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-[#1e2416] text-sm font-medium truncate">{deal.address}</p>
                    {deal.reason && <p className="text-[#6b7d52] text-xs mt-0.5">{deal.reason}</p>}
                  </div>
                  <div className="flex items-center gap-4 shrink-0 ml-4">
                    <span className="font-mono text-sm text-[#1e2416]">${(deal.price / 1000).toFixed(0)}K</span>
                    <span className="text-[#6b7d52]/60 text-xs w-20 text-right">{deal.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 04 — Market Intelligence */}
          <section>
            <SectionHeader number="04" title="Market Intelligence" count={MARKET.length} />
            <div className="mt-3 grid grid-cols-2 gap-2">
              {MARKET.map((m, i) => (
                <div key={i} className="bg-[#f5f2ea]/60 rounded-lg px-4 py-3">
                  <p className="text-[#6b7d52]/50 text-[10px] tracking-wider uppercase mb-1">{m.metric}</p>
                  <div className="flex items-baseline gap-2">
                    <span className="font-[family-name:var(--font-ibm-mono)] text-xl text-[#1e2416]">{m.value}</span>
                    <span className={`font-mono text-xs ${
                      m.direction === "up" ? "text-[#6b7d52]" : "text-[#c45c5c]"
                    }`}>{m.change}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 05 — Relationship Intelligence */}
          <section>
            <SectionHeader number="05" title="Relationship Intelligence" count={CONTACTS.length} />
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {CONTACTS.map((c, i) => (
                <div key={i} className="bg-[#f5f2ea]/60 rounded-lg px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[#1e2416] text-sm font-medium">{c.name}</p>
                    <span className="font-mono text-xs text-[#6b7d52]">{c.score}</span>
                  </div>
                  <p className="text-[#6b7d52]/50 text-xs">{c.note}</p>
                  <span className="inline-block mt-2 text-[9px] tracking-wider uppercase text-[#6b7d52]/40">{c.category}</span>
                </div>
              ))}
            </div>
          </section>

          {/* 06 — Required Actions */}
          <section>
            <SectionHeader number="06" title="Required Actions" count={ACTIONS.length} />
            <div className="mt-3 space-y-1">
              {ACTIONS.map((item, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-2.5">
                  <span className="font-mono text-[11px] text-[#9aab7e]/60 mt-0.5 w-4 shrink-0">{i + 1}.</span>
                  <div className="flex-1">
                    <p className="text-[#1e2416] text-sm leading-relaxed">{item.action}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[9px] tracking-wider uppercase ${
                      item.priority === "Critical" ? "text-[#c45c5c]" :
                      item.priority === "High" ? "text-[#d4944c]" : "text-[#6b7d52]/40"
                    }`}>{item.priority}</span>
                    <span className="text-[#6b7d52]/30 text-[9px] uppercase tracking-wider">{item.category}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Approval buttons (demo) */}
          <div className="border-t-2 border-[#1e2416] pt-6">
            <p className="text-[#6b7d52] text-xs mb-4">
              In production, this brief requires your approval before AIRE takes action on your behalf.
            </p>
            <div className="flex gap-3">
              <Link
                href="/sign-up"
                className="flex-1 py-3 text-center bg-[#1e2416] text-[#f4f1ec] text-sm font-medium hover:bg-[#5c6e2e] transition-colors"
              >
                Sign Up to Get Your Own Brief
              </Link>
              <button
                className="px-6 py-3 border border-[#e8e4d8] text-[#6b7d52] text-sm hover:border-[#6b7d52]/30 transition-colors"
                disabled
              >
                Approve (Demo)
              </button>
            </div>
          </div>
        </div>

        {/* Back to home */}
        <div className="mt-12 pt-6 border-t border-[#e8e4d8] text-center">
          <Link href="/" className="text-[#6b7d52] text-sm hover:underline">
            &larr; Back to AIRE
          </Link>
        </div>
      </div>
    </div>
  )
}
