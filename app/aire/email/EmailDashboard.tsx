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
    return <div className="text-[#6a6a60] text-sm py-12 text-center">Loading email intelligence...</div>
  }

  if (fetchError) {
    return (
      <div className="bg-white border border-[#d4c8b8] rounded-xl p-8 text-center">
        <p className="text-[#D45B5B] text-sm mb-3">{fetchError}</p>
        <button onClick={() => { setLoading(true); fetchTriage() }} className="text-[#6b7d52] hover:text-[#5a6c44] text-sm font-medium">
          Retry
        </button>
      </div>
    )
  }

  const hasAccounts = data && data.accounts.length > 0

  return (
    <div className="space-y-6">
      {/* Connection + Scan Bar */}
      <div className="bg-white border border-[#d4c8b8]/60 rounded-xl p-5 flex items-center justify-between">
        <div>
          {hasAccounts ? (
            <>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#6BBF59]" />
                <p className="text-[#1e2416] text-sm font-medium">
                  {data.accounts.map((a) => a.email).join(", ")}
                </p>
              </div>
              <p className="text-[#9a9a90] text-xs mt-0.5 ml-4">
                Last scan: {data.lastScanAt ? new Date(data.lastScanAt).toLocaleString() : "Never"}
              </p>
            </>
          ) : (
            <>
              <p className="text-[#1e2416] text-sm font-medium">No Gmail connected</p>
              <p className="text-[#9a9a90] text-xs mt-0.5">
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
              className="px-4 py-2 bg-[#6b7d52] text-[#f5f2ea] text-xs font-medium rounded-lg hover:bg-[#5a6c44] disabled:opacity-40 transition-colors"
            >
              {scanning ? "Scanning..." : "Scan Now"}
            </button>
          )}
          {!hasAccounts && (
            <button
              onClick={connectGmail}
              disabled={!googleConfigured || connecting}
              className="px-4 py-2 bg-[#6b7d52] text-[#f5f2ea] text-xs font-medium rounded-lg hover:bg-[#5a6c44] disabled:opacity-40 transition-colors"
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

      {/* Missed Calls */}
      {data && data.missedCalls.length > 0 && (
        <Section title="Missed Calls" count={data.missedCalls.length} variant="red">
          {data.missedCalls.map((c) => (
            <div key={c.id} className="bg-white border border-[#d4c8b8]/60 p-4 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-[#1e2416] text-sm font-medium">{c.callerName ?? c.callerPhone}</p>
                <p className="text-[#9a9a90] text-xs">{c.hoursAgo}h ago</p>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#D45B5B]/10 text-[#D45B5B] font-medium">Unreturned</span>
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
              onSent={fetchTriage}
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
              onSent={fetchTriage}
            />
          ))}
        </Section>
      )}

      {/* Transaction Emails */}
      {data && data.recentEmails.transaction.length > 0 && (
        <Section title="Transaction Emails" count={data.recentEmails.transaction.length} variant="sage">
          {data.recentEmails.transaction.map((e) => (
            <div key={e.id} className="bg-white border border-[#d4c8b8]/60 p-4 rounded-xl">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[#1e2416] text-sm font-medium">{e.subject ?? "(no subject)"}</p>
                  <p className="text-[#9a9a90] text-xs mt-0.5">{e.fromAddress}</p>
                </div>
                <span className="text-[#beb09e] text-xs shrink-0">{timeAgo(e.sentAt)}</span>
              </div>
              {e.bodyPreview && (
                <p className="text-[#6a6a60] text-xs mt-2 line-clamp-2">{e.bodyPreview}</p>
              )}
            </div>
          ))}
        </Section>
      )}

      {/* Empty State */}
      {data && data.stats.totalUnanswered === 0 && data.missedCalls.length === 0 && (
        <div className="bg-[#9aab7e]/8 border border-[#9aab7e]/20 rounded-xl text-center py-12">
          <p className="text-[#1e2416] text-sm font-medium">All clear</p>
          <p className="text-[#6a6a60] text-xs mt-1">No unanswered messages or missed calls.</p>
        </div>
      )}
    </div>
  )
}

/* ── Sub-components ─────────────────────────── */

function StatCard({ label, value, alert }: { label: string; value: number; alert: boolean }) {
  return (
    <div className="bg-white border border-[#d4c8b8]/60 p-4 rounded-xl text-center">
      <p className="text-[#9a9a90] text-[10px] tracking-[0.15em] uppercase">{label}</p>
      <p className={`text-2xl font-light mt-0.5 ${alert ? "text-[#D45B5B]" : "text-[#1e2416]"}`}>
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
    red: "bg-[#D45B5B]/10 text-[#D45B5B]",
    amber: "bg-[#E8B44C]/10 text-[#E8B44C]",
    sage: "bg-[#9aab7e]/10 text-[#6b7d52]",
  }
  return (
    <div>
      <div className="flex items-center gap-2.5 mb-3">
        <h3 className="text-[#1e2416] text-sm font-semibold" style={{ fontStyle: "normal" }}>{title}</h3>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${badgeStyles[variant]}`}>{count}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function MessageCard({ msg, draft, draftingId, onDraft, onHandled, onSent }: {
  msg: UnansweredMsg
  draft?: string
  draftingId: string | null
  onDraft: (id: string) => void
  onHandled: (id: string) => void
  onSent: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [editedBody, setEditedBody] = useState("")
  const [editedSubject, setEditedSubject] = useState("")
  const [sending, setSending] = useState(false)
  const [sendStatus, setSendStatus] = useState<"idle" | "sent" | "error">("idle")

  const urgencyBadge = {
    critical: "bg-[#D45B5B]/10 text-[#D45B5B]",
    high: "bg-[#E8B44C]/10 text-[#E8B44C]",
    medium: "bg-[#9aab7e]/10 text-[#6b7d52]",
    low: "bg-[#beb09e]/10 text-[#9a9a90]",
  }

  function openEditor() {
    if (!draft) return
    const lines = draft.split("\n")
    if (lines[0]?.startsWith("Subject:")) {
      setEditedSubject(lines[0].replace("Subject:", "").trim())
      setEditedBody(lines.slice(1).join("\n").trim())
    } else {
      setEditedSubject(msg.subject ? `Re: ${msg.subject}` : "Following up")
      setEditedBody(draft)
    }
    setEditing(true)
  }

  async function handleSend() {
    if (!editedBody.trim()) return
    setSending(true)
    setSendStatus("idle")
    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logId: msg.id,
          to: msg.from,
          subject: editedSubject,
          body: editedBody,
        }),
      })
      if (res.ok) {
        setSendStatus("sent")
        setEditing(false)
        setTimeout(() => onSent(), 1500)
      } else {
        setSendStatus("error")
      }
    } catch {
      setSendStatus("error")
    }
    setSending(false)
  }

  return (
    <div className="bg-white border border-[#d4c8b8]/60 p-4 rounded-xl">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.1em] text-[#9a9a90]">{msg.channel}</span>
            <span className={`text-[10px] py-0 px-1.5 rounded-full font-medium ${urgencyBadge[msg.urgency]}`}>
              {msg.hoursUnanswered > 48 ? "48h+" : `${Math.round(msg.hoursUnanswered)}h`}
            </span>
          </div>
          <p className="text-[#1e2416] text-sm font-medium mt-1">{msg.contactName ?? msg.from}</p>
          {msg.subject && <p className="text-[#6a6a60] text-xs mt-0.5">{msg.subject}</p>}
          <p className="text-[#9a9a90] text-xs mt-1 line-clamp-2">{msg.bodyPreview}</p>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <button
            onClick={() => onDraft(msg.id)}
            disabled={draftingId === msg.id}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#6b7d52]/30 text-[#6b7d52] hover:bg-[#9aab7e]/10 disabled:opacity-40 transition-colors"
          >
            {draftingId === msg.id ? "Drafting..." : "Draft Reply"}
          </button>
          <button
            onClick={() => onHandled(msg.id)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#d4c8b8] text-[#6a6a60] hover:bg-[#f5f2ea] transition-colors"
          >
            Handled
          </button>
        </div>
      </div>

      {/* Sent confirmation */}
      {sendStatus === "sent" && (
        <div className="mt-3 pt-3 border-t border-[#d4c8b8]/40">
          <p className="text-[#6BBF59] text-sm font-medium text-center py-2">Email sent to {msg.from}</p>
        </div>
      )}

      {/* Draft Reply — view mode */}
      {draft && !editing && sendStatus !== "sent" && (
        <div className="mt-3 pt-3 border-t border-[#d4c8b8]/40">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] uppercase tracking-[0.1em] text-[#6b7d52] font-medium">Draft Reply</span>
            <div className="flex gap-2">
              <button
                onClick={() => navigator.clipboard.writeText(draft)}
                className="text-xs text-[#9a9a90] hover:text-[#6a6a60] transition-colors"
              >
                Copy
              </button>
              <button
                onClick={openEditor}
                className="text-xs text-[#6b7d52] hover:text-[#5a6c44] transition-colors font-medium"
              >
                Edit & Send
              </button>
            </div>
          </div>
          <p className="text-[#1e2416] text-xs leading-relaxed whitespace-pre-wrap bg-[#f5f2ea] border border-[#d4c8b8]/30 rounded-lg p-3">
            {draft}
          </p>
        </div>
      )}

      {/* Draft Reply — edit & send mode */}
      {editing && sendStatus !== "sent" && (
        <div className="mt-3 pt-3 border-t border-[#d4c8b8]/40 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-[0.1em] text-[#6b7d52] font-medium">
              Replying to {msg.from}
            </span>
            <button
              onClick={() => setEditing(false)}
              className="text-xs text-[#9a9a90] hover:text-[#6a6a60] transition-colors"
            >
              Cancel
            </button>
          </div>
          <input
            type="text"
            value={editedSubject}
            onChange={(e) => setEditedSubject(e.target.value)}
            placeholder="Subject"
            className="w-full bg-[#f5f2ea] border border-[#d4c8b8]/50 rounded-lg px-3 py-2 text-[#1e2416] text-xs placeholder:text-[#beb09e] focus:outline-none focus:border-[#9aab7e]"
          />
          <textarea
            value={editedBody}
            onChange={(e) => setEditedBody(e.target.value)}
            rows={6}
            className="w-full bg-[#f5f2ea] border border-[#d4c8b8]/50 rounded-lg px-3 py-2 text-[#1e2416] text-xs leading-relaxed placeholder:text-[#beb09e] focus:outline-none focus:border-[#9aab7e] resize-none"
          />
          {sendStatus === "error" && (
            <p className="text-[#D45B5B] text-xs">Failed to send. Check your Resend API key.</p>
          )}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => navigator.clipboard.writeText(editedBody)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#d4c8b8] text-[#6a6a60] hover:bg-[#f5f2ea] transition-colors"
            >
              Copy
            </button>
            <button
              onClick={handleSend}
              disabled={sending || !editedBody.trim()}
              className="px-4 py-1.5 text-xs font-medium rounded-lg bg-[#6b7d52] text-[#f5f2ea] hover:bg-[#5a6c44] disabled:opacity-40 transition-colors"
            >
              {sending ? "Sending..." : "Send Email"}
            </button>
          </div>
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
