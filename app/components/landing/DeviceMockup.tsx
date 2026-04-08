'use client'

export function DeviceMockup() {
  return (
    <div className="relative mx-auto" style={{ maxWidth: "900px" }}>
      {/* Laptop frame */}
      <div className="relative rounded-t-xl overflow-hidden border border-[#3a4a28]/20 bg-[#1e2416]" style={{ boxShadow: "0 32px 80px rgba(30,36,22,0.4)" }}>
        {/* Browser chrome */}
        <div className="flex items-center gap-1.5 px-4 py-2.5 bg-[#1a1f14] border-b border-[#9aab7e]/10">
          <span className="w-2.5 h-2.5 rounded-full bg-[#c45c5c]/50" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#d4944c]/40" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#9aab7e]/40" />
          <div className="flex-1 flex justify-center">
            <div className="px-4 py-1 rounded-md bg-white/5 text-[10px] text-[#f4f1ec]/30 font-[family-name:var(--font-mono)]">
              app.aireintel.org/aire
            </div>
          </div>
        </div>

        {/* Screen content — video or fallback mockup */}
        <div className="relative aspect-[16/10] bg-[#1e2416] overflow-hidden">
          {/* MP4 video — replace src when you have the recording */}
          <video
            autoPlay
            muted
            loop
            playsInline
            poster="/aire-dashboard-preview.png"
            className="absolute inset-0 w-full h-full object-cover"
          >
            <source src="/aire-demo.mp4" type="video/mp4" />
          </video>

          {/* Fallback: static mockup if no video */}
          <div className="absolute inset-0 flex items-center justify-center" id="mockup-fallback">
            <DashboardMockup />
          </div>
        </div>
      </div>

      {/* Laptop base/chin */}
      <div className="relative mx-auto h-4 rounded-b-lg" style={{ width: "70%", background: "linear-gradient(to bottom, #2a3320, #3a4a28)" }}>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-1 rounded-b bg-[#9aab7e]/20" />
      </div>

      {/* Phone mockup floating alongside */}
      <div className="absolute -right-4 md:-right-8 bottom-4 md:bottom-8 w-24 md:w-36 z-20 animate-fade-up [animation-delay:0.9s]">
        <div className="rounded-2xl overflow-hidden border-2 border-[#3a4a28]/30 bg-[#1e2416]" style={{ boxShadow: "0 16px 48px rgba(30,36,22,0.5)" }}>
          {/* Phone notch */}
          <div className="flex justify-center py-1.5 bg-[#1a1f14]">
            <div className="w-8 h-1 rounded-full bg-[#9aab7e]/15" />
          </div>
          {/* Phone screen */}
          <div className="aspect-[9/16] p-2">
            <PhoneMockup />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Static dashboard mockup (shown until MP4 is added) ── */
function DashboardMockup() {
  return (
    <div className="w-full h-full p-6 flex flex-col">
      {/* Sidebar + main area */}
      <div className="flex flex-1 gap-4">
        {/* Sidebar */}
        <div className="w-40 shrink-0 hidden md:flex flex-col gap-2 py-4 pr-4 border-r border-[#9aab7e]/8">
          <div className="text-[#f4f1ec]/80 text-sm font-[family-name:var(--font-display)] italic mb-4">AIRE</div>
          {["Dashboard", "Transactions", "AirSign", "Morning Brief", "Contracts"].map((item, i) => (
            <div
              key={item}
              className={`text-xs py-1.5 px-2 rounded ${i === 0 ? "bg-[#9aab7e]/15 text-[#9aab7e]" : "text-[#f4f1ec]/30"}`}
            >
              {item}
            </div>
          ))}
        </div>

        {/* Main content */}
        <div className="flex-1 py-4">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-[9px] tracking-[0.15em] uppercase text-[#9aab7e]/50 font-[family-name:var(--font-label)]">Dashboard</p>
              <p className="text-[#f4f1ec]/80 text-base font-[family-name:var(--font-display)] italic mt-1">Good morning, Caleb</p>
            </div>
            <div className="flex gap-2">
              <div className="w-6 h-6 rounded-full bg-[#9aab7e]/20" />
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: "Active", value: "7" },
              { label: "Pipeline", value: "$1.2M" },
              { label: "Overdue", value: "2" },
            ].map((stat) => (
              <div key={stat.label} className="bg-white/[0.03] border border-[#9aab7e]/8 rounded-lg p-3">
                <p className="text-[8px] tracking-wider uppercase text-[#9aab7e]/40">{stat.label}</p>
                <p className="text-[#f4f1ec]/70 text-lg font-[family-name:var(--font-mono)] mt-0.5">{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Transaction list preview */}
          <div className="bg-white/[0.02] border border-[#9aab7e]/6 rounded-lg overflow-hidden">
            <div className="px-3 py-2 border-b border-[#9aab7e]/6">
              <p className="text-[8px] tracking-wider uppercase text-[#9aab7e]/40">Active Transactions</p>
            </div>
            {[
              { addr: "5834 Guice Dr", status: "Active", color: "#9aab7e" },
              { addr: "1247 Perkins Rd", status: "Pending", color: "#d4944c" },
              { addr: "892 Highland Rd", status: "Active", color: "#9aab7e" },
            ].map((tx) => (
              <div key={tx.addr} className="flex items-center gap-2 px-3 py-2 border-b border-[#9aab7e]/4 last:border-0">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: tx.color }} />
                <span className="text-[#f4f1ec]/50 text-[11px] flex-1">{tx.addr}</span>
                <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: `${tx.color}15`, color: tx.color }}>{tx.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Phone mockup showing Morning Brief ── */
function PhoneMockup() {
  return (
    <div className="h-full flex flex-col gap-1.5">
      <p className="text-[6px] md:text-[7px] tracking-wider uppercase text-[#9aab7e]/50">Morning Brief</p>
      <p className="text-[#f4f1ec]/70 text-[8px] md:text-[9px] font-[family-name:var(--font-display)] italic">April 7</p>
      <div className="space-y-1 mt-1">
        {[
          { dot: "#c45c5c", text: "2 overdue" },
          { dot: "#d4944c", text: "Appraisal today" },
          { dot: "#9aab7e", text: "3 follow-ups" },
        ].map((row) => (
          <div key={row.text} className="flex items-center gap-1">
            <span className="w-1 h-1 rounded-full shrink-0" style={{ background: row.dot }} />
            <span className="text-[#f4f1ec]/40 text-[6px] md:text-[7px] truncate">{row.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
