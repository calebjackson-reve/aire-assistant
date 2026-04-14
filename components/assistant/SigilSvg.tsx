// The AIRE sigil — 48px conic-gradient mark (olive → sage → cream)
// Pure visual primitive; no client state. Animations ride on data-state via
// locally-scoped keyframes so the parent can drive them without re-rendering.
// Why CSS conic-gradient instead of true SVG: SVG has only linear/radial
// gradients natively. Conic-gradient is the 2026 canonical technique for orb
// marks (Siri, Superhuman, Raycast). Kept on CSS to render in <1ms, scale
// cleanly, and stay WebGL-free per C3 constraint.

export type SigilState = "idle" | "listening" | "thinking"

interface SigilSvgProps {
  size?: number
  state?: SigilState
  className?: string
}

const KEYFRAMES = `
@keyframes aire-sigil-rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@keyframes aire-sigil-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}
.aire-sigil-ring { transform-origin: center; will-change: transform; }
.aire-sigil-ring[data-state="listening"] {
  animation: aire-sigil-rotate 4s linear infinite;
}
.aire-sigil-ring[data-state="thinking"] {
  animation: aire-sigil-pulse 1.2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
@media (prefers-reduced-motion: reduce) {
  .aire-sigil-ring { animation: none !important; }
}
`

export function SigilSvg({ size = 48, state = "idle", className = "" }: SigilSvgProps) {
  const innerInset = Math.round(size * 0.22)
  return (
    <span
      className={`relative inline-block align-middle ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <style>{KEYFRAMES}</style>

      {/* Outer conic ring — the rotating element */}
      <span
        className="aire-sigil-ring absolute inset-0 rounded-full"
        data-state={state}
        style={{
          background:
            "conic-gradient(from 210deg, #6b7d52 0deg, #9aab7e 140deg, #f5f2ea 240deg, #9aab7e 320deg, #6b7d52 360deg)",
          boxShadow:
            "0 1px 2px rgba(30, 36, 22, 0.18), 0 8px 24px -6px rgba(30, 36, 22, 0.32)",
        }}
      />

      {/* Inner disc — stays still so the gradient reads as a ring, not a wheel */}
      <span
        className="absolute rounded-full"
        style={{
          top: innerInset,
          right: innerInset,
          bottom: innerInset,
          left: innerInset,
          background:
            "radial-gradient(circle at 35% 30%, #f5f2ea 0%, #e8e4d8 55%, #9aab7e 100%)",
          boxShadow:
            "inset 0 1px 0 rgba(245, 242, 234, 0.6), inset 0 -1px 0 rgba(30, 36, 22, 0.22)",
        }}
      />

      {/* Specular hairline — 1px cream highlight on the top edge */}
      <span
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(120% 70% at 30% 10%, rgba(245, 242, 234, 0.55), transparent 55%)",
          mixBlendMode: "screen",
        }}
      />
    </span>
  )
}
