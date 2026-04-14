"use client"

// Page-aware overlay shell for the AIRE assistant. Mirrors VoiceOverlay's
// header/body/input skeleton but is intentionally NOT wired to the voice
// pipeline yet — the main thread handles integration after the C3 foundation
// merges. Renders a clear "stub" state so reviewers know this is scaffold.

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { SigilSvg } from "./SigilSvg"

interface AssistantOverlayProps {
  open: boolean
  onClose: () => void
}

const EXAMPLE_ASKS = [
  "What's my pipeline value?",
  "Show me today's deadlines",
  "Open 5834 Guice Dr",
  "Draft the inspection email",
  "Run compliance on active deals",
]

export function AssistantOverlay({ open, onClose }: AssistantOverlayProps) {
  const pathname = usePathname()
  const closeBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKey)
    closeBtnRef.current?.focus()
    return () => window.removeEventListener("keydown", handleKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="AIRE assistant"
      className="fixed inset-0 z-[60] flex flex-col"
      style={{
        background: "rgba(30, 36, 22, 0.95)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "rgba(232, 228, 216, 0.08)" }}>
        <div className="flex items-center gap-3">
          <SigilSvg size={32} state="listening" />
          <div className="flex flex-col leading-tight">
            <span
              className="text-lg italic"
              style={{ color: "#f5f2ea", fontFamily: "var(--font-display, 'Cormorant Garamond'), serif", letterSpacing: "-0.01em" }}
            >
              AIRE
            </span>
            <span
              className="text-[10px] uppercase tracking-[0.18em]"
              style={{ color: "rgba(232, 228, 216, 0.45)", fontFamily: "var(--font-body, 'Space Grotesk'), sans-serif" }}
            >
              {pathname || "/"}
            </span>
          </div>
        </div>
        <button
          ref={closeBtnRef}
          onClick={onClose}
          aria-label="Close assistant"
          className="rounded-full p-2 transition-colors"
          style={{ color: "rgba(232, 228, 216, 0.55)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#f5f2ea")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(232, 228, 216, 0.55)")}
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Body — stub */}
      <div className="flex-1 overflow-y-auto px-6 py-10">
        <div className="max-w-xl mx-auto flex flex-col items-center text-center">
          <SigilSvg size={96} state="thinking" />
          <h2
            className="mt-8 text-3xl italic"
            style={{ color: "#f5f2ea", fontFamily: "var(--font-display, 'Cormorant Garamond'), serif", letterSpacing: "-0.02em" }}
          >
            Voice pipeline not wired yet
          </h2>
          <p
            className="mt-4 text-sm leading-relaxed max-w-md"
            style={{ color: "rgba(232, 228, 216, 0.65)", fontFamily: "var(--font-body, 'Space Grotesk'), sans-serif" }}
          >
            This is the C3 scaffold — the sigil and overlay shell. The voice
            pipeline, proposer, and MCP tool registry merge in on the next
            pass. Close with <kbd className="px-1.5 py-0.5 mx-0.5 text-[10px] rounded" style={{ background: "rgba(154, 171, 126, 0.18)", color: "#f5f2ea" }}>Esc</kbd>.
          </p>

          <div
            className="mt-10 w-full rounded-2xl p-5 text-left"
            style={{
              background: "rgba(245, 242, 234, 0.04)",
              border: "1px solid rgba(154, 171, 126, 0.14)",
              boxShadow: "inset 0 1px 0 rgba(245, 242, 234, 0.06)",
            }}
          >
            <div
              className="text-[10px] uppercase tracking-[0.2em] mb-3"
              style={{ color: "rgba(154, 171, 126, 0.9)", fontFamily: "var(--font-body, 'Space Grotesk'), sans-serif" }}
            >
              Coming soon
            </div>
            <ul className="space-y-2">
              {EXAMPLE_ASKS.map((ask) => (
                <li
                  key={ask}
                  className="text-sm"
                  style={{ color: "rgba(232, 228, 216, 0.82)", fontFamily: "var(--font-body, 'Space Grotesk'), sans-serif" }}
                >
                  <span style={{ color: "#9aab7e", marginRight: 8 }}>—</span>
                  {ask}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Footer — disabled stub input so shape matches VoiceOverlay */}
      <div className="px-6 pb-6 pt-3 border-t" style={{ borderColor: "rgba(232, 228, 216, 0.08)" }}>
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div
            aria-hidden="true"
            className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 opacity-40"
            style={{ background: "rgba(154, 171, 126, 0.18)", color: "#9aab7e" }}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            </svg>
          </div>
          <div
            aria-hidden="true"
            className="flex-1 rounded-xl px-5 py-3 text-sm opacity-40"
            style={{
              background: "rgba(245, 242, 234, 0.05)",
              border: "1px solid rgba(245, 242, 234, 0.1)",
              color: "rgba(232, 228, 216, 0.4)",
              fontFamily: "var(--font-body, 'Space Grotesk'), sans-serif",
            }}
          >
            Input disabled in scaffold build
          </div>
        </div>
      </div>
    </div>
  )
}
