'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const NAV_LINKS = [
  { label: 'Tools',   href: '/tools' },
  { label: 'About',   href: '#about' },
  { label: 'Contact', href: '#contact' },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'backdrop-blur-xl border-b shadow-lg shadow-black/20'
            : 'bg-transparent'
        }`}
        style={scrolled ? { backgroundColor: 'rgba(10, 10, 8, 0.92)', borderColor: 'rgba(196, 168, 130, 0.08)' } : undefined}
      >
        <div className="container-aire flex items-center justify-between h-[64px]">
          <Link href="/" className="flex items-center gap-2.5 no-underline">
            <span className="font-display text-[17px] italic" style={{ color: '#F2E8DE' }}>
              AIRE
            </span>
          </Link>

          <div className="nav-desktop flex items-center gap-8">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="font-body text-sm font-medium transition-colors"
                style={{ color: 'rgba(212, 200, 188, 0.6)' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#C4A882')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(212, 200, 188, 0.6)')}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="nav-desktop">
            <Link href="/sign-up" className="btn-pill btn-pill-primary text-sm">
              Get Started
            </Link>
          </div>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="nav-mobile-btn bg-transparent p-2"
            style={{ color: '#F2E8DE' }}
            aria-label="Toggle menu"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {mobileOpen ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </>
              ) : (
                <>
                  <line x1="3" y1="7" x2="21" y2="7" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="17" x2="21" y2="17" />
                </>
              )}
            </svg>
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex flex-col justify-center items-center gap-10" style={{ backgroundColor: '#0a0a08' }}>
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="font-display text-3xl italic no-underline"
              style={{ color: '#F2E8DE' }}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/sign-up"
            onClick={() => setMobileOpen(false)}
            className="btn-pill btn-pill-primary text-base mt-4 px-10 py-3"
          >
            Get Started
          </Link>
        </div>
      )}
    </>
  )
}
