"use client"

import { useScrollReveal, useCountUp } from "@/app/hooks/useScrollReveal"

export function ScrollReveal({
  children,
  className = "",
  delay = 0,
  direction = "up",
  scale = false,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
  direction?: "up" | "left" | "right" | "none"
  scale?: boolean
}) {
  const { ref, isVisible } = useScrollReveal<HTMLDivElement>(0.1)

  const hiddenTransform =
    direction === "up" ? "translateY(40px)" :
    direction === "left" ? "translateX(-60px)" :
    direction === "right" ? "translateX(60px)" :
    "none"

  const hiddenScale = scale ? "scale(0.92)" : ""

  return (
    <div
      ref={ref}
      className={`${className}`}
      style={{
        transition: `opacity 800ms cubic-bezier(0.16, 1, 0.3, 1), transform 1000ms cubic-bezier(0.16, 1, 0.3, 1), filter 800ms ease`,
        transitionDelay: `${delay}ms`,
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translateY(0) translateX(0) scale(1)" : `${hiddenTransform} ${hiddenScale}`,
        filter: isVisible ? "blur(0px)" : "blur(4px)",
      }}
    >
      {children}
    </div>
  )
}

export function StaggeredReveal({
  children,
  className = "",
  staggerMs = 80,
}: {
  children: React.ReactNode[]
  className?: string
  staggerMs?: number
}) {
  const { ref, isVisible } = useScrollReveal<HTMLDivElement>(0.08)

  return (
    <div ref={ref} className={className}>
      {children.map((child, i) => (
        <div
          key={i}
          className={`transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
          }`}
          style={{ transitionDelay: `${i * staggerMs}ms` }}
        >
          {child}
        </div>
      ))}
    </div>
  )
}

export function CountUpStat({
  end,
  prefix = "",
  suffix = "",
  decimals = 0,
  label,
}: {
  end: number
  prefix?: string
  suffix?: string
  decimals?: number
  label: string
}) {
  const { ref, isVisible } = useScrollReveal<HTMLDivElement>(0.2)
  const value = useCountUp(end, isVisible)

  return (
    <div ref={ref} className="text-center">
      <p
        className="stat-number text-3xl md:text-[2.75rem] leading-none transition-[filter] duration-700 ease-out"
        style={{
          fontFeatureSettings: '"tnum"',
          filter: isVisible ? "blur(0px)" : "blur(2px)",
        }}
      >
        {prefix}{value.toFixed(decimals)}<span className="text-ink-faint">{suffix}</span>
      </p>
      <p className="section-label text-ink-faint text-[9px] mt-2">{label}</p>
    </div>
  )
}
