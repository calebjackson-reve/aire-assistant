"use client"

import { useState, useEffect, useCallback } from "react"

interface UnansweredMsg {
  id: string
  channel: "email" | "sms" | "call"
  from: string
  subject?: string
  bodyPreview: string
  sentAt: string
  hoursUnanswered: number
  contactName?: string
  contactId?: string
  urgency: "low" | "medium" | "high" | "critical"
}

interface MissedCall {
  id: string
  callerPhone: string
  callerName: string | null
  callTime: string
  hoursAgo: number
}

interface TriageData {
  unanswered: {
    critical: UnansweredMsg[]
    high: UnansweredMsg[]
    medium: UnansweredMsg[]
    low: UnansweredMsg[]
    total: number
  }
  missedCalls: MissedCall[]
  recentEmails: {
    transaction: Array<{ id: string; fromAddress: string; subject: string | null; bodyPreview: string | null; sentAt: string }>
    other: Array<{ id: string; fromAddress: string; subject: string | null; bodyPreview: string | null; sentAt: string }>
  }
  accounts: Array<{ id: string; email: string; provider: string; lastScan: string | null }>
  lastScanAt: string | null
  stats: { totalUnanswered: number; missedCallCount: number; criticalCount: number }
}

export function EmailDashboard({ googleConfigured }: { googleConfigured: boolean }) {
  const [data, setData] = useState<TriageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [draftingId, setDraftingId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [fetchError, setFetchError] = useState<string | null>(null)

  const fetchTriage = useCallback(async () => {
    try {
      setFetchError(null)
      const res = await fetch("/api/email/triage")
      if (res.ok) setData(await res.json())
      else setFetchError(`Failed to load email data (${res.status})`)
    } catch {
      setFetchError("Failed to connect to email service")
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchTriage() }, [fetchTriage])

  async function connectGmail() {
    setConnecting(true)
    try {
      const res = await fetch("/api/email/oauth")
      const d = await res.json()
      if (d.url) window.location.href = d.url
      else setConnecting(false)
    } catch { setConnecting(false) }
  }

  async function scanNow() {
    setScanning(true)
    try {
      await fetch("/api/email/scan-now", { method: "POST" })
      await fetchTriage()
    } catch { /* ignore */ }
    setScanning(false)
  }

  async function markHandled(logId: string) {
    await fetch("/api/email/handle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logId, action: "handled" }),
    })
    await fetchTriage()
  }

  async function getDraft(logId: string) {
    if (drafts[logId]) return
    setDraftingId(logId)
    try {
      const res = await fetch("/api/email/draft-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId }),
      })
      const d = await res.json()
      if (d.draft) setDrafts((prev) => ({ ...prev, [logId]: d.draft }))
    } catch { /* ignore */ }
    setDraftingId(null)
  }

  if (loading) {
    return <div className="text-cream-dim text-sm py-12 text-center">Loading email intelligence...</div>
  }

  if (fetchError) {
    return (
      <div className="border border-brown-border rounded-xl p-8 text-center">
        <p className="text-red-400 text-sm mb-3">{fetchError}</p>
        <button onClick={() => { setLoading(true); fetchTriage() }} className="text-copper hover:text-copper-light text-sm">
          Retry
        </button>
      </div>
    )
  }

  const hasAccounts = data && data.accounts.length > 0

  return (
    <div className="space-y-6">
      {/* Connection + Scan Bar */}
      <div className="card-glass !p-5 flex items-center justify-between">
        <div>
          {hasAccounts ? (
            <>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-status-green animate-pulse-dot" />
                <p className="text-cream text-sm font-medium">
                  {data.accounts.map((a) => a.email).join(", ")}
                </p>
              </div>
              <p className="text-cream-dim text-xs mt-0.5 ml-4">
                Last scan: {data.lastScanAt ? new Date(data.lastScanAt).toLocaleString() : "Never"}
              </p>
            </>
          ) : (
            <>
              <p className="text-cream text-sm font-medium">No Gmail connected</p>
              <p className="text-cream-dim text-xs mt-0.5">
                {googleConfigured
                  ? "Connect Gmail to enable inbox scanning and AI triage."
                  : "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET first."}
              </p>
            </>
          )}
        </div>
        <div className="flex gap-2">
          {hasAccounts && (
            <button
              onClick={scanNow}
              disabled={scanning}
              className="btn-pill !py-2 !px-4 btn-pill-primary !text-xs disabled:opacity-40"
            >
              {scanning ? "Scanning..." : "Scan Now"}
            </button>
          )}
          {!hasAccounts && (
            <button
              onClick={connectGmail}
              disabled={!googleConfigured || connecting}
              className="btn-pill !py-2 !px-4 btn-pill-primary !text-xs disabled:opacity-40"
            >
              {connecting ? "Connecting..." : "Connect Gmail"}
            </button>
          )}
        </div>
      </div>

      {/* Stats Row */}
      {data && (
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Needs Response" value={data.stats.totalUnanswered} alert={data.stats.totalUnanswered > 0} />
          <StatCard label="Missed Calls" value={data.stats.missedCallCount} alert={data.stats.missedCallCount > 0} />
          <StatCard label="Critical" value={data.stats.criticalCount} alert={data.stats.criticalCount > 0} />
        </div>
      )}

      {/* Missed Calls — top priority */}
      {data && data.missedCalls.length > 0 && (
        <Section title="Missed Calls" count={data.missedCalls.length} variant="red">
          {data.missedCalls.map((c) => (
            <div key={c.id} className="card-earth !p-4 !rounded-xl flex items-center justify-between">
              <div>
                <p className="text-cream text-sm font-medium">{c.callerName ?? c.callerPhone}</p>
                <p className="text-cream-dim text-xs">{c.hoursAgo}h ago</p>
              </div>
              <span className="badge !bg-status-red/15 !text-status-red !text-xs !py-0.5">Unreturned</span>
            </div>
          ))}
        </Section>
      )}

      {/* Critical + High — Needs Response */}
      {data && (data.unanswered.critical.length > 0 || data.unanswered.high.length > 0) && (
        <Section
          title="Needs Response"
          count={data.unanswered.critical.length + data.unanswered.high.length}
          variant={data.unanswered.critical.length > 0 ? "red" : "amber"}
        >
          {[...data.unanswered.critical, ...data.unanswered.high].map((msg) => (
            <MessageCard
              key={msg.id}
              msg={msg}
              draft={drafts[msg.id]}
              draftingId={draftingId}
              onDraft={getDraft}
              onHandled={markHandled}
            />
          ))}
        </Section>
      )}

      {/* Medium + Low — Informational */}
      {data && (data.unanswered.medium.length > 0 || data.unanswered.low.length > 0) && (
        <Section title="Informational" count={data.unanswered.medium.length + data.unanswered.low.length} variant="sage">
          {[...data.unanswered.medium, ...data.unanswered.low].map((msg) => (
            <MessageCard
              key={msg.id}
              msg={msg}
              draft={drafts[msg.id]}
              draftingId={draftingId}
              onDraft={getDraft}
              onHandled={markHandled}
            />
          ))}
        </Section>
      )}

      {/* Transaction Emails */}
      {data && data.recentEmails.transaction.length > 0 && (
        <Section title="Transaction Emails" count={data.recentEmails.transaction.length} variant="sage">
          {data.recentEmails.transaction.map((e) => (
            <div key={e.id} className="card-glass !p-4 !rounded-xl">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-cream text-sm font-medium">{e.subject ?? "(no subject)"}</p>
                  <p className="text-cream-dim text-xs mt-0.5">{e.fromAddress}</p>
                </div>
                <span className="text-cream-dark text-xs shrink-0">{timeAgo(e.sentAt)}</span>
              </div>
              {e.bodyPreview && (
                <p className="text-cream-dim/60 text-xs mt-2 line-clamp-2">{e.bodyPreview}</p>
              )}
            </div>
          ))}
        </Section>
      )}

      {/* Empty State */}
      {data && data.stats.totalUnanswered === 0 && data.missedCalls.length === 0 && (
        <div className="card-sage !rounded-xl text-center !py-12">
          <p className="text-cream text-sm font-medium">All clear</p>
          <p className="text-cream-dim text-xs mt-1">No unanswered messages or missed calls.</p>
        </div>
      )}
    </div>
  )
}

/* ── Sub-components ─────────────────────────── */

function StatCard({ label, value, alert }: { label: string; value: number; alert: boolean }) {
  return (
    <div className="card-glass !p-4 !rounded-xl text-center">
      <p className="text-cream-dark text-[10px] tracking-[0.15em] uppercase">{label}</p>
      <p className={`text-2xl font-light mt-0.5 ${alert ? "text-status-red" : "text-cream"}`}>
        {value}
      </p>
    </div>
  )
}

function Section({ title, count, variant, children }: {
  title: string
  count: number
  variant: "red" | "amber" | "sage"
  children: React.ReactNode
}) {
  const badgeStyles = {
    red: "!bg-status-red/15 !text-status-red",
    amber: "!bg-status-amber/15 !text-status-amber",
    sage: "!bg-sage/15 !text-sage-light",
  }
  return (
    <div>
      <div className="flex items-center gap-2.5 mb-3">
        <h3 className="text-cream text-sm font-semibold" style={{ fontStyle: "normal" }}>{title}</h3>
        <span className={`badge !text-xs !py-0.5 !px-2 ${badgeStyles[variant]}`}>{count}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function MessageCard({ msg, draft, draftingId, onDraft, onHandled }: {
  msg: UnansweredMsg
  draft?: string
  draftingId: string | null
  onDraft: (id: string) => void
  onHandled: (id: string) => void
}) {
  const cardStyle = {
    critical: "card-earth",
    high: "card-earth",
    medium: "card-glass",
    low: "card-glass",
  }
  const urgencyBadge = {
    critical: "!bg-status-red/15 !text-status-red",
    high: "!bg-status-amber/15 !text-status-amber",
    medium: "!bg-sage/15 !text-sage-light",
    low: "!bg-cream-dark/10 !text-cream-dark",
  }

  return (
    <div className={`${cardStyle[msg.urgency]} !p-4 !rounded-xl`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.1em] text-cream-dark">{msg.channel}</span>
            <span className={`badge !text-[10px] !py-0 !px-1.5 ${urgencyBadge[msg.urgency]}`}>
              {msg.hoursUnanswered > 48 ? "48h+" : `${Math.round(msg.hoursUnanswered)}h`}
            </span>
          </div>
          <p className="text-cream text-sm font-medium mt-1">{msg.contactName ?? msg.from}</p>
          {msg.subject && <p className="text-cream-dim text-xs mt-0.5">{msg.subject}</p>}
          <p className="text-cream-dark text-xs mt-1 line-clamp-2">{msg.bodyPreview}</p>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <button
            onClick={() => onDraft(msg.id)}
            disabled={draftingId === msg.id}
            className="btn-pill !py-1.5 !px-3 btn-pill-outline !text-xs disabled:opacity-40"
          >
            {draftingId === msg.id ? "Drafting..." : "Draft Reply"}
          </button>
          <button
            onClick={() => onHandled(msg.id)}
            className="btn-pill !py-1.5 !px-3 btn-pill-outline !text-xs"
          >
            Handled
          </button>
        </div>
      </div>

      {/* Draft Reply */}
      {draft && (
        <div className="mt-3 pt-3 border-t border-glass-border">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] uppercase tracking-[0.1em] text-copper-light font-medium">Draft Reply</span>
            <button
              onClick={() => navigator.clipboard.writeText(draft)}
              className="text-xs text-copper-light hover:text-peach transition-colors"
            >
              Copy
            </button>
          </div>
          <p className="text-cream text-xs leading-relaxed whitespace-pre-wrap bg-forest-deep/40 rounded-lg p-3">
            {draft}
          </p>
        </div>
      )}
    </div>
  )
}

function timeAgo(dateStr: string): string {
  const h = (Date.now() - new Date(dateStr).getTime()) / 3600000
  if (h < 1) return `${Math.round(h * 60)}m ago`
  if (h < 24) return `${Math.round(h)}h ago`
  return `${Math.round(h / 24)}d ago`
}
