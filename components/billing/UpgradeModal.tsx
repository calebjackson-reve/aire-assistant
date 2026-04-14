"use client";

import { useState } from "react";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature: string;
  requiredTier: "PRO" | "INVESTOR";
  currentTier: string;
  reason?: string;
  limit?: number;
  currentUsage?: number;
}

const TIER_INFO = {
  PRO: {
    name: "AIRE Pro",
    price: "$47/mo",
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID || "",
    features: [
      "Unlimited transactions",
      "TC automation agent",
      "Document intelligence (AI classification & extraction)",
      "Morning brief",
      "Email attachment scanning",
      "Relationship intelligence",
      "AirSign electronic signatures",
      "Batch document upload",
      "Compliance scanning",
    ],
  },
  INVESTOR: {
    name: "AIRE Investor",
    price: "$147/mo",
    priceId: process.env.NEXT_PUBLIC_STRIPE_INVESTOR_PRICE_ID || "",
    features: [
      "Everything in Pro",
      "Voice command pipeline",
      "CMA & AIRE Estimate engine",
      "External API access",
      "Priority support",
    ],
  },
};

export default function UpgradeModal({
  isOpen,
  onClose,
  feature,
  requiredTier,
  currentTier,
  reason,
  limit,
  currentUsage,
}: UpgradeModalProps) {
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const tier = TIER_INFO[requiredTier];
  const featureLabel = feature.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId: tier.priceId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Checkout error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#1e2416]/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-[#9aab7e] px-6 py-5">
          <h2
            className="text-xl font-bold text-[#f5f2ea]"
            style={{ fontFamily: "'Cormorant Garamond', serif" }}
          >
            Upgrade to {tier.name}
          </h2>
          <p className="text-sm text-[#f5f2ea]/80 mt-1">
            {featureLabel} requires {tier.name}
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {/* Reason / Limit message */}
          {reason && (
            <div className="bg-[#f5f2ea] rounded-lg p-3 mb-4 text-sm text-[#1e2416]">
              {reason}
              {limit !== undefined && currentUsage !== undefined && (
                <div className="mt-1 text-xs text-[#6b7d52]">
                  Usage: {currentUsage} / {limit}
                </div>
              )}
            </div>
          )}

          {/* Current tier badge */}
          <div className="text-xs text-gray-400 mb-3">
            Current plan: <span className="font-medium text-[#1e2416]">{currentTier}</span>
          </div>

          {/* Features list */}
          <div className="space-y-2 mb-5">
            {tier.features.map((f, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <svg
                  className="w-4 h-4 text-[#6b7d52] mt-0.5 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span className="text-[#1e2416]">{f}</span>
              </div>
            ))}
          </div>

          {/* Price */}
          <div className="text-center mb-4">
            <span
              className="text-3xl font-bold text-[#1e2416]"
              style={{ fontFamily: "'Cormorant Garamond', serif" }}
            >
              {tier.price}
            </span>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-[#e8e4d8] rounded-lg text-sm text-[#6b7d52] hover:bg-[#f5f2ea] transition-colors"
            >
              Maybe Later
            </button>
            <button
              onClick={handleUpgrade}
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-[#6b7d52] text-[#f5f2ea] rounded-lg text-sm font-medium hover:bg-[#5a6b44] transition-colors disabled:opacity-50"
            >
              {loading ? "Loading..." : `Upgrade to ${tier.name}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
