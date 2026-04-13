"use client"

import { useEffect, useState } from "react"

// EXPERIMENT 05 — Command Bar Opening
// Full ⌘K entrance sequence: backdrop blur-in (0 → 12px) + card
// scale(0.94 → 1) + rotateX(-8° → 0) + 6-item content stagger (40ms each).
// 260ms total. Zero library, pure CSS transitions on transform+opacity.
// Press ⌘K / Ctrl+K or click the pill to open. Esc to close.

const SUGGESTIONS = [
  { kbd: "→", label: "Create new deal", section: "Quick actions" },
  { kbd: "→", label: "Write contract for 554 Avenue F", section: "Quick actions" },
  { kbd: "→", label: "Run compliance scan — 5834 Guice", section: "Quick actions" },
  { kbd: "",  label: "J. Smith — 5834 Guice Dr", section: "Deals" },
  { kbd: "",  label: "L. Nuñez — 1420 Perkins Rd", section: "Deals" },
  { kbd: "",  label: "R. Davis — 7822 Coursey Blvd", section: "Deals" },
] as const

export default function CommandBarOpeningExperiment() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((v) => !v)
      } else if (e.key === "Escape") {
        setOpen(false)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return (
    <div className="min-h-screen w-full bg-[#f5f2ea] text-[#2c3520] p-10" style={{ fontFamily: "var(--font-body)" }}>
      <div className="max-w-3xl mx-auto">
        <p
          className="text-[10px] tracking-[0.22em] uppercase text-[#6b7d52] mb-2"
          style={{ fontFamily: "var(--font-ibm-mono)" }}
        >
          Experiment 05
        </p>
        <h1
          className="text-[#1e2416] text-4xl mb-4"
          style={{ fontFamily: "var(--font-cormorant)", fontStyle: "italic", fontWeight: 500 }}
        >
          Command Bar Opening
        </h1>
        <p className="text-[14px] leading-relaxed text-[#4a5638] max-w-xl mb-10">
          Press <Kbd>⌘ K</Kbd> or click the pill below. The card scales up,
          tilts back from −8°, and its six rows stagger in 40ms apart. Esc closes.
          Total sequence: 260ms.
        </p>

        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-3 h-10 px-4 rounded-md transition-[border-color,box-shadow] duration-[160ms]"
          style={{
            background: "#f0ece2",
            border: "1px solid #c5c9b8",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6)",
          }}
        >
          <svg className="w-4 h-4 text-[#8a9070]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <span className="text-[13px] text-[#8a9070]">Search deals, deadlines, contracts…</span>
          <Kbd>⌘ K</Kbd>
        </button>
      </div>

      {/* Backdrop + dialog */}
      <div
        aria-hidden={!open}
        className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-6"
        style={{
          background: "rgba(30,36,22,0.55)",
          backdropFilter: open ? "blur(12px)" : "blur(0px)",
          WebkitBackdropFilter: open ? "blur(12px)" : "blur(0px)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 260ms cubic-bezier(0.2, 0.8, 0.2, 1), backdrop-filter 260ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        }}
        onClick={() => setOpen(false)}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-xl rounded-xl overflow-hidden"
          style={{
            background: "#f0ece2",
            border: "1px solid #c5c9b8",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.7), 0 24px 64px rgba(30,36,22,0.35), 0 48px 96px rgba(30,36,22,0.22)",
            transformOrigin: "center top",
            transform: open
              ? "perspective(900px) scale(1) rotateX(0deg) translateY(0px)"
              : "perspective(900px) scale(0.94) rotateX(-8deg) translateY(-8px)",
            opacity: open ? 1 : 0,
            transition:
              "transform 260ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 220ms cubic-bezier(0.2, 0.8, 0.2, 1)",
            willChange: "transform, opacity",
          }}
        >
          <div className="flex items-center gap-3 px-4 h-12 border-b border-[#c5c9b8]">
            <svg className="w-4 h-4 text-[#6b7d52]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              autoFocus={open}
              placeholder="Type a command or search…"
              className="flex-1 bg-transparent outline-none text-[14px] text-[#1e2416] placeholder:text-[#8a9070]"
            />
            <Kbd>esc</Kbd>
          </div>

          <ul className="py-2">
            {SUGGESTIONS.map((s, i) => {
              const showSectionLabel = i === 0 || SUGGESTIONS[i - 1].section !== s.section
              return (
                <li key={i}>
                  {showSectionLabel && (
                    <div
                      className="px-4 pt-3 pb-1.5 text-[10px] tracking-[0.18em] uppercase text-[#8a9070]"
                      style={{
                        fontFamily: "var(--font-ibm-mono)",
                        opacity: open ? 1 : 0,
                        transition: `opacity 220ms ease-out ${i * 40 + 40}ms`,
                      }}
                    >
                      {s.section}
                    </div>
                  )}
                  <button
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-[#f5f2ea] transition-colors duration-[120ms] group"
                    style={{
                      opacity: open ? 1 : 0,
                      transform: open ? "translateY(0)" : "translateY(6px)",
                      transition: `opacity 240ms ease-out ${i * 40 + 60}ms, transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1) ${i * 40 + 60}ms`,
                    }}
                  >
                    {s.kbd && (
                      <span
                        className="w-5 h-5 shrink-0 grid place-items-center text-[11px] text-[#6b7d52]"
                        style={{ fontFamily: "var(--font-ibm-mono)" }}
                      >
                        {s.kbd}
                      </span>
                    )}
                    {!s.kbd && (
                      <span className="w-5 h-5 shrink-0 rounded bg-[#9aab7e]/20" />
                    )}
                    <span className="flex-1 text-[14px] text-[#1e2416]">{s.label}</span>
                    <span
                      className="text-[11px] text-[#8a9070] opacity-0 group-hover:opacity-100 transition-opacity duration-[160ms]"
                      style={{ fontFamily: "var(--font-ibm-mono)" }}
                    >
                      ↵
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>

          <div
            className="px-4 py-2.5 border-t border-[#c5c9b8] text-[11px] text-[#8a9070] flex items-center gap-5"
            style={{ fontFamily: "var(--font-ibm-mono)" }}
          >
            <span className="flex items-center gap-1.5">
              <Kbd>↑ ↓</Kbd> navigate
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>↵</Kbd> select
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>esc</Kbd> close
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      className="text-[10px] px-1.5 py-0.5 rounded border border-[#c5c9b8] bg-[#f5f2ea] text-[#6b7d52]"
      style={{ fontFamily: "var(--font-ibm-mono)" }}
    >
      {children}
    </kbd>
  )
}
