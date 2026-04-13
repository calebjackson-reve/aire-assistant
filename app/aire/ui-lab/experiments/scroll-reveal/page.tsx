"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"

// EXPERIMENT 02 — Scroll Reveal
// Section-by-section reveal via IntersectionObserver + CSS translateY stagger
// + mask-image edge (Linear-grade). Each item inside a section reveals with
// 80ms stagger. Zero library.

const SECTIONS = [
  {
    index: "01",
    title: "A quiet morning in the pipeline.",
    copy: "Eighteen active deals. Three moves today. The map shows clear weather from lunch onward.",
    items: ["5834 Guice — counter due today", "1420 Perkins — appraisal in 2 days", "Coursey closing docs — review"],
  },
  {
    index: "02",
    title: "The numbers that mattered this quarter.",
    copy: "Editorial data. Reads like a magazine spread, moves like a dashboard.",
    items: ["$3.38M in flight", "7 deals closed YTD", "Avg days on market · 10"],
  },
  {
    index: "03",
    title: "What the day wants next.",
    copy: "Agent activity stream. Every item fades in on scroll, mono timestamps anchoring the rhythm.",
    items: ["08:02 — Morning Brief synthesized", "08:14 — 4 new leads triaged", "08:45 — Compliance clean"],
  },
]

export default function ScrollRevealExperiment() {
  return (
    <div className="min-h-screen w-full bg-[#f5f2ea] text-[#2c3520]" style={{ fontFamily: "var(--font-body)" }}>
      <div className="px-10 pt-10 max-w-4xl mx-auto">
        <p
          className="text-[10px] tracking-[0.22em] uppercase text-[#6b7d52] mb-2"
          style={{ fontFamily: "var(--font-ibm-mono)" }}
        >
          Experiment 02
        </p>
        <h1
          className="text-[#1e2416] text-4xl"
          style={{ fontFamily: "var(--font-cormorant)", fontStyle: "italic", fontWeight: 500 }}
        >
          Scroll Reveal
        </h1>
        <p className="mt-4 max-w-xl text-[14px] text-[#4a5638] leading-relaxed">
          Scroll down. Each section fades + translateY(-16px → 0) when its top edge enters the viewport.
          Inside every section the list items stagger 80ms apart. No layout shift — the space is
          reserved by opacity-0 elements.
        </p>
      </div>

      <div className="max-w-4xl mx-auto px-10 pt-16 pb-40 space-y-48">
        {SECTIONS.map((s, i) => (
          <Section key={i} {...s} />
        ))}
        <div className="h-[40vh]" aria-hidden />
      </div>
    </div>
  )
}

function Section({ index, title, copy, items }: { index: string; title: string; copy: string; items: string[] }) {
  const ref = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisible(true)
            io.unobserve(el)
          }
        }
      },
      { threshold: 0.2 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <section ref={ref} className="relative">
      <Reveal visible={visible} delay={0}>
        <p
          className="text-[10px] tracking-[0.22em] uppercase text-[#6b7d52] mb-2"
          style={{ fontFamily: "var(--font-ibm-mono)" }}
        >
          {index} / Section
        </p>
      </Reveal>
      <Reveal visible={visible} delay={80}>
        <h2
          className="text-[#1e2416] text-3xl md:text-4xl leading-tight"
          style={{ fontFamily: "var(--font-cormorant)", fontStyle: "italic", fontWeight: 500 }}
        >
          {title}
        </h2>
      </Reveal>
      <Reveal visible={visible} delay={160}>
        <p className="mt-3 max-w-xl text-[15px] text-[#4a5638] leading-relaxed">{copy}</p>
      </Reveal>
      <ul className="mt-6 space-y-2.5">
        {items.map((item, i) => (
          <Reveal key={i} visible={visible} delay={240 + i * 80}>
            <li className="flex items-start gap-3 text-[14px] text-[#2c3520]">
              <span
                className="w-1.5 h-1.5 rounded-full bg-[#9aab7e] mt-2 shrink-0"
                style={{ boxShadow: "0 0 8px rgba(154,171,126,0.5)" }}
              />
              <span>{item}</span>
            </li>
          </Reveal>
        ))}
      </ul>
    </section>
  )
}

function Reveal({ visible, delay, children }: { visible: boolean; delay: number; children: ReactNode }) {
  return (
    <div
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(16px)",
        transition: `opacity 520ms cubic-bezier(0, 0, 0.2, 1) ${delay}ms, transform 520ms cubic-bezier(0, 0, 0.2, 1) ${delay}ms`,
        willChange: "transform, opacity",
      }}
    >
      {children}
    </div>
  )
}
