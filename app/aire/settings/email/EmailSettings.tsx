"use client"

import { useState } from "react"

interface Account {
  id: string
  email: string
  provider: string
  isActive: boolean
  lastScan: string | null
  createdAt: string
}

export function EmailSettings({
  accounts,
  googleConfigured,
}: {
  accounts: Account[]
  googleConfigured: boolean
}) {
  const [connecting, setConnecting] = useState(false)

  async function connectGmail() {
    setConnecting(true)
    try {
      const res = await fetch("/api/email/oauth")
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else setConnecting(false)
    } catch {
      setConnecting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Connected Accounts */}
      {accounts.length > 0 ? (
        <div className="card-glass !p-0 !rounded-xl divide-y divide-glass-border overflow-hidden">
          {accounts.map((account) => (
            <div key={account.id} className="p-5 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-cream text-sm font-medium">{account.email}</span>
                  <span
                    className={`badge !text-xs !py-0.5 !px-2 ${
                      account.isActive
                        ? "!bg-status-green/15 !text-status-green"
                        : "!bg-cream-dark/10 !text-cream-dark"
                    }`}
                  >
                    {account.isActive ? "Connected" : "Disconnected"}
                  </span>
                </div>
                <p className="text-cream-dim text-xs mt-0.5">
                  {account.provider === "gmail" ? "Gmail" : account.provider} · Connected{" "}
                  {new Date(account.createdAt).toLocaleDateString()}
                  {account.lastScan && ` · Last scan ${new Date(account.lastScan).toLocaleString()}`}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card-glass !rounded-xl text-center !py-12">
          <p className="text-cream text-sm font-medium">No email accounts connected</p>
          <p className="text-cream-dim text-xs mt-1">
            Connect your Gmail to enable AIRE email intelligence scanning.
          </p>
        </div>
      )}

      {/* Connect Button */}
      <div className="card-glass !p-5 !rounded-xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-cream text-sm font-medium">Add Gmail Account</p>
            <p className="text-cream-dim text-xs mt-0.5">
              {googleConfigured
                ? "AIRE scans for transaction emails, flags unanswered messages, and generates draft replies."
                : "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables to enable."}
            </p>
          </div>
          <button
            onClick={connectGmail}
            disabled={!googleConfigured || connecting}
            className="btn-pill !py-2 !px-5 btn-pill-primary !text-sm disabled:opacity-40 shrink-0"
          >
            {connecting ? "Connecting..." : "Connect Gmail"}
          </button>
        </div>
      </div>

      {/* Permissions Info */}
      <div className="card-sage !p-5 !rounded-xl">
        <p className="text-cream text-xs font-medium mb-2 tracking-[0.1em] uppercase">What AIRE accesses</p>
        <ul className="text-cream-dim text-xs space-y-1.5">
          <li>Read-only access to Gmail messages and labels</li>
          <li>Email metadata (sender, subject, date) for classification</li>
          <li>PDF attachments for document auto-filing</li>
          <li>AIRE never sends emails on your behalf</li>
        </ul>
      </div>
    </div>
  )
}
