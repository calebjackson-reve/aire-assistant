import Link from "next/link"

// HeroV2 — replaces the globe + sparkles hero with a product-first first-fold.
// Goal: a cold visitor sees proof (Q1 stats), product depth (inline dashboard
// preview), and a clear CTA within 8 seconds, without scrolling.
// DESIGN.md: Cream canvas, Cormorant italic AIRE wordmark, Space Grotesk body,
// IBM Plex Mono for every numeral. Palette: sage/olive/cream/linen/deep-forest.

const Q1_STATS = [
  { value: "18", label: "Deals Closed" },
  { value: "$3.38M", label: "Volume" },
  { value: "10", label: "Days to Contract" },
  { value: "$114K", label: "Client Equity" },
]

const AGENTS = [
  "01  Transaction",
  "02  Voice Command",
  "03  Morning Brief",
  "04  Content",
  "05  Intelligence",
  "06  Compliance",
  "07  AirSign",
]

export function HeroV2({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="relative bg-[#f5f2ea] overflow-hidden">
      {/* Proof strip — Deep Forest ribbon with Q1 headline stats in IBM Plex Mono */}
      <div className="bg-[#1e2416] border-b border-[#4a5638]/40">
        <div className="max-w-7xl mx-auto px-6 py-2.5 flex flex-wrap items-center justify-center gap-x-6 gap-y-1.5 text-[11px] uppercase tracking-[0.18em] font-[family-name:var(--font-mono)]">
          <span className="text-[#9aab7e]">Q1 2026</span>
          <span className="text-[#e8e4d8]/30">·</span>
          <span className="text-[#e8e4d8]">18 deals closed</span>
          <span className="text-[#e8e4d8]/30">·</span>
          <span className="text-[#e8e4d8]">$3.38M volume</span>
          <span className="text-[#e8e4d8]/30">·</span>
          <span className="text-[#e8e4d8]">10 days to contract</span>
        </div>
      </div>

      {/* Main hero split — text left, product preview right */}
      <div className="max-w-7xl mx-auto px-6 pt-14 pb-12 md:pt-20 md:pb-16 lg:pt-24 lg:pb-20 grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-12 lg:gap-16 items-center">

        {/* ─── LEFT ─── */}
        <div className="relative">
          {/* Eyebrow pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#9aab7e]/12 border border-[#6b7d52]/25 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[#6b7d52]" />
            <span className="text-[#4a5638] text-[11px] font-medium tracking-[0.04em] uppercase">Built by a Louisiana REALTOR. For Louisiana REALTORS.</span>
          </div>

          {/* AIRE wordmark — Cormorant italic */}
          <h1 className="font-[family-name:var(--font-cormorant)] italic text-[#1e2416] leading-[0.92] tracking-[-0.035em] text-[92px] md:text-[128px] lg:text-[148px] mb-4 font-medium">
            AIRE
          </h1>

          {/* Main tagline — second Cormorant line, olive accent on the key word */}
          <h2 className="font-[family-name:var(--font-cormorant)] italic text-[#1e2416] text-[26px] md:text-[34px] lg:text-[38px] leading-[1.15] tracking-[-0.015em] mb-5 max-w-xl">
            The real estate <span className="text-[#6b7d52]">operating system</span>.
          </h2>

          {/* Sub-body — Space Grotesk */}
          <p className="text-[#2c3520]/80 text-[15px] md:text-[16px] leading-[1.65] max-w-lg mb-7">
            Seven AI agents handle deadlines, signatures, briefs, and compliance.
            You close the deals.
          </p>

          {/* Inline stat row — IBM Plex Mono, 4 big numbers */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-5 mb-8 max-w-xl">
            {Q1_STATS.map((s, i) => (
              <div key={s.label} className="relative">
                {i > 0 && <span className="hidden sm:block absolute -left-2 top-1 bottom-1 w-px bg-[#c5c9b8]" />}
                <p className="font-[family-name:var(--font-mono)] text-[#1e2416] text-[22px] md:text-[26px] font-medium leading-none tracking-[-0.01em]">
                  {s.value}
                </p>
                <p className="font-[family-name:var(--font-mono)] text-[#8a9070] text-[9px] md:text-[10px] uppercase tracking-[0.15em] mt-1.5">
                  {s.label}
                </p>
              </div>
            ))}
          </div>

          {/* CTAs — olive primary + ghost secondary with spring hover */}
          <div className="flex flex-wrap gap-3 mb-6">
            <Link
              href={signedIn ? "/aire" : "/sign-up"}
              className="group inline-flex items-center gap-2 bg-[#6b7d52] text-[#f5f2ea] px-6 py-3.5 rounded-lg text-sm font-medium hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9aab7e]/60 shadow-[0_1px_3px_rgba(30,36,22,0.15),0_8px_24px_-6px_rgba(30,36,22,0.25)]"
              style={{ transition: "transform 240ms cubic-bezier(0.34,1.56,0.64,1), box-shadow 240ms ease" }}
            >
              {signedIn ? "Open Dashboard" : "Start 7-day free trial"}
              <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </Link>
            <a
              href="#platform"
              className="inline-flex items-center gap-2 border border-[#6b7d52]/35 text-[#6b7d52] px-6 py-3.5 rounded-lg text-sm font-medium hover:bg-[#9aab7e]/10 hover:border-[#6b7d52]/60 hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9aab7e]/50"
              style={{ transition: "transform 240ms cubic-bezier(0.34,1.56,0.64,1), background 200ms ease" }}
            >
              See the Morning Brief
            </a>
          </div>

          {/* Signature — Caleb's attribution, editorial voice */}
          <p className="font-[family-name:var(--font-cormorant)] italic text-[#8a9070] text-[13px] md:text-[14px] leading-relaxed">
            &ldquo;This is my Q1. AIRE built it with me. Your turn.&rdquo;
            <span className="block not-italic font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.18em] text-[#8a9070]/70 mt-1.5">
              — Caleb Jackson · REALTOR · Reve Realtors · Baton Rouge
            </span>
          </p>
        </div>

        {/* ─── RIGHT — Product preview card ─── */}
        <div className="relative">
          {/* Specular highlight behind the card */}
          <div className="absolute -inset-8 bg-gradient-to-br from-[#9aab7e]/10 via-transparent to-transparent rounded-[32px] blur-2xl pointer-events-none" />

          {/* The dashboard composition */}
          <div
            className="relative rounded-2xl overflow-hidden bg-[#1e2416] border border-[#4a5638]/60"
            style={{
              boxShadow: "0 1px 0 rgba(245,242,234,0.06) inset, 0 12px 40px -8px rgba(30,36,22,0.35), 0 24px 64px -12px rgba(30,36,22,0.25)",
            }}
          >
            {/* Top bar */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#4a5638]/40">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#9aab7e]/70" />
                <span className="font-[family-name:var(--font-mono)] text-[10px] text-[#e8e4d8]/60 uppercase tracking-[0.2em]">
                  AIRE / Dashboard
                </span>
              </div>
              <span className="font-[family-name:var(--font-mono)] text-[9px] text-[#9aab7e] uppercase tracking-[0.18em]">
                Live
              </span>
            </div>

            {/* Body — 2 column: rail + main */}
            <div className="flex">
              {/* Agent rail */}
              <div className="w-12 shrink-0 py-4 flex flex-col items-center gap-3 border-r border-[#4a5638]/30">
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <span
                    key={n}
                    className={`w-6 h-6 rounded flex items-center justify-center font-[family-name:var(--font-mono)] text-[9px] ${
                      n === 3
                        ? "bg-[#9aab7e]/20 text-[#9aab7e] ring-1 ring-[#9aab7e]/40"
                        : "text-[#e8e4d8]/35"
                    }`}
                  >
                    {String(n).padStart(2, "0")}
                  </span>
                ))}
              </div>

              {/* Main pane */}
              <div className="flex-1 p-5 space-y-4">
                {/* Pipeline pulse card */}
                <div className="bg-[#f5f2ea]/4 border border-[#4a5638]/30 rounded-lg p-4">
                  <div className="flex items-baseline justify-between mb-3">
                    <span className="font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-[0.18em] text-[#e8e4d8]/50">
                      Pipeline · 30d
                    </span>
                    <span className="font-[family-name:var(--font-mono)] text-[9px] text-[#9aab7e]">
                      +12.4%
                    </span>
                  </div>
                  <p className="font-[family-name:var(--font-mono)] text-[#e8e4d8] text-[28px] md:text-[32px] leading-none font-medium tracking-[-0.01em]">
                    $3.38M
                  </p>
                  {/* Sparkline */}
                  <svg viewBox="0 0 200 40" className="mt-3 w-full h-8 overflow-visible">
                    <defs>
                      <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#9aab7e" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#9aab7e" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d="M0 30 L20 26 L40 28 L60 22 L80 18 L100 20 L120 14 L140 16 L160 10 L180 8 L200 6 L200 40 L0 40 Z" fill="url(#spark-fill)" />
                    <path d="M0 30 L20 26 L40 28 L60 22 L80 18 L100 20 L120 14 L140 16 L160 10 L180 8 L200 6" fill="none" stroke="#9aab7e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>

                {/* Morning Brief line */}
                <div className="flex items-start gap-3 py-2 border-b border-[#4a5638]/20">
                  <span className="relative mt-1 flex shrink-0">
                    <span className="absolute inline-flex w-2.5 h-2.5 rounded-full bg-[#9aab7e] opacity-60 animate-ping" />
                    <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-[#9aab7e]" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-[0.18em] text-[#9aab7e] mb-1">
                      06:42 · Morning Brief
                    </p>
                    <p className="text-[#e8e4d8]/85 text-[12px] leading-relaxed">
                      4 deadlines this week. 2 pending compliance. 1 unreplied buyer at
                      5834 Guice Dr.
                    </p>
                  </div>
                </div>

                {/* Voice command bubble */}
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-[#9aab7e]/8 border border-[#9aab7e]/25">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9aab7e" strokeWidth="1.8" strokeLinecap="round">
                    <rect x="9" y="4" width="6" height="12" rx="3" />
                    <path d="M5 10a7 7 0 0 0 14 0M12 17v4" />
                  </svg>
                  <span className="font-[family-name:var(--font-mono)] text-[11px] text-[#e8e4d8]/85 leading-tight">
                    &ldquo;Send update on 5834 Guice to all parties&rdquo;
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom agent ribbon — 7 agents named, IBM Plex Mono, thin olive line */}
      <div className="border-t border-[#c5c9b8]/70 bg-[#f0ece2]">
        <div className="max-w-7xl mx-auto px-6 py-3 overflow-x-auto">
          <div className="flex items-center justify-between gap-4 min-w-[760px] md:min-w-0">
            {AGENTS.map((a, i) => (
              <span
                key={a}
                className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.16em] text-[#6b7d52]/70 whitespace-nowrap"
              >
                <span className="text-[#9aab7e]">{a.slice(0, 2)}</span>
                <span className="ml-2 text-[#4a5638]/70">{a.slice(4).toUpperCase()}</span>
                {i < AGENTS.length - 1 && <span className="ml-4 text-[#c5c9b8]">·</span>}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
