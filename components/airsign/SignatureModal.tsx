"use client"

/**
 * AirSign Layer 3 — Signature Capture Modal
 * Three modes: Draw (canvas), Type (with font selection), Upload (image).
 * Returns signature as data URL (PNG) for embedding into PDF.
 */

import { useState, useRef, useEffect, useCallback } from "react"

export interface SignatureResult {
  dataUrl: string       // PNG data URL of signature
  mode: "draw" | "type" | "upload"
  fontFamily?: string   // only for type mode
  text?: string         // only for type mode
}

interface SignatureModalProps {
  signerName: string
  onComplete: (result: SignatureResult) => void
  onCancel: () => void
  mode?: "signature" | "initials"
}

// ─── SIGNATURE FONTS ────────────────────────────────────────────────────────

export const SIGNATURE_FONTS = [
  { name: "Allura", family: "'Allura', cursive", url: "https://fonts.googleapis.com/css2?family=Allura&display=swap" },
  { name: "Dancing Script", family: "'Dancing Script', cursive", url: "https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&display=swap" },
  { name: "Great Vibes", family: "'Great Vibes', cursive", url: "https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap" },
  { name: "Sacramento", family: "'Sacramento', cursive", url: "https://fonts.googleapis.com/css2?family=Sacramento&display=swap" },
  { name: "Parisienne", family: "'Parisienne', cursive", url: "https://fonts.googleapis.com/css2?family=Parisienne&display=swap" },
  { name: "Caveat", family: "'Caveat', cursive", url: "https://fonts.googleapis.com/css2?family=Caveat:wght@700&display=swap" },
]

// ─── INITIALS GENERATOR ─────────────────────────────────────────────────────

export function generateInitials(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .map(w => w[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 3) // max 3 initials
}

// ─── COMPONENT ──────────────────────────────────────────────────────────────

export function SignatureModal({ signerName, onComplete, onCancel, mode = "signature" }: SignatureModalProps) {
  const [tab, setTab] = useState<"draw" | "type">("type")
  const [selectedFont, setSelectedFont] = useState(0)
  const [typedText, setTypedText] = useState(mode === "initials" ? generateInitials(signerName) : signerName)
  const [fontsLoaded, setFontsLoaded] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawingRef = useRef(false)
  const lastPosRef = useRef({ x: 0, y: 0 })

  const isInitials = mode === "initials"
  const canvasWidth = isInitials ? 200 : 500
  const canvasHeight = isInitials ? 80 : 120

  // Load Google Fonts
  useEffect(() => {
    const existing = document.getElementById("airsign-signature-fonts")
    if (!existing) {
      const urls = SIGNATURE_FONTS.map(f => `@import url('${f.url}');`).join("\n")
      const style = document.createElement("style")
      style.id = "airsign-signature-fonts"
      style.textContent = urls
      document.head.appendChild(style)
    }
    // Give fonts time to load
    const timer = setTimeout(() => setFontsLoaded(true), 800)
    return () => clearTimeout(timer)
  }, [])

  // Initialize canvas
  useEffect(() => {
    if (tab !== "draw") return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.fillStyle = "white"
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)
    ctx.strokeStyle = "#1e2416"
    ctx.lineWidth = 2.5
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
  }, [tab, canvasWidth, canvasHeight])

  const getCanvasPos = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    const clientX = 'touches' in e ? e.touches[0]?.clientX ?? e.changedTouches[0]?.clientX ?? 0 : e.clientX
    const clientY = 'touches' in e ? e.touches[0]?.clientY ?? e.changedTouches[0]?.clientY ?? 0 : e.clientY
    return {
      x: (clientX - rect.left) * (canvasRef.current!.width / rect.width),
      y: (clientY - rect.top) * (canvasRef.current!.height / rect.height),
    }
  }, [])

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    isDrawingRef.current = true
    lastPosRef.current = getCanvasPos(e)
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current) return
    const ctx = canvasRef.current?.getContext("2d")
    if (!ctx) return
    const pos = getCanvasPos(e)
    ctx.beginPath()
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    lastPosRef.current = pos
  }

  function handleMouseUp() {
    isDrawingRef.current = false
  }

  // Touch handlers for mobile signing
  function handleTouchStart(e: React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault() // prevent scroll while drawing
    isDrawingRef.current = true
    lastPosRef.current = getCanvasPos(e)
  }

  function handleTouchMove(e: React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault()
    if (!isDrawingRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!ctx) return
    const pos = getCanvasPos(e)
    ctx.beginPath()
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    lastPosRef.current = pos
  }

  function handleTouchEnd(e: React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault()
    isDrawingRef.current = false
  }

  function clearCanvas() {
    const ctx = canvasRef.current?.getContext("2d")
    if (!ctx) return
    ctx.fillStyle = "white"
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)
  }

  function renderTypedSignature(): string {
    // Render typed text to canvas and return data URL
    const canvas = document.createElement("canvas")
    canvas.width = canvasWidth
    canvas.height = canvasHeight
    const ctx = canvas.getContext("2d")
    if (!ctx) return ""

    ctx.fillStyle = "white"
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)

    const font = SIGNATURE_FONTS[selectedFont]
    const fontSize = isInitials ? 40 : 36
    ctx.font = `${fontSize}px ${font.family}`
    ctx.fillStyle = "#1e2416"
    ctx.textBaseline = "middle"

    // Center the text
    const metrics = ctx.measureText(typedText)
    const x = Math.max(8, (canvasWidth - metrics.width) / 2)
    ctx.fillText(typedText, x, canvasHeight / 2)

    // Draw baseline
    if (!isInitials) {
      ctx.strokeStyle = "#9aab7e"
      ctx.lineWidth = 0.5
      ctx.beginPath()
      ctx.moveTo(20, canvasHeight * 0.72)
      ctx.lineTo(canvasWidth - 20, canvasHeight * 0.72)
      ctx.stroke()
    }

    return canvas.toDataURL("image/png")
  }

  function handleComplete() {
    if (tab === "draw") {
      const dataUrl = canvasRef.current?.toDataURL("image/png")
      if (!dataUrl) return
      onComplete({ dataUrl, mode: "draw" })
    } else {
      const dataUrl = renderTypedSignature()
      if (!dataUrl) return
      onComplete({
        dataUrl,
        mode: "type",
        fontFamily: SIGNATURE_FONTS[selectedFont].family,
        text: typedText,
      })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 overflow-y-auto p-4" onClick={onCancel}>
      <div
        className="bg-[#f5f2ea] rounded-xl shadow-2xl w-full max-w-lg mx-auto my-auto max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-3">
          <h3 className="font-[family-name:var(--font-cormorant)] italic text-[#1e2416] text-lg">
            {isInitials ? "Add Your Initials" : "Add Your Signature"}
          </h3>
          <p className="text-[#6b7d52]/60 text-xs mt-1">
            {isInitials ? "Type or draw your initials" : "Choose how you'd like to sign"}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 mb-4">
          <button
            onClick={() => setTab("type")}
            className={`text-xs px-4 py-1.5 rounded-full transition ${
              tab === "type" ? "bg-[#6b7d52] text-[#f5f2ea]" : "text-[#6b7d52] hover:bg-[#9aab7e]/10"
            }`}
          >
            Type
          </button>
          <button
            onClick={() => setTab("draw")}
            className={`text-xs px-4 py-1.5 rounded-full transition ${
              tab === "draw" ? "bg-[#6b7d52] text-[#f5f2ea]" : "text-[#6b7d52] hover:bg-[#9aab7e]/10"
            }`}
          >
            Draw
          </button>
        </div>

        {/* Content — scrollable */}
        <div className="px-6 pb-2 overflow-y-auto flex-1 min-h-0">
          {tab === "type" ? (
            <div>
              <input
                type="text"
                value={typedText}
                onChange={e => setTypedText(e.target.value)}
                className="w-full bg-white border border-[#9aab7e]/20 rounded-lg px-4 py-2.5 text-[#1e2416] text-sm focus:outline-none focus:border-[#9aab7e]/50 mb-3"
                placeholder={isInitials ? "Your initials" : "Your full name"}
              />

              {/* Font previews */}
              <div className="space-y-1.5">
                {SIGNATURE_FONTS.map((font, i) => (
                  <button
                    key={font.name}
                    onClick={() => setSelectedFont(i)}
                    className={`w-full text-left px-4 py-2.5 rounded-lg border transition ${
                      selectedFont === i
                        ? "border-[#6b7d52] bg-white shadow-sm"
                        : "border-transparent hover:bg-white/50"
                    }`}
                  >
                    <span
                      className="text-[#1e2416] block"
                      style={{
                        fontFamily: font.family,
                        fontSize: isInitials ? "28px" : "24px",
                        opacity: fontsLoaded ? 1 : 0.3,
                      }}
                    >
                      {typedText || (isInitials ? "AB" : "Your Name")}
                    </span>
                    <span className="text-[#6b7d52]/40 text-[9px] uppercase tracking-wider">{font.name}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <div className="bg-white rounded-lg border border-[#9aab7e]/20 overflow-hidden">
                <canvas
                  ref={canvasRef}
                  width={canvasWidth}
                  height={canvasHeight}
                  className="w-full cursor-crosshair"
                  style={{ height: canvasHeight }}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                />
              </div>
              <button
                onClick={clearCanvas}
                className="text-[#6b7d52] text-xs mt-2 hover:underline"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {/* Actions — sticky at bottom */}
        <div className="flex gap-3 px-6 py-4 border-t border-[#9aab7e]/10 shrink-0">
          <button
            onClick={onCancel}
            className="flex-1 border border-[#9aab7e]/20 text-[#6b7d52] py-2.5 rounded-lg text-sm hover:bg-[#9aab7e]/5 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleComplete}
            disabled={tab === "type" && !typedText.trim()}
            className="flex-1 bg-[#6b7d52] text-[#f5f2ea] py-2.5 rounded-lg text-sm font-medium hover:bg-[#6b7d52]/90 disabled:opacity-40 transition"
          >
            {isInitials ? "Apply Initials" : "Apply Signature"}
          </button>
        </div>
      </div>
    </div>
  )
}
