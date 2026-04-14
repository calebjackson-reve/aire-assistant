"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

interface BrandingShape {
  logoUrl?: string
  accentColor?: string
  emailFooter?: string
  fontFamily?: string
  wordmark?: string
}

interface InitialShape {
  name: string
  slug: string
  branding: BrandingShape
  defaultSignerAuth: string
  requireSignerAuth: boolean
  complianceMode: string
}

interface MemberRow {
  id: string
  userId: string
  name: string
  email: string
  role: string
  joinedAt: string
  isSelf: boolean
}

type Mode = "CREATE" | "EDIT" | "VIEW"

export function BrokerageSettingsClient({
  mode,
  brokerageId,
  initial,
  members,
  canManageMembers,
}: {
  mode: Mode
  brokerageId?: string
  initial?: InitialShape
  members?: MemberRow[]
  canManageMembers?: boolean
}) {
  const router = useRouter()
  const [name, setName] = useState(initial?.name ?? "")
  const [slug, setSlug] = useState(initial?.slug ?? "")
  const [logoUrl, setLogoUrl] = useState(initial?.branding.logoUrl ?? "")
  const [accentColor, setAccentColor] = useState(initial?.branding.accentColor ?? "")
  const [emailFooter, setEmailFooter] = useState(initial?.branding.emailFooter ?? "")
  const [defaultSignerAuth, setDefaultSignerAuth] = useState(initial?.defaultSignerAuth ?? "EMAIL_LINK")
  const [requireSignerAuth, setRequireSignerAuth] = useState(initial?.requireSignerAuth ?? false)
  const [complianceMode, setComplianceMode] = useState(initial?.complianceMode ?? "OFF")
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const readonly = mode === "VIEW"

  async function handleSubmit() {
    setErr(null)
    setSaving(true)
    try {
      if (mode === "CREATE") {
        // Legacy brokerage-create endpoint lives outside v2 namespace
        const res = await fetch("/api/airsign/v2/brokerages/bootstrap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          }),
        })
        if (!res.ok) {
          const e = await res.json().catch(() => ({ error: "Failed" }))
          setErr(e.error ?? "Failed to create")
          return
        }
        router.refresh()
        return
      }

      if (!brokerageId) {
        setErr("missing brokerageId")
        return
      }

      const res = await fetch(`/api/airsign/v2/brokerages/${brokerageId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branding: { logoUrl, accentColor, emailFooter },
          defaultSignerAuth,
          requireSignerAuth,
          complianceMode,
        }),
      })
      if (!res.ok) {
        const e = await res.json()
        setErr(e.error ?? "Failed to save")
        return
      }
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      {mode === "CREATE" && (
        <div className="bg-[#1e2416]/40 border border-[#4a5638]/50 rounded-lg p-6">
          <p className="text-[#8a9070] text-[11px] tracking-[0.1em] uppercase mb-5">Identity</p>
          {err && (
            <div className="bg-[#8b4a4a]/15 border-l-[3px] border-[#8b4a4a] text-[#c45c5c] text-sm px-4 py-2.5 rounded mb-4">
              {err}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Brokerage name" value={name} onChange={setName} />
            <Field label="Slug" value={slug} onChange={setSlug} placeholder="reve-realtors" />
          </div>
          <div className="flex justify-end mt-6">
            <button
              onClick={handleSubmit}
              disabled={saving || !name}
              className="bg-[#6b7d52] text-[#f5f2ea] font-medium px-6 py-2.5 rounded-md text-sm hover:bg-[#5a6b43] disabled:opacity-50 transition-colors"
            >
              {saving ? "Creating..." : "Create brokerage"}
            </button>
          </div>
        </div>
      )}

      {mode !== "CREATE" && (
        <>
          <div className="bg-[#1e2416]/40 border border-[#4a5638]/50 rounded-lg p-6">
            <p className="text-[#8a9070] text-[11px] tracking-[0.1em] uppercase mb-5">Branding</p>
            {err && (
              <div className="bg-[#8b4a4a]/15 border-l-[3px] border-[#8b4a4a] text-[#c45c5c] text-sm px-4 py-2.5 rounded mb-4">
                {err}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Logo URL" value={logoUrl} onChange={setLogoUrl} readonly={readonly} className="col-span-2" />
              <Field label="Accent color (hex)" value={accentColor} onChange={setAccentColor} readonly={readonly} placeholder="#6b7d52" />
            </div>
            <div className="mt-4">
              <label className="block text-[#8a9070] text-[10px] tracking-[0.08em] uppercase mb-1.5">Email footer</label>
              <textarea
                value={emailFooter}
                onChange={(e) => setEmailFooter(e.target.value)}
                disabled={readonly}
                rows={3}
                placeholder="Appended to every signing invitation email."
                className="w-full bg-[#1e2416]/60 border border-[#4a5638] rounded-md px-3 py-2.5 text-[#e8e4d8] text-sm placeholder:text-[#8a9070]/60 focus:outline-none focus:border-[#9aab7e] disabled:opacity-60"
              />
            </div>
          </div>

          <div className="bg-[#1e2416]/40 border border-[#4a5638]/50 rounded-lg p-6">
            <p className="text-[#8a9070] text-[11px] tracking-[0.1em] uppercase mb-5">Signer authentication</p>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-[#8a9070] text-[10px] tracking-[0.08em] uppercase mb-1.5">
                  Default signer auth
                </label>
                <select
                  value={defaultSignerAuth}
                  onChange={(e) => setDefaultSignerAuth(e.target.value)}
                  disabled={readonly}
                  className="w-full bg-[#1e2416]/60 border border-[#4a5638] rounded-md px-3 py-2.5 text-[#e8e4d8] text-sm focus:outline-none focus:border-[#9aab7e] disabled:opacity-60"
                >
                  <option value="EMAIL_LINK">Email link (default)</option>
                  <option value="SMS_OTP">SMS one-time code</option>
                  <option value="ACCESS_CODE">Access code</option>
                  <option value="KBA">KBA (ID verification)</option>
                </select>
              </div>
              <div>
                <label className="block text-[#8a9070] text-[10px] tracking-[0.08em] uppercase mb-1.5">
                  Enforce default
                </label>
                <label className="flex items-center gap-2 bg-[#1e2416]/60 border border-[#4a5638] rounded-md px-3 py-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requireSignerAuth}
                    onChange={(e) => setRequireSignerAuth(e.target.checked)}
                    disabled={readonly}
                    className="accent-[#9aab7e]"
                  />
                  <span className="text-[#e8e4d8] text-sm">Require all signers to use ≥ default method</span>
                </label>
              </div>
            </div>
          </div>

          <div className="bg-[#1e2416]/40 border border-[#4a5638]/50 rounded-lg p-6">
            <p className="text-[#8a9070] text-[11px] tracking-[0.1em] uppercase mb-5">Compliance</p>
            <div>
              <label className="block text-[#8a9070] text-[10px] tracking-[0.08em] uppercase mb-1.5">Compliance mode</label>
              <select
                value={complianceMode}
                onChange={(e) => setComplianceMode(e.target.value)}
                disabled={readonly}
                className="w-full bg-[#1e2416]/60 border border-[#4a5638] rounded-md px-3 py-2.5 text-[#e8e4d8] text-sm focus:outline-none focus:border-[#9aab7e] disabled:opacity-60"
              >
                <option value="OFF">Off — no review required</option>
                <option value="REVIEW_BEFORE_SEND">Review before send</option>
                <option value="REVIEW_BEFORE_CLOSE">Review before close</option>
              </select>
              <p className="text-[#e8e4d8]/40 text-xs mt-1.5">
                Review-before-send blocks envelope delivery until a BROKER_OWNER or COMPLIANCE_OFFICER approves.
              </p>
            </div>
          </div>

          {!readonly && (
            <div className="flex justify-end">
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="bg-[#6b7d52] text-[#f5f2ea] font-medium px-6 py-2.5 rounded-md text-sm hover:bg-[#5a6b43] disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving..." : "Save settings"}
              </button>
            </div>
          )}

          {members && <MembersList brokerageId={brokerageId!} members={members} canManage={!!canManageMembers} />}
        </>
      )}
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  readonly,
  placeholder,
  className,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  readonly?: boolean
  placeholder?: string
  className?: string
}) {
  return (
    <div className={className}>
      <label className="block text-[#8a9070] text-[10px] tracking-[0.08em] uppercase mb-1.5">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readonly}
        placeholder={placeholder}
        className="w-full bg-[#1e2416]/60 border border-[#4a5638] rounded-md px-3 py-2.5 text-[#e8e4d8] text-sm placeholder:text-[#8a9070]/60 focus:outline-none focus:border-[#9aab7e] read-only:opacity-60"
      />
    </div>
  )
}

function MembersList({ brokerageId, members, canManage }: { brokerageId: string; members: MemberRow[]; canManage: boolean }) {
  const router = useRouter()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [role, setRole] = useState("AGENT")
  const [inviting, setInviting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function handleInvite() {
    setErr(null)
    setInviting(true)
    try {
      const res = await fetch("/api/airsign/v2/brokerages/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role }),
      })
      if (!res.ok) {
        const e = await res.json()
        setErr(e.error ?? "Failed")
        return
      }
      setEmail("")
      setRole("AGENT")
      setInviteOpen(false)
      router.refresh()
    } finally {
      setInviting(false)
    }
  }

  async function handleRemove(memberId: string) {
    if (!confirm("Remove this member from the brokerage?")) return
    const res = await fetch(`/api/airsign/v2/brokerages/members?memberId=${memberId}`, { method: "DELETE" })
    if (res.ok) router.refresh()
  }

  // Suppress unused brokerageId lint (consumed indirectly via same-session auth on the API)
  void brokerageId

  return (
    <div className="bg-[#1e2416]/40 border border-[#4a5638]/50 rounded-lg p-6">
      <div className="flex items-center justify-between mb-5">
        <p className="text-[#8a9070] text-[11px] tracking-[0.1em] uppercase">Members</p>
        {canManage && (
          <button
            onClick={() => setInviteOpen((v) => !v)}
            className="text-[#9aab7e] text-xs hover:text-[#e8e4d8] transition-colors"
          >
            {inviteOpen ? "Cancel" : "+ Invite"}
          </button>
        )}
      </div>

      {inviteOpen && canManage && (
        <div className="mb-4 p-4 bg-[#1e2416]/60 border border-[#4a5638] rounded-md space-y-3">
          {err && <div className="text-[#c45c5c] text-xs">{err}</div>}
          <div className="grid grid-cols-[1fr_180px_auto] gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="agent@example.com"
              className="bg-[#1e2416]/80 border border-[#4a5638] rounded-md px-3 py-2 text-[#e8e4d8] text-sm placeholder:text-[#8a9070]/60 focus:outline-none focus:border-[#9aab7e]"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="bg-[#1e2416]/80 border border-[#4a5638] rounded-md px-3 py-2 text-[#e8e4d8] text-sm focus:outline-none focus:border-[#9aab7e]"
            >
              <option value="AGENT">Agent</option>
              <option value="ASSISTANT">Assistant</option>
              <option value="OFFICE_ADMIN">Office admin</option>
              <option value="COMPLIANCE_OFFICER">Compliance officer</option>
              <option value="BROKER">Broker owner</option>
            </select>
            <button
              onClick={handleInvite}
              disabled={inviting || !email}
              className="bg-[#6b7d52] text-[#f5f2ea] text-xs px-4 py-2 rounded-md hover:bg-[#5a6b43] disabled:opacity-50 transition-colors"
            >
              {inviting ? "..." : "Add"}
            </button>
          </div>
          <p className="text-[#8a9070] text-[11px]">
            They must already have an AIRE account. They&apos;ll gain access to the brokerage on their next sign-in.
          </p>
        </div>
      )}

      <div className="divide-y divide-[#4a5638]/40">
        {members.map((m) => (
          <div key={m.id} className="flex items-center justify-between py-3">
            <div>
              <p className="text-[#e8e4d8] text-sm">
                {m.name}
                {m.isSelf && <span className="text-[#8a9070] text-xs ml-2">(you)</span>}
              </p>
              <p className="text-[#8a9070] text-xs">{m.email}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-[family-name:var(--font-mono)] text-[#9aab7e] bg-[#6b7d52]/15 px-2 py-0.5 rounded">
                {m.role}
              </span>
              {canManage && !m.isSelf && (
                <button
                  onClick={() => handleRemove(m.id)}
                  className="text-[#8a9070] text-xs hover:text-[#c45c5c] transition-colors"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
