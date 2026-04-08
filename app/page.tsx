import Link from "next/link"
import Image from "next/image"
import { auth } from "@clerk/nextjs/server"
import Navbar from "./components/layout/Navbar"
import Footer from "./components/layout/Footer"
import { ScrollReveal, CountUpStat } from "./components/ui/scroll-reveal"
import { ScrollToTop } from "./components/ui/scroll-to-top"
import { ScrollProgress } from "./components/ui/scroll-progress"
import { PricingToggle } from "./components/landing/PricingToggle"
import { EmailCaptureSection } from "./components/landing/EmailCaptureSection"
import { DeviceMockup } from "./components/landing/DeviceMockup"

const FEATURES = [
  {
    label: "Transaction Coordinator",
    title: "Every deadline tracked.",
    body: "Auto-calculated deadlines from contract dates. Louisiana Act of Sale timelines, inspection periods, financing contingencies — all managed by AI.",
    stats: [
      { value: "47 min", label: "saved per deal" },
      { value: "0", label: "missed deadlines" },
    ],
  },
  {
    label: "AirSign",
    title: "Send. Sign. Seal.",
    body: "Upload any PDF, place signature fields, send signing links. Buyers and sellers sign from any device. Sealed PDF with full audit trail.",
    stats: [
      { value: "8 sec", label: "to send" },
      { value: "100%", label: "mobile" },
    ],
  },
  {
    label: "Morning Brief",
    title: "Intelligence at 7AM.",
    body: "Three AI researchers scan your transactions, communications, and market data overnight. Deadlines, new listings, follow-ups — ready before coffee.",
    stats: [
      { value: "3", label: "AI researchers" },
      { value: "7 AM", label: "daily" },
    ],
  },
  {
    label: "Voice Commands",
    title: "Speak. It acts.",
    body: "\"Create a transaction at 5834 Guice Drive.\" Natural language to action in under 4 seconds. Built for agents in the car.",
    stats: [
      { value: "<4s", label: "response" },
      { value: "30+", label: "actions" },
    ],
  },
]

const FREE_TOOLS = [
  { name: "AIRE Estimate", description: "AI-powered property valuations with local comp analysis.", tag: "AVM" },
  { name: "Market Pulse", description: "Live GBRAR MLS data for Greater Baton Rouge.", tag: "Data" },
  { name: "Flood Vision", description: "Flood zones and insurance estimates by parish.", tag: "Risk" },
  { name: "Deal DNA", description: "Comps, price/sqft, DOM, and leverage points.", tag: "Analysis" },
]

export default async function HomePage() {
  const { userId } = await auth()
  const signedIn = !!userId

  return (
    <>
      <Navbar />
      <ScrollProgress />

      {/* ═══ 1. HERO — Seed-inspired, muted sage bg, device mockup ═══ */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
        {/* Background video — atmospheric, lazy loaded */}
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="none"
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src="/landing.mp4" type="video/mp4" />
        </video>
        {/* Overlay to soften video and ensure text readability */}
        <div className="absolute inset-0 bg-[#c8ceb8]/75" />
        {/* Subtle grain */}
        <div className="absolute inset-0 grain-overlay" />

        {/* Top announcement bar */}
        <div className="absolute top-0 left-0 right-0 z-20 bg-[#3a4a28] text-center py-2.5">
          <p className="text-[#f4f1ec]/70 text-xs tracking-wide">
            Built by an agent who closed $3.38M in Q1 2026
            <span className="text-[#f4f1ec]/40 mx-2">&middot;</span>
            <Link href="#pricing" className="text-[#f4f1ec] underline underline-offset-2 hover:text-white transition-colors">
              See pricing →
            </Link>
          </p>
        </div>

        <div className="relative z-10 container-aire text-center pt-28 pb-8 md:pt-32 md:pb-12">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#3a4a28]/20 border border-[#3a4a28]/15 rounded-full mb-8 animate-fade-up">
            <span className="w-1.5 h-1.5 rounded-full bg-[#5c6e2e]" />
            <span className="text-[#3a4a28] text-xs font-medium">Real Estate Intelligence System</span>
          </div>

          {/* Headline */}
          <h1 className="text-[#1e2416] mb-5 max-w-2xl mx-auto animate-fade-up [animation-delay:0.15s]">
            The operating system<br className="hidden md:block" />
            for Louisiana agents
          </h1>

          {/* Subhead */}
          <p className="text-[#3a4a28]/70 text-base md:text-lg leading-relaxed max-w-lg mx-auto mb-10 animate-fade-up [animation-delay:0.3s]">
            Transaction coordination, e-signatures, morning briefs,
            and voice commands — seven AI agents that understand
            how we close in Baton Rouge.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap justify-center gap-4 mb-16 animate-fade-up [animation-delay:0.45s]">
            <Link
              href={signedIn ? "/aire" : "/sign-up"}
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-[#1e2416] text-[#f4f1ec] text-sm font-medium tracking-wide rounded-full hover:bg-[#2a3320] transition-all duration-300 hover:translate-y-[-1px] hover:shadow-[0_8px_24px_rgba(30,36,22,0.3)]"
            >
              {signedIn ? "Open Dashboard" : "Get Started Free"}
            </Link>
            <a
              href="#platform"
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-white/50 text-[#3a4a28] text-sm font-medium tracking-wide rounded-full border border-[#3a4a28]/10 hover:bg-white/70 transition-all duration-300"
            >
              See the Platform
            </a>
          </div>
        </div>

        {/* Device mockup — laptop showing AIRE dashboard */}
        <div className="relative z-10 w-full max-w-4xl mx-auto px-6 animate-fade-up [animation-delay:0.6s]">
          <DeviceMockup />
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-cream to-transparent z-[5]" />
      </section>

      {/* ═══ 2. PROOF BAR ═══ */}
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

      {/* ═══ 3. PRODUCT CARDS + PRICING TOGGLE — Seed-style grid ═══ */}
      <section id="pricing" className="section-padding bg-cream">
        <div className="container-aire">
          <ScrollReveal className="text-center mb-6">
            <p className="section-label mb-4">Pricing</p>
            <h2 className="max-w-lg mx-auto">Simple plans, built for agents</h2>
          </ScrollReveal>
          <p className="text-ink-muted text-sm text-center max-w-md mx-auto mb-12">
            Start free with the tools. Upgrade when you want the full AI operating system.
          </p>
          <PricingToggle signedIn={signedIn} />
        </div>
      </section>

      {/* ═══ 4. EMAIL CAPTURE — Value-first ═══ */}
      <section className="py-20 md:py-28 bg-[#3a4a28] relative overflow-hidden">
        <div className="absolute inset-0 grain-overlay" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[250px] rounded-full bg-[#9aab7e]/10 blur-[100px]" />
        <EmailCaptureSection />
      </section>

      {/* ═══ 5. PLATFORM FEATURES ═══ */}
      <section id="platform" className="section-padding">
        <div className="container-aire">
          <ScrollReveal className="text-center mb-20">
            <p className="section-label mb-4">The Platform</p>
            <h2 className="max-w-lg mx-auto">Four systems working while you sell</h2>
          </ScrollReveal>

          <div className="space-y-24 md:space-y-32">
            {FEATURES.map((feature, i) => (
              <ScrollReveal key={feature.label}>
                <div
                  className={`grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center ${
                    i % 2 === 1 ? "lg:[direction:rtl]" : ""
                  }`}
                >
                  {/* Text */}
                  <div className={i % 2 === 1 ? "lg:[direction:ltr]" : ""}>
                    <p className="section-label mb-3">{feature.label}</p>
                    <h3 className="text-2xl md:text-3xl font-light italic text-ink mb-4 leading-tight">
                      {feature.title}
                    </h3>
                    <p className="text-ink-muted text-[15px] leading-relaxed mb-8">{feature.body}</p>
                    <div className="flex gap-10">
                      {feature.stats.map((stat) => (
                        <div key={stat.label}>
                          <p className="stat-number text-2xl">{stat.value}</p>
                          <p className="text-ink-faint text-xs mt-0.5">{stat.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Feature card mockup */}
                  <div className={`relative ${i % 2 === 1 ? "lg:[direction:ltr]" : ""}`}>
                    <FeatureCard feature={feature} />
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 6. FREE TOOLS ═══ */}
      <section id="tools" className="section-padding bg-cream-warm">
        <div className="container-aire">
          <ScrollReveal className="text-center mb-14">
            <p className="section-label mb-4">Free Tools</p>
            <h2 className="max-w-md mx-auto">Try before you commit</h2>
            <p className="text-ink-muted text-sm mt-4 max-w-sm mx-auto">
              Real data for the Greater Baton Rouge market. No signup required.
            </p>
          </ScrollReveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {FREE_TOOLS.map((tool) => (
              <div key={tool.name} className="bg-white border border-champagne-light rounded-lg p-6 hover:shadow-[0_8px_32px_rgba(0,0,0,0.06)] hover:translate-y-[-2px] transition-all duration-300">
                <div className="flex items-center justify-between mb-3">
                  <span className="badge">{tool.tag}</span>
                </div>
                <h3 className="text-base font-normal not-italic text-ink mb-2">{tool.name}</h3>
                <p className="text-ink-muted text-sm leading-relaxed">{tool.description}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <Link
              href={signedIn ? "/aire" : "/sign-up"}
              className="text-sage text-sm font-medium hover:text-olive transition-colors"
            >
              Try all tools free →
            </Link>
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
                  Every feature exists because I needed it at the closing table, on the phone
                  with a lender, or at 6 AM reviewing my pipeline. AIRE is built by an active
                  agent, for agents who want an unfair advantage with real data.
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
            <Link href={signedIn ? "/aire" : "/sign-up"} className="inline-flex items-center px-8 py-3.5 bg-[#f4f1ec] text-ink text-sm font-medium tracking-wide rounded-full hover:bg-white hover:translate-y-[-1px] transition-all duration-300">
              {signedIn ? "Open Dashboard" : "Start Free"}
            </Link>
            <a
              href="https://calendly.com/calebjackson"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-8 py-3.5 border border-[#f4f1ec]/15 text-[#f4f1ec]/60 text-sm font-medium tracking-wide rounded-full hover:text-[#f4f1ec] hover:border-[#f4f1ec]/30 transition-all duration-300"
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

/* ── Inline feature card (dark mockup style matching Seed product cards) ── */
function FeatureCard({ feature }: { feature: typeof FEATURES[number] }) {
  return (
    <div
      className="relative aspect-[4/3] rounded-xl overflow-hidden"
      style={{ background: "#1e2416", boxShadow: "0 24px 64px rgba(30,36,22,0.35)" }}
    >
      {/* Window chrome */}
      <div className="flex items-center gap-1.5 px-5 py-3 border-b border-[#9aab7e]/10">
        <span className="w-2 h-2 rounded-full bg-[#c45c5c]/60" />
        <span className="w-2 h-2 rounded-full bg-[#d4944c]/50" />
        <span className="w-2 h-2 rounded-full bg-[#9aab7e]/50" />
        <span className="ml-3 text-[10px] text-[#f4f1ec]/20 font-[family-name:var(--font-mono)]">
          aire / {feature.label.toLowerCase().replace(/\s+/g, "-")}
        </span>
      </div>

      <div className="p-5">
        <p className="text-[9px] tracking-[0.15em] uppercase text-[#9aab7e]/50 mb-3 font-[family-name:var(--font-label)]">
          {feature.label}
        </p>
        <p className="text-[#f4f1ec]/80 text-sm mb-4 font-[family-name:var(--font-body)]">
          {feature.title}
        </p>

        {/* Simulated UI rows */}
        <div className="space-y-0.5">
          {feature.stats.map((stat, j) => (
            <div key={stat.label} className="flex items-center gap-3 py-2.5 border-b border-[#9aab7e]/6 last:border-0">
              <span className={`w-1.5 h-1.5 rounded-full ${j === 0 ? "bg-[#9aab7e]" : "bg-[#d4944c]"}`} />
              <span className="text-[#f4f1ec]/50 text-xs font-[family-name:var(--font-mono)] flex-1">{stat.label}</span>
              <span className="text-[#f4f1ec]/80 text-xs font-[family-name:var(--font-mono)]">{stat.value}</span>
            </div>
          ))}
        </div>

        {/* Fake action button */}
        <div className="mt-5">
          <div className="w-full py-2.5 rounded-lg bg-[#9aab7e]/15 text-[#9aab7e] text-xs text-center font-medium tracking-wide uppercase">
            View Details
          </div>
        </div>
      </div>
    </div>
  )
}
