"use client"

import { useEffect, useRef, type ReactNode } from "react"

// EXPERIMENT 03 — Magnetic CTA
// Button softly tracks the cursor within an 80px radius. Spring-style easing
// via a damped RAF loop (no library). Tracks both the button AND the label
// independently, so the label drags 40% further than the shell — gives the
// pull a tactile feel. Zero dependencies.

export default function MagneticCtaExperiment() {
  return (
    <div className="min-h-screen w-full bg-[#f5f2ea] text-[#2c3520] p-10" style={{ fontFamily: "var(--font-body)" }}>
      <div className="max-w-3xl mx-auto">
        <p
          className="text-[10px] tracking-[0.22em] uppercase text-[#6b7d52] mb-2"
          style={{ fontFamily: "var(--font-ibm-mono)" }}
        >
          Experiment 03
        </p>
        <h1
          className="text-[#1e2416] text-4xl mb-6"
          style={{ fontFamily: "var(--font-cormorant)", fontStyle: "italic", fontWeight: 500 }}
        >
          Magnetic CTA
        </h1>
        <p className="text-[14px] leading-relaxed text-[#4a5638] max-w-xl">
          Move your cursor near any button. The shell eases toward the cursor; the label drags
          40% further. Radius 80px, spring stiffness ~0.16. No library — single RAF loop per
          button. Applied to primary conversion CTAs it lifts clicks without users noticing why.
        </p>
      </div>

      <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto place-items-center">
        <MagneticButton tone="primary">+ New deal</MagneticButton>
        <MagneticButton tone="secondary">Schedule showing</MagneticButton>
        <MagneticButton tone="ghost">Request CMA</MagneticButton>
      </div>

      <div className="mt-24 max-w-3xl mx-auto text-center">
        <p
          className="text-[10px] tracking-[0.22em] uppercase text-[#6b7d52] mb-4"
          style={{ fontFamily: "var(--font-ibm-mono)" }}
        >
          Voice
        </p>
        <MagneticMic />
      </div>
    </div>
  )
}

function useMagnetic(radius = 80, stiffness = 0.16) {
  const shellRef = useRef<HTMLDivElement>(null)
  const labelRef = useRef<HTMLSpanElement>(null)
  const target = useRef({ x: 0, y: 0 })
  const actual = useRef({ x: 0, y: 0 })
  const raf = useRef<number | null>(null)

  useEffect(() => {
    const shell = shellRef.current
    if (!shell) return

    function onMove(e: MouseEvent) {
      if (!shell) return
      const rect = shell.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const dx = e.clientX - cx
      const dy = e.clientY - cy
      const dist = Math.hypot(dx, dy)
      if (dist < radius) {
        const strength = 1 - dist / radius
        target.current.x = dx * strength * 0.4
        target.current.y = dy * strength * 0.4
      } else {
        target.current.x = 0
        target.current.y = 0
      }
    }

    function tick() {
      actual.current.x += (target.current.x - actual.current.x) * stiffness
      actual.current.y += (target.current.y - actual.current.y) * stiffness
      if (shellRef.current) {
        shellRef.current.style.transform = `translate3d(${actual.current.x.toFixed(2)}px, ${actual.current.y.toFixed(2)}px, 0)`
      }
      if (labelRef.current) {
        labelRef.current.style.transform = `translate3d(${(actual.current.x * 0.4).toFixed(2)}px, ${(actual.current.y * 0.4).toFixed(2)}px, 0)`
      }
      raf.current = requestAnimationFrame(tick)
    }

    window.addEventListener("mousemove", onMove)
    raf.current = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener("mousemove", onMove)
      if (raf.current) cancelAnimationFrame(raf.current)
    }
  }, [radius, stiffness])

  return { shellRef, labelRef }
}

function MagneticButton({ tone, children }: { tone: "primary" | "secondary" | "ghost"; children: ReactNode }) {
  const { shellRef, labelRef } = useMagnetic()
  const styles = {
    primary: {
      background: "#6b7d52",
      color: "#f5f2ea",
      border: "1px solid #6b7d52",
      boxShadow: "0 0 0 1px rgba(154,171,126,0.0), 0 8px 22px rgba(106,125,82,0.18)",
    },
    secondary: {
      background: "transparent",
      color: "#6b7d52",
      border: "1px solid #6b7d52",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4)",
    },
    ghost: {
      background: "#f0ece2",
      color: "#1e2416",
      border: "1px solid #c5c9b8",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6)",
    },
  }[tone]

  return (
    <div
      ref={shellRef}
      className="cursor-pointer will-change-transform rounded-full px-6 py-3 text-[12px] uppercase tracking-[0.14em] select-none transition-[box-shadow] duration-[200ms]"
      style={{ ...styles }}
    >
      <span ref={labelRef} className="inline-block will-change-transform">
        {children}
      </span>
    </div>
  )
}

function MagneticMic() {
  const { shellRef, labelRef } = useMagnetic(100, 0.18)
  return (
    <div
      ref={shellRef}
      className="relative inline-grid place-items-center w-20 h-20 rounded-full cursor-pointer will-change-transform"
      style={{
        background: "#1e2416",
        color: "#9aab7e",
        boxShadow: "inset 0 0 0 1px rgba(154,171,126,0.3), 0 12px 36px rgba(30,36,22,0.25)",
      }}
    >
      <span ref={labelRef} className="inline-block will-change-transform">
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="2" width="6" height="12" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0" />
          <path d="M12 19v3" />
        </svg>
      </span>
      <span
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{
          boxShadow: "0 0 0 0 rgba(154,171,126,0.4)",
          animation: "magMicPulse 2.4s cubic-bezier(0.2,0.8,0.2,1) infinite",
        }}
      />
      <style>{`
        @keyframes magMicPulse {
          0%   { box-shadow: 0 0 0 0 rgba(154,171,126,0.4); }
          60%  { box-shadow: 0 0 0 24px rgba(154,171,126,0.0); }
          100% { box-shadow: 0 0 0 24px rgba(154,171,126,0.0); }
        }
      `}</style>
    </div>
  )
}
