"use client"

import { useEffect, useRef, useState } from "react"

// EXPERIMENT 04 — Sparkline Hero
// 1080-wide mono sparkline that writes itself on scroll entry via the
// stroke-dashoffset trick. Once revealed, the last data point pulses a
// sage ring. Pure SVG + IntersectionObserver. Zero dependencies.

const SERIES_90D = [
  22, 28, 24, 31, 29, 38, 36, 42, 40, 45, 49, 47, 54, 52, 58, 60, 62, 64,
  66, 65, 70, 73, 71, 78, 80, 79, 83, 85, 84, 88, 90, 93, 91, 96, 98, 102,
  99, 104, 108, 106, 111, 115, 113, 120, 124, 121, 128, 132, 130, 137,
  141, 139, 146, 150, 148, 155, 160, 158, 165, 170, 168, 175, 180, 178,
  185, 190, 188, 195, 200, 198, 205, 210, 208, 215, 220, 218, 225, 230,
  228, 235, 240, 238, 245, 250, 248, 255, 260, 258, 265, 270, 268,
]

export default function SparklineHeroExperiment() {
  return (
    <div className="min-h-screen w-full bg-[#f5f2ea] text-[#2c3520]" style={{ fontFamily: "var(--font-body)" }}>
      <div className="max-w-4xl mx-auto px-10 pt-10">
        <p
          className="text-[10px] tracking-[0.22em] uppercase text-[#6b7d52] mb-2"
          style={{ fontFamily: "var(--font-ibm-mono)" }}
        >
          Experiment 04
        </p>
        <h1
          className="text-[#1e2416] text-4xl mb-4"
          style={{ fontFamily: "var(--font-cormorant)", fontStyle: "italic", fontWeight: 500 }}
        >
          Sparkline Hero
        </h1>
        <p className="text-[14px] leading-relaxed text-[#4a5638] max-w-xl">
          Scroll down. The sparkline writes itself over 1.6s using the classic
          <code className="mx-1 text-[12px]" style={{ fontFamily: "var(--font-ibm-mono)" }}>stroke-dashoffset</code>
          trick. Once drawn, the trailing data point pulses. No library; just SVG + IntersectionObserver.
        </p>
      </div>

      {/* Intentional scroll distance so the hero sparkline enters mid-viewport */}
      <div className="h-[55vh]" aria-hidden />

      <div className="max-w-[1080px] mx-auto px-10 pb-10">
        <Sparkline data={SERIES_90D} />
        <div className="mt-4 flex items-baseline justify-between">
          <div>
            <p
              className="text-[10px] tracking-[0.22em] uppercase text-[#6b7d52]"
              style={{ fontFamily: "var(--font-ibm-mono)" }}
            >
              Pipeline · last 90 days
            </p>
            <p
              className="text-[48px] leading-none mt-2 text-[#1e2416] tracking-[-0.02em]"
              style={{ fontFamily: "var(--font-ibm-mono)", fontWeight: 500 }}
            >
              $3.38M
            </p>
          </div>
          <p
            className="text-[12px] text-[#6b7d52]"
            style={{ fontFamily: "var(--font-ibm-mono)" }}
          >
            ▲ 12.1% vs prior
          </p>
        </div>
      </div>

      <div className="h-[50vh]" aria-hidden />
    </div>
  )
}

function Sparkline({ data }: { data: number[] }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const pathRef = useRef<SVGPathElement>(null)
  const [drawn, setDrawn] = useState(false)
  const [pathLength, setPathLength] = useState(0)

  const W = 1080
  const H = 180
  const pad = 4
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (W - pad * 2)
    const y = H - pad - ((v - min) / range) * (H - pad * 2)
    return [x, y] as const
  })

  const path = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ")
  const fillPath = `${path} L ${points[points.length - 1][0].toFixed(1)},${H} L ${points[0][0].toFixed(1)},${H} Z`
  const [lastX, lastY] = points[points.length - 1]

  useEffect(() => {
    if (pathRef.current) {
      setPathLength(pathRef.current.getTotalLength())
    }
  }, [])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setDrawn(true)
            io.unobserve(el)
          }
        }
      },
      { threshold: 0.3 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div ref={wrapRef} className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-[180px] overflow-visible">
        {/* Area fill reveals via opacity */}
        <path
          d={fillPath}
          fill="#9aab7e"
          opacity={drawn ? 0.08 : 0}
          style={{ transition: "opacity 800ms cubic-bezier(0, 0, 0.2, 1) 800ms" }}
        />
        {/* Stroke draws via dashoffset */}
        <path
          ref={pathRef}
          d={path}
          fill="none"
          stroke="#6b7d52"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            strokeDasharray: pathLength,
            strokeDashoffset: drawn ? 0 : pathLength,
            transition: "stroke-dashoffset 1600ms cubic-bezier(0.2, 0.8, 0.2, 1)",
          }}
        />
        {/* Trailing data-point — pulses once drawn */}
        {drawn && (
          <>
            <circle
              cx={lastX}
              cy={lastY}
              r={4}
              fill="#9aab7e"
              style={{ filter: "drop-shadow(0 0 6px rgba(154,171,126,0.6))" }}
            />
            <circle cx={lastX} cy={lastY} r={4} fill="none" stroke="#9aab7e" strokeWidth={1.5}>
              <animate attributeName="r" from="4" to="14" dur="2.4s" repeatCount="indefinite" />
              <animate attributeName="opacity" from="0.7" to="0" dur="2.4s" repeatCount="indefinite" />
            </circle>
          </>
        )}
      </svg>
    </div>
  )
}
