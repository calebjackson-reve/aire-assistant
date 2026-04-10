"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { VoiceOverlay } from "@/components/VoiceOverlay"

const NAV_ITEMS = [
  { href: "/aire", label: "Brief", icon: "sun", desc: "Daily overview" },
  { href: "/aire/email", label: "Inbox", icon: "mail", desc: "Email triage" },
  { href: "/aire/transactions", label: "Deals", icon: "folder", desc: "Transaction pipeline" },
  { href: "/airsign", label: "AirSign", icon: "pen", desc: "Electronic signing" },
  { href: "/aire/relationships", label: "Contacts", icon: "users", desc: "Relationship intel" },
  { href: "/aire/intelligence", label: "Market", icon: "chart", desc: "Market data" },
  { href: "/aire/transcript-tasks", label: "Tasks", icon: "list", desc: "Transcript to tasks" },
]

const MORE_ITEMS = [
  { href: "/aire/documents", label: "Documents", icon: "file", desc: "Upload & classify" },
  { href: "/aire/contracts", label: "Contracts", icon: "file", desc: "Write & manage" },
  { href: "/aire/compliance", label: "Compliance", icon: "shield", desc: "LA rules engine" },
  { href: "/aire/communications", label: "Comms", icon: "mail", desc: "All communications" },
  { href: "/aire/morning-brief", label: "Morning Brief", icon: "sun", desc: "Daily AI brief" },
  { href: "/aire/monitoring", label: "Monitoring", icon: "monitor", desc: "Agent health" },
  { href: "/aire/research", label: "Research", icon: "chart", desc: "Learning metrics" },
  { href: "/aire/data-health", label: "Data Health", icon: "monitor", desc: "Pipeline status" },
  { href: "/aire/voice-analytics", label: "Voice", icon: "mic", desc: "Voice analytics" },
  { href: "/aire/mls-input", label: "MLS Input", icon: "file", desc: "Auto-fill Paragon" },
]

const SECONDARY_ITEMS = [
  { href: "/aire/settings", label: "Settings", icon: "settings" },
]

function NavIcon({ name, className }: { name: string; className?: string }) {
  const icons: Record<string, React.ReactNode> = {
    sun: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </svg>
    ),
    users: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    pen: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    ),
    folder: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
    ),
    chart: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
    mail: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
      </svg>
    ),
    list: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
      </svg>
    ),
    file: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
      </svg>
    ),
    shield: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    monitor: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
    mic: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
      </svg>
    ),
    settings: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  }
  return <>{icons[name] || null}</>
}

export function DarkLayout({ children, activeCount = 0, overdueCount = 0 }: { children: React.ReactNode; activeCount?: number; overdueCount?: number }) {
  const pathname = usePathname()
  const [voiceOpen, setVoiceOpen] = useState(false)

  return (
    <div className="min-h-screen flex bg-[#f5f2ea]">
      {/* ── Sidebar ── */}
      <aside className="hidden md:flex flex-col w-[240px] fixed inset-y-0 left-0 z-40 bg-white border-r border-[#d4c8b8]/40">
        {/* Logo */}
        <div className="h-16 flex items-center px-5 border-b border-[#d4c8b8]/20">
          <Link href="/aire" className="flex items-center gap-3 no-underline group">
            <div className="w-8 h-8 rounded-lg bg-[#6b7d52] flex items-center justify-center font-display text-sm italic text-[#f5f2ea] group-hover:bg-[#5a6c44] transition-colors">
              A
            </div>
            <div>
              <span className="font-display text-sm italic text-[#1e2416] block leading-none">AIRE</span>
              <span className="font-mono text-[9px] text-[#6b7d52] tracking-wider uppercase">Intelligence</span>
            </div>
          </Link>
        </div>

        {/* Primary nav */}
        <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/aire"
                ? pathname === "/aire" || pathname === "/aire/morning-brief"
                : pathname === item.href || pathname.startsWith(item.href + "/")
            const badge =
              item.href === "/aire/transactions" && activeCount > 0 ? activeCount :
              item.href === "/aire" && overdueCount > 0 ? overdueCount :
              null
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link-hover relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] no-underline transition-all duration-200 ${
                  isActive
                    ? "bg-[#9aab7e]/15 text-[#1e2416] font-medium nav-link-active"
                    : "text-[#6a6a60] hover:text-[#1e2416]"
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-[#6b7d52]" />
                )}
                <NavIcon name={item.icon} className="w-[18px] h-[18px] shrink-0" />
                <span className="flex-1">{item.label}</span>
                {badge !== null && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-medium ${
                    item.href === "/aire" ? "bg-[#D45B5B]/15 text-[#D45B5B]" : "bg-[#6b7d52]/15 text-[#6b7d52]"
                  }`}>
                    {badge}
                  </span>
                )}
              </Link>
            )
          })}
          {/* More section */}
          <div className="mt-4 pt-3 border-t border-[#d4c8b8]/20">
            <span className="px-3 text-[10px] font-mono uppercase tracking-wider text-[#9a9a90]">More</span>
            <div className="mt-2 space-y-0.5">
              {MORE_ITEMS.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[12px] no-underline transition-all duration-200 ${
                      isActive
                        ? "bg-[#9aab7e]/15 text-[#1e2416] font-medium"
                        : "text-[#9a9a90] hover:text-[#1e2416] hover:bg-[#9aab7e]/8"
                    }`}
                  >
                    <NavIcon name={item.icon} className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        </nav>

        {/* Secondary — Settings, Back */}
        <div className="px-3 py-3 border-t border-[#d4c8b8]/20 space-y-0.5">
          {SECONDARY_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs no-underline transition-colors ${
                  isActive
                    ? "text-[#1e2416] bg-[#9aab7e]/10"
                    : "text-[#9a9a90] hover:text-[#6a6a60] hover:bg-[#9aab7e]/5"
                }`}
              >
                <NavIcon name={item.icon} className="w-3.5 h-3.5 shrink-0" />
                {item.label}
              </Link>
            )
          })}
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-[#beb09e] hover:text-[#6a6a60] no-underline transition-colors"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
            </svg>
            Back to site
          </Link>
        </div>
      </aside>

      {/* ── Mobile top bar ── */}
      <nav className="md:hidden fixed top-0 inset-x-0 z-50 bg-white/95 backdrop-blur-xl border-b border-[#d4c8b8]/30">
        <div className="px-4 h-14 flex items-center justify-between">
          <Link href="/aire" className="flex items-center gap-2.5 no-underline">
            <div className="w-7 h-7 rounded-lg bg-[#6b7d52] flex items-center justify-center font-display text-xs italic text-[#f5f2ea]">
              A
            </div>
            <span className="font-display text-base italic text-[#1e2416]">AIRE</span>
          </Link>
          <div className="flex items-center gap-2">
            {overdueCount > 0 && (
              <span className="text-[10px] px-2 py-1 rounded-full bg-[#D45B5B]/15 text-[#D45B5B] font-mono">
                {overdueCount}
              </span>
            )}
            <button
              onClick={() => setVoiceOpen(!voiceOpen)}
              className="w-9 h-9 rounded-lg bg-[#9aab7e]/15 flex items-center justify-center hover:bg-[#9aab7e]/25 transition-colors"
            >
              <svg className="w-4 h-4 text-[#6b7d52]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* ── Mobile bottom tab bar ── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white/95 backdrop-blur-xl border-t border-[#d4c8b8]/30 pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-7 h-16">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/aire"
                ? pathname === "/aire" || pathname === "/aire/morning-brief"
                : pathname === item.href || pathname.startsWith(item.href + "/")
            const badge =
              item.href === "/aire/transactions" && activeCount > 0 ? activeCount :
              item.href === "/aire" && overdueCount > 0 ? overdueCount :
              null
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex flex-col items-center justify-center gap-1 no-underline transition-colors ${
                  isActive ? "text-[#6b7d52]" : "text-[#beb09e]"
                }`}
              >
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-[2px] rounded-b bg-[#6b7d52]" />
                )}
                <NavIcon name={item.icon} className="w-5 h-5" />
                <span className="text-[10px] tracking-wide">{item.label}</span>
                {badge !== null && (
                  <span className={`absolute top-1 right-[22%] text-[9px] px-1 py-0.5 rounded-full min-w-[14px] text-center font-mono text-white ${
                    item.href === "/aire" ? "bg-[#D45B5B]" : "bg-[#6b7d52]"
                  }`}>
                    {badge}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* ── Main content ── */}
      <main className="flex-1 md:ml-[240px] pt-14 md:pt-[56px] pb-20 md:pb-0 min-h-screen bg-[#f5f2ea] text-[#1e2416]">
        {/* Ask AIRE — sticky top command bar */}
        <div className="hidden md:block fixed top-0 right-0 left-[240px] z-30 bg-white/90 backdrop-blur-xl border-b border-[#d4c8b8]/30">
          <div className="max-w-3xl mx-auto px-6 py-2.5">
            <button
              onClick={() => setVoiceOpen(!voiceOpen)}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg bg-[#f5f2ea] border border-[#d4c8b8]/40 text-sm transition-all duration-200 hover:bg-[#efe9e0] hover:border-[#9aab7e]/40 hover:shadow-[0_0_20px_rgba(154,171,126,0.1)] group"
            >
              <svg className="w-4 h-4 text-[#9aab7e] group-hover:text-[#6b7d52] transition-colors shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
              </svg>
              <span className="text-[#9a9a90] text-[13px] flex-1 text-left">Ask AIRE anything... &quot;write a contract for 554 Avenue F&quot;</span>
              <div className="flex items-center gap-2">
                <kbd className="inline-flex items-center px-1.5 py-0.5 rounded bg-[#9aab7e]/10 text-[#6b7d52]/50 font-mono text-[10px] border border-[#9aab7e]/15">
                  /
                </kbd>
                <span className="text-[#beb09e] text-[10px]">voice or type</span>
              </div>
            </button>
          </div>
        </div>
        {children}
      </main>

      {/* Voice command overlay */}
      <VoiceOverlay open={voiceOpen} onClose={() => setVoiceOpen(false)} />
    </div>
  )
}
