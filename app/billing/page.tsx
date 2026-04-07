"use client"

import { useUser } from "@clerk/nextjs"
import { useSearchParams } from "next/navigation"
import { useState, Suspense } from "react"

const PLANS = [
  {
    name: "AIRE Access",
    tier: "FREE",
    price: "$0",
    period: "/month",
    features: [
      "Basic market data",
      "3 property searches/day",
      "Email support",
    ],
    priceId: null,
    cta: "Current Plan",
  },
  {
    name: "AIRE Pro",
    tier: "PRO",
    price: "$97",
    period: "/month",
    features: [
      "Unlimited property searches",
      "AI market analysis",
      "Transaction management",
      "Voice commands",
      "Deadline alerts (SMS)",
      "Document automation",
      "AirSign e-signatures",
      "Morning Brief",
    ],
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID ?? "",
    cta: "Upgrade to Pro",
    popular: true,
  },
  {
    name: "AIRE Investor",
    tier: "INVESTOR",
    price: "$197",
    period: "/month",
    features: [
      "Everything in Pro",
      "Portfolio analytics",
      "ROI calculator",
      "Multi-deal pipeline",
      "Advanced deal analysis",
      "Priority support",
      "API access",
    ],
    priceId: process.env.NEXT_PUBLIC_STRIPE_INVESTOR_PRICE_ID ?? "",
    cta: "Upgrade to Investor",
  },
]

export default function BillingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f5f2ea] flex items-center justify-center text-[#6b7d52] text-sm">Loading billing...</div>}>
      <BillingContent />
    </Suspense>
  )
}

function BillingContent() {
  const { user } = useUser()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState<string | null>(null)

  const success = searchParams.get("success")
  const canceled = searchParams.get("canceled")

  async function handleCheckout(priceId: string) {
    setLoading(priceId)
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch (error) {
      console.error("Checkout error:", error)
    } finally {
      setLoading(null)
    }
  }

  async function handlePortal() {
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch (error) {
      console.error("Portal error:", error)
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f2ea]">
      <div className="max-w-5xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <p className="text-[#6b7d52] text-[10px] font-medium tracking-[0.25em] uppercase mb-2">
            AIRE Intelligence
          </p>
          <h1 className="font-[family-name:var(--font-cormorant)] italic text-[#1e2416] text-4xl mb-3">
            Choose Your Plan
          </h1>
          <p className="text-[#6b7d52]/60 text-base max-w-xl mx-auto">
            Unlock the full power of AI-driven real estate intelligence for the Baton Rouge market.
          </p>
        </div>

        {/* Status banners */}
        {success && (
          <div className="mb-8 p-4 rounded-lg bg-[#9aab7e]/15 border border-[#9aab7e]/30 text-[#6b7d52] text-center text-sm">
            Welcome to AIRE! Your subscription is now active.
          </div>
        )}
        {canceled && (
          <div className="mb-8 p-4 rounded-lg bg-[#d4944c]/10 border border-[#d4944c]/30 text-[#d4944c] text-center text-sm">
            Checkout canceled. No charges were made.
          </div>
        )}

        {/* Plan Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan) => (
            <div
              key={plan.tier}
              className={`relative rounded-2xl p-8 flex flex-col ${
                plan.popular
                  ? "bg-white border-2 border-[#6b7d52] shadow-[0_4px_24px_rgba(107,125,82,0.12)]"
                  : "bg-white border border-[#9aab7e]/20"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#6b7d52] text-[#f5f2ea] text-[10px] font-medium tracking-wider uppercase px-4 py-1 rounded-full">
                  Most Popular
                </div>
              )}

              <h2 className="text-[#1e2416] text-xl font-semibold mb-1">{plan.name}</h2>
              <div className="mb-6">
                <span className="text-[#1e2416] text-4xl font-bold">{plan.price}</span>
                <span className="text-[#6b7d52]/50 text-sm">{plan.period}</span>
              </div>

              <ul className="space-y-2.5 mb-8 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <span className="text-[#9aab7e] mt-0.5 text-sm">&#10003;</span>
                    <span className="text-[#1e2416]/70 text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              {plan.priceId ? (
                <button
                  onClick={() => handleCheckout(plan.priceId!)}
                  disabled={loading === plan.priceId}
                  className={`w-full py-3 rounded-lg text-sm font-medium transition min-h-[44px] ${
                    plan.popular
                      ? "bg-[#6b7d52] text-[#f5f2ea] hover:bg-[#6b7d52]/90"
                      : "bg-[#9aab7e]/10 text-[#6b7d52] hover:bg-[#9aab7e]/20"
                  } disabled:opacity-40`}
                >
                  {loading === plan.priceId ? "Redirecting..." : plan.cta}
                </button>
              ) : (
                <div className="w-full py-3 rounded-lg text-center text-sm font-medium bg-[#f5f2ea] text-[#6b7d52]/40">
                  {plan.cta}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Manage Subscription */}
        <div className="mt-10 text-center">
          <button
            onClick={handlePortal}
            className="text-[#6b7d52]/50 hover:text-[#6b7d52] text-sm underline transition"
          >
            Manage existing subscription
          </button>
        </div>
      </div>
    </div>
  )
}
