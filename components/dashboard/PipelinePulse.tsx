"use client"

import { useEffect, useRef, useState, type MouseEvent } from "react"

type Props = {
  valueLabel: string
  series?: number[]
  deltaPct?: number | null
  caption?: string
  footnote?: string
}

export function PipelinePulse({ valueLabel, series, deltaPct, caption, footnote }: Props) {
  const cardRef = useRef<HTMLDivElement>(null)
  const pathRef = useRef<SVGPathElement>(null)
  const [drawn, setDrawn] = useState(false)
  const [pathLength, setPathLength] = useState(0)

  // Tilt-on-hover (C2 — max 4 degrees)
  function handleMove(e: MouseEvent<HTMLDivElement>) {
    const el = cardRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    const tiltX = (0.5 - y) * 8
    const tiltY = (x - 0.5) * 8
    el.style.setProperty("--tilt-x", `${tiltX.toFixed(2)}deg`)
    el.style.setProperty("--tilt-y", `${tiltY.toFixed(2)}deg`)
    el.style.setProperty("--spec-x", `${(x * 100).toFixed(1)}%`)
    el.style.setProperty("--spec-y", `${(y * 100).toFixed(1)}%`)
  }
  function handleLeave() {
    const el = cardRef.current
    if (!el) return
    el.style.setProperty("--tilt-x", "0deg")
    el.style.setProperty("--tilt-y", "0deg")
  }

  // Sparkline geometry
  const data = series && series.length >= 2 ? series : null
  const W = 600
  const H = 72
  const pad = 3
  let path = ""
  let fillPath = ""
  let lastX = 0
  let lastY = 0
  if (data) {
    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1
    const points = data.map((v, i) => {
      const xp = pad + (i / (data.length - 1)) * (W - pad * 2)
      const yp = H - pad - ((v - min) / range) * (H - pad * 2)
      return [xp, yp] as const
    })
    path = points
      .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
      .join(" ")
    fillPath = `${path} L ${points[points.length - 1][0].toFixed(1)},${H} L ${points[0][0].toFixed(1)},${H} Z`
    lastX = points[points.length - 1][0]
    lastY = points[points.length - 1][1]
  }

  useEffect(() => {
    if (pathRef.current) setPathLength(pathRef.current.getTotalLength())
    const t = setTimeout(() => setDrawn(true), 140)
    return () => clearTimeout(t)
  }, [])

  const deltaLabel =
    deltaPct == null
      ? null
      : deltaPct >= 0
        ? `▲ ${deltaPct.toFixed(1)}%`
        : `▼ ${Math.abs(deltaPct).toFixed(1)}%`
  const deltaColor = deltaPct == null ? undefined : deltaPct >= 0 ? "#9aab7e" : "#c4787a"

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className="relative rounded-2xl p-6 sm:p-7 overflow-hidden will-change-transform"
      style={{
        background: "linear-gradient(180deg, #2a3224 0%, #252d1e 100%)",
        border: "1px solid rgba(154,171,126,0.18)",
        boxShadow:
          "inset 0 1px 0 rgba(245,242,234,0.06), 0 2px 8px rgba(30,36,22,0.28), 0 24px 64px rgba(30,36,22,0.40)",
        transformStyle: "preserve-3d",
        transform:
          "perspective(1200px) rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg))",
        transition: "transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1)",
      }}
    >
      {/* Specular highlight — radial sage tracking cursor */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none rounded-2xl"
        style={{
          background:
            "radial-gradient(320px 220px at var(--spec-x, 50%) var(--spec-y, 50%), rgba(154,171,126,0.10), transparent 60%)",
        }}
      />

      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <p
            className="text-[10px] uppercase tracking-[0.22em]"
            style={{ fontFamily: "var(--font-ibm-mono)", color: "rgba(179,194,149,0.65)" }}
          >
            Pipeline · live
          </p>
          {caption && (
            <p
              className="text-[10px] uppercase tracking-[0.22em]"
              style={{ fontFamily: "var(--font-ibm-mono)", color: "rgba(179,194,149,0.55)" }}
            >
              {caption}
            </p>
          )}
        </div>

        <div className="mt-3 flex items-baseline gap-4 flex-wrap">
          <p
            className="text-[48px] sm:text-[64px] leading-none tracking-[-0.03em] tabular-nums"
            style={{ fontFamily: "var(--font-ibm-mono)", fontWeight: 500, color: "#e8e4d8" }}
          >
            {valueLabel}
          </p>
          {deltaLabel && (
            <p
              className="text-[12px] tabular-nums"
              style={{ fontFamily: "var(--font-ibm-mono)", color: deltaColor }}
            >
              {deltaLabel}
            </p>
          )}
        </div>

        {data && (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="w-full h-[72px] mt-5 overflow-visible"
            aria-label="Pipeline 30-day trend"
            role="img"
          >
            <path
              d={fillPath}
              fill="#9aab7e"
              opacity={drawn ? 0.1 : 0}
              style={{ transition: "opacity 800ms cubic-bezier(0,0,0.2,1) 600ms" }}
            />
            <path
              ref={pathRef}
              d={path}
              fill="none"
              stroke="#b3c295"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                strokeDasharray: pathLength || 1,
                strokeDashoffset: drawn ? 0 : pathLength || 1,
                transition: "stroke-dashoffset 1400ms cubic-bezier(0.2,0.8,0.2,1)",
              }}
            />
            {drawn && (
              <>
                <circle
                  cx={lastX}
                  cy={lastY}
                  r={3.5}
                  fill="#9aab7e"
                  style={{ filter: "drop-shadow(0 0 6px rgba(154,171,126,0.7))" }}
                />
                <circle
                  cx={lastX}
                  cy={lastY}
                  r={3.5}
                  fill="none"
                  stroke="#9aab7e"
                  strokeWidth={1.25}
                >
                  <animate attributeName="r" from="3.5" to="13" dur="2.4s" repeatCount="indefinite" />
                  <animate
                    attributeName="opacity"
                    from="0.7"
                    to="0"
                    dur="2.4s"
                    repeatCount="indefinite"
                  />
                </circle>
              </>
            )}
          </svg>
        )}

        {footnote && (
          <p
            className="mt-4 text-[10px] uppercase tracking-[0.22em]"
            style={{ fontFamily: "var(--font-ibm-mono)", color: "rgba(179,194,149,0.55)" }}
          >
            {footnote}
          </p>
        )}
      </div>
    </div>
  )
}
