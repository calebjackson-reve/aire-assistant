import Link from "next/link"
import Image from "next/image"
import Navbar from "./components/layout/Navbar"
import Footer from "./components/layout/Footer"
import { ScrollReveal, CountUpStat } from "./components/ui/scroll-reveal"
import { ScrollToTop } from "./components/ui/scroll-to-top"
import { ScrollProgress } from "./components/ui/scroll-progress"
import { PricingToggle } from "./components/landing/PricingToggle"
import { EmailCaptureSection } from "./components/landing/EmailCaptureSection"
import { DeviceMockup } from "./components/landing/DeviceMockup"
import { LouisianaGlobe } from "./components/landing/LouisianaGlobe"
import { WireframeGlobe } from "./components/landing/WireframeGlobe"
import { SparklesText } from "./components/landing/SparklesText"
import { RotatingWords } from "./components/landing/RotatingWords"
import { LampSection } from "./components/landing/LampSection"

const FEATURES = [
  {
    label: "Transaction Coordinator",
    title: "Never miss a deadline again.",
    body: "Every Act of Sale timeline, inspection period, and financing contingency auto-calculated from your contract dates. One missed deadline can kill a $200K deal — this makes sure it doesn't.",
    stats: [
      { value: "47 min", label: "saved per deal" },
      { value: "0", label: "missed deadlines" },
    ],
  },
  {
    label: "AirSign",
    title: "Signatures in seconds, not days.",
    body: "Drop Dotloop. Upload a PDF, place fields, send a link. Your clients sign from their phone at the kitchen table. Sealed with a full audit trail.",
    stats: [
      { value: "8 sec", label: "to send" },
      { value: "100%", label: "mobile ready" },
    ],
  },
  {
    label: "Morning Brief",
    title: "Know everything before your first call.",
    body: "Three AI researchers work overnight — scanning your deadlines, flagging unanswered emails, and surfacing new comps. Your full pipeline briefing lands at 7 AM.",
    stats: [
      { value: "3", label: "AI researchers" },
      { value: "7 AM", label: "on your desk" },
    ],
  },
  {
    label: "Voice Commands",
    title: "Run your business from the driver's seat.",
    body: "\"Create a transaction at 5834 Guice Drive.\" Speak it, and it's done — under 4 seconds. Built for agents who close deals between showings.",
    stats: [
      { value: "<4s", label: "to action" },
      { value: "30+", label: "voice commands" },
    ],
  },
]

const FREE_TOOLS = [
  { name: "AIRE Estimate", description: "Know what a property is actually worth before you write the offer.", tag: "AVM" },
  { name: "Market Pulse", description: "Live MLS data for Greater Baton Rouge — updated daily, not monthly.", tag: "Data" },
  { name: "Flood Vision", description: "Flood zone and insurance cost by parish. No more surprises at closing.", tag: "Risk" },
  { name: "Deal DNA", description: "Comps, price per square foot, and days on market — the full picture in one view.", tag: "Analysis" },
]

export default function HomePage() {
  const signedIn = false // Landing page is always public — auth handled by Navbar

  return (
    <>
      <Navbar />
      <ScrollProgress />

      {/* ═══ 1. HERO — Mesh gradient + grain + word reveal ═══ */}
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
        {/* Animated mesh gradient */}
        <div className="absolute inset-0 hero-mesh-gradient" />
        {/* Grain texture overlay */}
        <div className="absolute inset-0 grain-overlay-svg" />
        {/* Top announcement bar */}
        <div className="absolute top-0 left-0 right-0 z-20 bg-[#3a4a28] text-center py-2.5">
          <p className="text-[#f4f1ec]/70 text-xs tracking-wide">
            18 deals closed. $3.38M in volume. 10 avg days on market. Now it&apos;s your turn.
            <span className="text-[#f4f1ec]/40 mx-2">&middot;</span>
            <Link href="#pricing" className="text-[#f4f1ec] underline underline-offset-2 hover:text-white transition-colors">
              See pricing →
            </Link>
          </p>
        </div>

        {/* SVG filter for glass distortion effect */}
        <svg style={{ display: "none" }}>
          <filter id="glass-distortion" x="0%" y="0%" width="100%" height="100%" filterUnits="objectBoundingBox">
            <feTurbulence type="fractalNoise" baseFrequency="0.001 0.005" numOctaves="1" seed="17" result="turbulence" />
            <feGaussianBlur in="turbulence" stdDeviation="3" result="softMap" />
            <feSpecularLighting in="softMap" surfaceScale="5" specularConstant="1" specularExponent="100" lightingColor="white" result="specLight">
              <fePointLight x="-200" y="-200" z="300" />
            </feSpecularLighting>
            <feComposite in="specLight" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="litImage" />
            <feDisplacementMap in="SourceGraphic" in2="softMap" scale="200" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </svg>

        {/* Hero split layout — text LEFT, globe RIGHT */}
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 pt-28 pb-8 md:pt-32 md:pb-12 flex flex-col md:flex-row items-center gap-8 md:gap-0">
          {/* Left side — text content */}
          <div className="flex-1 text-center md:text-left md:pr-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#3a4a28]/20 border border-[#3a4a28]/15 rounded-full mb-8 animate-fade-up">
              <span className="w-1.5 h-1.5 rounded-full bg-[#5c6e2e]" />
              <span className="text-[#3a4a28] text-xs font-medium">Built by a Louisiana REALTOR. For Louisiana REALTORS.</span>
            </div>

            {/* AIRE with sparkles */}
            <SparklesText
              text="AIRE"
              className="block text-[#1e2416] text-7xl md:text-9xl font-light italic tracking-[-0.03em] leading-none mb-4"
            />

            {/* Rotating description */}
            <h2 className="text-[#3a4a28] text-2xl md:text-3xl font-light mb-3" style={{ fontFamily: "var(--font-cormorant)" }}>
              Real estate{" "}
              <RotatingWords
                words={["intelligence", "clarity", "precision", "confidence", "automation"]}
                className="text-[#6b7d52] font-medium italic"
              />
            </h2>

            {/* Subhead */}
            <p className="text-[#3a4a28]/70 text-base md:text-lg leading-relaxed max-w-lg mb-10 animate-fade-up [animation-delay:0.6s]">
              Seven AI agents handle your deadlines, signatures, briefs, and compliance — so you can focus on the conversations that actually close deals.
            </p>

            {/* Liquid Glass CTAs */}
            <div className="flex flex-wrap justify-center md:justify-start gap-4 mb-8 animate-fade-up [animation-delay:0.75s]">
              <Link
                href={signedIn ? "/aire" : "/sign-up"}
                className="group relative inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-sm font-semibold tracking-wide transition-all duration-700 hover:px-9 hover:py-[18px] overflow-hidden"
                style={{ transitionTimingFunction: "cubic-bezier(0.175, 0.885, 0.32, 2.2)" }}
              >
                {/* Glass layers */}
                <span className="absolute inset-0 rounded-2xl overflow-hidden" style={{ backdropFilter: "blur(3px)", filter: "url(#glass-distortion)", isolation: "isolate" }} />
                <span className="absolute inset-0 rounded-2xl bg-[#1e2416]/80" />
                <span className="absolute inset-0 rounded-2xl" style={{ boxShadow: "inset 2px 2px 1px 0 rgba(154, 171, 126, 0.3), inset -1px -1px 1px 1px rgba(154, 171, 126, 0.2)" }} />
                <span className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#9aab7e]/20 via-transparent to-[#6b7d52]/20" />
                <span className="relative z-10 text-[#f4f1ec]">
                  {signedIn ? "Open Dashboard" : "Start Your Free Trial"}
                </span>
              </Link>
              <a
                href="#platform"
                className="group relative inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-sm font-semibold tracking-wide transition-all duration-700 hover:px-9 hover:py-[18px] overflow-hidden"
                style={{ transitionTimingFunction: "cubic-bezier(0.175, 0.885, 0.32, 2.2)" }}
              >
                {/* Glass layers — lighter version */}
                <span className="absolute inset-0 rounded-2xl overflow-hidden" style={{ backdropFilter: "blur(6px)", filter: "url(#glass-distortion)", isolation: "isolate" }} />
                <span className="absolute inset-0 rounded-2xl bg-white/30" />
                <span className="absolute inset-0 rounded-2xl" style={{ boxShadow: "inset 2px 2px 1px 0 rgba(255, 255, 255, 0.5), inset -1px -1px 1px 1px rgba(255, 255, 255, 0.3)" }} />
                <span className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#9aab7e]/10 via-transparent to-[#f5f2ea]/20" />
                <span className="relative z-10 text-[#1e2416]">
                  See How It Works
                </span>
              </a>
            </div>
          </div>

          {/* Right side — Wireframe dotted globe */}
          <div className="flex-1 flex items-center justify-center md:justify-end relative">
            <div className="relative w-[400px] h-[400px] md:w-[500px] md:h-[500px]">
              <WireframeGlobe className="w-full h-full" />
              {/* Subtle glow behind globe */}
              <div className="absolute inset-0 rounded-full bg-[#9aab7e]/5 blur-3xl -z-10 scale-110" />
            </div>
          </div>
        </div>

        {/* Device mockup — below the hero split */}
        <div className="relative z-10 w-full max-w-4xl mx-auto px-6 -mt-8 animate-fade-up [animation-delay:0.9s]">
          <DeviceMockup />
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-cream to-transparent z-[5]" />
      </section>

      {/* ═══ 2. PROOF BAR — Large mono numbers + Syncopate labels + dividers ═══ */}
      <section className="bg-cream">
        <div className="container-aire">
          <div className="divider" />
          <div className="flex flex-wrap justify-center gap-y-8 py-16 md:py-24">
            <StatBlock value="18" label="Deals Closed Q1 2026" />
            <StatDivider />
            <StatBlock value="$3.38M" label="In Closed Volume" />
            <StatDivider />
            <StatBlock value="10" label="Avg Days to Contract" />
            <StatDivider />
            <StatBlock value="$114K+" label="Equity Created for Clients" />
          </div>
          <div className="divider" />
        </div>
      </section>

      {/* ═══ 3. PRICING ═══ */}
      <section id="pricing" className="py-24 md:py-32 bg-gradient-to-b from-cream to-cream-warm">
        <div className="container-aire">
          <ScrollReveal className="text-center mb-6">
            <p className="section-label mb-4">Pricing</p>
            <h2 className="max-w-lg mx-auto">One saved deadline pays for the year</h2>
          </ScrollReveal>
          <p className="text-ink-muted text-sm text-center max-w-md mx-auto mb-12">
            $97/month is less than one hour of your time. The platform saves you 47 minutes per deal.
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

      {/* ═══ TC LAMP SHOWCASE ═══ */}
      <section className="py-8 md:py-12">
        <div className="container-aire">
          <LampSection
            label="Transaction Coordinator"
            title="Your deals run themselves."
            description="AIRE tracks every deadline, sends every reminder, and flags every risk — before you even think about it. 47 minutes saved per deal. Zero missed deadlines."
          >
            <div className="flex gap-8 mt-4">
              <div className="text-center">
                <p className="text-2xl font-light text-[#9aab7e]" style={{ fontFamily: "var(--font-ibm-mono)", fontFeatureSettings: '"tnum"' }}>47min</p>
                <p className="text-[10px] text-[#e8e4d8]/40 uppercase tracking-wider mt-1" style={{ fontFamily: "var(--font-label)" }}>Saved per deal</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-light text-[#9aab7e]" style={{ fontFamily: "var(--font-ibm-mono)", fontFeatureSettings: '"tnum"' }}>0</p>
                <p className="text-[10px] text-[#e8e4d8]/40 uppercase tracking-wider mt-1" style={{ fontFamily: "var(--font-label)" }}>Missed deadlines</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-light text-[#9aab7e]" style={{ fontFamily: "var(--font-ibm-mono)", fontFeatureSettings: '"tnum"' }}>24/7</p>
                <p className="text-[10px] text-[#e8e4d8]/40 uppercase tracking-wider mt-1" style={{ fontFamily: "var(--font-label)" }}>Monitoring</p>
              </div>
            </div>
          </LampSection>
        </div>
      </section>

      {/* ═══ 5. PLATFORM FEATURES — Alternating layout + accent lines ═══ */}
      <section id="platform" className="py-24 md:py-32 lg:py-40">
        <div className="container-aire">
          <ScrollReveal className="text-center mb-20" scale>
            <p className="section-label mb-4">The Platform</p>
            <h2 className="max-w-lg mx-auto">Four systems that work while you sleep</h2>
          </ScrollReveal>

          <div className="space-y-28 md:space-y-36">
            {FEATURES.map((feature, i) => {
              const textDirection = i % 2 === 0 ? "left" as const : "right" as const
              const cardDirection = i % 2 === 0 ? "right" as const : "left" as const
              return (
                <div key={feature.label}>
                  <div
                    className={`grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center ${
                      i % 2 === 1 ? "lg:[direction:rtl]" : ""
                    }`}
                  >
                    {/* Text — slides in from the side */}
                    <ScrollReveal direction={textDirection} delay={0}>
                      <div className={i % 2 === 1 ? "lg:[direction:ltr]" : ""}>
                        <div className="feature-accent">
                          <p className="section-label mb-3">{feature.label}</p>
                        </div>
                        <h3 className="!text-3xl md:!text-4xl font-light italic text-ink mb-5 leading-tight font-[family-name:var(--font-display)]">
                          {feature.title}
                        </h3>
                        <p className="text-ink-muted text-[15px] leading-relaxed mb-8">{feature.body}</p>
                        <div className="flex gap-10">
                          {feature.stats.map((stat) => (
                            <div key={stat.label}>
                              <p className="text-3xl font-[family-name:var(--font-mono)] font-light tracking-tight text-ink" style={{ fontFeatureSettings: '"tnum"' }}>
                                {stat.value}
                              </p>
                              <p className="text-ink-faint text-xs mt-1 uppercase tracking-wider font-[family-name:var(--font-label)]" style={{ fontSize: '0.6rem' }}>
                                {stat.label}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </ScrollReveal>

                    {/* Feature card mockup — slides in from opposite side with scale */}
                    <ScrollReveal direction={cardDirection} delay={200} scale>
                      <div className={`relative ${i % 2 === 1 ? "lg:[direction:ltr]" : ""}`}>
                        <FeatureCard feature={feature} />
                      </div>
                    </ScrollReveal>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ═══ 6. FREE TOOLS ═══ */}
      <section id="tools" className="py-24 md:py-32 bg-cream-warm">
        <div className="container-aire">
          <ScrollReveal className="text-center mb-14">
            <p className="section-label mb-4">Free Tools</p>
            <h2 className="max-w-md mx-auto">See real value before you sign up</h2>
            <p className="text-ink-muted text-sm mt-4 max-w-sm mx-auto">
              Live Greater Baton Rouge data. No account needed. No strings.
            </p>
          </ScrollReveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {FREE_TOOLS.map((tool) => (
              <div key={tool.name} className="bg-white border border-champagne-light rounded-2xl p-6 hover:shadow-[0_12px_40px_rgba(30,36,22,0.08)] hover:translate-y-[-3px] transition-all duration-300">
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
              Explore all free tools →
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ 7. ABOUT ═══ */}
      <section id="about" className="py-24 md:py-32">
        <div className="container-aire">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 lg:gap-20 items-center max-w-5xl mx-auto">
            <div className="lg:col-span-2">
              <div className="relative aspect-[3/4] overflow-hidden rounded-2xl" style={{ boxShadow: "0 24px 64px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.04)" }}>
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
                  I closed 18 deals and $3.38M in Q1 2026 using the same tools every agent complains about — Dotloop, generic CMAs, spreadsheets for deadlines. So I built something better.
                </p>
                <p>
                  Every feature in AIRE exists because I needed it at the closing table, on the phone with a lender, or reviewing my pipeline at 6 AM. This isn&apos;t a tech company guessing what agents need. This is what actually works.
                </p>
              </div>
              <div className="flex flex-wrap gap-4 mt-10">
                <a
                  href="https://calendly.com/calebjackson"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-pill btn-pill-primary"
                >
                  Book a 15-Minute Call
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

      {/* ═══ 8. FINAL CTA — Dramatic deep forest ═══ */}
      <section className="py-32 md:py-40 bg-[#1e2416] relative overflow-hidden">
        <div className="absolute inset-0 grain-overlay-svg" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] rounded-full bg-[#9aab7e]/[0.06] blur-[140px]" />
        <div className="container-aire text-center max-w-2xl mx-auto relative z-10">
          <p className="section-label text-[#9aab7e]/50 mb-6">Get Started</p>
          <h2 className="text-[#f4f1ec] !text-4xl md:!text-5xl !italic !font-light mb-6 leading-tight">
            Your next closing shouldn&apos;t keep you up at night.
          </h2>
          <p className="text-[#f4f1ec]/40 text-sm mb-12 max-w-sm mx-auto">
            14 days free. No credit card. Cancel anytime.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href={signedIn ? "/aire" : "/sign-up"} className="inline-flex items-center px-10 py-4 bg-[#f4f1ec] text-[#1e2416] text-sm font-medium tracking-wide rounded-full hover:bg-white hover:translate-y-[-1px] hover:shadow-[0_8px_32px_rgba(244,241,236,0.2)] transition-all duration-300">
              {signedIn ? "Open Dashboard" : "Start Your Free Trial"}
            </Link>
            <a
              href="https://calendly.com/calebjackson"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-10 py-4 border border-[#f4f1ec]/15 text-[#f4f1ec]/60 text-sm font-medium tracking-wide rounded-full hover:text-[#f4f1ec] hover:border-[#f4f1ec]/30 transition-all duration-300"
            >
              Talk to Caleb
            </a>
          </div>
        </div>
      </section>

      <Footer />
      <ScrollToTop />
    </>
  )
}

/* ── Stats bar components ── */
function StatBlock({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center px-6 md:px-10">
      <p
        className="text-4xl md:text-5xl font-[family-name:var(--font-mono)] font-light tracking-tight text-ink leading-none"
        style={{ fontFeatureSettings: '"tnum"' }}
      >
        {value}
      </p>
      <p className="mt-2 uppercase tracking-[0.15em] text-ink-faint font-[family-name:var(--font-label)]" style={{ fontSize: '0.6rem' }}>
        {label}
      </p>
    </div>
  )
}

function StatDivider() {
  return (
    <div className="hidden md:flex items-center">
      <div className="w-px h-12 bg-olive/20" />
    </div>
  )
}

/* ── Inline feature card (dark mockup style) ── */
function FeatureCard({ feature }: { feature: typeof FEATURES[number] }) {
  return (
    <div
      className="relative aspect-[4/3] rounded-2xl overflow-hidden"
      style={{ background: "#1e2416", boxShadow: "0 24px 64px rgba(30,36,22,0.35), 0 8px 24px rgba(30,36,22,0.15)" }}
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
