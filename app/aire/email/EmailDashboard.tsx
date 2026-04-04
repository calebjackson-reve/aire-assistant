"use client"

import { useState } from "react"

export function EmailDashboard({ googleConfigured }: { googleConfigured: boolean }) {
  const [connecting, setConnecting] = useState(false)

  async function connectGmail() {
    setConnecting(true)
    try {
      const res = await fetch("/api/email/oauth")
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setConnecting(false)
      }
    } catch {
      setConnecting(false)
    }
  }

  return (
    <div>
      {/* Connection status */}
      <div className="border border-brown-border rounded-xl p-6 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-cream text-sm font-medium">Gmail Connection</p>
            <p className="text-cream-dim text-xs mt-0.5">
              {googleConfigured
                ? "Connect your Gmail to enable email scanning and AI classification."
                : "Google OAuth credentials not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in environment variables."}
            </p>
          </div>
          <button
            onClick={connectGmail}
            disabled={!googleConfigured || connecting}
            className="bg-copper hover:bg-copper-light disabled:opacity-40 text-forest-deep font-medium text-sm px-5 py-2.5 rounded-lg transition-colors shrink-0"
          >
            {connecting ? "Connecting..." : "Connect Gmail"}
          </button>
        </div>
      </div>

      {/* How it works */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <FeatureCard
          title="Email Scan"
          description="AIRE scans your inbox for transaction-related emails — contracts, lender updates, title docs, inspection reports."
        />
        <FeatureCard
          title="AI Classification"
          description="Each email is classified by transaction, urgency, and action needed using consensus-based AI."
        />
        <FeatureCard
          title="Morning Brief"
          description="Classified emails feed into your Morning Brief — key updates surfaced before your first call."
        />
      </div>

      {/* Capabilities */}
      <div className="border border-brown-border rounded-xl p-6">
        <p className="text-cream text-sm font-medium mb-4">What AIRE detects in your email</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Contract updates", desc: "Executed agreements, amendments, addenda" },
            { label: "Lender communications", desc: "Approval letters, conditions, clear-to-close" },
            { label: "Title & closing", desc: "Title commitments, HUD-1, closing instructions" },
            { label: "Inspection reports", desc: "Inspection findings, repair requests, responses" },
            { label: "Client messages", desc: "Questions, concerns, scheduling requests" },
            { label: "Agent-to-agent", desc: "Showing feedback, offer negotiations, status updates" },
          ].map((item) => (
            <div key={item.label} className="border border-brown-border/50 rounded-lg p-3">
              <p className="text-cream text-sm">{item.label}</p>
              <p className="text-cream-dim text-xs mt-0.5">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="border border-brown-border rounded-xl p-5">
      <p className="text-cream text-sm font-medium mb-2">{title}</p>
      <p className="text-cream-dim text-xs leading-relaxed">{description}</p>
    </div>
  )
}
