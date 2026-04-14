"use client"

// WisprButton — floating side-button, hold to record.
// Position: fixed right edge, above mobile bottom tab strip.
// Idle: 48px circle with mic icon (olive stroke on cream).
// Active: 120px pill with live waveform and elapsed counter.
// Release: stops + sends. Right-click or Esc while held: cancel.

import { useEffect, useRef } from "react"
import { Mic, Loader2 } from "lucide-react"
import { useWispr } from "./WisprProvider"

export function WisprButton() {
  const { isRecording, isProcessing, elapsed, startRecording, stopRecording, cancelRecording } =
    useWispr()
  const pressRef = useRef<boolean>(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && (isRecording || pressRef.current)) {
        cancelRecording()
        pressRef.current = false
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [isRecording, cancelRecording])

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    e.preventDefault()
    if (e.button === 2) return // right-click handled as cancel below
    pressRef.current = true
    startRecording()
  }

  function onPointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    e.preventDefault()
    if (!pressRef.current) return
    pressRef.current = false
    stopRecording()
  }

  function onPointerLeave() {
    if (!pressRef.current || !isRecording) return
    // Released outside button — still treat as stop, not cancel
    pressRef.current = false
    stopRecording()
  }

  function onContextMenu(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault()
    if (isRecording) {
      pressRef.current = false
      cancelRecording()
    }
  }

  const label = isProcessing
    ? "Processing…"
    : isRecording
      ? `Listening · ${elapsed}s`
      : "Hold to speak"

  return (
    <div
      className="fixed right-4 z-50 select-none"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 88px)" }}
    >
      <button
        type="button"
        aria-label={label}
        aria-pressed={isRecording}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
        onContextMenu={onContextMenu}
        disabled={isProcessing}
        className="group flex items-center justify-center rounded-full transition-[transform,box-shadow,width,background-color] duration-[160ms] ease-out active:translate-y-px focus-visible:outline-none"
        style={{
          width: isRecording ? 130 : 48,
          height: 48,
          background: isRecording ? "#6b7d52" : "#f5f2ea",
          color: isRecording ? "#f5f2ea" : "#6b7d52",
          border: "1px solid rgba(30,36,22,0.16)",
          boxShadow: isRecording
            ? "0 0 0 4px rgba(154,171,126,0.30), 0 10px 28px rgba(30,36,22,0.25), 0 18px 44px rgba(106,125,82,0.25)"
            : "0 1px 0 rgba(255,255,255,0.6) inset, 0 6px 18px rgba(30,36,22,0.16), 0 14px 36px rgba(30,36,22,0.14)",
          cursor: isProcessing ? "progress" : "pointer",
          touchAction: "none",
        }}
      >
        {isProcessing ? (
          <Loader2 size={18} strokeWidth={1.75} className="animate-spin" />
        ) : isRecording ? (
          <span className="flex items-center gap-2 px-3">
            <Waveform />
            <span
              className="text-[11px] tabular-nums tracking-wider"
              style={{ fontFamily: "var(--font-ibm-mono, 'IBM Plex Mono'), monospace" }}
            >
              {elapsed}s
            </span>
          </span>
        ) : (
          <Mic size={18} strokeWidth={1.75} />
        )}
      </button>

      {/* Hover tooltip — only when idle + desktop */}
      {!isRecording && !isProcessing && (
        <span
          className="pointer-events-none absolute right-full top-1/2 -translate-y-1/2 mr-3 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-[160ms] hidden md:block"
          style={{
            fontFamily: "var(--font-ibm-mono, 'IBM Plex Mono'), monospace",
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "rgba(30,36,22,0.55)",
          }}
        >
          Hold to speak
        </span>
      )}
    </div>
  )
}

function Waveform() {
  // 5-bar animated waveform, pure CSS. Never use JS rAF here — lighter.
  return (
    <span className="flex items-center gap-[3px]" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="inline-block rounded-sm"
          style={{
            width: 2.5,
            height: 12,
            background: "currentColor",
            opacity: 0.9,
            animation: `wispr-bar 680ms ease-in-out ${i * 90}ms infinite alternate`,
          }}
        />
      ))}
      <style>{`
        @keyframes wispr-bar {
          0%   { transform: scaleY(0.25); }
          100% { transform: scaleY(1.0); }
        }
      `}</style>
    </span>
  )
}
