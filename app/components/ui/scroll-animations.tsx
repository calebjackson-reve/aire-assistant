'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

// ── Reveal on scroll — fade up with stagger ──────────────────────
export function Reveal({
  children,
  className = '',
  delay = 0,
}: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.unobserve(el)
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -60px 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(32px)',
        transition: `opacity 0.7s cubic-bezier(0.22, 1, 0.36, 1) ${delay}s, transform 0.7s cubic-bezier(0.22, 1, 0.36, 1) ${delay}s`,
      }}
    >
      {children}
    </div>
  )
}

// ── Text reveal — line by line ───────────────────────────────────
export function TextReveal({
  children,
  className = '',
}: {
  children: string
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.unobserve(el)
        }
      },
      { threshold: 0.3 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const words = children.split(' ')

  return (
    <span ref={ref} className={className}>
      {words.map((word, i) => (
        <span key={i} className="inline-block overflow-hidden">
          <span
            className="inline-block"
            style={{
              transform: visible ? 'translateY(0)' : 'translateY(110%)',
              transition: `transform 0.6s cubic-bezier(0.22, 1, 0.36, 1) ${i * 0.04}s`,
            }}
          >
            {word}&nbsp;
          </span>
        </span>
      ))}
    </span>
  )
}

// ── Animated counter — counts up on scroll ───────────────────────
export function Counter({
  target,
  prefix = '',
  suffix = '',
  duration = 2000,
  className = '',
}: {
  target: number
  prefix?: string
  suffix?: string
  duration?: number
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const [value, setValue] = useState(0)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started) {
          setStarted(true)
          observer.unobserve(el)
        }
      },
      { threshold: 0.5 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [started])

  useEffect(() => {
    if (!started) return
    const start = performance.now()
    function update(now: number) {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // ease out cubic
      setValue(Math.round(target * eased))
      if (progress < 1) requestAnimationFrame(update)
    }
    requestAnimationFrame(update)
  }, [started, target, duration])

  return (
    <span ref={ref} className={className}>
      {prefix}{value.toLocaleString()}{suffix}
    </span>
  )
}

// ── Magnetic button — follows cursor on hover ────────────────────
export function MagneticButton({
  children,
  className = '',
  href,
  onClick,
}: {
  children: ReactNode
  className?: string
  href?: string
  onClick?: () => void
}) {
  const ref = useRef<HTMLAnchorElement & HTMLButtonElement>(null)

  function handleMouseMove(e: React.MouseEvent) {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = e.clientX - rect.left - rect.width / 2
    const y = e.clientY - rect.top - rect.height / 2
    el.style.transform = `translate(${x * 0.25}px, ${y * 0.25}px)`
  }

  function handleMouseLeave() {
    const el = ref.current
    if (el) el.style.transform = 'translate(0, 0)'
  }

  const props = {
    ref,
    className: `inline-block transition-transform duration-300 ease-out ${className}`,
    onMouseMove: handleMouseMove,
    onMouseLeave: handleMouseLeave,
    style: { willChange: 'transform' as const },
  }

  if (href) {
    return <a {...props} href={href}>{children}</a>
  }
  return <button {...props} onClick={onClick} type="button">{children}</button>
}

// ── Horizontal ticker — auto-scrolling text ──────────────────────
export function Ticker({
  children,
  speed = 30,
  className = '',
}: {
  children: ReactNode
  speed?: number
  className?: string
}) {
  return (
    <div className={`overflow-hidden ${className}`}>
      <div
        className="flex whitespace-nowrap"
        style={{
          animation: `ticker ${speed}s linear infinite`,
        }}
      >
        <div className="flex shrink-0 items-center">{children}</div>
        <div className="flex shrink-0 items-center" aria-hidden>{children}</div>
      </div>
      <style>{`
        @keyframes ticker {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  )
}
