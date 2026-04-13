"use client"

import { useRef, type MouseEvent } from "react"

// EXPERIMENT 01 — Tilt Card
// 3D card that tilts toward the cursor (max 6° rotateX/Y) with a radial
// specular highlight that follows the cursor position. Pure React +
// inline CSS custom properties. Zero dependencies.

export default function TiltCardExperiment() {
  return (
    <div className="min-h-screen w-full bg-[#f5f2ea] text-[#2c3520] p-10" style={{ fontFamily: "var(--font-body)" }}>
      <Header title="Tilt Card" slug="01" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto mt-10">
        <TiltCard
          label="Pipeline"
          value="$3.38M"
          caption="Active · 18 deals"
        />
        <TiltCard
          label="Closing"
          value="4"
          caption="≤ 7 days"
          tone="warm"
        />
        <TiltCard
          label="Overdue"
          value="3"
          caption="needs attention"
          tone="error"
        />
      </div>

      <p className="max-w-2xl mx-auto mt-10 text-[14px] leading-relaxed text-[#4a5638]">
        Hover any card. Cursor position drives a CSS-var-based tilt (max 6° rotateX, 6° rotateY)
        plus a radial sage highlight that tracks the pointer. Only <code>transform</code> and two
        custom properties animate — no library required, no layout shift.
      </p>
    </div>
  )
}

function TiltCard({
  label,
  value,
  caption,
  tone = "default",
}: {
  label: string
  value: string
  caption: string
  tone?: "default" | "warm" | "error"
}) {
  const ref = useRef<HTMLDivElement>(null)

  function handleMove(e: MouseEvent<HTMLDivElement>) {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width   // 0..1
    const y = (e.clientY - rect.top) / rect.height   // 0..1
    const tiltX = (0.5 - y) * 12   // -6..+6 deg
    const tiltY = (x - 0.5) * 12
    el.style.setProperty("--tilt-x", `${tiltX.toFixed(2)}deg`)
    el.style.setProperty("--tilt-y", `${tiltY.toFixed(2)}deg`)
    el.style.setProperty("--spec-x", `${(x * 100).toFixed(1)}%`)
    el.style.setProperty("--spec-y", `${(y * 100).toFixed(1)}%`)
  }

  function handleLeave() {
    const el = ref.current
    if (!el) return
    el.style.setProperty("--tilt-x", "0deg")
    el.style.setProperty("--tilt-y", "0deg")
  }

  const valueColor = tone === "error" ? "#8b4a4a" : tone === "warm" ? "#b5956a" : "#1e2416"

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className="relative rounded-xl p-6 overflow-hidden will-change-transform"
      style={{
        background: "#f0ece2",
        border: "1px solid #c5c9b8",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.6), 0 2px 8px rgba(30,36,22,0.08), 0 18px 44px rgba(30,36,22,0.12)",
        transformStyle: "preserve-3d",
        transform:
          "perspective(900px) rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg))",
        transition: "transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)",
      }}
    >
      {/* Specular highlight — radial sage at cursor position */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none rounded-xl"
        style={{
          background:
            "radial-gradient(240px 180px at var(--spec-x, 50%) var(--spec-y, 50%), rgba(154,171,126,0.22), transparent 60%)",
          transition: "opacity 160ms ease-out",
        }}
      />
      <div className="relative">
        <p
          className="text-[10px] tracking-[0.22em] uppercase text-[#6b7d52]"
          style={{ fontFamily: "var(--font-ibm-mono)" }}
        >
          {label}
        </p>
        <p
          className="text-[48px] leading-none mt-3 tracking-[-0.02em]"
          style={{ fontFamily: "var(--font-ibm-mono)", fontWeight: 500, color: valueColor }}
        >
          {value}
        </p>
        <p className="text-[12px] mt-2 text-[#8a9070]">{caption}</p>
      </div>
    </div>
  )
}

function Header({ title, slug }: { title: string; slug: string }) {
  return (
    <div className="max-w-6xl mx-auto">
      <p
        className="text-[10px] tracking-[0.22em] uppercase text-[#6b7d52] mb-2"
        style={{ fontFamily: "var(--font-ibm-mono)" }}
      >
        Experiment {slug}
      </p>
      <h1
        className="text-[#1e2416] text-4xl"
        style={{ fontFamily: "var(--font-cormorant)", fontStyle: "italic", fontWeight: 500 }}
      >
        {title}
      </h1>
    </div>
  )
}
