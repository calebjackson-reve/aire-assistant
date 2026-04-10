'use client'

import { useState } from 'react'

export interface CardFlipProps {
  title: string
  subtitle: string
  description: string
  features: string[]
  icon: React.ReactNode
  cta?: string
  href?: string
}

export function CardFlip({
  title,
  subtitle,
  description,
  features,
  icon,
  cta = "Try it free",
  href = "/sign-up",
}: CardFlipProps) {
  const [isFlipped, setIsFlipped] = useState(false)

  return (
    <div
      className="group relative h-[340px] w-full [perspective:2000px]"
      onMouseEnter={() => setIsFlipped(true)}
      onMouseLeave={() => setIsFlipped(false)}
    >
      <div
        className={`relative h-full w-full [transform-style:preserve-3d] transition-all duration-700 ${
          isFlipped ? '[transform:rotateY(180deg)]' : '[transform:rotateY(0deg)]'
        }`}
      >
        {/* Front */}
        <div
          className={`absolute inset-0 h-full w-full [transform:rotateY(0deg)] [backface-visibility:hidden] overflow-hidden rounded-2xl bg-white border border-[#d4c8b8]/30 shadow-[0_4px_24px_rgba(30,36,22,0.06)] transition-all duration-700 group-hover:shadow-[0_12px_40px_rgba(30,36,22,0.12)] group-hover:border-[#9aab7e]/30 ${
            isFlipped ? 'opacity-0' : 'opacity-100'
          }`}
        >
          {/* Gradient accent */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#9aab7e]/5 via-transparent to-[#6b7d52]/5" />

          {/* Animated lines */}
          <div className="absolute inset-0 flex items-center justify-center pt-16">
            <div className="relative flex h-[80px] w-[180px] flex-col items-center justify-center gap-2">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="h-2.5 rounded-sm bg-gradient-to-r from-[#9aab7e]/15 via-[#9aab7e]/25 to-[#9aab7e]/15 opacity-0"
                  style={{
                    width: `${55 + Math.random() * 45}%`,
                    marginLeft: `${Math.random() * 20}%`,
                    animation: 'slideIn 2s ease-in-out infinite',
                    animationDelay: `${i * 0.2}s`,
                  }}
                />
              ))}

              {/* Center icon */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-[#6b7d52] via-[#6b7d52]/90 to-[#9aab7e] flex items-center justify-center shadow-[0_4px_16px_rgba(107,125,82,0.3)] animate-pulse transition-all duration-500 group-hover:scale-110 group-hover:rotate-6">
                  {icon}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom content */}
          <div className="absolute right-0 bottom-0 left-0 p-5">
            <div className="space-y-1.5">
              <h3 className="text-base font-semibold tracking-tight text-[#1e2416] transition-all duration-500 group-hover:translate-y-[-3px]">
                {title}
              </h3>
              <p className="text-sm text-[#6a6a60] line-clamp-2 transition-all duration-500 delay-[50ms] group-hover:translate-y-[-3px]">
                {subtitle}
              </p>
            </div>
          </div>
        </div>

        {/* Back */}
        <div
          className={`absolute inset-0 h-full w-full [transform:rotateY(180deg)] [backface-visibility:hidden] rounded-2xl p-5 bg-white border border-[#d4c8b8]/30 shadow-[0_12px_40px_rgba(30,36,22,0.12)] flex flex-col transition-all duration-700 group-hover:border-[#9aab7e]/30 ${
            !isFlipped ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#9aab7e]/5 via-transparent to-[#6b7d52]/5" />

          <div className="relative z-10 flex-1 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-[#6b7d52] to-[#9aab7e] flex items-center justify-center">
                  {icon}
                </div>
                <h3 className="text-base font-semibold tracking-tight text-[#1e2416]">
                  {title}
                </h3>
              </div>
              <p className="text-sm text-[#6a6a60] line-clamp-2">
                {description}
              </p>
            </div>

            <div className="space-y-2">
              {features.map((feature, index) => (
                <div
                  key={feature}
                  className="flex items-center gap-2.5 text-sm text-[#3a4a28] transition-all duration-500"
                  style={{
                    transform: isFlipped ? 'translateX(0)' : 'translateX(-10px)',
                    opacity: isFlipped ? 1 : 0,
                    transitionDelay: `${index * 100 + 200}ms`,
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#9aab7e] shrink-0" />
                  <span className="font-medium text-[13px]">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-10 mt-auto border-t border-[#d4c8b8]/20 pt-3">
            <a
              href={href}
              className="group/start flex items-center justify-between rounded-lg p-2.5 transition-all duration-300 bg-[#f5f2ea] hover:bg-[#9aab7e]/10 hover:scale-[1.02] hover:cursor-pointer border border-transparent hover:border-[#9aab7e]/20"
            >
              <span className="text-sm font-semibold text-[#1e2416] group-hover/start:text-[#6b7d52] transition-colors duration-300">
                {cta}
              </span>
              <svg className="w-4 h-4 text-[#6b7d52] transition-all duration-300 group-hover/start:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
              </svg>
            </a>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes slideIn {
          0% { transform: translateX(-100px); opacity: 0; }
          50% { transform: translateX(0); opacity: 0.8; }
          100% { transform: translateX(100px); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
