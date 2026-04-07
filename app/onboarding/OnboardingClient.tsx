"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"

interface InitialState {
  firstName: string | null
  lastName: string | null
  email: string
  brokerageName: string | null
  licenseNumber: string | null
  defaultCommissionSplit: number | null
  preferredTitleCompany: string | null
  avatarUrl: string | null
  hasSignature: boolean
  gmailConnected: string | null
  mlsConnected: boolean
  contactCount: number
}

export default function OnboardingClient({ initial }: { initial: InitialState }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // ---------- Gmail ----------
  const [gmailEmail, setGmailEmail] = useState(initial.gmailConnected)
  const [gmailScanning, setGmailScanning] = useState(false)

  useEffect(() => {
    const status = searchParams.get("gmail")
    const email = searchParams.get("email")
    if (status === "connected" && email) {
      setGmailEmail(email)
      setGmailScanning(true)
      // Clear from URL
      const params = new URLSearchParams(searchParams.toString())
      params.delete("gmail")
      params.delete("email")
      const next = params.toString()
      router.replace(`/onboarding${next ? `?${next}` : ""}`)
    }
  }, [searchParams, router])

  const connectGmail = async () => {
    const res = await fetch("/api/oauth/gmail/start")
    const data = await res.json()
    if (data.url) window.location.href = data.url
  }

  // ---------- MLS ----------
  const [mlsProvider, setMlsProvider] = useState("")
  const [mlsUsername, setMlsUsername] = useState("")
  const [mlsPassword, setMlsPassword] = useState("")
  const [mlsConnected, setMlsConnected] = useState(initial.mlsConnected)
  const [mlsSaving, setMlsSaving] = useState(false)

  const saveMls = async () => {
    if (!mlsProvider) return
    setMlsSaving(true)
    try {
      const res = await fetch("/api/onboarding/mls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: mlsProvider,
          username: mlsUsername,
          password: mlsPassword,
        }),
      })
      if (res.ok) setMlsConnected(true)
    } finally {
      setMlsSaving(false)
    }
  }

  // ---------- LinkedIn (stub) ----------
  const [linkedInModalOpen, setLinkedInModalOpen] = useState(false)

  // ---------- vCard upload ----------
  const [contactCount, setContactCount] = useState(initial.contactCount)
  const [vcardUploading, setVcardUploading] = useState(false)
  const [vcardMessage, setVcardMessage] = useState<string | null>(null)
  const vcfInputRef = useRef<HTMLInputElement>(null)

  const uploadVcard = async (files: FileList | null) => {
    if (!files || !files.length) return
    setVcardUploading(true)
    setVcardMessage(null)
    try {
      const form = new FormData()
      for (const f of Array.from(files)) form.append("vcf", f)
      const res = await fetch("/api/onboarding/vcard", { method: "POST", body: form })
      const data = await res.json()
      if (res.ok) {
        setContactCount(c => c + (data.created || 0))
        setVcardMessage(`Imported ${data.created} new contacts from ${data.parsed} parsed entries.`)
      } else {
        setVcardMessage(data.error || "Upload failed")
      }
    } finally {
      setVcardUploading(false)
    }
  }

  // ---------- Profile ----------
  const [brokerageName, setBrokerageName] = useState(initial.brokerageName || "")
  const [licenseNumber, setLicenseNumber] = useState(initial.licenseNumber || "")
  const [commissionSplit, setCommissionSplit] = useState(
    initial.defaultCommissionSplit != null ? String(initial.defaultCommissionSplit) : ""
  )
  const [titleCompany, setTitleCompany] = useState(initial.preferredTitleCompany || "")
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(initial.avatarUrl)
  const [profileSaving, setProfileSaving] = useState(false)

  const onAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const saveProfile = async () => {
    setProfileSaving(true)
    try {
      const form = new FormData()
      form.append("brokerageName", brokerageName)
      form.append("licenseNumber", licenseNumber)
      form.append("defaultCommissionSplit", commissionSplit)
      form.append("preferredTitleCompany", titleCompany)
      if (avatarFile) form.append("avatar", avatarFile)
      await fetch("/api/onboarding/profile", { method: "POST", body: form })
    } finally {
      setProfileSaving(false)
    }
  }

  // ---------- Signature ----------
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(initial.hasSignature)
  const [sigSaved, setSigSaved] = useState(initial.hasSignature)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.strokeStyle = "#1e2416"
    ctx.lineWidth = 2.5
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
  }, [])

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY
    return {
      x: ((clientX - rect.left) / rect.width) * canvas.width,
      y: ((clientY - rect.top) / rect.height) * canvas.height,
    }
  }

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    const ctx = canvasRef.current?.getContext("2d")
    if (!ctx) return
    const { x, y } = getPos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
    setIsDrawing(true)
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return
    e.preventDefault()
    const ctx = canvasRef.current?.getContext("2d")
    if (!ctx) return
    const { x, y } = getPos(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    setHasSignature(true)
  }

  const endDraw = () => setIsDrawing(false)

  const clearSig = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!ctx || !canvas) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
    setSigSaved(false)
  }

  const saveSig = async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dataUrl = canvas.toDataURL("image/png")
    const res = await fetch("/api/onboarding/signature", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signatureData: dataUrl }),
    })
    if (res.ok) setSigSaved(true)
  }

  // ---------- Finish ----------
  const [finishing, setFinishing] = useState(false)
  const finish = async () => {
    setFinishing(true)
    try {
      // Save profile & signature if dirty (best effort)
      if (!sigSaved && hasSignature) await saveSig()
      await saveProfile()
      await fetch("/api/onboarding/complete", { method: "POST" })
      router.push("/aire")
    } finally {
      setFinishing(false)
    }
  }

  // ---------- UI ----------
  const sectionClass =
    "rounded-2xl border border-[#9aab7e]/25 bg-[#f5f2ea] p-7 shadow-[0_1px_0_rgba(30,36,22,0.04),0_20px_40px_-28px_rgba(30,36,22,0.25)]"
  const labelClass =
    "block text-[11px] uppercase tracking-[0.18em] text-[#6b7d52] mb-2 font-medium"
  const inputClass =
    "w-full rounded-lg border border-[#9aab7e]/30 bg-white/60 px-4 py-2.5 text-[#1e2416] text-sm outline-none focus:border-[#6b7d52] focus:bg-white transition-colors placeholder:text-[#6b7d52]/40"
  const pillBtn =
    "inline-flex items-center gap-2 rounded-full border border-[#6b7d52]/30 bg-[#9aab7e] text-white text-sm px-5 py-2.5 hover:bg-[#6b7d52] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
  const ghostBtn =
    "inline-flex items-center gap-2 rounded-full border border-[#6b7d52]/30 bg-white/60 text-[#1e2416] text-sm px-5 py-2.5 hover:bg-white transition-colors disabled:opacity-50"
  const connectedBadge =
    "inline-flex items-center gap-2 rounded-full border border-[#9aab7e]/40 bg-[#9aab7e]/15 text-[#6b7d52] text-xs px-3 py-1"

  return (
    <div className="min-h-screen bg-[#e8e4d8]">
      <div className="max-w-3xl mx-auto px-6 py-14">
        {/* Header */}
        <div className="mb-12">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[#6b7d52] mb-3">
            Day One
          </p>
          <h1 className="font-serif italic text-[#1e2416] text-4xl md:text-5xl leading-[1.05] tracking-tight mb-3">
            Welcome to AIRE.
          </h1>
          <p className="text-[#6b7d52] text-base max-w-xl leading-relaxed">
            Connect a few accounts and share a few details. AIRE will pre-populate
            your contacts, deals, signature, and brokerage — so you never type
            anything twice.
          </p>
        </div>

        {/* Section 1: Connect Accounts */}
        <section className={`${sectionClass} mb-6`}>
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="font-serif italic text-[#1e2416] text-2xl">
              1. Connect your accounts
            </h2>
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#6b7d52]/60">
              Four sources
            </span>
          </div>

          <div className="space-y-3">
            {/* Gmail */}
            <div className="flex items-center justify-between gap-4 rounded-xl border border-[#9aab7e]/20 bg-white/50 p-4">
              <div>
                <p className="text-[#1e2416] text-sm font-medium">Gmail</p>
                <p className="text-[#6b7d52] text-xs mt-0.5">
                  Scan the last 90 days of mail to build your contact list automatically.
                </p>
                {gmailEmail && (
                  <p className="text-[#6b7d52] text-xs mt-1 italic">{gmailEmail}</p>
                )}
                {gmailScanning && (
                  <p className="text-[#6b7d52] text-xs mt-1">
                    Scanning your inbox… contacts will appear in the background.
                  </p>
                )}
              </div>
              {gmailEmail ? (
                <span className={connectedBadge}>Connected</span>
              ) : (
                <button onClick={connectGmail} className={pillBtn}>
                  Connect Gmail
                </button>
              )}
            </div>

            {/* MLS */}
            <div className="rounded-xl border border-[#9aab7e]/20 bg-white/50 p-4">
              <div className="flex items-center justify-between gap-4 mb-3">
                <div>
                  <p className="text-[#1e2416] text-sm font-medium">MLS</p>
                  <p className="text-[#6b7d52] text-xs mt-0.5">
                    We will schedule a listing + comp import using your RETS or RESO credentials.
                  </p>
                </div>
                {mlsConnected && <span className={connectedBadge}>Import scheduled</span>}
              </div>
              {!mlsConnected && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <select
                    className={inputClass}
                    value={mlsProvider}
                    onChange={e => setMlsProvider(e.target.value)}
                  >
                    <option value="">MLS provider…</option>
                    <option value="GBRMLS">Greater Baton Rouge MLS</option>
                    <option value="NOMAR">New Orleans (GSREIN/NOMAR)</option>
                    <option value="REALCOMP">Realcomp</option>
                    <option value="CRMLS">CRMLS</option>
                    <option value="OTHER">Other</option>
                  </select>
                  <input
                    className={inputClass}
                    placeholder="Agent ID or username"
                    value={mlsUsername}
                    onChange={e => setMlsUsername(e.target.value)}
                  />
                  <input
                    className={`${inputClass} sm:col-span-1`}
                    type="password"
                    placeholder="Password"
                    value={mlsPassword}
                    onChange={e => setMlsPassword(e.target.value)}
                  />
                  <button
                    onClick={saveMls}
                    disabled={!mlsProvider || mlsSaving}
                    className={pillBtn}
                  >
                    {mlsSaving ? "Saving…" : "Connect MLS"}
                  </button>
                </div>
              )}
            </div>

            {/* LinkedIn */}
            <div className="flex items-center justify-between gap-4 rounded-xl border border-[#9aab7e]/20 bg-white/50 p-4">
              <div>
                <p className="text-[#1e2416] text-sm font-medium">LinkedIn</p>
                <p className="text-[#6b7d52] text-xs mt-0.5">
                  Optional — pull in referral partners and past clients.
                </p>
              </div>
              <button
                onClick={() => setLinkedInModalOpen(true)}
                className={ghostBtn}
              >
                Connect LinkedIn
              </button>
            </div>

            {/* vCard Upload */}
            <div className="flex items-center justify-between gap-4 rounded-xl border border-[#9aab7e]/20 bg-white/50 p-4">
              <div>
                <p className="text-[#1e2416] text-sm font-medium">Phone contacts (.vcf)</p>
                <p className="text-[#6b7d52] text-xs mt-0.5">
                  Export from iPhone or Android and upload here.
                </p>
                {contactCount > 0 && (
                  <p className="text-[#6b7d52] text-xs mt-1 italic">
                    {contactCount} contact{contactCount === 1 ? "" : "s"} in your book.
                  </p>
                )}
                {vcardMessage && (
                  <p className="text-[#6b7d52] text-xs mt-1">{vcardMessage}</p>
                )}
              </div>
              <div>
                <input
                  ref={vcfInputRef}
                  type="file"
                  accept=".vcf,text/vcard"
                  multiple
                  className="hidden"
                  onChange={e => uploadVcard(e.target.files)}
                />
                <button
                  onClick={() => vcfInputRef.current?.click()}
                  disabled={vcardUploading}
                  className={pillBtn}
                >
                  {vcardUploading ? "Importing…" : "Upload .vcf"}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Profile */}
        <section className={`${sectionClass} mb-6`}>
          <h2 className="font-serif italic text-[#1e2416] text-2xl mb-5">
            2. Your profile
          </h2>

          <div className="flex items-center gap-5 mb-6">
            <div className="w-20 h-20 rounded-full overflow-hidden border border-[#9aab7e]/30 bg-white/60 flex items-center justify-center">
              {avatarPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarPreview}
                  alt="Headshot"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-[#6b7d52]/40 text-xs">Photo</span>
              )}
            </div>
            <label className={ghostBtn + " cursor-pointer"}>
              Upload headshot
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onAvatarChange}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Brokerage</label>
              <input
                className={inputClass}
                value={brokerageName}
                onChange={e => setBrokerageName(e.target.value)}
                placeholder="Reve Realtors"
              />
            </div>
            <div>
              <label className={labelClass}>License number</label>
              <input
                className={inputClass}
                value={licenseNumber}
                onChange={e => setLicenseNumber(e.target.value)}
                placeholder="LA 0000000"
              />
            </div>
            <div>
              <label className={labelClass}>Default commission split (%)</label>
              <input
                className={inputClass}
                type="number"
                step="0.01"
                value={commissionSplit}
                onChange={e => setCommissionSplit(e.target.value)}
                placeholder="3"
              />
            </div>
            <div>
              <label className={labelClass}>Preferred title company</label>
              <input
                className={inputClass}
                value={titleCompany}
                onChange={e => setTitleCompany(e.target.value)}
                placeholder="First American Title"
              />
            </div>
          </div>
        </section>

        {/* Section 3: Signature */}
        <section className={`${sectionClass} mb-6`}>
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="font-serif italic text-[#1e2416] text-2xl">
              3. Your signature
            </h2>
            {sigSaved && <span className={connectedBadge}>Saved</span>}
          </div>
          <p className="text-[#6b7d52] text-xs mb-3">
            Draw it once. AIRE will use this to pre-fill AirSign envelopes.
          </p>
          <div className="rounded-xl border border-[#9aab7e]/30 bg-white overflow-hidden">
            <canvas
              ref={canvasRef}
              width={800}
              height={220}
              className="w-full h-[180px] touch-none cursor-crosshair"
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={endDraw}
              onMouseLeave={endDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={endDraw}
            />
          </div>
          <div className="flex gap-3 mt-3">
            <button onClick={clearSig} className={ghostBtn}>
              Clear
            </button>
            <button
              onClick={saveSig}
              disabled={!hasSignature}
              className={pillBtn}
            >
              Save signature
            </button>
          </div>
        </section>

        {/* Section 4: Finish */}
        <div className="flex items-center justify-between gap-4 pt-6">
          <p className="text-[#6b7d52] text-xs">
            You can edit everything later in Settings.
          </p>
          <button
            onClick={finish}
            disabled={finishing}
            className="rounded-full bg-[#1e2416] text-[#f5f2ea] text-sm px-8 py-3 hover:bg-[#6b7d52] transition-colors disabled:opacity-50"
          >
            {finishing ? "Finishing…" : "Finish & enter AIRE"}
          </button>
        </div>
      </div>

      {/* LinkedIn Modal (stub) */}
      {linkedInModalOpen && (
        <div
          className="fixed inset-0 bg-[#1e2416]/60 flex items-center justify-center z-50 p-6"
          onClick={() => setLinkedInModalOpen(false)}
        >
          <div
            className="bg-[#f5f2ea] rounded-2xl p-8 max-w-md border border-[#9aab7e]/30"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="font-serif italic text-[#1e2416] text-2xl mb-2">
              Coming soon
            </h3>
            <p className="text-[#6b7d52] text-sm mb-5">
              LinkedIn integration is on the roadmap. For now, export your connections
              as a .vcf and use the phone contacts uploader.
            </p>
            <button
              onClick={() => setLinkedInModalOpen(false)}
              className={pillBtn}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
