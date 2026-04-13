import { HERO_STATS, MOVES_TODAY, TRANSACTIONS, ACTIVITY, VIEW_TABS, RAIL_ITEMS } from "./_data"
import { ThemeToggle } from "./ThemeToggle"

// =============================================================================
// AIRE UI-Lab Dashboard — shared by Daylight + Nocturne concept pages.
// All visual values resolve via CSS variables defined in ../_theme.css, which
// switch based on data-theme on the nearest .ui-lab-scope ancestor.
//
// Responsive matrix:
//   < 768  (mobile) → bottom tab strip, table → card stack, sticky composer
//   768–1023 (tab) → icon rail visible, table compresses (drops Closing col)
//   ≥ 1024 (desktop) → full layout with right rail
// =============================================================================

export function Dashboard({ initialTheme }: { initialTheme: "daylight" | "nocturne" }) {
  return (
    <div
      className="ui-lab-scope relative min-h-screen w-full overflow-x-hidden"
      data-theme={initialTheme}
      data-default-theme={initialTheme}
      style={{ background: "var(--surface-base)", color: "var(--text-body)", fontFamily: "var(--font-body)" }}
    >
      {/* Atmospheric grid texture — only visible on Nocturne (opacity gated by var) */}
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

      <div
        className="relative z-10 grid min-h-full"
        style={{ gridTemplateColumns: "64px 1fr", gridTemplateRows: "56px auto 36px" }}
      >
        {/* ── ICON RAIL (md+) ─────────────────────────── */}
        <aside
          className="row-span-3 hidden md:flex flex-col items-center py-4 gap-1 border-r z-30"
          style={{
            background: "var(--surface-rail)",
            borderColor: "var(--border-rail)",
            boxShadow: "1px 0 32px rgba(0,0,0,0.18)",
          }}
        >
          <div
            className="w-9 h-9 rounded-md flex items-center justify-center text-[#e8e4d8] font-semibold relative"
            style={{
              background: "rgba(154,171,126,0.22)",
              fontFamily: "var(--font-cormorant)",
              fontStyle: "italic",
              boxShadow: "inset 0 0 0 1px rgba(154,171,126,0.30), inset 0 1px 0 rgba(255,255,255,0.10)",
            }}
          >
            A
          </div>
          <div className="h-px w-6 my-3" style={{ background: "var(--border-rail)" }} />
          {RAIL_ITEMS.map((item) => (
            <RailIcon key={item.id} item={item} />
          ))}
          <div className="flex-1" />
          <ThemeToggle />
          <button
            aria-label="Settings"
            className="w-10 h-10 rounded-md grid place-items-center transition-[transform,color,background-color] duration-[160ms] ease-out active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9aab7e] focus-visible:ring-offset-2"
            style={{
              color: "var(--text-on-rail)",
              ["--tw-ring-offset-color" as string]: "var(--surface-rail)",
            }}
          >
            <Icon name="cog" />
          </button>
          <div
            className="w-8 h-8 rounded-full bg-[#9aab7e]/30 ring-1 ring-[#9aab7e]/50 grid place-items-center text-[#e8e4d8] text-[11px] font-medium mt-1"
            style={{ fontFamily: "var(--font-ibm-mono)" }}
          >
            CJ
          </div>
        </aside>

        {/* ── TOP STRIP ─────────────────────────── */}
        <header
          className="col-start-1 md:col-start-2 col-span-2 md:col-span-1 flex items-center px-4 md:px-5 gap-3 md:gap-4 z-20 border-b"
          style={{
            background: "var(--surface-overlay)",
            backdropFilter: "blur(12px)",
            borderColor: "var(--border-base)",
          }}
        >
          <div
            className="md:hidden w-8 h-8 rounded-md flex items-center justify-center font-semibold shrink-0"
            style={{
              background: "var(--surface-rail)",
              color: "#e8e4d8",
              fontFamily: "var(--font-cormorant)",
              fontStyle: "italic",
              boxShadow: "inset 0 0 0 1px rgba(154,171,126,0.30)",
            }}
          >
            A
          </div>
          <div className="hidden md:block">
            <Breadcrumb />
          </div>
          <div className="flex-1 max-w-xl mx-auto">
            <CommandPill />
          </div>
          <button
            aria-label="Voice command"
            className="w-9 h-9 rounded-full grid place-items-center transition-[transform,background-color,border-color,box-shadow] duration-[160ms] ease-out active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9aab7e]/60 shrink-0"
            style={{
              color: "var(--text-accent)",
              border: "1px solid var(--border-base)",
              background: "transparent",
            }}
          >
            <Icon name="mic" />
          </button>
          <div className="md:hidden">
            <ThemeToggle />
          </div>
          <div className="text-right leading-tight hidden sm:block shrink-0">
            <p
              className="text-[10px] tracking-[0.18em] uppercase"
              style={{ fontFamily: "var(--font-ibm-mono)", color: "var(--text-muted)" }}
            >
              Tue · Apr 12
            </p>
            <p className="text-[11px] font-medium" style={{ color: "var(--text-accent)" }}>
              Caleb Jackson
            </p>
          </div>
        </header>

        {/* ── MAIN CANVAS ─────────────────────────── */}
        <main className="col-start-1 md:col-start-2 col-span-2 md:col-span-1 px-4 md:px-8 pt-5 md:pt-6 pb-[140px] md:pb-6">
          {/* Hero stat row */}
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
                Q2 · 2026
              </p>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-12 gap-3 md:gap-5 items-stretch">
              {/* Anchor */}
              <div className="col-span-2 lg:col-span-6 ulb-card-float ulb-tilt ulb-specular p-5 md:p-6 overflow-hidden">
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span
                    className="ulb-num text-[44px] md:text-[60px] leading-none tracking-[-0.02em]"
                    style={{ color: "var(--text-strong)", fontWeight: 500 }}
                  >
                    ${HERO_STATS.pipelineMillions.toFixed(2)}M
                  </span>
                  <span
                    className="text-[12px] tracking-[0.18em] uppercase"
                    style={{ fontFamily: "var(--font-ibm-mono)", color: "var(--text-accent)" }}
                  >
                    active
                  </span>
                </div>
                <p
                  className="mt-2 text-[14px] md:text-[15px]"
                  style={{ fontFamily: "var(--font-cormorant)", fontStyle: "italic", color: "var(--text-soft)" }}
                >
                  Three moves today. The day clears after lunch.
                </p>
                <Sparkline />
              </div>

              <StatTile label="Active" value={HERO_STATS.active.toString()} caption="deals in pipeline" />
              <StatTile label="Closing" value={HERO_STATS.closingThisWeek.toString()} caption="≤ 7 days" tone="warning" />
              <StatTile label="Overdue" value={HERO_STATS.overdue.toString()} caption="needs attention" tone="error" extraClasses="col-span-2 lg:col-span-2" />
            </div>
          </section>

          {/* View tabs */}
          <div
            className="flex items-end justify-between mb-3 border-b overflow-x-auto"
            style={{ borderColor: "var(--border-base)" }}
          >
            <nav className="flex gap-1 min-w-0 flex-shrink-0">
              {VIEW_TABS.map((tab) => (
                <button
                  key={tab.id}
                  className="relative px-3 pb-2.5 pt-2 text-[13px] tracking-tight transition-[color,opacity] duration-[160ms] ease-out focus-visible:outline-none whitespace-nowrap"
                  style={{
                    color: tab.active ? "var(--text-strong)" : "var(--text-muted)",
                    fontWeight: tab.active ? 500 : 400,
                  }}
                >
                  {tab.label}
                  <span
                    className="ml-1.5 text-[10px] tracking-wider align-text-top"
                    style={{ fontFamily: "var(--font-ibm-mono)", color: "var(--text-muted)" }}
                  >
                    {tab.count}
                  </span>
                  {tab.active && (
                    <span
                      className="absolute -bottom-px left-2 right-2 h-[2px] rounded-full"
                      style={{ background: "var(--text-accent)", boxShadow: "0 0 12px var(--glow-hairline)" }}
                    />
                  )}
                </button>
              ))}
            </nav>
            <div className="flex gap-2 pb-2 pl-3 shrink-0">
              <button
                className="hidden md:inline-block text-[11px] uppercase tracking-[0.1em] rounded-md px-3 py-1.5 transition-[background-color,border-color,transform,box-shadow] duration-[160ms] ease-out active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9aab7e]/60"
                style={{
                  color: "var(--text-accent)",
                  border: "1px solid var(--border-base)",
                  background: "transparent",
                }}
              >
                Density
              </button>
              <button
                className="text-[11px] uppercase tracking-[0.1em] rounded-md px-3 py-1.5 transition-[background-color,transform,box-shadow] duration-[160ms] ease-out active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9aab7e]/60"
                style={{
                  color: "var(--accent-primary-fg)",
                  background: "var(--accent-primary-bg)",
                  border: "1px solid var(--accent-primary-bg)",
                  boxShadow: "var(--glow-cta)",
                }}
              >
                + New deal
              </button>
            </div>
          </div>

          {/* Two-column grid (lg) / stacked (mobile+tablet) */}
          <div className="grid gap-5 md:gap-6 lg:grid-cols-[1fr_320px]" style={{ perspective: "1600px" }}>
            <div>
              {/* Desktop + tablet table */}
              <div className="hidden md:block ulb-card-float ulb-specular ulb-tilt overflow-hidden">
                <table className="w-full text-left text-[13px]" style={{ color: "var(--text-body)" }}>
                  <thead>
                    <tr style={{ background: "var(--surface-card-soft)", borderBottom: "1px solid var(--border-base)" }}>
                      {[
                        { label: "Property", align: "left",  showAt: "md" },
                        { label: "Party",    align: "left",  showAt: "md" },
                        { label: "Status",   align: "left",  showAt: "md" },
                        { label: "Next",     align: "left",  showAt: "md" },
                        { label: "Closing",  align: "right", showAt: "lg" },
                        { label: "Value",    align: "right", showAt: "md" },
                      ].map((h) => (
                        <th
                          key={h.label}
                          className={`px-4 py-2.5 text-[10px] uppercase tracking-[0.12em] font-medium ${h.align === "right" ? "text-right" : ""} ${h.showAt === "lg" ? "hidden lg:table-cell" : ""}`}
                          style={{ color: "var(--text-muted)", fontFamily: "var(--font-body)" }}
                        >
                          {h.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {TRANSACTIONS.map((t) => (
                      <tr
                        key={t.id}
                        className="ulb-row border-b last:border-0 cursor-pointer"
                        style={{ borderColor: "var(--border-soft)" }}
                      >
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            {t.pinned && <span style={{ color: "#b5956a" }} title="Pinned">★</span>}
                            <span style={{ color: "var(--text-strong)", fontWeight: 500 }}>{t.address}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5" style={{ color: "var(--text-soft)" }}>
                          {t.party}
                        </td>
                        <td className="px-4 py-3.5">
                          <StatusChip tone={t.statusTone}>{t.status}</StatusChip>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <UrgencyDot urgency={t.dueIn} />
                            <span style={{ color: "var(--text-soft)" }}>{t.next}</span>
                            <span
                              className="text-[11px]"
                              style={{ fontFamily: "var(--font-ibm-mono)", color: "var(--text-muted)" }}
                            >
                              · {t.dueIn}
                            </span>
                          </div>
                        </td>
                        <td
                          className="hidden lg:table-cell px-4 py-3.5 text-right"
                          style={{ fontFamily: "var(--font-ibm-mono)", color: "var(--text-soft)" }}
                        >
                          {t.closing}
                        </td>
                        <td
                          className="px-4 py-3.5 text-right tabular-nums"
                          style={{ fontFamily: "var(--font-ibm-mono)", color: "var(--text-strong)" }}
                        >
                          ${t.value}K
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile card stack */}
              <div className="md:hidden space-y-2.5">
                {TRANSACTIONS.map((t) => (
                  <DealCard key={t.id} txn={t} />
                ))}
              </div>

              {/* Interactive states strip */}
              <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
                <button
                  className="text-[11px] uppercase tracking-[0.1em] rounded-md px-3 py-1.5 transition-[background-color,transform,box-shadow] duration-[160ms] ease-out active:translate-y-px hover:-translate-y-px"
                  style={{
                    color: "var(--accent-primary-fg)",
                    background: "var(--accent-primary-bg)",
                    boxShadow: "var(--glow-cta)",
                  }}
                >
                  Primary
                </button>
                <button
                  className="text-[11px] uppercase tracking-[0.1em] rounded-md px-3 py-1.5 transition-[background-color,transform] duration-[160ms] ease-out active:translate-y-px"
                  style={{
                    color: "var(--text-accent)",
                    border: "1px solid var(--text-accent)",
                    background: "transparent",
                  }}
                >
                  Secondary
                </button>
                <button
                  disabled
                  className="text-[11px] uppercase tracking-[0.1em] rounded-md px-3 py-1.5 opacity-50 cursor-not-allowed"
                  style={{ color: "var(--text-muted)", border: "1px solid var(--border-base)" }}
                >
                  Disabled
                </button>
                <button
                  className="text-[11px] uppercase tracking-[0.1em] rounded-md px-3 py-1.5 inline-flex items-center gap-2"
                  style={{ color: "var(--text-accent)", background: "rgba(154,171,126,0.15)" }}
                >
                  <span className="w-3 h-3 rounded-full border-2 border-[#9aab7e]/30 border-t-[#9aab7e] animate-spin" />
                  Loading
                </button>
                <button
                  className="text-[11px] uppercase tracking-[0.1em] rounded-md px-3 py-1.5 transition-[background-color,transform] duration-[160ms] ease-out active:translate-y-px"
                  style={{ color: "#f5f2ea", background: "#8b4a4a" }}
                >
                  Destructive
                </button>
              </div>
            </div>

            {/* Right rail (stacks below on <lg) */}
            <div className="space-y-5">
              {/* Moves today — Deep Forest emphasis card, both themes */}
              <div
                className="ulb-tilt rounded-xl p-5 relative overflow-hidden"
                style={{
                  background: "var(--surface-emph)",
                  color: "var(--text-on-emph)",
                  border: "1px solid var(--border-on-emph)",
                  boxShadow: "var(--shadow-float), inset 0 1px 0 var(--glow-highlight)",
                }}
              >
                <div
                  aria-hidden
                  className="absolute -top-12 -right-12 w-44 h-44 rounded-full opacity-30 blur-3xl"
                  style={{ background: "rgba(154,171,126,0.45)" }}
                />
                <div className="flex items-center justify-between mb-3 relative">
                  <p
                    className="text-[10px] tracking-[0.22em] uppercase"
                    style={{ fontFamily: "var(--font-ibm-mono)", color: "#9aab7e" }}
                  >
                    02 / Moves today
                  </p>
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inset-0 rounded-full bg-[#9aab7e] opacity-60 animate-ping" />
                    <span className="relative rounded-full h-2 w-2 bg-[#9aab7e]" />
                  </span>
                </div>
                <h3
                  className="text-[20px] leading-snug mb-4 relative"
                  style={{ fontFamily: "var(--font-cormorant)", fontStyle: "italic" }}
                >
                  Three things move the day forward.
                </h3>
                <ol className="space-y-3 relative">
                  {MOVES_TODAY.map((m) => (
                    <li key={m.id} className="flex gap-3 items-start">
                      <span
                        className="shrink-0 w-6 h-6 rounded-md grid place-items-center text-[10px]"
                        style={{
                          color: "#9aab7e",
                          border: "1px solid rgba(74,86,56,0.7)",
                          fontFamily: "var(--font-ibm-mono)",
                        }}
                      >
                        {String(m.id).padStart(2, "0")}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] leading-snug" style={{ color: "#e8e4d8" }}>
                          {m.label}
                        </p>
                        <p className="text-[11px] mt-0.5" style={{ color: "#8a9070" }}>
                          <span style={{ fontFamily: "var(--font-ibm-mono)" }}>{m.urgency}</span> · {m.actor}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
                <div
                  className="mt-4 pt-4 flex items-center justify-between text-[11px] relative"
                  style={{ borderTop: "1px solid rgba(74,86,56,0.6)" }}
                >
                  <span style={{ color: "#8a9070" }}>Brief synthesized 08:02</span>
                  <button className="transition-colors duration-[160ms]" style={{ color: "#9aab7e" }}>
                    Open ⌘O →
                  </button>
                </div>
              </div>

              {/* Activity stream */}
              <div className="ulb-card ulb-specular p-5 overflow-hidden">
                <p
                  className="text-[10px] tracking-[0.22em] uppercase mb-3"
                  style={{ fontFamily: "var(--font-ibm-mono)", color: "var(--text-muted)" }}
                >
                  03 / Agent activity
                </p>
                <ul className="space-y-2.5">
                  {ACTIVITY.map((a, i) => (
                    <li
                      key={i}
                      className="ulb-activity-row flex gap-3 text-[12px]"
                      style={{ animationDelay: `${i * 60}ms` }}
                    >
                      <span
                        className="shrink-0"
                        style={{ fontFamily: "var(--font-ibm-mono)", color: "var(--text-muted)" }}
                      >
                        {a.time}
                      </span>
                      <span
                        className={`shrink-0 inline-block w-1 h-1 rounded-full mt-2 ${a.tone === "ok" ? "bg-[#6b7d52]" : "bg-[#7a8e9e]"}`}
                      />
                      <div className="flex-1 min-w-0">
                        <span style={{ color: "var(--text-strong)" }}>{a.actor}</span>
                        <span style={{ color: "var(--text-soft)" }}> — {a.verb}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </main>

        {/* Keyboard dock (md+) */}
        <footer
          className="hidden md:flex col-start-2 items-center px-5 gap-5 text-[11px]"
          style={{
            background: "var(--surface-overlay-2)",
            backdropFilter: "blur(10px)",
            color: "var(--text-muted)",
            borderTop: "1px solid var(--border-base)",
          }}
        >
          <KbdHint k="⌘K" label="Search" />
          <KbdHint k="N"  label="New deal" />
          <KbdHint k="V"  label="Voice" />
          <KbdHint k="J/K" label="Move" />
          <KbdHint k="C"  label="Complete" />
          <div className="flex-1" />
          <span style={{ fontFamily: "var(--font-ibm-mono)" }}>v0.2 · concept B · {initialTheme}</span>
        </footer>

        <MobileBottomBars />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────── sub-components

function RailIcon({ item }: { item: { id: string; icon: string; label: string; badge: string | null; active: boolean } }) {
  return (
    <button
      aria-label={item.label}
      className="relative w-10 h-10 rounded-md grid place-items-center transition-[color,background-color,transform,box-shadow] duration-[160ms] ease-out active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9aab7e] focus-visible:ring-offset-2"
      style={{
        color: item.active ? "var(--text-on-rail-active)" : "var(--text-on-rail)",
        background: item.active ? "rgba(74,86,56,0.50)" : "transparent",
        boxShadow: item.active ? "inset 0 0 0 1px rgba(154,171,126,0.30), inset 0 1px 0 rgba(255,255,255,0.05)" : "none",
        ["--tw-ring-offset-color" as string]: "var(--surface-rail)",
      }}
    >
      <Icon name={item.icon} />
      {item.active && (
        <span
          className="absolute left-0 top-2 bottom-2 w-[2px] rounded-r"
          style={{ background: "#9aab7e", boxShadow: "0 0 10px rgba(154,171,126,0.55)" }}
        />
      )}
      {item.badge && (
        <span
          className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 rounded-full text-[9px] grid place-items-center font-semibold"
          style={{ background: "var(--accent-dot)", color: "#1e2416", fontFamily: "var(--font-ibm-mono)" }}
        >
          {item.badge}
        </span>
      )}
    </button>
  )
}

function CommandPill() {
  return (
    <div
      className="group relative flex items-center gap-3 h-9 px-3.5 rounded-md transition-[border-color,box-shadow] duration-[160ms] ease-out focus-within:ring-2 focus-within:ring-[#9aab7e]/40"
      style={{
        background: "var(--surface-card)",
        border: "1px solid var(--border-base)",
        boxShadow: "inset 0 1px 0 var(--glow-highlight)",
      }}
    >
      <Icon name="search" className="w-3.5 h-3.5" />
      <span className="flex-1 text-[13px] truncate" style={{ color: "var(--text-muted)" }}>
        <span className="hidden sm:inline">Search deals, deadlines, contracts, contacts…</span>
        <span className="sm:hidden">Search…</span>
      </span>
      <Kbd>⌘ K</Kbd>
    </div>
  )
}

function Breadcrumb() {
  return (
    <div className="flex items-center gap-2 text-[12px]" style={{ color: "var(--text-muted)" }}>
      <span style={{ color: "var(--text-strong)", fontWeight: 500 }}>Brief</span>
      <span style={{ color: "var(--text-subtle)" }}>/</span>
      <span>Tue · Apr 12</span>
    </div>
  )
}

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
  tone?: "default" | "warning" | "error"
  extraClasses?: string
}) {
  const dotColor = tone === "warning" ? "#b5956a" : tone === "error" ? "#8b4a4a" : "var(--accent-dot)"
  const valueColor = tone === "error" ? "#c4787a" : tone === "warning" ? "#c69a6a" : "var(--text-strong)"
  return (
    <div className={`col-span-2 lg:col-span-2 ulb-card-elev ulb-tilt ulb-specular px-5 py-5 flex flex-col justify-between overflow-hidden ${extraClasses}`}>
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

function Sparkline() {
  const points = [22, 28, 24, 31, 29, 38, 36, 42, 40, 45, 49, 47, 54, 52, 58, 60, 62, 64]
  const max = Math.max(...points), min = Math.min(...points)
  const w = 320, h = 36
  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w
      const y = h - ((p - min) / (max - min)) * h
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(" ")
  return (
    <div className="mt-4 -ml-1 flex items-end gap-3">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full max-w-[320px] h-9 overflow-visible">
        <path d={path} fill="none" stroke="var(--text-accent)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />
        <path d={`${path} L ${w},${h} L 0,${h} Z`} fill="var(--text-accent)" opacity={0.1} />
      </svg>
      <span
        className="text-[10px] tracking-[0.18em] uppercase pb-1 whitespace-nowrap"
        style={{ fontFamily: "var(--font-ibm-mono)", color: "var(--text-muted)" }}
      >
        90 days
      </span>
    </div>
  )
}

function StatusChip({ children, tone }: { children: React.ReactNode; tone: string }) {
  const map: Record<string, { bg: string; fg: string; border: string }> = {
    active:  { bg: "#e8f0e0", fg: "#4a5638", border: "#9aab7e" },
    pending: { bg: "#f0ece2", fg: "#6b5a3a", border: "#c5a96a" },
    overdue: { bg: "#f5e8e8", fg: "#5a2a2a", border: "#c4a0a0" },
    info:    { bg: "#eaecf0", fg: "#3a4550", border: "#a0aab8" },
    closing: { bg: "#e8f0e0", fg: "#4a5638", border: "#6b7d52" },
  }
  const c = map[tone] || map.info
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
    "2d": "#b5956a",
    "3d": "#6b7d52",
    "4d": "#6b7d52",
    "5d": "#6b7d52",
    "—":  "#c5c9b8",
  }
  return <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: map[urgency] || "#6b7d52" }} />
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      className="text-[10px] px-1.5 py-0.5 rounded"
      style={{
        background: "var(--surface-card-soft)",
        color: "var(--text-accent)",
        border: "1px solid var(--border-base)",
        fontFamily: "var(--font-ibm-mono)",
      }}
    >
      {children}
    </kbd>
  )
}

function KbdHint({ k, label }: { k: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Kbd>{k}</Kbd>
      <span>{label}</span>
    </span>
  )
}

function DealCard({ txn }: { txn: (typeof TRANSACTIONS)[number] }) {
  return (
    <div className="ulb-card ulb-specular p-4 overflow-hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {txn.pinned && <span style={{ color: "#b5956a" }}>★</span>}
            <p className="text-[14px] font-medium truncate" style={{ color: "var(--text-strong)" }}>
              {txn.address}
            </p>
          </div>
          <p className="text-[12px] mt-0.5 truncate" style={{ color: "var(--text-soft)" }}>
            {txn.party}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="ulb-num text-[15px] font-medium tabular-nums" style={{ color: "var(--text-strong)" }}>
            ${txn.value}K
          </p>
          <p className="text-[11px]" style={{ fontFamily: "var(--font-ibm-mono)", color: "var(--text-muted)" }}>
            {txn.closing}
          </p>
        </div>
      </div>
      <div
        className="mt-3 pt-3 flex items-center justify-between gap-2"
        style={{ borderTop: "1px solid var(--border-soft)" }}
      >
        <StatusChip tone={txn.statusTone}>{txn.status}</StatusChip>
        <div className="flex items-center gap-2 text-[12px]">
          <UrgencyDot urgency={txn.dueIn} />
          <span style={{ color: "var(--text-soft)" }}>{txn.next}</span>
          <span style={{ fontFamily: "var(--font-ibm-mono)", color: "var(--text-muted)" }}>· {txn.dueIn}</span>
        </div>
      </div>
    </div>
  )
}

function MobileBottomBars() {
  return (
    <>
      {/* Sticky composer — sits above tab strip on mobile */}
      <div
        className="md:hidden fixed bottom-[60px] left-0 right-0 z-40 px-3 pb-2 pt-2 flex gap-2"
        style={{
          background: "var(--surface-overlay-2)",
          backdropFilter: "blur(14px)",
          borderTop: "1px solid var(--border-soft)",
        }}
      >
        <div
          className="flex-1 flex items-center gap-2 h-10 px-3 rounded-md text-[13px]"
          style={{
            background: "var(--surface-card)",
            color: "var(--text-muted)",
            border: "1px solid var(--border-base)",
            boxShadow: "inset 0 1px 0 var(--glow-highlight)",
          }}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <span className="flex-1">Search…</span>
          <Kbd>⌘ K</Kbd>
        </div>
        <button
          className="h-10 px-4 rounded-md text-[12px] uppercase tracking-[0.1em] active:translate-y-px transition-[transform,box-shadow] duration-[160ms]"
          style={{
            color: "var(--accent-primary-fg)",
            background: "var(--accent-primary-bg)",
            boxShadow: "var(--glow-cta)",
          }}
        >
          + New
        </button>
      </div>

      {/* Bottom tab strip — replaces icon rail on mobile */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 h-[60px] grid grid-cols-5"
        style={{
          background: "var(--surface-rail)",
          borderTop: "1px solid var(--border-rail)",
          boxShadow: "0 -8px 24px rgba(0,0,0,0.18)",
        }}
      >
        {RAIL_ITEMS.slice(0, 5).map((item) => (
          <button
            key={item.id}
            aria-label={item.label}
            className="relative flex flex-col items-center justify-center gap-1 text-[10px] uppercase tracking-[0.06em] transition-colors duration-[160ms]"
            style={{
              color: item.active ? "var(--text-on-rail-active)" : "var(--text-on-rail)",
              fontFamily: "var(--font-ibm-mono)",
            }}
          >
            <Icon name={item.icon} className="w-[18px] h-[18px]" />
            <span className="text-[9px]">{item.label}</span>
            {item.active && (
              <span
                className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] rounded-b"
                style={{ background: "#9aab7e", boxShadow: "0 0 10px rgba(154,171,126,0.55)" }}
              />
            )}
            {item.badge && (
              <span
                className="absolute top-1.5 right-1/2 translate-x-3 min-w-[14px] h-[14px] px-1 rounded-full text-[9px] grid place-items-center font-semibold"
                style={{ background: "var(--accent-dot)", color: "#1e2416", fontFamily: "var(--font-ibm-mono)" }}
              >
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </nav>
    </>
  )
}

function Icon({ name, className = "w-4 h-4" }: { name: string; className?: string }) {
  const props = {
    className,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  }
  switch (name) {
    case "sun":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5" />
        </svg>
      )
    case "deals":
      return (
        <svg {...props}>
          <path d="M3 7h18M3 12h18M3 17h18" />
        </svg>
      )
    case "inbox":
      return (
        <svg {...props}>
          <path d="M22 12h-6l-2 3h-4l-2-3H2" />
          <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
        </svg>
      )
    case "sign":
      return (
        <svg {...props}>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
      )
    case "users":
      return (
        <svg {...props}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      )
    case "chart":
      return (
        <svg {...props}>
          <path d="M3 3v18h18" />
          <path d="M7 14l4-4 4 4 5-7" />
        </svg>
      )
    case "tools":
      return (
        <svg {...props}>
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      )
    case "cog":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.65 1.65 0 0 0-1.8-.3 1.65 1.65 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.65 1.65 0 0 0-1-1.5 1.65 1.65 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.65 1.65 0 0 0 .3-1.8 1.65 1.65 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.65 1.65 0 0 0 1.5-1 1.65 1.65 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.65 1.65 0 0 0 1.8.3h0a1.65 1.65 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.65 1.65 0 0 0 1 1.5h0a1.65 1.65 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.65 1.65 0 0 0-.3 1.8v0a1.65 1.65 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.65 1.65 0 0 0-1.5 1z" />
        </svg>
      )
    case "mic":
      return (
        <svg {...props} className={className || "w-4 h-4"}>
          <rect x="9" y="2" width="6" height="12" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0" />
          <path d="M12 19v3" />
        </svg>
      )
    case "search":
      return (
        <svg {...props}>
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      )
    default:
      return null
  }
}
