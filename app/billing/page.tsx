"use client";

import { useUser } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";

const PLANS = [
  {
    name: "Free",
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
    name: "Pro",
    tier: "PRO",
    price: "$49",
    period: "/month",
    features: [
      "Unlimited property searches",
      "AI market analysis",
      "Transaction management",
      "Voice commands",
      "Deadline alerts (SMS)",
      "Document automation",
    ],
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID || "STRIPE_PRO_PRICE_ID",
    cta: "Upgrade to Pro",
    popular: true,
  },
  {
    name: "Investor",
    tier: "INVESTOR",
    price: "$149",
    period: "/month",
    features: [
      "Everything in Pro",
      "Portfolio analytics",
      "ROI calculator",
      "Multi-deal pipeline",
      "Priority support",
      "API access",
    ],
    priceId: process.env.NEXT_PUBLIC_STRIPE_INVESTOR_PRICE_ID || "STRIPE_INVESTOR_PRICE_ID",
    cta: "Upgrade to Investor",
  },
];

export default function BillingPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center" }}>Loading billing...</div>}>
      <BillingContent />
    </Suspense>
  );
}

function BillingContent() {
  const { user } = useUser();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState<string | null>(null);

  const success = searchParams.get("success");
  const canceled = searchParams.get("canceled");

  async function handleCheckout(priceId: string) {
    setLoading(priceId);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Checkout error:", error);
    } finally {
      setLoading(null);
    }
  }

  async function handlePortal() {
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Portal error:", error);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-6xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">
            AIRE Intelligence Plans
          </h1>
          <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
            Unlock the full power of AI-driven real estate intelligence
            for the Baton Rouge market.
          </p>
        </div>

        {/* Status banners */}
        {success && (
          <div className="mb-8 p-4 rounded-lg bg-emerald-900/50 border border-emerald-700 text-emerald-200 text-center">
            Welcome to AIRE Pro! Your subscription is now active.
          </div>
        )}
        {canceled && (
          <div className="mb-8 p-4 rounded-lg bg-amber-900/50 border border-amber-700 text-amber-200 text-center">
            Checkout canceled. No charges were made.
          </div>
        )}

        {/* Plan Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {PLANS.map((plan) => (
            <div
              key={plan.tier}
              className={`relative rounded-2xl p-8 flex flex-col ${
                plan.popular
                  ? "bg-gradient-to-b from-blue-900/40 to-zinc-900 border-2 border-blue-500"
                  : "bg-zinc-900 border border-zinc-800"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-4 py-1 rounded-full">
                  MOST POPULAR
                </div>
              )}

              <h2 className="text-2xl font-bold mb-2">{plan.name}</h2>
              <div className="mb-6">
                <span className="text-4xl font-bold">{plan.price}</span>
                <span className="text-zinc-400">{plan.period}</span>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <span className="text-emerald-400 mt-0.5">&#10003;</span>
                    <span className="text-zinc-300">{feature}</span>
                  </li>
                ))}
              </ul>

              {plan.priceId ? (
                <button
                  onClick={() => handleCheckout(plan.priceId!)}
                  disabled={loading === plan.priceId}
                  className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                    plan.popular
                      ? "bg-blue-600 hover:bg-blue-700 text-white"
                      : "bg-zinc-800 hover:bg-zinc-700 text-white"
                  } disabled:opacity-50`}
                >
                  {loading === plan.priceId ? "Redirecting..." : plan.cta}
                </button>
              ) : (
                <div className="w-full py-3 rounded-lg text-center font-semibold bg-zinc-800 text-zinc-500">
                  {plan.cta}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Manage Subscription */}
        <div className="mt-12 text-center">
          <button
            onClick={handlePortal}
            className="text-zinc-400 hover:text-white underline transition-colors"
          >
            Manage existing subscription
          </button>
        </div>
      </div>
    </div>
  );
}
