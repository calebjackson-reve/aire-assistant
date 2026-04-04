"use client"

import * as React from "react"
import { ChevronRight } from "lucide-react"

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string
  description?: string
  tag?: string
  href?: string
  variant?: "default" | "warm" | "copper"
}

const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, title, description, tag, href, variant = "default", children, ...props }, ref) => {
    const variantStyles = {
      default: {
        circles: "bg-white/8",
        accent: "bg-white",
      },
      warm: {
        circles: "bg-white/6",
        accent: "bg-white",
      },
      copper: {
        circles: "bg-[#C4A882]/10",
        accent: "bg-[#C4A882]",
      },
    }

    const v = variantStyles[variant]

    const Wrapper = href ? "a" : "div"

    return (
      <Wrapper
        ref={ref as React.Ref<HTMLDivElement & HTMLAnchorElement>}
        href={href}
        className={`group h-[280px] w-full [perspective:1000px] cursor-pointer no-underline block ${className ?? ""}`}
        {...(props as React.HTMLAttributes<HTMLElement>)}
      >
        <div className="relative h-full rounded-3xl bg-gradient-to-br from-white/40 to-white/20 shadow-lg transition-all duration-500 ease-in-out [transform-style:preserve-3d] group-hover:[box-shadow:rgba(0,0,0,0.1)_10px_20px_20px_-15px,rgba(0,0,0,0.05)_0px_10px_15px_0px] group-hover:[transform:rotate3d(1,1,0,10deg)]" style={{ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.5)', borderTop: '1px solid rgba(255,255,255,0.7)' }}>
          {/* Glass overlay */}
          <div className="absolute inset-1.5 rounded-[26px] border-b border-l border-white/30 bg-gradient-to-b from-white/20 to-white/5 backdrop-blur-sm [transform-style:preserve-3d] [transform:translate3d(0,0,20px)]" />

          {/* Content */}
          <div className="absolute [transform:translate3d(0,0,22px)] inset-0 flex flex-col justify-between p-6">
            <div>
              {tag && (
                <span className="text-[10px] font-semibold tracking-[0.12em] uppercase text-[#5A6B3A] block mb-4">
                  {tag}
                </span>
              )}
              {title && (
                <span className="block text-lg font-semibold text-[#2A2A24]">
                  {title}
                </span>
              )}
              {description && (
                <span className="mt-3 block text-sm text-[#2A2A24]/50 leading-relaxed">
                  {description}
                </span>
              )}
              {children}
            </div>

            {href && (
              <div className="flex items-center gap-1 text-xs text-[#5A6B3A] group-hover:text-[#5A6B3A] transition-colors">
                <span>Open</span>
                <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </div>
            )}
          </div>

          {/* Floating circles — 3D depth */}
          <div className="absolute top-0 right-0 [transform-style:preserve-3d]">
            {[
              { size: "120px", pos: "6px", z: "15px", delay: "0s" },
              { size: "90px", pos: "12px", z: "30px", delay: "0.3s" },
              { size: "60px", pos: "20px", z: "45px", delay: "0.6s" },
            ].map((circle, index) => (
              <div
                key={index}
                className={`absolute aspect-square rounded-full ${v.circles} shadow-[rgba(100,100,111,0.15)_-8px_8px_16px_0px] transition-all duration-500 ease-in-out`}
                style={{
                  width: circle.size,
                  top: circle.pos,
                  right: circle.pos,
                  transform: `translate3d(0, 0, ${circle.z})`,
                  transitionDelay: circle.delay,
                }}
              />
            ))}
          </div>
        </div>
      </Wrapper>
    )
  }
)

GlassCard.displayName = "GlassCard"

export { GlassCard }
