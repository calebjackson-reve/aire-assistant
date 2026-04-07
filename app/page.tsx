import Link from "next/link"
import Image from "next/image"
import { auth } from "@clerk/nextjs/server"
import Navbar from "./components/layout/Navbar"
import Footer from "./components/layout/Footer"
import { ScrollReveal, CountUpStat } from "./components/ui/scroll-reveal"
import { TCMockup, AirSignMockup, BriefMockup, VoiceMockup } from "./components/ui/feature-mockups"
import { MagneticCard } from "./components/ui/magnetic-card"
import { ScrollToTop } from "./components/ui/scroll-to-top"
import { ScrollProgress } from "./components/ui/scroll-progress"

const FEATURES = [
  {
    label: "Transaction Coordinator",
    headline: "Every deadline tracked. Every document filed.",
    body: "Auto-calculated deadlines from contract dates. Louisiana Act of Sale timelines, inspection periods, and financing contingencies — all managed by AI. No more spreadsheets.",
    stats: [
      { value: "47 min", label: "saved per transaction" },
      { value: "0", label: "missed deadlines" },
    ],
  },
  {
    label: "AirSign",
    headline: "Send. Sign. Seal. From your phone.",
    body: "Upload any PDF, place signature fields, send signing links via email. Your buyers and sellers sign from any device. You get a sealed PDF with embedded signatures and a full audit trail.",
    stats: [
      { value: "8 sec", label: "to send for signing" },
      { value: "100%", label: "mobile compatible" },
    ],
  },
  {
    label: "Morning Brief",
    headline: "Your market intelligence, every morning at 7am.",
    body: "Three AI researchers scan your transactions, communications, and market data overnight. By the time you pour coffee, your brief is ready — deadlines due today, new listings in your farm, and relationship follow-ups.",
    stats: [
      { value: "3", label: "AI researchers" },
      { value: "7:00 AM", label: "daily delivery" },
    ],
  },
  {
    label: "Voice Commands",
    headline: "Speak. It acts.",
    body: "\"Create a transaction at 5834 Guice Drive. Add buyer John Smith. Schedule inspection for Friday.\" Natural language to action in under 4 seconds. Built for agents who are always in the car.",
    stats: [
      { value: "<4s", label: "response time" },
      { value: "30+", label: "voice actions" },
    ],
  },
]

const TOOLS = [
  { name: "AIRE Estimate", description: "AI-powered property valuations using ensemble scoring and local comp analysis.", tag: "AVM" },
  { name: "Market Pulse", description: "Live data from GBRAR MLS, Redfin, NAR, and ATTOM for Greater Baton Rouge.", tag: "Live Data" },
  { name: "Flood Vision", description: "Flood zones, insurance estimates, and elevation data for every Louisiana parish.", tag: "Risk" },
  { name: "Deal DNA", description: "Comps, price per square foot, days on market, and leverage points for any property.", tag: "Analysis" },
  { name: "Neighborhood Score", description: "Schools, safety, appreciation trends, and walkability scoring by ZIP.", tag: "Intelligence" },
]

const TIERS = [
  {
    name: "Access",
    price: "Free",
    period: "",
    description: "Try the tools. No credit card.",
    features: ["AIRE Estimate", "Market Pulse dashboard", "Flood Vision lookup"],
    cta: "Start Free",
    featured: false,
  },
  {
    name: "Pro",
    price: "$97",
    period: "/mo",
    description: "The full AI operating system.",
    features: ["Everything in Access", "Transaction Coordinator", "AirSign e-signatures", "Morning Brief", "Voice Commands", "Document automation", "Deadline alerts (SMS)"],
    cta: "Start Pro Trial",
    featured: true,
  },
  {
    name: "Investor",
    price: "$197",
    period: "/mo",
    description: "Advanced deal analysis and full system.",
    features: ["Everything in Pro", "Deal DNA deep analysis", "Cash flow projections", "Portfolio tracking", "Priority support", "API access"],
    cta: "Contact Us",
    featured: false,
  },
]

export default async function HomePage() {
  const { userId } = await auth()
  const signedIn = !!userId
  return (
    <>
      <Navbar />
      <ScrollProgress />

      {/* ═══ 1. HERO — Dark editorial overlay, bottom-aligned text ═══ */}
      <section className="relative h-screen flex items-end justify-start overflow-hidden">
        <video
          autoPlay
          muted
          playsInline
          preload="auto"
          poster="/aire-hero.png"
          // @ts-expect-error fetchPriority not in React types yet
          fetchPriority="high"
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src="/landing.mp4" type="video/mp4" />
        </video>

        {/* Dark gradient for text legibility — Caldera-style */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a18]/70 via-[#1a1a18]/20 to-transparent" />
        {/* Grain texture */}
        <div className="absolute inset-0 grain-overlay" />

        <div className="relative z-10 container-aire pb-20 md:pb-28 lg:pb-32 max-w-2xl">
          <p className="section-label text-[#f4f1ec]/50 mb-5 animate-fade-up [animation-delay:0.2s]">
            Real Estate Intelligence System
          </p>
          <h1 className="text-[#f4f1ec] mb-6 animate-fade-up [animation-delay:0.4s]">
            Built for parishes, <br className="hidden md:block" />
            not platforms
          </h1>
          <p className="text-[#f4f1ec]/50 text-base md:text-lg leading-relaxed mb-10 animate-fade-up [animation-delay:0.6s]">
            Act of Sale deadlines, GBRAR comp data, Louisiana disclosure rules —
            seven AI agents that understand how we close in Baton Rouge.
            Built by an agent who did $3.38M in Q1.
          </p>
          <div className="flex flex-wrap gap-4 animate-fade-up [animation-delay:0.8s]">
            <Link href={signedIn ? "/aire" : "/sign-up"} className="btn-pill bg-[#f4f1ec] text-ink hover:bg-white hover:translate-y-[-1px] transition-all duration-300">
              {signedIn ? "Open Dashboard" : "Get Started Free"}
            </Link>
            <a href="#platform" className="btn-pill border border-[#f4f1ec]/20 text-[#f4f1ec]/60 hover:text-[#f4f1ec] hover:border-[#f4f1ec]/40 transition-all duration-300">
              See the Platform
            </a>
          </div>
        </div>

        {/* Bottom fade into cream */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-cream to-transparent z-[5]" />
      </section>

      {/* ═══ 2. PROOF BAR — Q1 2026 real numbers ═══ */}
      <section className="bg-cream">
        <div className="container-aire">
          <div className="divider" />
          <div className="flex flex-wrap justify-center gap-x-16 gap-y-6 py-14 md:py-20">
            <CountUpStat end={18} label="Transactions Closed" />
            <CountUpStat end={3.38} prefix="$" suffix="M" decimals={2} label="Total Volume" />
            <CountUpStat end={10} label="Avg Days on Market" />
            <CountUpStat end={114} prefix="$" suffix="K+" label="Client Equity Created" />
          </div>
          <div className="divider" />
        </div>
      </section>

      {/* ═══ 3. PLATFORM — One feature per block ═══ */}
      <section id="platform" className="section-padding">
        <div className="container-aire">
          <ScrollReveal className="text-center mb-20">
            <p className="section-label mb-4">The Platform</p>
            <h2 className="max-w-lg mx-auto">Four systems working while you sell</h2>
          </ScrollReveal>

          <div className="space-y-32">
            {FEATURES.map((feature, i) => (
              <div
                key={feature.label}
                className={`grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center ${
                  i % 2 === 1 ? "lg:[direction:rtl]" : ""
                }`}
              >
                {/* Text side */}
                <div className={i % 2 === 1 ? "lg:[direction:ltr]" : ""}>
                  <p className="section-label mb-4">{feature.label}</p>
                  <h3 className="text-2xl md:text-3xl font-light italic text-ink mb-5 leading-tight">
                    {feature.headline}
                  </h3>
                  <p className="text-ink-muted text-[15px] leading-relaxed mb-8">
                    {feature.body}
                  </p>
                  <div className="flex gap-10">
                    {feature.stats.map((stat) => (
                      <div key={stat.label}>
                        <p className="stat-number text-2xl">{stat.value}</p>
                        <p className="text-ink-faint text-xs mt-0.5">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Visual side — dark UI mockup */}
                <div className={`relative ${i % 2 === 1 ? "lg:[direction:ltr]" : ""}`}>
                  {i === 0 && <TCMockup />}
                  {i === 1 && <AirSignMockup />}
                  {i === 2 && <BriefMockup />}
                  {i === 3 && <VoiceMockup />}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 4. TOOLS ═══ */}
      <section id="tools" className="section-padding bg-cream-warm">
        <div className="container-aire">
          <ScrollReveal className="text-center mb-16">
            <p className="section-label mb-4">Free Tools</p>
            <h2 className="max-w-md mx-auto">Built for the Greater Baton Rouge market</h2>
            <p className="text-ink-muted text-sm mt-4 max-w-sm mx-auto">
              Parishes, flood zones, mineral rights — the data sources that actually matter here.
            </p>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {TOOLS.map((tool) => (
              <MagneticCard key={tool.name}>
                <div className="card-glass group h-full">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-lg font-normal not-italic text-ink">{tool.name}</h3>
                    <span className="badge">{tool.tag}</span>
                  </div>
                  <p className="text-ink-muted text-sm leading-relaxed">{tool.description}</p>
                </div>
              </MagneticCard>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 5. HOW IT WORKS ═══ */}
      <section className="section-padding">
        <div className="container-aire">
          <ScrollReveal className="text-center mb-16">
            <p className="section-label mb-4">How It Works</p>
            <h2>Three steps to closing smarter</h2>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8 max-w-3xl mx-auto">
            {[
              { step: "01", title: "Connect your transactions", body: "Import from your MLS or create manually. AIRE reads the contract and sets every deadline." },
              { step: "02", title: "AIRE monitors and acts", body: "Daily briefs, document tracking, signature reminders, compliance scanning — all automatic." },
              { step: "03", title: "You close more deals", body: "Spend your time with clients, not spreadsheets. AIRE handles the coordination." },
            ].map((item) => (
              <div key={item.step} className="text-center md:text-left relative">
                {/* Decorative large number */}
                <span className="font-[family-name:var(--font-cormorant)] text-[8rem] md:text-[10rem] font-light italic leading-none text-champagne/20 absolute -top-10 md:-top-14 left-1/2 md:left-0 -translate-x-1/2 md:translate-x-0 select-none pointer-events-none">
                  {item.step}
                </span>
                <div className="relative z-10 pt-16 md:pt-20">
                  <h3 className="text-lg font-normal not-italic text-ink mb-3">{item.title}</h3>
                  <p className="text-ink-muted text-sm leading-relaxed">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 6. PRICING ═══ */}
      <section id="pricing" className="section-padding bg-cream-warm">
        <div className="container-aire">
          <ScrollReveal className="text-center mb-16">
            <p className="section-label mb-4">Pricing</p>
            <h2>Simple, transparent, built for agents</h2>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {TIERS.map((tier) => (
              <div
                key={tier.name}
                className={`p-8 border transition-all ${
                  tier.featured
                    ? "border-ink bg-white shadow-[0_8px_32px_rgba(0,0,0,0.06)]"
                    : "border-champagne-light bg-white/50"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="section-label">{tier.name}</p>
                  {tier.featured && <span className="badge">Popular</span>}
                </div>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="stat-number text-4xl">{tier.price}</span>
                  {tier.period && <span className="text-ink-faint text-sm">{tier.period}</span>}
                </div>
                <p className="text-ink-muted text-sm mb-8">{tier.description}</p>
                <ul className="space-y-3 mb-8">
                  {tier.features.map((f) => (
                    <li key={f} className="text-sm text-ink-muted flex items-start gap-2">
                      <span className="w-1 h-1 rounded-full bg-sage mt-2 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={signedIn ? "/aire" : "/sign-up"}
                  className={`btn-pill w-full text-center ${
                    tier.featured ? "btn-pill-primary" : "btn-pill-outline"
                  }`}
                >
                  {signedIn ? "Open Dashboard" : tier.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 7. ABOUT ═══ */}
      <section id="about" className="section-padding">
        <div className="container-aire">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 lg:gap-20 items-center max-w-5xl mx-auto">
            <div className="lg:col-span-2">
              <div className="relative aspect-[3/4] overflow-hidden rounded-sm" style={{ boxShadow: "0 24px 64px rgba(0,0,0,0.08)" }}>
                <Image
                  src="/headshot-2.jpg"
                  alt="Caleb Jackson — REALTOR at Reve Realtors, Baton Rouge"
                  fill
                  loading="lazy"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/15 via-transparent to-transparent" />
              </div>
            </div>

            <div className="lg:col-span-3">
              <p className="section-label mb-4">About</p>
              <h2 className="mb-2">Caleb Jackson</h2>
              <p className="text-sage text-sm font-medium mb-8 font-[family-name:var(--font-body)]">
                REALTOR &middot; Reve Realtors &middot; Baton Rouge, Louisiana
              </p>
              <div className="space-y-5 text-ink-muted text-[15px] leading-[1.85] max-w-lg">
                <p>
                  I built AIRE because the tools agents have today are broken — outdated data,
                  generic national platforms, and zero Louisiana-specific intelligence.
                  I closed 18 transactions and $3.38M in Q1 2026, and every one showed me
                  what the industry still gets wrong.
                </p>
                <p>
                  Every feature in this platform exists because I needed it at the closing
                  table, on the phone with a lender, or at 6 AM reviewing my pipeline.
                  AIRE is built by an active agent, for agents who want an unfair advantage
                  with real data.
                </p>
              </div>
              <div className="flex flex-wrap gap-4 mt-10">
                <a
                  href="https://calendly.com/calebjackson"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-pill btn-pill-primary"
                >
                  Book a Conversation
                </a>
                <a
                  href="https://www.instagram.com/calebjackson_24/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-pill btn-pill-outline"
                >
                  Follow on Instagram
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ 8. FINAL CTA ═══ */}
      <section className="py-24 md:py-32 bg-ink relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] rounded-full bg-sage/[0.06] blur-[120px]" />
        <div className="container-aire text-center max-w-xl mx-auto relative z-10">
          <p className="section-label text-sage/50 mb-4">Get Started</p>
          <h2 className="text-[#f4f1ec] mb-4">
            Your next deal deserves better tools.
          </h2>
          <p className="text-[#f4f1ec]/40 text-sm mb-10 max-w-sm mx-auto">
            Start free. No credit card. Full platform access for 14 days.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href={signedIn ? "/aire" : "/sign-up"} className="btn-pill bg-[#f4f1ec] text-ink hover:bg-white hover:translate-y-[-1px] transition-all duration-300">
              {signedIn ? "Open Dashboard" : "Start Free"}
            </Link>
            <a
              href="https://calendly.com/calebjackson"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-pill border border-[#f4f1ec]/15 text-[#f4f1ec]/60 hover:text-[#f4f1ec] hover:border-[#f4f1ec]/30 transition-all duration-300"
            >
              Book a Call
            </a>
          </div>
        </div>
      </section>

      <Footer />
      <ScrollToTop />
    </>
  )
}
