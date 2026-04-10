"use client"

import { useEffect, useRef } from "react"

export function WireframeGlobe({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const size = 500
    canvas.width = size * dpr
    canvas.height = size * dpr
    canvas.style.width = `${size}px`
    canvas.style.height = `${size}px`
    ctx.scale(dpr, dpr)

    const cx = size / 2
    const cy = size / 2
    const radius = size * 0.42
    let rotation = 0

    // Generate dot grid on sphere surface
    const dots: { lat: number; lng: number }[] = []
    const dotSpacing = 8 // degrees
    for (let lat = -80; lat <= 80; lat += dotSpacing) {
      const latRad = (lat * Math.PI) / 180
      const circumference = Math.cos(latRad)
      const dotsInRow = Math.max(4, Math.floor((360 / dotSpacing) * circumference))
      for (let i = 0; i < dotsInRow; i++) {
        const lng = (i / dotsInRow) * 360 - 180
        dots.push({ lat, lng })
      }
    }

    // Simplified land masses (rough continent outlines as lat/lng bounding boxes)
    const landRegions = [
      // North America
      { latMin: 15, latMax: 72, lngMin: -170, lngMax: -50 },
      // South America
      { latMin: -56, latMax: 15, lngMin: -82, lngMax: -34 },
      // Europe
      { latMin: 35, latMax: 72, lngMin: -10, lngMax: 40 },
      // Africa
      { latMin: -35, latMax: 37, lngMin: -18, lngMax: 52 },
      // Asia
      { latMin: 5, latMax: 72, lngMin: 40, lngMax: 150 },
      // Australia
      { latMin: -45, latMax: -10, lngMin: 112, lngMax: 155 },
    ]

    const isLand = (lat: number, lng: number): boolean => {
      return landRegions.some(
        (r) => lat >= r.latMin && lat <= r.latMax && lng >= r.lngMin && lng <= r.lngMax
      )
    }

    // Project 3D point to 2D
    const project = (lat: number, lng: number, rot: number): { x: number; y: number; visible: boolean } => {
      const latRad = (lat * Math.PI) / 180
      const lngRad = ((lng + rot) * Math.PI) / 180

      const x = Math.cos(latRad) * Math.sin(lngRad)
      const y = -Math.sin(latRad)
      const z = Math.cos(latRad) * Math.cos(lngRad)

      return {
        x: cx + x * radius,
        y: cy + y * radius,
        visible: z > 0,
      }
    }

    const draw = () => {
      ctx.clearRect(0, 0, size, size)

      // Globe outline circle
      ctx.beginPath()
      ctx.arc(cx, cy, radius, 0, Math.PI * 2)
      ctx.strokeStyle = "rgba(107, 125, 82, 0.15)"
      ctx.lineWidth = 1
      ctx.stroke()

      // Latitude lines (wireframe)
      for (let lat = -60; lat <= 60; lat += 30) {
        ctx.beginPath()
        let started = false
        for (let lng = -180; lng <= 180; lng += 2) {
          const p = project(lat, lng, rotation)
          if (p.visible) {
            if (!started) {
              ctx.moveTo(p.x, p.y)
              started = true
            } else {
              ctx.lineTo(p.x, p.y)
            }
          } else {
            started = false
          }
        }
        ctx.strokeStyle = "rgba(107, 125, 82, 0.08)"
        ctx.lineWidth = 0.5
        ctx.stroke()
      }

      // Longitude lines (wireframe)
      for (let lng = -180; lng < 180; lng += 30) {
        ctx.beginPath()
        let started = false
        for (let lat = -90; lat <= 90; lat += 2) {
          const p = project(lat, lng, rotation)
          if (p.visible) {
            if (!started) {
              ctx.moveTo(p.x, p.y)
              started = true
            } else {
              ctx.lineTo(p.x, p.y)
            }
          } else {
            started = false
          }
        }
        ctx.strokeStyle = "rgba(107, 125, 82, 0.08)"
        ctx.lineWidth = 0.5
        ctx.stroke()
      }

      // Draw dots
      dots.forEach((dot) => {
        const p = project(dot.lat, dot.lng, rotation)
        if (!p.visible) return

        const land = isLand(dot.lat, dot.lng)
        const dotRadius = land ? 1.8 : 0.8
        const alpha = land ? 0.6 : 0.12

        // Highlight Louisiana region (roughly lat 29-33, lng -94 to -89)
        const isLouisiana =
          dot.lat >= 29 && dot.lat <= 33 &&
          (dot.lng + rotation) % 360 >= -94 && (dot.lng + rotation) % 360 <= -89

        ctx.beginPath()
        ctx.arc(p.x, p.y, dotRadius, 0, Math.PI * 2)

        if (isLouisiana) {
          ctx.fillStyle = "rgba(154, 171, 126, 0.9)"
          ctx.fill()
          // Glow
          ctx.beginPath()
          ctx.arc(p.x, p.y, 4, 0, Math.PI * 2)
          ctx.fillStyle = "rgba(154, 171, 126, 0.15)"
          ctx.fill()
        } else {
          ctx.fillStyle = land
            ? `rgba(107, 125, 82, ${alpha})`
            : `rgba(154, 171, 126, ${alpha})`
          ctx.fill()
        }
      })

      rotation += 0.15
      requestAnimationFrame(draw)
    }

    const animId = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animId)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={`${className}`}
      style={{ width: 500, height: 500 }}
    />
  )
}
