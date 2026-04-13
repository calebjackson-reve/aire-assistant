import Link from "next/link"

export const metadata = { title: "UI Lab — AIRE" }

const CONCEPTS = [
  {
    href: "/aire/ui-lab/concepts/B-daylight",
    title: "B · Daylight",
    role: "Public / marketing default",
    summary: "Cream canvas, Olive accents, Warm-White cards. Editorial calm.",
  },
  {
    href: "/aire/ui-lab/concepts/B-nocturne",
    title: "B · Nocturne",
    role: "In-app default (signed-in)",
    summary: "Deep Forest canvas, Sage accents, floating Warm-White cards. Moodier, glossier.",
  },
]

export default function UiLabIndex() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <p
        className="text-[10px] tracking-[0.22em] uppercase text-[#6b7d52] mb-2"
        style={{ fontFamily: "var(--font-ibm-mono)" }}
      >
        UI Lab · Concept B · v0.2
      </p>
      <h1
        className="text-[#1e2416] text-4xl mb-3"
        style={{ fontFamily: "var(--font-cormorant)", fontStyle: "italic", fontWeight: 500 }}
      >
        Two themes, one product.
      </h1>
      <p className="text-[#4a5638] text-[16px] leading-relaxed mb-10 max-w-prose">
        Concept B (Linear × Attio × Superhuman command-center) shipped as a user-toggleable
        light/dark theme system. Daylight is the public marketing default; Nocturne is the
        signed-in default. Both share an identical layout, components, and motion language —
        only surface, accent, shadow, and atmosphere swap. Locked AIRE palette only.
      </p>

      <ul className="space-y-3">
        {CONCEPTS.map((c) => (
          <li key={c.href}>
            <Link
              href={c.href}
              className="group block rounded-xl p-5 bg-[#f0ece2] border border-[#c5c9b8] hover:border-[#9aab7e] transition-[border-color,transform,box-shadow] duration-[200ms] ease-out hover:-translate-y-px"
              style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6), 0 1px 3px rgba(30,36,22,0.06), 0 8px 24px rgba(30,36,22,0.06)" }}
            >
              <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <h2
                  className="text-[#1e2416] text-[22px]"
                  style={{ fontFamily: "var(--font-cormorant)", fontStyle: "italic", fontWeight: 500 }}
                >
                  {c.title}
                </h2>
                <span
                  className="text-[10px] tracking-[0.18em] uppercase text-[#6b7d52]"
                  style={{ fontFamily: "var(--font-ibm-mono)" }}
                >
                  {c.role}
                </span>
              </div>
              <p className="text-[#4a5638] text-[14px] mt-2">{c.summary}</p>
              <p
                className="text-[#6b7d52] text-[11px] mt-3 opacity-0 group-hover:opacity-100 transition-opacity duration-[200ms]"
                style={{ fontFamily: "var(--font-ibm-mono)" }}
              >
                Open mock →
              </p>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-12 text-[12px] text-[#8a9070] space-y-1.5" style={{ fontFamily: "var(--font-ibm-mono)" }}>
        <p>BRANCH: ui/remodel</p>
        <p>SCOPE: mocks only — no /aire/page.tsx or DESIGN.md changes</p>
        <p>NEXT: review → promote</p>
      </div>
    </div>
  )
}
