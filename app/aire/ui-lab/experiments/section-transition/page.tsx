"use client"

import { useState, type ReactNode } from "react"

// EXPERIMENT 06 — Section Transition
// Cross-section morph using the native View Transitions API where supported
// (Chrome 111+, Safari 18+, Edge). Zero-dep fallback: opacity + translateY
// tween with matching timing. No framer-motion, no libraries — one page
// route that swaps between three pseudo-sections demonstrating the morph.

const SECTIONS = [
  {
    id: "brief",
    eyebrow: "01 / Brief",
    title: "Good morning, Caleb.",
    body: "Eighteen active deals. Three moves today. The day clears after lunch.",
    accent: "#9aab7e",
  },
  {
    id: "deals",
    eyebrow: "02 / Deals",
    title: "A clean pipeline.",
    body: "$3.38M in flight. Seven closed YTD. Average days on market: 10.",
    accent: "#6b7d52",
  },
  {
    id: "market",
    eyebrow: "03 / Market",
    title: "Baton Rouge, right now.",
    body: "Median list $289K, trending +3.1%. Inventory normalizing after Q1 squeeze.",
    accent: "#1e2416",
  },
] as const

type SectionId = (typeof SECTIONS)[number]["id"]

// Narrow type for the View Transitions API (not in lib.dom.d.ts for older TS)
type DocumentWithVT = Document & {
  startViewTransition?: (cb: () => void) => { finished: Promise<void> }
}

export default function SectionTransitionExperiment() {
  const [active, setActive] = useState<SectionId>("brief")
  const current = SECTIONS.find((s) => s.id === active)!

  function go(id: SectionId) {
    if (id === active) return
    const doc = document as DocumentWithVT
    if (doc.startViewTransition) {
      doc.startViewTransition(() => setActive(id))
    } else {
      setActive(id) // fallback relies on CSS transitions below
    }
  }

  return (
    <div className="min-h-screen w-full bg-[#f5f2ea] text-[#2c3520]" style={{ fontFamily: "var(--font-body)" }}>
      <ViewTransitionStyles />

      <div className="max-w-3xl mx-auto px-10 pt-10">
        <p
          className="text-[10px] tracking-[0.22em] uppercase text-[#6b7d52] mb-2"
          style={{ fontFamily: "var(--font-ibm-mono)" }}
        >
          Experiment 06
        </p>
        <h1
          className="text-[#1e2416] text-4xl mb-4"
          style={{ fontFamily: "var(--font-cormorant)", fontStyle: "italic", fontWeight: 500 }}
        >
          Section Transition
        </h1>
        <p className="text-[14px] leading-relaxed text-[#4a5638] max-w-xl mb-10">
          Click the tabs below. On Chromium / Safari 18+, the View Transitions API cross-fades and
          morphs the shared elements automatically. In older browsers the fallback is an opacity +
          translateY tween keyed on React state. Same visual, no library.
        </p>

        <nav className="flex gap-1 mb-10 border-b border-[#c5c9b8]">
          {SECTIONS.map((s) => {
            const on = s.id === active
            return (
              <button
                key={s.id}
                onClick={() => go(s.id)}
                className="relative px-4 pb-3 pt-2 text-[13px] tracking-tight transition-[color] duration-[160ms] focus-visible:outline-none"
                style={{ color: on ? "#1e2416" : "#8a9070", fontWeight: on ? 500 : 400 }}
              >
                {s.eyebrow}
                {on && (
                  <span
                    className="absolute -bottom-px left-3 right-3 h-[2px] rounded-full"
                    style={{
                      background: "#6b7d52",
                      boxShadow: "0 0 12px rgba(154,171,126,0.4)",
                      viewTransitionName: "tab-underline",
                    }}
                  />
                )}
              </button>
            )
          })}
        </nav>

        <Fallback key={current.id}>
          <article className="relative">
            <div
              aria-hidden
              className="absolute -left-6 top-0 bottom-0 w-[3px] rounded-full"
              style={{
                background: current.accent,
                viewTransitionName: "section-rule",
              }}
            />
            <p
              className="text-[10px] tracking-[0.22em] uppercase text-[#6b7d52] mb-2"
              style={{ fontFamily: "var(--font-ibm-mono)", viewTransitionName: "section-eyebrow" }}
            >
              {current.eyebrow}
            </p>
            <h2
              className="text-[#1e2416] text-5xl leading-tight mb-4"
              style={{
                fontFamily: "var(--font-cormorant)",
                fontStyle: "italic",
                fontWeight: 500,
                viewTransitionName: "section-title",
              }}
            >
              {current.title}
            </h2>
            <p
              className="text-[16px] leading-relaxed text-[#4a5638] max-w-xl"
              style={{ viewTransitionName: "section-body" }}
            >
              {current.body}
            </p>
          </article>
        </Fallback>

        <p
          className="mt-16 text-[11px] tracking-[0.18em] uppercase text-[#8a9070]"
          style={{ fontFamily: "var(--font-ibm-mono)" }}
        >
          {typeof window !== "undefined" &&
          (document as DocumentWithVT).startViewTransition
            ? "View Transitions API · active"
            : "Fallback tween · active (browser does not support View Transitions)"}
        </p>
      </div>
    </div>
  )
}

// React-level fallback wrapper — keyed to force remount on section change.
// When View Transitions API isn't available, React's remount + the CSS
// transition below produces the cross-fade.
function Fallback({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        animation: "sect-in 360ms cubic-bezier(0.2, 0.8, 0.2, 1) both",
      }}
    >
      {children}
    </div>
  )
}

function ViewTransitionStyles() {
  return (
    <style>{`
      @keyframes sect-in {
        from { opacity: 0; transform: translateY(8px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      /* View Transitions API hooks — tune defaults per element */
      ::view-transition-old(section-title),
      ::view-transition-new(section-title) {
        animation-duration: 420ms;
        animation-timing-function: cubic-bezier(0.2, 0.8, 0.2, 1);
      }
      ::view-transition-old(section-body),
      ::view-transition-new(section-body) {
        animation-duration: 300ms;
        animation-timing-function: cubic-bezier(0.2, 0.8, 0.2, 1);
        animation-delay: 60ms;
      }
      ::view-transition-old(section-eyebrow),
      ::view-transition-new(section-eyebrow) {
        animation-duration: 240ms;
      }
      ::view-transition-old(section-rule),
      ::view-transition-new(section-rule) {
        animation-duration: 360ms;
        animation-timing-function: cubic-bezier(0.2, 0.8, 0.2, 1);
      }
      ::view-transition-old(tab-underline),
      ::view-transition-new(tab-underline) {
        animation-duration: 200ms;
      }
      @media (prefers-reduced-motion: reduce) {
        @keyframes sect-in { from { opacity: 0; } to { opacity: 1; } }
        ::view-transition-group(*) { animation-duration: 0ms !important; }
      }
    `}</style>
  )
}
