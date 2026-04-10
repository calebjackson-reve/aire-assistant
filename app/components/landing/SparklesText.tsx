"use client"

import { useEffect, useRef } from "react"

export function SparklesText({
  text = "AIRE",
  className = "",
}: {
  text?: string
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1

    const resize = () => {
      const rect = container.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
      ctx.scale(dpr, dpr)
    }
    resize()

    interface Sparkle {
      x: number
      y: number
      size: number
      opacity: number
      speed: number
      phase: number
      color: string
    }

    const colors = [
      "rgba(154, 171, 126, 0.9)",  // sage
      "rgba(107, 125, 82, 0.8)",   // olive
      "rgba(232, 228, 216, 0.9)",  // linen
      "rgba(245, 242, 234, 0.7)",  // cream
      "rgba(154, 171, 126, 0.6)",  // sage light
    ]

    const sparkles: Sparkle[] = []
    const rect = container.getBoundingClientRect()
    const count = 60

    for (let i = 0; i < count; i++) {
      sparkles.push({
        x: Math.random() * rect.width,
        y: Math.random() * rect.height,
        size: Math.random() * 2.5 + 0.5,
        opacity: Math.random(),
        speed: Math.random() * 2 + 1,
        phase: Math.random() * Math.PI * 2,
        color: colors[Math.floor(Math.random() * colors.length)],
      })
    }

    let frame = 0
    const draw = () => {
      const w = rect.width
      const h = rect.height
      ctx.clearRect(0, 0, w, h)

      sparkles.forEach((s) => {
        s.phase += 0.02 * s.speed
        s.opacity = (Math.sin(s.phase) + 1) / 2

        // Subtle drift
        s.y -= 0.15 * s.speed
        s.x += Math.sin(s.phase * 0.5) * 0.3

        // Wrap around
        if (s.y < -5) {
          s.y = h + 5
          s.x = Math.random() * w
        }
        if (s.x < -5) s.x = w + 5
        if (s.x > w + 5) s.x = -5

        // Draw sparkle
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2)
        ctx.fillStyle = s.color.replace(/[\d.]+\)$/, `${s.opacity * 0.8})`)
        ctx.fill()

        // Cross sparkle effect for larger particles
        if (s.size > 1.5 && s.opacity > 0.6) {
          ctx.beginPath()
          ctx.moveTo(s.x - s.size * 2, s.y)
          ctx.lineTo(s.x + s.size * 2, s.y)
          ctx.moveTo(s.x, s.y - s.size * 2)
          ctx.lineTo(s.x, s.y + s.size * 2)
          ctx.strokeStyle = s.color.replace(/[\d.]+\)$/, `${s.opacity * 0.3})`)
          ctx.lineWidth = 0.5
          ctx.stroke()
        }
      })

      frame++
      requestAnimationFrame(draw)
    }

    const animId = requestAnimationFrame(draw)
    window.addEventListener("resize", resize)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener("resize", resize)
    }
  }, [])

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none z-10"
      />
      <span className="relative z-0">{text}</span>
    </div>
  )
}
