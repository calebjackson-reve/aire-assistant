'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { UserButton, useUser } from '@clerk/nextjs'

const NAV_SECTIONS = [
  { label: 'Platform', href: '#platform' },
  { label: 'Tools', href: '#tools' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'About', href: '#about' },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { isSignedIn } = useUser()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > window.innerHeight * 0.85)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled
            ? 'bg-cream/95 backdrop-blur-xl border-b border-champagne-light shadow-[0_1px_3px_rgba(0,0,0,0.04)]'
            : 'bg-transparent pointer-events-none'
        }`}
      >
        <div className={`container-aire flex items-center justify-between h-[72px] transition-opacity duration-500 ${scrolled ? 'opacity-100 pointer-events-auto' : 'opacity-0'}`}>
          {/* Logo */}
          <Link href="/" className="no-underline">
            <span className="font-[family-name:var(--font-cormorant)] text-[22px] font-light italic text-ink tracking-[-0.02em]">
              AIRE
            </span>
          </Link>

          {/* Section links — Syncopate labels */}
          <div className="nav-desktop flex items-center gap-10">
            {NAV_SECTIONS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="font-[family-name:var(--font-syncopate)] text-[10px] tracking-[0.18em] uppercase text-ink-muted hover:text-ink transition-colors duration-300 relative after:absolute after:bottom-[-2px] after:left-0 after:w-0 after:h-px after:bg-ink after:transition-all after:duration-300 hover:after:w-full"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Actions */}
          <div className="nav-desktop flex items-center gap-4">
            {isSignedIn ? (
              <>
                <Link
                  href="/aire"
                  className="font-[family-name:var(--font-syncopate)] text-[10px] tracking-[0.18em] uppercase text-ink-muted hover:text-ink transition-colors"
                >
                  Dashboard
                </Link>
                <Link href="/aire" className="btn-pill btn-pill-primary text-[10px]">
                  Open AIRE
                </Link>
                <UserButton />
              </>
            ) : (
              <>
                <Link
                  href="/sign-in"
                  className="font-[family-name:var(--font-syncopate)] text-[10px] tracking-[0.15em] uppercase text-ink-muted hover:text-ink transition-colors"
                >
                  Sign In
                </Link>
                <Link href="/sign-up" className="btn-pill btn-pill-primary text-[10px]">
                  Get Started
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="nav-mobile-btn bg-transparent p-2 pointer-events-auto"
            aria-label="Toggle menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ink">
              {mobileOpen ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </>
              ) : (
                <>
                  <line x1="4" y1="8" x2="20" y2="8" />
                  <line x1="4" y1="16" x2="20" y2="16" />
                </>
              )}
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-cream flex flex-col justify-center items-center gap-12">
          {NAV_SECTIONS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="font-[family-name:var(--font-cormorant)] text-3xl font-light italic text-ink no-underline"
            >
              {link.label}
            </a>
          ))}
          <div className="flex flex-col items-center gap-4 mt-4">
            {isSignedIn ? (
              <Link href="/aire" onClick={() => setMobileOpen(false)} className="btn-pill btn-pill-primary px-10">
                Open AIRE
              </Link>
            ) : (
              <>
                <Link href="/sign-in" onClick={() => setMobileOpen(false)} className="text-ink-muted text-sm no-underline">
                  Sign In
                </Link>
                <Link href="/sign-up" onClick={() => setMobileOpen(false)} className="btn-pill btn-pill-primary px-10">
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
