// components/ui/primitives.tsx
//
// Canonical primitive barrel. Every cluster agent imports shared
// primitives from here, not from scattered paths.
//
//   import { SectionLabel, HairlineDivider } from "@/components/ui/primitives"
//
// Adding a new primitive? Put the source in components/ui/primitives/<Name>.tsx
// and re-export from this file.
//
// Cluster agents: if you catch yourself re-implementing any of these,
// STOP and use the shared version instead. Drift is the enemy.
//
// TODO (cluster waves 2-7):
//   StatCard       — 3px olive left border, IBM Plex Mono 32px value (DESIGN.md §4)
//   StatusBadge    — 5 variants (Active / Pending / Overdue / Info / Draft)
//   CardGlass      — elevated surface + cream/40 hairline top edge + shadow-tint
//   GlossyToggle   — hairline + specular sage + shine sweep (C6)
//   AgentPulse     — 48px sage ring pulse when any agent is running (C1)
//   ThemeToggle    — Daylight / Nocturne switcher (persists to localStorage)
//
// Already-shipped primitives and their current homes (merge when touched):
//   SegmentErrorBoundary — exists on `ops/nightbuild` branch, not yet merged to main
//   ToastProvider        — exists on `ops/nightbuild` branch, not yet merged to main
//   FeedbackButtons      — components/FeedbackButtons.tsx (move to /ui/primitives/ when touched)

export { SectionLabel } from "./primitives/SectionLabel"

// ── HairlineDivider ──────────────────────────────────────────
// 1px dividing rule. Cream/40 on dark surfaces, olive/20 on light.
// Use between editorial sections (SectionLabel → content → HairlineDivider).
type HairlineProps = {
  variant?: "light" | "dark"
  /** Alias for variant — accepted for backward compat with cluster agents */
  tone?: "light" | "dark"
  className?: string
}

export function HairlineDivider({ variant, tone, className = "" }: HairlineProps) {
  const resolved = variant ?? tone ?? "light"
  const base = resolved === "dark"
    ? "bg-[#e8e4d8]/20"  // Linen/20 on Nocturne
    : "bg-[#6b7d52]/20"  // Olive/20 on Daylight
  return <div role="separator" className={`h-px w-full ${base} ${className}`} />
}
