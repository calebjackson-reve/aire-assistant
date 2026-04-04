import Link from 'next/link'

const SOCIALS = [
  { label: 'Instagram', href: 'https://www.instagram.com/calebjackson_24/' },
  { label: 'TikTok',    href: 'https://www.tiktok.com/@calebjackson' },
  { label: 'LinkedIn',  href: 'https://www.linkedin.com/in/caleb-jackson-22b627270' },
  { label: 'YouTube',   href: 'https://www.youtube.com/@calebjackson' },
  { label: 'X',         href: 'https://x.com/calebjackson24' },
]

const TOOL_LINKS = [
  ['Market Pulse',       '/tools/market-pulse'],
  ['Cash Flow Analyzer', '/tools/cash-flow'],
  ['Flood Vision',       '/tools/flood-vision'],
  ['Neighborhood Score', '/tools/neighborhood-score'],
  ['Deal DNA',           '/tools/deal-dna'],
]

const COMPANY_LINKS = [
  ['About', '#about'],
  ['Tools', '/tools'],
  ['Contact', '#contact'],
  ['Privacy Policy', '/privacy'],
]

export default function Footer() {
  return (
    <footer id="contact" className="bg-[#B0AC9E] border-t border-white/20">
      <div className="container-aire py-16 md:py-20">
        {/* Top — brand + columns */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-8 mb-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-peach to-copper-light flex items-center justify-center font-display text-sm italic text-forest-deep">
                A
              </div>
              <span className="font-display text-[15px] italic text-cream">
                AIRE Intelligence
              </span>
            </div>
            <p className="text-sm text-cream-dark leading-relaxed max-w-[280px] mb-6">
              AI-powered real estate tools for the Greater Baton Rouge market.
              Built by Caleb Jackson at Reve REALTORS.
            </p>
            <div className="flex gap-2">
              {SOCIALS.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={s.label}
                  className="w-8 h-8 rounded-lg border border-glass-border flex items-center justify-center text-[10px] font-medium text-cream-dark hover:text-peach hover:border-copper/30 transition-colors"
                >
                  {s.label.slice(0, 2).toUpperCase()}
                </a>
              ))}
            </div>
          </div>

          {/* Tools */}
          <div>
            <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[#C4A882] mb-5">
              Tools
            </div>
            <div className="flex flex-col gap-3">
              {TOOL_LINKS.map(([label, href]) => (
                <Link
                  key={label}
                  href={href}
                  className="text-sm text-cream-dark hover:text-cream transition-colors no-underline"
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>

          {/* Company */}
          <div>
            <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[#C4A882] mb-5">
              Company
            </div>
            <div className="flex flex-col gap-3">
              {COMPANY_LINKS.map(([label, href]) => (
                <Link
                  key={label}
                  href={href}
                  className="text-sm text-cream-dark hover:text-cream transition-colors no-underline"
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div>
            <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[#C4A882] mb-5">
              Get in Touch
            </div>
            <div className="flex flex-col gap-3">
              <a
                href="https://calendly.com/calebjackson"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-peach hover:text-peach-light transition-colors no-underline"
              >
                Book a Consultation &rarr;
              </a>
              <span className="text-sm text-cream-dark">Greater Baton Rouge, Louisiana</span>
              <span className="text-sm text-cream-dark">Licensed Real Estate Advisor</span>
              <span className="text-sm text-cream-dark">Reve REALTORS</span>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="divider mb-6" />
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
          <span className="text-xs text-cream-dark">
            &copy; 2026 Caleb Jackson Real Estate. All rights reserved.
          </span>
          <span className="text-xs text-copper/40 tracking-wider uppercase">
            Powered by AIRE Intelligence
          </span>
        </div>
      </div>
    </footer>
  )
}
