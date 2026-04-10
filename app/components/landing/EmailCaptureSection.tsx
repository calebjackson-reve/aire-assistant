'use client'

import { useState } from 'react'

export function EmailCaptureSection() {
  const [email, setEmail] = useState('')
  const [zip, setZip] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return

    // TODO: Wire to API route that saves lead + triggers welcome email
    // For now, just show success state
    setSubmitted(true)
  }

  return (
    <div className="relative z-10 container-aire max-w-2xl mx-auto text-center">
      <p className="text-[#9aab7e]/60 text-xs tracking-[0.2em] uppercase font-[family-name:var(--font-label)] mb-5">
        Free Weekly Brief
      </p>
      <h2 className="text-[#f4f1ec] text-2xl md:text-3xl font-[family-name:var(--font-display)] font-light italic mb-4">
        Your ZIP code, every Monday morning
      </h2>
      <p className="text-[#f4f1ec]/40 text-sm leading-relaxed max-w-md mx-auto mb-10">
        New listings, price drops, and closed deals in your market — curated by AI, delivered to your inbox. Free forever.
      </p>

      {submitted ? (
        <div className="animate-fade-up">
          <div className="inline-flex items-center gap-2 px-6 py-3 bg-[#9aab7e]/15 border border-[#9aab7e]/20 rounded-lg">
            <span className="w-2 h-2 rounded-full bg-[#9aab7e]" />
            <span className="text-[#9aab7e] text-sm font-medium">You&apos;re in. First brief drops Monday.</span>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            required
            className="flex-1 px-5 py-3.5 bg-white/8 border border-white/15 rounded-lg text-[#f4f1ec] text-sm placeholder:text-white/30 focus:outline-none focus:border-[#9aab7e]/40 transition"
          />
          <input
            type="text"
            value={zip}
            onChange={(e) => setZip(e.target.value)}
            placeholder="ZIP code"
            className="w-28 px-4 py-3.5 bg-white/8 border border-white/15 rounded-lg text-[#f4f1ec] text-sm placeholder:text-white/30 focus:outline-none focus:border-[#9aab7e]/40 transition"
          />
          <button
            type="submit"
            className="px-6 py-3.5 bg-[#f4f1ec] text-[#3a4a28] text-sm font-medium tracking-wide rounded-lg hover:bg-white transition-all duration-300 shrink-0"
          >
            Send Me the Brief
          </button>
        </form>
      )}

      <p className="text-[#f4f1ec]/20 text-xs mt-6">
        No spam. No pitch. Just data. Unsubscribe anytime.
      </p>
    </div>
  )
}
