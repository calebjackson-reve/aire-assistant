"use client"

// WisprIndicator — 2px sage line at top edge of viewport that pulses while
// recording. Zero chrome beyond this. Pure CSS animation.

import { useWispr } from "./WisprProvider"

export function WisprIndicator() {
  const { isRecording, isProcessing } = useWispr()
  const visible = isRecording || isProcessing

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed top-0 left-0 right-0 z-[60] transition-opacity duration-[160ms]"
      style={{
        height: 2,
        opacity: visible ? 1 : 0,
        background: isRecording
          ? "linear-gradient(90deg, transparent 0%, #9aab7e 50%, transparent 100%)"
          : "linear-gradient(90deg, transparent 0%, #6b7d52 50%, transparent 100%)",
        backgroundSize: "200% 100%",
        animation: visible ? "wispr-indicator 1.4s ease-in-out infinite" : "none",
      }}
    >
      <style>{`
        @keyframes wispr-indicator {
          0%   { background-position: -100% 0; }
          100% { background-position:  100% 0; }
        }
      `}</style>
    </div>
  )
}
