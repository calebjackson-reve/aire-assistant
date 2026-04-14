// /aire/assistant — capability landing for the floating sigil. Server
// Component shell; interactive bits (state demo, FAB) are isolated clients.
// The FloatingAssistant is mounted here for preview only; the main thread
// will later mount it globally from app/aire/layout.tsx.

import { ASSISTANT_TOOLS, TOOL_CATEGORY_LABEL, type ToolCategory } from "@/lib/mcp/tools"
import { SigilSvg } from "@/components/assistant/SigilSvg"
import { FloatingAssistant } from "@/components/assistant/FloatingAssistant"
import { StateDemo } from "./StateDemo"

const DISPLAY = "var(--font-display, 'Cormorant Garamond'), serif"
const BODY = "var(--font-body, 'Space Grotesk'), sans-serif"
const MONO = "var(--font-mono, 'IBM Plex Mono'), monospace"

const CATEGORY_ORDER: ToolCategory[] = [
  "brief",
  "transactions",
  "intelligence",
  "contracts",
  "airsign",
  "communications",
  "compliance",
]

export default function AssistantLandingPage() {
  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    label: TOOL_CATEGORY_LABEL[cat],
    tools: ASSISTANT_TOOLS.filter((t) => t.category === cat),
  })).filter((g) => g.tools.length > 0)

  return (
    <div className="min-h-screen relative">
      {/* Ambient wash — low-opacity sage radial, keeps the canvas warm */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 40% at 85% 0%, rgba(154, 171, 126, 0.08), transparent 70%)",
        }}
      />

      <div className="relative max-w-5xl mx-auto px-6 md:px-10 pt-16 md:pt-24 pb-32">
        {/* Eyebrow */}
        <div
          className="flex items-center gap-3 text-[11px] uppercase mb-6"
          style={{ color: "rgba(154, 171, 126, 0.9)", fontFamily: BODY, letterSpacing: "0.22em" }}
        >
          <span style={{ width: 24, height: 1, background: "#6b7d52", display: "inline-block" }} />
          C3 · Floating assistant
        </div>

        {/* Hero */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8">
          <div className="max-w-2xl">
            <h1
              className="italic leading-[1.02]"
              style={{
                color: "#f5f2ea",
                fontFamily: DISPLAY,
                fontSize: "clamp(44px, 7vw, 76px)",
                letterSpacing: "-0.025em",
                fontWeight: 500,
              }}
            >
              Click your assistant
              <br />
              to try it.
            </h1>
            <p
              className="mt-6 text-base md:text-lg leading-relaxed max-w-xl"
              style={{ color: "rgba(232, 228, 216, 0.72)", fontFamily: BODY }}
            >
              A 48px sigil lives in the bottom-right of every AIRE surface. Tap
              it, hold to talk, and it proposes the next move — one tool, one
              confirmation, one tap. No mascot, no chatbot theatre.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-[11px] uppercase" style={{ fontFamily: BODY, letterSpacing: "0.18em", color: "rgba(232, 228, 216, 0.5)" }}>
              <span className="flex items-center gap-2">
                <kbd className="px-2 py-1 rounded" style={{ background: "rgba(154, 171, 126, 0.15)", color: "#f5f2ea", fontFamily: MONO, letterSpacing: "0.02em" }}>
                  ⌘J
                </kbd>
                Toggle
              </span>
              <span className="flex items-center gap-2">
                <kbd className="px-2 py-1 rounded" style={{ background: "rgba(154, 171, 126, 0.15)", color: "#f5f2ea", fontFamily: MONO, letterSpacing: "0.02em" }}>
                  Esc
                </kbd>
                Close
              </span>
              <span className="flex items-center gap-2">
                <kbd className="px-2 py-1 rounded" style={{ background: "rgba(154, 171, 126, 0.15)", color: "#f5f2ea", fontFamily: MONO, letterSpacing: "0.02em" }}>
                  Hold Space
                </kbd>
                Talk (soon)
              </span>
            </div>
          </div>

          <div className="shrink-0 self-center md:self-end">
            <SigilSvg size={140} state="listening" />
          </div>
        </div>

        {/* Three-state demo */}
        <section className="mt-16 md:mt-20">
          <div className="mb-6 flex items-baseline justify-between">
            <h2
              className="italic"
              style={{
                color: "#f5f2ea",
                fontFamily: DISPLAY,
                fontSize: "clamp(28px, 3.5vw, 38px)",
                letterSpacing: "-0.015em",
                fontWeight: 500,
              }}
            >
              Three states
            </h2>
            <span className="text-[10px] uppercase tracking-[0.22em]" style={{ color: "rgba(154, 171, 126, 0.9)", fontFamily: BODY }}>
              Reduced-motion safe
            </span>
          </div>
          <StateDemo />
        </section>

        {/* Capability list */}
        <section className="mt-16 md:mt-20">
          <div className="mb-6 flex items-baseline justify-between">
            <h2
              className="italic"
              style={{
                color: "#f5f2ea",
                fontFamily: DISPLAY,
                fontSize: "clamp(28px, 3.5vw, 38px)",
                letterSpacing: "-0.015em",
                fontWeight: 500,
              }}
            >
              What it can do
            </h2>
            <span className="text-[10px] uppercase tracking-[0.22em]" style={{ color: "rgba(154, 171, 126, 0.9)", fontFamily: BODY }}>
              <span style={{ fontFamily: MONO, letterSpacing: "0.05em" }}>{ASSISTANT_TOOLS.length.toString().padStart(2, "0")}</span>{" "}
              tools
            </span>
          </div>

          <div className="space-y-10">
            {grouped.map((group) => (
              <div key={group.category}>
                <div
                  className="text-[11px] uppercase tracking-[0.22em] mb-3 flex items-center gap-3"
                  style={{ color: "rgba(154, 171, 126, 0.9)", fontFamily: BODY }}
                >
                  <span style={{ width: 16, height: 1, background: "rgba(154, 171, 126, 0.5)", display: "inline-block" }} />
                  {group.label}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {group.tools.map((tool) => (
                    <div
                      key={tool.name}
                      className="rounded-2xl p-5 transition-transform"
                      style={{
                        background: "rgba(245, 242, 234, 0.04)",
                        border: "1px solid rgba(154, 171, 126, 0.14)",
                        boxShadow: "inset 0 1px 0 rgba(245, 242, 234, 0.05)",
                      }}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div
                          className="text-sm"
                          style={{ color: "#f5f2ea", fontFamily: BODY, fontWeight: 500, letterSpacing: "-0.005em" }}
                        >
                          {tool.label}
                        </div>
                        {tool.confirmRequired && (
                          <span
                            className="shrink-0 text-[9px] uppercase px-2 py-0.5 rounded-full"
                            style={{
                              background: "rgba(107, 125, 82, 0.22)",
                              color: "#9aab7e",
                              fontFamily: BODY,
                              letterSpacing: "0.14em",
                              border: "1px solid rgba(154, 171, 126, 0.22)",
                            }}
                          >
                            Confirm
                          </span>
                        )}
                      </div>
                      <div
                        className="text-[13px] leading-relaxed mb-3"
                        style={{ color: "rgba(232, 228, 216, 0.68)", fontFamily: BODY }}
                      >
                        {tool.description}
                      </div>
                      <div
                        className="text-[10px] uppercase"
                        style={{ color: "rgba(232, 228, 216, 0.3)", fontFamily: MONO, letterSpacing: "0.08em" }}
                      >
                        {tool.name}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Footnote */}
        <div
          className="mt-20 pt-6 text-[11px] uppercase"
          style={{
            color: "rgba(232, 228, 216, 0.35)",
            fontFamily: BODY,
            letterSpacing: "0.2em",
            borderTop: "1px solid rgba(232, 228, 216, 0.08)",
          }}
        >
          Scaffold — voice pipeline wires on the next pass · Refs: JARVIS_RESEARCH.md §§1,3
        </div>
      </div>

      {/* Floating sigil — the real thing, clickable */}
      <FloatingAssistant />
    </div>
  )
}
