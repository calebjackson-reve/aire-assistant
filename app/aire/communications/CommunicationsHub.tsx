"use client"

import { useState } from "react"

interface Contact {
  id: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  type: string
  neighborhood: string | null
  relationshipScore: number
  lastContactedAt: Date | null
}

interface Transaction {
  id: string
  propertyAddress: string
  buyerName: string | null
  sellerName: string | null
  buyerEmail: string | null
  sellerEmail: string | null
  buyerPhone: string | null
  sellerPhone: string | null
  status: string
}

interface Draft {
  subject: string
  body: string
  tone: string
  channel: string
  fairHousingCheck: boolean
  notes: string
}

export function CommunicationsHub({
  contacts,
  transactions,
}: {
  contacts: Contact[]
  transactions: Transaction[]
}) {
  const [contactName, setContactName] = useState("")
  const [contactType, setContactType] = useState("")
  const [channel, setChannel] = useState<"email" | "text" | "call">("text")
  const [purpose, setPurpose] = useState("")
  const [context, setContext] = useState("")
  const [loading, setLoading] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function generateDraft() {
    if (!contactName.trim() || !purpose.trim()) return

    setLoading(true)
    setError(null)
    setDraft(null)

    try {
      const res = await fetch("/api/communications/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactName, contactType, channel, purpose, context }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Draft generation failed")
      } else {
        setDraft(data.draft)
      }
    } catch {
      setError("Unable to reach the server. Check your connection and try again.")
    } finally {
      setLoading(false)
    }
  }

  function selectContact(c: Contact) {
    setContactName(`${c.firstName} ${c.lastName}`)
    setContactType(c.type)
    if (c.phone) setChannel("text")
    else if (c.email) setChannel("email")
  }

  function selectTransactionParty(name: string, type: string) {
    setContactName(name)
    setContactType(type)
  }

  return (
    <div>
      {/* Draft composer */}
      <div className="border border-brown-border rounded-xl p-6 mb-8">
        <p className="text-cream text-sm font-medium mb-4">Draft a message</p>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-cream-dim text-xs block mb-1">Recipient</label>
            <input
              type="text"
              placeholder="Contact name..."
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              className="w-full bg-forest-deep border border-brown-border rounded-lg px-4 py-2.5 text-cream text-sm placeholder:text-cream-dark/50 focus:outline-none focus:border-copper/40"
            />
          </div>
          <div>
            <label className="text-cream-dim text-xs block mb-1">Type</label>
            <input
              type="text"
              placeholder="Buyer, seller, lead..."
              value={contactType}
              onChange={(e) => setContactType(e.target.value)}
              className="w-full bg-forest-deep border border-brown-border rounded-lg px-4 py-2.5 text-cream text-sm placeholder:text-cream-dark/50 focus:outline-none focus:border-copper/40"
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="text-cream-dim text-xs block mb-1">Channel</label>
          <div className="flex gap-2">
            {(["text", "email", "call"] as const).map((ch) => (
              <button
                key={ch}
                onClick={() => setChannel(ch)}
                className={`text-sm px-4 py-2 rounded-lg border transition-colors ${
                  channel === ch
                    ? "border-copper bg-copper/10 text-copper"
                    : "border-brown-border text-cream-dim hover:text-cream"
                }`}
              >
                {ch === "text" ? "Text" : ch === "email" ? "Email" : "Call Script"}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className="text-cream-dim text-xs block mb-1">Purpose</label>
          <input
            type="text"
            placeholder="Follow up on showing, check in after closing, nurture lead..."
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && generateDraft()}
            className="w-full bg-forest-deep border border-brown-border rounded-lg px-4 py-2.5 text-cream text-sm placeholder:text-cream-dark/50 focus:outline-none focus:border-copper/40"
          />
        </div>

        <div className="mb-4">
          <label className="text-cream-dim text-xs block mb-1">Additional context (optional)</label>
          <textarea
            placeholder="Any details — property address, recent conversation, timeline..."
            value={context}
            onChange={(e) => setContext(e.target.value)}
            rows={2}
            className="w-full bg-forest-deep border border-brown-border rounded-lg px-4 py-2.5 text-cream text-sm placeholder:text-cream-dark/50 focus:outline-none focus:border-copper/40 resize-none"
          />
        </div>

        <button
          onClick={generateDraft}
          disabled={loading || !contactName.trim() || !purpose.trim()}
          className="bg-copper hover:bg-copper-light disabled:opacity-40 text-forest-deep font-medium text-sm px-6 py-2.5 rounded-lg transition-colors"
        >
          {loading ? "Drafting..." : "Generate Draft"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="border border-status-red/30 bg-status-red/5 rounded-lg p-4 mb-6">
          <p className="text-status-red text-sm">{error}</p>
        </div>
      )}

      {/* Draft output */}
      {draft && (
        <div className="border border-copper/20 bg-copper/5 rounded-xl p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-cream text-sm font-medium">
                {draft.channel === "email" ? "Email Draft" : draft.channel === "text" ? "Text Draft" : "Call Script"}
              </p>
              {draft.subject && (
                <p className="text-cream-dim text-xs mt-0.5">Subject: {draft.subject}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${
                draft.fairHousingCheck
                  ? "text-status-green bg-status-green/10"
                  : "text-status-red bg-status-red/10"
              }`}>
                {draft.fairHousingCheck ? "FH Compliant" : "FH Review Needed"}
              </span>
              <span className="text-cream-dim text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-brown-light/30">
                {draft.tone}
              </span>
            </div>
          </div>

          <div className="bg-forest-deep/50 border border-brown-border/50 rounded-lg p-4 mb-3">
            <p className="text-cream text-sm whitespace-pre-wrap leading-relaxed">{draft.body}</p>
          </div>

          {draft.notes && (
            <p className="text-cream-dim text-xs italic">{draft.notes}</p>
          )}

          <div className="flex gap-2 mt-4">
            <button
              onClick={() => navigator.clipboard.writeText(draft.body)}
              className="text-xs text-copper hover:text-copper-light transition-colors border border-copper/20 px-3 py-1.5 rounded-lg"
            >
              Copy to clipboard
            </button>
            <button
              onClick={generateDraft}
              className="text-xs text-cream-dim hover:text-cream transition-colors border border-brown-border px-3 py-1.5 rounded-lg"
            >
              Regenerate
            </button>
          </div>
        </div>
      )}

      {/* Quick select from contacts */}
      {contacts.length > 0 && (
        <div className="mb-8">
          <h2 className="text-cream font-medium mb-3">Quick select — contacts</h2>
          <div className="flex flex-wrap gap-2">
            {contacts.slice(0, 12).map((c) => (
              <button
                key={c.id}
                onClick={() => selectContact(c)}
                className="text-xs border border-brown-border text-cream-dim hover:text-cream hover:border-copper/30 px-3 py-1.5 rounded-lg transition-colors"
              >
                {c.firstName} {c.lastName}
                <span className="text-cream-dark/50 ml-1">{c.type}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quick select from transactions */}
      {transactions.length > 0 && (
        <div>
          <h2 className="text-cream font-medium mb-3">Quick select — transaction parties</h2>
          <div className="space-y-2">
            {transactions.map((txn) => (
              <div key={txn.id} className="border border-brown-border rounded-lg p-3">
                <p className="text-cream text-xs font-medium mb-2">{txn.propertyAddress}</p>
                <div className="flex flex-wrap gap-2">
                  {txn.buyerName && (
                    <button
                      onClick={() => selectTransactionParty(txn.buyerName!, "Buyer")}
                      className="text-[11px] border border-brown-border text-cream-dim hover:text-cream px-2.5 py-1 rounded transition-colors"
                    >
                      {txn.buyerName} (Buyer)
                    </button>
                  )}
                  {txn.sellerName && (
                    <button
                      onClick={() => selectTransactionParty(txn.sellerName!, "Seller")}
                      className="text-[11px] border border-brown-border text-cream-dim hover:text-cream px-2.5 py-1 rounded transition-colors"
                    >
                      {txn.sellerName} (Seller)
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
