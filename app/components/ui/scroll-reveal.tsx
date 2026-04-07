"use client"

import { useScrollReveal, useCountUp } from "@/app/hooks/useScrollReveal"

export function ScrollReveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  const { ref, isVisible } = useScrollReveal<HTMLDivElement>(0.12)

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        isVisible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-6"
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
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
      <p className="stat-number text-3xl md:text-[2.75rem] leading-none">
        {prefix}{value.toFixed(decimals)}<span className="text-ink-faint">{suffix}</span>
      </p>
      <p className="section-label text-ink-faint text-[9px] mt-2">{label}</p>
    </div>
  )
}
