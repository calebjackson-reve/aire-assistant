import Link from "next/link"
import Image from "next/image"
import Navbar from "./components/layout/Navbar"
import Footer from "./components/layout/Footer"
import { SectionDivider } from "./components/ui/section-divider"
import { KnowledgeSphereWrapper as KnowledgeSphere } from "./components/ui/knowledge-sphere-wrapper"
import { GlassCard } from "./components/ui/glass-card"

const TOOLS = [
  {
    name: "Market Pulse",
    description: "Live data from GBRAR MLS, Redfin, NAR, and ATTOM.",
    href: "/tools/market-pulse",
    tag: "Live Data",
  },
  {
    name: "Cash Flow Analyzer",
    description: "Rental projections with cap rate and cash-on-cash analysis.",
    href: "/tools/cash-flow",
    tag: "Calculator",
  },
  {
    name: "Flood Vision",
    description: "Flood zones, insurance estimates, and elevation data.",
    href: "/tools/flood-vision",
    tag: "Risk",
  },
  {
    name: "Neighborhood Score",
    description: "Schools, safety, appreciation, and walkability scoring.",
    href: "/tools/neighborhood-score",
    tag: "Intelligence",
  },
  {
    name: "Deal DNA",
    description: "Comps, price/sqft, days on market, and leverage points.",
    href: "/tools/deal-dna",
    tag: "Analysis",
  },
]

export default function HomePage() {
  return (
    <>
      <Navbar />

      {/* ═══ 1. HERO — Video plays once, freezes on last frame ═══ */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#C4C0B0]">
        {/* Video plays once and stops — no loop */}
        <video
          autoPlay
          muted
          playsInline
          preload="auto"
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src="/landing.mp4" type="video/mp4" />
        </video>

        {/* No overlay — video text is already baked in */}

        {/* Scroll CTA at bottom — appears after video settles */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 animate-fade-up [animation-delay:7s]">
          <Link href="#tools" className="btn-pill btn-pill-primary text-sm">
            Explore Tools
          </Link>
        </div>

        {/* Bottom fade into page */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#C4C0B0] to-transparent" />
      </section>

      <SectionDivider />

      {/* ═══ 2. TOOLS — 5 glass cards ═══ */}
      <section className="section-padding relative overflow-hidden">
        <div className="absolute inset-0 bg-[#C4C0B0]" />
        <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full bg-copper/[0.03] blur-[100px]" />

        <div className="container-aire relative z-10">
          <div className="text-center mb-10">
            <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[#7A8C50] mb-3">
              Free Tools
            </p>
            <h2 className="mb-3">Built for Louisiana real estate</h2>
            <p className="max-w-md mx-auto text-[#6A6A60] text-sm">
              Parishes, flood zones, mineral rights — data sources that matter here.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {TOOLS.map((tool, i) => (
              <GlassCard
                key={tool.name}
                title={tool.name}
                description={tool.description}
                tag={tool.tag}
                href={tool.href}
                variant={(["default", "copper", "default"] as const)[i % 3]}
              />
            ))}
          </div>
        </div>
      </section>

      <SectionDivider />

      {/* ═══ 3. INTELLIGENCE — Sphere + single message ═══ */}
      <section className="section-padding relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#C4C0B0] to-[#B8B4A6]" />

        <div className="container-aire relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[#7A8C50] mb-3">
                The Platform
              </p>
              <h2 className="mb-4">More than tools — a full AI operating system</h2>
              <p className="text-[#5A5A50] text-sm leading-relaxed mb-6">
                Email scanning, document signing, morning briefs, deal tracking, and
                relationship intelligence — all connected through one knowledge graph.
              </p>
              <ul className="space-y-3 mb-8">
                {["Email Scanner", "AirSign Documents", "Morning Briefs", "Deal Tracker", "Relationship Intelligence"].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-[#5A5A50]">
                    <span className="w-1 h-1 rounded-full bg-[#7A8C50] shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/sign-up" className="btn-pill btn-pill-primary">
                Get Started Free
              </Link>
            </div>

            <div className="relative">
              <KnowledgeSphere className="w-full h-[400px] md:h-[480px]" />
            </div>
          </div>
        </div>
      </section>

      <SectionDivider />

      {/* ═══ 4. ABOUT — Portrait + tight bio ═══ */}
      <section id="about" className="section-padding relative overflow-hidden">
        <div className="absolute inset-0 bg-[#C4C0B0]" />
        <div className="absolute bottom-0 left-1/3 w-[400px] h-[300px] rounded-full bg-copper/[0.03] blur-[80px]" />

        <div className="container-aire relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 lg:gap-14 items-center">
            <div className="lg:col-span-2">
              <div
                className="relative rounded-2xl overflow-hidden aspect-[3/4]"
                style={{
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  boxShadow: '0 16px 48px rgba(0, 0, 0, 0.3)',
                }}
              >
                <Image
                  src="/headshot-2.jpg"
                  alt="Caleb Jackson"
                  fill
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
              </div>
            </div>

            <div className="lg:col-span-3">
              <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[#7A8C50] mb-3">
                About
              </p>
              <h2 className="mb-1">Caleb Jackson</h2>
              <p className="text-[#7A8C50] text-sm font-medium mb-6">
                Real Estate Advisor &middot; Reve REALTORS &middot; Baton Rouge, LA
              </p>
              <p className="text-white/65 text-[15px] leading-relaxed mb-7">
                I built AIRE because the tools agents have today are broken — outdated data,
                generic national platforms, and zero Louisiana-specific intelligence. Every tool
                here is built from scratch for the Greater Baton Rouge market, powered by AI,
                and designed to give you an unfair advantage with real data.
              </p>
              <Link
                href="https://calendly.com/calebjackson"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-pill btn-pill-glass"
              >
                Book a Conversation
              </Link>
            </div>
          </div>
        </div>
      </section>

      <SectionDivider />

      {/* ═══ 5. CTA ═══ */}
      <section className="section-padding relative overflow-hidden">
        <div className="absolute inset-0 bg-[#C4C0B0]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[250px] rounded-full bg-copper/[0.03] blur-[100px]" />

        <div className="container-aire relative z-10 text-center max-w-lg mx-auto">
          <h2 className="mb-3">5 free tools built for Baton Rouge</h2>
          <p className="text-[#6A6A60] text-sm mb-8">
            No sign-up required. Start using them now.
          </p>
          <Link href="/tools" className="btn-pill btn-pill-primary">
            Explore Tools
          </Link>
        </div>
      </section>

      <Footer />
    </>
  )
}
