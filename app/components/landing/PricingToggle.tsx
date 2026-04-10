'use client'

import { useState } from 'react'
import Link from 'next/link'

const PLANS = [
  {
    name: "Agent",
    monthly: "$197",
    annual: "$157",
    period: "/mo",
    badge: null,
    description: "Replace five subscriptions with one.",
    features: [
      "Morning Brief — your pipeline at 7 AM",
      "Transaction Coordinator — zero missed deadlines",
      "AirSign — unlimited e-signatures",
      "Voice Commands — run deals from the car",
      "Document intelligence + LREC compliance",
      "Market data + AIRE Estimate",
      "Deadline alerts via email + SMS",
    ],
    cta: "Start 14-Day Free Trial",
    style: "default" as const,
  },
  {
    name: "Team",
    monthly: "$497",
    annual: "$397",
    period: "/mo",
    badge: "Most Popular",
    description: "Your team coordinator that never calls in sick.",
    features: [
      "Everything in Agent for up to 10 users",
      "Broker dashboard — see every deal",
      "Team pipeline + compliance view",
      "Shared document templates",
      "Agent onboarding + training",
      "Priority support from Caleb",
    ],
    cta: "Start 14-Day Free Trial",
    style: "featured" as const,
  },
  {
    name: "Brokerage",
    monthly: "$1,497",
    annual: "$1,197",
    period: "/mo",
    badge: "Enterprise",
    description: "Replace your TC department.",
    features: [
      "Everything in Team for up to 50 users",
      "White-label option — your brand, your domain",
      "Brokerage-wide compliance dashboard",
      "Agent performance analytics",
      "Custom LREC form library",
      "Monthly strategy call with Caleb",
      "API access for custom integrations",
    ],
    cta: "Talk to Caleb",
    style: "default" as const,
  },
]

export function PricingToggle({ signedIn }: { signedIn: boolean }) {
  const [annual, setAnnual] = useState(false)

  return (
    <div>
      {/* Toggle */}
      <div className="flex items-center justify-center gap-3 mb-12">
        <span className={`text-sm transition-colors ${!annual ? "text-ink font-medium" : "text-ink-muted"}`}>Monthly</span>
        <button
          onClick={() => setAnnual(!annual)}
          className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${annual ? "bg-olive" : "bg-champagne"}`}
          aria-label="Toggle annual pricing"
        >
          <span
            className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-300 ${annual ? "left-[26px]" : "left-0.5"}`}
          />
        </button>
        <span className={`text-sm transition-colors ${annual ? "text-ink font-medium" : "text-ink-muted"}`}>
          Annual
          <span className="ml-1.5 text-xs text-sage font-medium">Save 20%</span>
        </span>
      </div>

      {/* Cards — Seed-style product cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
        {PLANS.map((plan) => {
          const price = annual ? plan.annual : plan.monthly
          const isFeatured = plan.style === "featured"

          return (
            <div
              key={plan.name}
              className={`relative rounded-xl overflow-hidden transition-all duration-300 hover:translate-y-[-4px] ${
                isFeatured
                  ? "bg-[#3a4a28] text-[#f4f1ec] shadow-[0_16px_48px_rgba(30,36,22,0.25)]"
                  : "bg-white border border-champagne-light"
              }`}
            >
              {/* Badge */}
              {plan.badge && (
                <div className="absolute top-4 left-4">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-medium tracking-wide ${
                    isFeatured
                      ? "bg-[#9aab7e]/20 text-[#9aab7e]"
                      : "bg-sage/10 text-sage"
                  }`}>
                    {plan.badge}
                  </span>
                </div>
              )}

              <div className="p-7 pt-12">
                {/* Plan name */}
                <p className={`text-xs tracking-[0.15em] uppercase mb-4 font-[family-name:var(--font-label)] ${
                  isFeatured ? "text-[#9aab7e]/60" : "text-sage"
                }`}>
                  {plan.name}
                </p>

                {/* Price */}
                <div className="flex items-baseline gap-1 mb-2">
                  <span className={`text-4xl font-[family-name:var(--font-mono)] font-light tracking-tight ${
                    isFeatured ? "text-[#f4f1ec]" : "text-ink"
                  }`}>
                    {price}
                  </span>
                  {plan.period && (
                    <span className={`text-sm ${isFeatured ? "text-[#f4f1ec]/40" : "text-ink-faint"}`}>
                      {plan.period}
                    </span>
                  )}
                </div>
                <p className={`text-sm mb-7 ${isFeatured ? "text-[#f4f1ec]/50" : "text-ink-muted"}`}>
                  {plan.description}
                </p>

                {/* Features */}
                <ul className="space-y-2.5 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className={`text-sm flex items-start gap-2.5 ${isFeatured ? "text-[#f4f1ec]/70" : "text-ink-muted"}`}>
                      <span className={`w-1 h-1 rounded-full mt-2 shrink-0 ${isFeatured ? "bg-[#9aab7e]" : "bg-sage"}`} />
                      {f}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Link
                  href={signedIn ? "/aire" : "/sign-up"}
                  className={`block w-full text-center py-3 rounded-lg text-sm font-medium tracking-wide transition-all duration-300 ${
                    isFeatured
                      ? "bg-[#f4f1ec] text-[#3a4a28] hover:bg-white"
                      : "bg-ink text-cream hover:bg-olive"
                  }`}
                >
                  {signedIn ? "Open Dashboard" : plan.cta}
                </Link>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
