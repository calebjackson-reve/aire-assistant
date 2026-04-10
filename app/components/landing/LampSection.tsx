"use client"

import { useScrollReveal } from "@/app/hooks/useScrollReveal"

export function LampSection({
  label,
  title,
  description,
  children,
}: {
  label: string
  title: string
  description: string
  children?: React.ReactNode
}) {
  const { ref, isVisible } = useScrollReveal<HTMLDivElement>(0.15)

  return (
    <div
      ref={ref}
      className="relative flex min-h-[500px] flex-col items-center justify-center overflow-hidden bg-[#1e2416] w-full rounded-3xl"
    >
      {/* Lamp effect — conic gradients expanding on scroll */}
      <div className="relative flex w-full flex-1 scale-y-125 items-center justify-center isolate z-0">
        {/* Left beam */}
        <div
          className="absolute inset-auto right-1/2 h-56 overflow-visible transition-all duration-1000 ease-out"
          style={{
            width: isVisible ? "30rem" : "15rem",
            opacity: isVisible ? 1 : 0.5,
            background: "conic-gradient(from 70deg at center top, #9aab7e, transparent, transparent)",
          }}
        >
          <div className="absolute w-full left-0 bg-[#1e2416] h-40 bottom-0 z-20" style={{ maskImage: "linear-gradient(to top, white, transparent)" }} />
          <div className="absolute w-40 h-full left-0 bg-[#1e2416] bottom-0 z-20" style={{ maskImage: "linear-gradient(to right, white, transparent)" }} />
        </div>

        {/* Right beam */}
        <div
          className="absolute inset-auto left-1/2 h-56 overflow-visible transition-all duration-1000 ease-out"
          style={{
            width: isVisible ? "30rem" : "15rem",
            opacity: isVisible ? 1 : 0.5,
            background: "conic-gradient(from 290deg at center top, transparent, transparent, #9aab7e)",
          }}
        >
          <div className="absolute w-40 h-full right-0 bg-[#1e2416] bottom-0 z-20" style={{ maskImage: "linear-gradient(to left, white, transparent)" }} />
          <div className="absolute w-full right-0 bg-[#1e2416] h-40 bottom-0 z-20" style={{ maskImage: "linear-gradient(to top, white, transparent)" }} />
        </div>

        {/* Glow layers */}
        <div className="absolute top-1/2 h-48 w-full translate-y-12 scale-x-150 bg-[#1e2416] blur-2xl" />
        <div className="absolute top-1/2 z-50 h-48 w-full bg-transparent opacity-10 backdrop-blur-md" />
        <div
          className="absolute inset-auto z-50 h-36 w-[28rem] -translate-y-1/2 rounded-full bg-[#9aab7e] blur-3xl transition-opacity duration-1000"
          style={{ opacity: isVisible ? 0.4 : 0.1 }}
        />

        {/* Center beam line */}
        <div
          className="absolute inset-auto z-50 h-0.5 -translate-y-[7rem] bg-[#9aab7e] rounded-full transition-all duration-1000 ease-out"
          style={{ width: isVisible ? "30rem" : "15rem" }}
        />

        {/* Dark cover above */}
        <div className="absolute inset-auto z-40 h-44 w-full -translate-y-[12.5rem] bg-[#1e2416]" />
      </div>

      {/* Content */}
      <div className="relative z-50 flex -translate-y-60 flex-col items-center px-6 text-center">
        <p
          className="text-[10px] tracking-[0.2em] uppercase text-[#9aab7e]/60 mb-4"
          style={{ fontFamily: "var(--font-label)" }}
        >
          {label}
        </p>
        <h2
          className="text-3xl md:text-5xl font-light italic text-[#f5f2ea] mb-4 max-w-2xl leading-tight transition-all duration-1000"
          style={{
            fontFamily: "var(--font-cormorant)",
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? "translateY(0)" : "translateY(40px)",
          }}
        >
          {title}
        </h2>
        <p className="text-[#e8e4d8]/50 text-sm md:text-base max-w-lg leading-relaxed mb-8">
          {description}
        </p>
        {children}
      </div>
    </div>
  )
}
