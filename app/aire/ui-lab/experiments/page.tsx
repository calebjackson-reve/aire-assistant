import Link from "next/link"

export const metadata = { title: "Experiments — UI Lab" }

const EXPERIMENTS = [
  {
    href: "/aire/ui-lab/experiments/tilt-card",
    slug: "01",
    title: "Tilt Card",
    summary: "3D card with cursor-follow specular highlight. Max 6° rotateX/Y, spring ease.",
    status: "built",
  },
  {
    href: "/aire/ui-lab/experiments/scroll-reveal",
    slug: "02",
    title: "Scroll Reveal",
    summary: "Section reveals via mask-image + translateY stagger (Linear-grade).",
    status: "built",
  },
  {
    href: "/aire/ui-lab/experiments/magnetic-cta",
    slug: "03",
    title: "Magnetic CTA",
    summary: "Button tracks cursor within 80px radius. Subtle spring pull.",
    status: "built",
  },
  {
    href: "/aire/ui-lab/experiments/sparkline-hero",
    slug: "04",
    title: "Sparkline Hero",
    summary: "1080-wide mono sparkline that writes itself on scroll entry.",
    status: "built",
  },
  {
    href: "/aire/ui-lab/experiments/command-bar-opening",
    slug: "05",
    title: "Command Bar Opening",
    summary: "⌘K entrance: blur + scale(0.94→1) + rotateX(-8→0) + content stagger. 260ms.",
    status: "built",
  },
  {
    href: "/aire/ui-lab/experiments/section-transition",
    slug: "06",
    title: "Section Transition",
    summary: "View Transitions API with framer-motion fallback.",
    status: "built",
  },
]

export default function ExperimentsIndex() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <p
        className="text-[10px] tracking-[0.22em] uppercase text-[#6b7d52] mb-2"
        style={{ fontFamily: "var(--font-ibm-mono)" }}
      >
        UI Lab · Experiments · v0.1
      </p>
      <h1
        className="text-[#1e2416] text-4xl mb-3"
        style={{ fontFamily: "var(--font-cormorant)", fontStyle: "italic", fontWeight: 500 }}
      >
        Six ways to make it feel alive.
      </h1>
      <p className="text-[#4a5638] text-[16px] leading-relaxed mb-10 max-w-prose">
        Standalone micro-components proving techniques we might productionize later.
        Palette-locked (Sage / Olive / Cream / Linen / Deep Forest). Transform + opacity only.
        No library required for 1–5; 6 uses the native View Transitions API with a zero-dep fallback.
      </p>

      <ul className="space-y-3">
        {EXPERIMENTS.map((exp) => (
          <li key={exp.href}>
            <Link
              href={exp.href}
              className="group block rounded-xl p-5 bg-[#f0ece2] border border-[#c5c9b8] hover:border-[#9aab7e] transition-[border-color,transform,box-shadow] duration-[200ms] ease-out hover:-translate-y-px"
              style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6), 0 1px 3px rgba(30,36,22,0.06), 0 8px 24px rgba(30,36,22,0.06)" }}
            >
              <div className="flex items-baseline gap-4">
                <span
                  className="text-[11px] tracking-[0.18em] text-[#6b7d52] shrink-0"
                  style={{ fontFamily: "var(--font-ibm-mono)" }}
                >
                  {exp.slug}
                </span>
                <h2
                  className="text-[#1e2416] text-[22px] flex-1"
                  style={{ fontFamily: "var(--font-cormorant)", fontStyle: "italic", fontWeight: 500 }}
                >
                  {exp.title}
                </h2>
                <span
                  className="text-[10px] tracking-[0.18em] uppercase text-[#6b7d52] shrink-0"
                  style={{ fontFamily: "var(--font-ibm-mono)" }}
                >
                  {exp.status}
                </span>
              </div>
              <p className="text-[#4a5638] text-[14px] mt-2 ml-[40px]">{exp.summary}</p>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-12 text-[12px] text-[#8a9070] space-y-1.5" style={{ fontFamily: "var(--font-ibm-mono)" }}>
        <p>SCOPE: experimental only — not promoted to /aire routes</p>
        <p>LIBRARIES: zero new npm deps — all experiments use native React + CSS</p>
        <p>NEXT: promote wins to Dashboard / listing / AirSign primitives after review</p>
      </div>
    </div>
  )
}
