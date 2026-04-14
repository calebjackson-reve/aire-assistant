"use client"

// The floating AIRE assistant FAB. 48px on desktop, 56px on mobile. Lives in
// the bottom-right corner with safe-area inset. Click opens AssistantOverlay.
// State model:
//   idle       — static. The sigil is quiet.
//   listening  — conic ring rotates 4s linear. Active when overlay is open.
//   thinking   — 1.2s scale pulse. Driven externally (stub-toggleable now).
// Respects prefers-reduced-motion via SigilSvg's own media query.

import { useState, useCallback, useEffect } from "react"
import { SigilSvg, type SigilState } from "./SigilSvg"
import { AssistantOverlay } from "./AssistantOverlay"

interface FloatingAssistantProps {
  /** Force a state externally (e.g. landing-page demo). If omitted, the FAB
   *  manages its own state: idle when closed, listening when overlay open. */
  state?: SigilState
  /** Start with overlay open (used by landing page "click to try" CTA). */
  defaultOpen?: boolean
  className?: string
}

export function FloatingAssistant({ state, defaultOpen = false, className = "" }: FloatingAssistantProps) {
  const [open, setOpen] = useState(defaultOpen)
  const [hovered, setHovered] = useState(false)

  const effectiveState: SigilState = state ?? (open ? "listening" : "idle")

  const handleClick = useCallback(() => setOpen((v) => !v), [])
  const handleClose = useCallback(() => setOpen(false), [])

  // Keyboard shortcut: ⌘/Ctrl + J toggles the assistant. Matches Linear's
  // lightweight summon pattern; avoids collision with ⌘K (command bar, C4).
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [])

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-label={open ? "Close AIRE assistant" : "Open AIRE assistant"}
        aria-expanded={open}
        className={`fixed z-50 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 transition-transform ${className}`}
        style={{
          right: "max(24px, env(safe-area-inset-right))",
          bottom: "max(24px, env(safe-area-inset-bottom))",
          padding: 4,
          background: "transparent",
          border: "none",
          transform: hovered ? "translateZ(0) scale(1.06)" : "translateZ(0) scale(1)",
          transitionDuration: "220ms",
          transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)",
          // sage-tinted focus ring
          boxShadow: hovered ? "0 0 0 3px rgba(154, 171, 126, 0.35)" : "none",
          cursor: "pointer",
        }}
      >
        <span className="block md:hidden">
          <SigilSvg size={56} state={effectiveState} />
        </span>
        <span className="hidden md:block">
          <SigilSvg size={48} state={effectiveState} />
        </span>
      </button>
      <AssistantOverlay open={open} onClose={handleClose} />
    </>
  )
}
