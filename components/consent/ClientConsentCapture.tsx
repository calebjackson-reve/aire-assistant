"use client"

// ClientConsentCapture — TCPA gate UI (Daylight cream, Cormorant heading,
// IBM Plex Mono for phone, Olive primary CTA, muted-red for revoke).
// Use as a modal or inline block before any SMS-bearing surface.

import { useState } from "react"

interface Party {
  name: string
  phone?: string | null
  email?: string | null
  role?: string
}

interface Props {
  transactionId?: string
  parties: Party[]
  onRecorded?: (consentId: string, party: Party) => void
  className?: string
}

type Status = "idle" | "capturing" | "saved" | "error"

export function ClientConsentCapture({ transactionId, parties, onRecorded, className = "" }: Props) {
  const [statuses, setStatuses] = useState<Record<string, Status>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function record(party: Party, channel: "SMS" | "VOICE") {
    if (!party.phone) return
    const key = `${party.phone}:${channel}`
    setStatuses((s) => ({ ...s, [key]: "capturing" }))
    setErrors((e) => ({ ...e, [key]: "" }))

    try {
      const res = await fetch("/api/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId,
          clientName: party.name,
          clientPhone: party.phone,
          clientEmail: party.email ?? null,
          channel,
          method: "AGENT_ATTESTATION",
          notes: `Recorded from transaction consent UI`,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setStatuses((s) => ({ ...s, [key]: "error" }))
        setErrors((e) => ({ ...e, [key]: data.error ?? "Failed" }))
        return
      }
      setStatuses((s) => ({ ...s, [key]: "saved" }))
      onRecorded?.(data.consent.id, party)
    } catch {
      setStatuses((s) => ({ ...s, [key]: "error" }))
      setErrors((e) => ({ ...e, [key]: "Network error" }))
    }
  }

  return (
    <div className={`rounded-xl border border-[#c5c9b8] bg-[#f5f2ea] p-5 ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#6b7d52]/70 mb-1.5">
            TCPA · Consent Gate
          </p>
          <h3 className="font-(family-name:--font-cormorant) italic text-[#1e2416] text-2xl leading-[1.15] tracking-[-0.015em]">
            Confirm client consent
          </h3>
          <p className="text-[#4a5638] text-sm leading-relaxed mt-2 max-w-lg">
            AIRE will not send SMS or voice messages to a client until you attest
            that they gave permission. One tap per party, per channel.
          </p>
        </div>
      </div>

      <ul className="space-y-2.5">
        {parties.filter((p) => p.phone).map((party) => {
          const smsKey = `${party.phone}:SMS`
          const smsStatus = statuses[smsKey] ?? "idle"

          return (
            <li
              key={party.phone ?? party.name}
              className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-[#c5c9b8]/70 bg-[#f0ece2] px-4 py-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-[#1e2416] text-sm font-medium truncate">{party.name}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="font-mono text-[12px] text-[#4a5638]">{party.phone}</span>
                  {party.role && (
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[#8a9070]">
                      {party.role}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {smsStatus === "saved" ? (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-md border border-[#9aab7e] bg-[#e8f0e0] px-3 py-1.5 text-xs font-medium text-[#4a5638]"
                    aria-live="polite"
                  >
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#6b7d52]" />
                    SMS consent recorded
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => record(party, "SMS")}
                    disabled={smsStatus === "capturing"}
                    style={{ transition: "transform 200ms cubic-bezier(0.34,1.56,0.64,1)" }}
                    className="inline-flex items-center gap-2 rounded-md bg-[#6b7d52] px-4 py-2 text-xs font-medium text-[#f5f2ea] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9aab7e]/50"
                  >
                    {smsStatus === "capturing" ? "Recording..." : "Confirm SMS consent"}
                  </button>
                )}
              </div>

              {errors[smsKey] && (
                <p className="basis-full font-mono text-[11px] text-[#8b4a4a]">{errors[smsKey]}</p>
              )}
            </li>
          )
        })}
      </ul>

      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#8a9070] mt-4">
        One row per attestation · revocable from /aire/settings/consents
      </p>
    </div>
  )
}
