"use client"

// Interactive three-state preview used on /aire/assistant. Lets a visitor
// toggle the sigil between idle / listening / thinking without opening the
// overlay — purely for demoing the animation language.

import { useState } from "react"
import { SigilSvg, type SigilState } from "@/components/assistant/SigilSvg"

const STATES: Array<{ id: SigilState; label: string; hint: string }> = [
  { id: "idle", label: "Idle", hint: "Static. The sigil is quiet." },
  { id: "listening", label: "Listening", hint: "Conic ring rotates 4s linear." },
  { id: "thinking", label: "Thinking", hint: "Scale pulse 1.0 → 1.05 at 1.2s." },
]

export function StateDemo() {
  const [state, setState] = useState<SigilState>("listening")
  const active = STATES.find((s) => s.id === state) ?? STATES[0]

  return (
    <div
      className="rounded-3xl p-8 md:p-10"
      style={{
        background: "rgba(245, 242, 234, 0.04)",
        border: "1px solid rgba(154, 171, 126, 0.16)",
        boxShadow: "inset 0 1px 0 rgba(245, 242, 234, 0.06), 0 24px 60px -30px rgba(30, 36, 22, 0.6)",
      }}
    >
      <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
        <div className="shrink-0 flex items-center justify-center" style={{ width: 160, height: 160 }}>
          <SigilSvg size={128} state={state} />
        </div>

        <div className="flex-1 w-full">
          <div
            className="text-[10px] uppercase tracking-[0.2em] mb-2"
            style={{ color: "rgba(154, 171, 126, 0.9)", fontFamily: "var(--font-body, 'Space Grotesk'), sans-serif" }}
          >
            Animation state
          </div>
          <div
            className="text-2xl italic mb-1"
            style={{ color: "#f5f2ea", fontFamily: "var(--font-display, 'Cormorant Garamond'), serif", letterSpacing: "-0.01em" }}
          >
            {active.label}
          </div>
          <div
            className="text-sm mb-6"
            style={{ color: "rgba(232, 228, 216, 0.65)", fontFamily: "var(--font-body, 'Space Grotesk'), sans-serif" }}
          >
            {active.hint}
          </div>

          <div role="tablist" aria-label="Sigil animation state" className="flex flex-wrap gap-2">
            {STATES.map((s) => {
              const isActive = s.id === state
              return (
                <button
                  key={s.id}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setState(s.id)}
                  className="text-xs px-4 py-2 rounded-full transition-transform focus:outline-none focus-visible:ring-2"
                  style={{
                    fontFamily: "var(--font-body, 'Space Grotesk'), sans-serif",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    background: isActive ? "#6b7d52" : "rgba(245, 242, 234, 0.06)",
                    color: isActive ? "#f5f2ea" : "rgba(232, 228, 216, 0.7)",
                    border: `1px solid ${isActive ? "#6b7d52" : "rgba(154, 171, 126, 0.2)"}`,
                    boxShadow: isActive ? "0 0 0 3px rgba(154, 171, 126, 0.25)" : "none",
                  }}
                >
                  {s.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
