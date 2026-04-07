"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { VoiceOverlay } from "@/components/VoiceOverlay"

// Primary nav: agent daily operating system
const NAV_ITEMS = [
  { href: "/aire", label: "Brief", icon: "sun" },
  { href: "/aire/email", label: "Inbox", icon: "mail" },
  { href: "/aire/transactions", label: "Deals", icon: "folder" },
  { href: "/aire/relationships", label: "Contacts", icon: "users" },
  { href: "/aire/intelligence", label: "Market", icon: "chart" },
]

// Secondary — quiet, bottom of sidebar
const SECONDARY_ITEMS = [
  { href: "/airsign", label: "AirSign", icon: "pen" },
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
    credit: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
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
    settings: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  }
  return <>{icons[name] || null}</>
}

// Voice command mic button — Siri-style
function VoiceButton({ onActivate }: { onActivate: () => void }) {
  return (
    <button
      onClick={onActivate}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-forest-deep text-cream text-sm font-medium transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] group"
    >
      <div className="w-9 h-9 rounded-full bg-sage/20 flex items-center justify-center group-hover:bg-sage/30 transition-colors shrink-0">
        <svg className="w-4.5 h-4.5 text-sage" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      </div>
      <div className="text-left">
        <span className="block text-sm">Ask AIRE</span>
        <span className="block text-[10px] text-cream/50 font-normal">Voice or type a command</span>
      </div>
    </button>
  )
}

export function DarkLayout({ children, activeCount = 0, overdueCount = 0 }: { children: React.ReactNode; activeCount?: number; overdueCount?: number }) {
  const pathname = usePathname()
  const [voiceOpen, setVoiceOpen] = useState(false)

  return (
    <div className="min-h-screen flex">
      {/* Sidebar — cream/white bg, forest text for contrast */}
      <aside className="hidden md:flex flex-col w-[220px] fixed inset-y-0 left-0 z-40 bg-cream border-r border-olive/10">
        {/* Logo */}
        <div className="h-14 flex items-center px-5 border-b border-olive/10">
          <Link href="/aire" className="flex items-center gap-2.5 no-underline">
            <div className="w-7 h-7 rounded-full bg-forest-deep flex items-center justify-center font-display text-xs italic text-cream">
              A
            </div>
            <span className="font-display text-sm italic text-forest-deep">AIRE</span>
          </Link>
        </div>

        {/* Voice command — Siri-style, top of nav */}
        <div className="px-3 pt-4 pb-2">
          <VoiceButton onActivate={() => setVoiceOpen(!voiceOpen)} />
        </div>

        {/* Primary nav */}
        <nav className="flex-1 py-2 px-3 space-y-0.5 overflow-y-auto">
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
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm no-underline transition-all ${
                  isActive
                    ? "bg-forest-deep/10 text-forest-deep font-medium"
                    : "text-olive hover:text-forest-deep hover:bg-forest-deep/5"
                }`}
              >
                <NavIcon name={item.icon} className="w-[18px] h-[18px] shrink-0" />
                {item.label}
                {badge !== null && (
                  <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    item.href === "/aire" ? "bg-[#c45c5c]/15 text-[#c45c5c]" : "bg-sage/15 text-sage"
                  }`}>
                    {badge}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Secondary — AirSign, Settings, quiet at bottom */}
        <div className="px-3 py-3 border-t border-olive/10 space-y-0.5">
          {SECONDARY_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs no-underline transition-all ${
                  isActive
                    ? "text-forest-deep bg-forest-deep/10"
                    : "text-olive/60 hover:text-olive"
                }`}
              >
                <NavIcon name={item.icon} className="w-3.5 h-3.5 shrink-0" />
                {item.label}
              </Link>
            )
          })}
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs text-olive/60 hover:text-olive no-underline transition-colors"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
            </svg>
            Back to site
          </Link>
        </div>
      </aside>

      {/* Mobile top bar — cream bg matching sidebar */}
      <nav className="md:hidden fixed top-0 inset-x-0 z-50 bg-cream/95 backdrop-blur-xl border-b border-olive/10">
        <div className="px-4 h-14 flex items-center justify-between">
          <Link href="/aire" className="flex items-center gap-2 no-underline">
            <div className="w-7 h-7 rounded-full bg-forest-deep flex items-center justify-center font-display text-xs italic text-cream">
              A
            </div>
            <span className="font-display text-base italic text-forest-deep">AIRE</span>
          </Link>
          <div className="flex items-center gap-2">
            {overdueCount > 0 && (
              <span className="text-[10px] px-2 py-1 rounded-full bg-[#c45c5c]/15 text-[#c45c5c]">
                {overdueCount} overdue
              </span>
            )}
            <button
              onClick={() => setVoiceOpen(!voiceOpen)}
              className="w-8 h-8 rounded-full bg-forest-deep flex items-center justify-center"
            >
              <svg className="w-4 h-4 text-cream" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile bottom tab bar — cream bg */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-cream/95 backdrop-blur-xl border-t border-olive/10 pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5 h-16">
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
                  isActive ? "text-forest-deep" : "text-olive/40"
                }`}
              >
                <NavIcon name={item.icon} className="w-5 h-5" />
                <span className="text-[10px] tracking-wide">{item.label}</span>
                {badge !== null && (
                  <span className={`absolute top-1.5 right-[22%] text-[9px] px-1 py-0.5 rounded-full min-w-[14px] text-center ${
                    item.href === "/aire" ? "bg-[#c45c5c] text-cream" : "bg-sage text-cream"
                  }`}>
                    {badge}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Main content — dark bg, contrasts with cream sidebar */}
      <main className="flex-1 md:ml-[220px] pt-14 md:pt-0 pb-20 md:pb-0 min-h-screen bg-forest-deep text-cream">
        {children}
      </main>

      {/* Voice command overlay — real, working voice/text interface */}
      <VoiceOverlay open={voiceOpen} onClose={() => setVoiceOpen(false)} />
    </div>
  )
}
