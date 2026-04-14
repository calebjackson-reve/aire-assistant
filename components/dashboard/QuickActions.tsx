"use client"

import Link from "next/link"

export type QuickAction = {
  href: string
  label: string
  hint: string
}

type Props = { actions: QuickAction[] }

export function QuickActions({ actions }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {actions.map((a) => (
        <GlossyAction key={a.href} action={a} />
      ))}
    </div>
  )
}

function GlossyAction({ action }: { action: QuickAction }) {
  return (
    <Link
      href={action.href}
      className="aire-glossy-action group relative overflow-hidden rounded-xl px-4 py-3.5 flex items-center justify-between gap-3 focus:outline-none"
      style={{
        background: "rgba(42,50,36,0.55)",
        border: "1px solid rgba(154,171,126,0.16)",
        boxShadow:
          "inset 0 1px 0 rgba(245,242,234,0.05), 0 1px 0 rgba(30,36,22,0.25)",
        transition:
          "transform 220ms cubic-bezier(0.34,1.56,0.64,1), box-shadow 220ms cubic-bezier(0.2,0.8,0.2,1)",
      }}
    >
      {/* Specular sage — fades in on hover */}
      <span
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(280px 160px at 30% 0%, rgba(154,171,126,0.14), transparent 65%)",
          transition: "opacity 220ms cubic-bezier(0.2,0.8,0.2,1)",
        }}
      />

      {/* Shine sweep — slides across on hover */}
      <span
        aria-hidden
        className="aire-shine pointer-events-none absolute top-0 bottom-0 w-[35%]"
        style={{
          left: "-40%",
          background:
            "linear-gradient(120deg, transparent 40%, rgba(245,242,234,0.10) 50%, transparent 60%)",
          transform: "translateX(0) skewX(-14deg)",
          transition: "transform 520ms cubic-bezier(0.2,0.8,0.2,1)",
        }}
      />

      <div className="relative min-w-0">
        <p
          className="text-[13px] leading-snug truncate"
          style={{ color: "#e8e4d8" }}
        >
          {action.label}
        </p>
        <p
          className="mt-0.5 text-[10px] uppercase tracking-[0.18em] truncate"
          style={{
            fontFamily: "var(--font-ibm-mono)",
            color: "rgba(179,194,149,0.50)",
          }}
        >
          {action.hint}
        </p>
      </div>

      <span
        aria-hidden
        className="relative inline-block"
        style={{
          fontFamily: "var(--font-ibm-mono)",
          color: "rgba(179,194,149,0.40)",
          fontSize: 14,
          transform: "translateX(0)",
          transition: "transform 220ms cubic-bezier(0.34,1.56,0.64,1)",
        }}
      >
        →
      </span>

      <style>{`
        .aire-glossy-action:hover { transform: translateY(-1px); }
        .aire-glossy-action:active { transform: translateY(0) scale(0.98); }
        .aire-glossy-action:hover .aire-shine { transform: translateX(320%) skewX(-14deg); }
        .aire-glossy-action:hover [aria-hidden][role="img"], .aire-glossy-action:hover > span:last-of-type { transform: translateX(3px); }
        .aire-glossy-action:focus-visible {
          box-shadow:
            0 0 0 2px rgba(154,171,126,0.38),
            inset 0 1px 0 rgba(245,242,234,0.05);
        }
      `}</style>
    </Link>
  )
}
