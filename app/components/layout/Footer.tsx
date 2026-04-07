import Link from 'next/link'

const LINKS = [
  { label: 'Platform', href: '#platform' },
  { label: 'Tools', href: '#tools' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'About', href: '#about' },
  { label: 'Privacy', href: '/privacy' },
]

const SOCIALS = [
  { label: 'IG', href: 'https://www.instagram.com/calebjackson_24/' },
  { label: 'TT', href: 'https://www.tiktok.com/@calebjackson' },
  { label: 'LI', href: 'https://www.linkedin.com/in/caleb-jackson-22b627270' },
  { label: 'X', href: 'https://x.com/calebjackson24' },
]

function SocialIcon({ name }: { name: string }) {
  const cls = "w-3.5 h-3.5 opacity-50 group-hover:opacity-100 transition-opacity"
  if (name === "IG") return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="20" height="20" rx="5" /><circle cx="12" cy="12" r="5" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg>
  if (name === "TT") return <svg className={cls} viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1 0-5.78c.27 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15.2a6.34 6.34 0 0 0 9.49 5.5 6.33 6.33 0 0 0 2.85-5.29V8.87a8.28 8.28 0 0 0 4.1 1.08V6.5c-.01 0-.01.19 0 .19z"/></svg>
  if (name === "LI") return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z" /><rect x="2" y="9" width="4" height="12" /><circle cx="4" cy="4" r="2" /></svg>
  return <svg className={cls} viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
}

export default function Footer() {
  return (
    <footer className="border-t border-champagne-light">
      <div className="container-aire py-16 md:py-20">
        <div className="flex flex-col md:flex-row justify-between gap-12">
          {/* Brand */}
          <div className="max-w-xs">
            <span className="font-[family-name:var(--font-cormorant)] text-[22px] font-light italic text-ink block mb-4">
              AIRE
            </span>
            <p className="text-sm text-ink-muted leading-relaxed">
              AI-powered transaction management for Louisiana real estate.
              Built by an active agent, for agents.
            </p>
          </div>

          {/* Links */}
          <div className="flex gap-16">
            <div>
              <p className="font-[family-name:var(--font-syncopate)] text-[9px] tracking-[0.2em] uppercase text-ink-faint mb-5">
                Navigate
              </p>
              <div className="flex flex-col gap-3">
                {LINKS.map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    className="text-sm text-ink-muted hover:text-ink transition-colors no-underline"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <p className="font-[family-name:var(--font-syncopate)] text-[9px] tracking-[0.2em] uppercase text-ink-faint mb-5">
                Connect
              </p>
              <div className="flex flex-col gap-3">
                <a href="https://calendly.com/calebjackson" target="_blank" rel="noopener noreferrer" className="text-sm text-sage hover:text-olive transition-colors no-underline">
                  Book a call
                </a>
                {SOCIALS.map((s) => (
                  <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-ink-muted hover:text-ink transition-colors no-underline group">
                    <SocialIcon name={s.label} />
                    {s.label === 'IG' ? 'Instagram' : s.label === 'TT' ? 'TikTok' : s.label === 'LI' ? 'LinkedIn' : 'X / Twitter'}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="divider mt-12 mb-6" />
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
          <span className="text-xs text-ink-faint">
            &copy; 2026 AIRE Intelligence. Baton Rouge, Louisiana.
          </span>
          <span className="text-xs text-ink-faint">
            Caleb Jackson &middot; Reve REALTORS
          </span>
        </div>
      </div>
    </footer>
  )
}
