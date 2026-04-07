"use client"

import { useScrollReveal } from "@/app/hooks/useScrollReveal"

function MockupShell({ children }: { children: React.ReactNode }) {
  const { ref, isVisible } = useScrollReveal<HTMLDivElement>(0.15)
  return (
    <div
      ref={ref}
      className={`relative aspect-[4/3] rounded-lg overflow-hidden transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"
      }`}
      style={{ background: "#1e2416", boxShadow: "0 24px 64px rgba(30,36,22,0.4)" }}
    >
      {/* Window chrome */}
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-[#9aab7e]/10">
        <span className="w-2 h-2 rounded-full bg-[#c45c5c]/60" />
        <span className="w-2 h-2 rounded-full bg-[#d4944c]/50" />
        <span className="w-2 h-2 rounded-full bg-[#9aab7e]/50" />
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

export function TCMockup() {
  return (
    <MockupShell>
      <p className="mockup-text mb-3" style={{ fontSize: "9px", letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(154,171,126,0.5)" }}>
        Active Transaction
      </p>
      <p className="mockup-text-bright text-sm mb-4">5834 Guice Dr, Baton Rouge</p>
      <div className="mockup-badge bg-[#9aab7e]/15 text-[#9aab7e] mb-5">Active</div>

      <p className="mockup-text mb-2" style={{ fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(154,171,126,0.35)" }}>
        Deadlines
      </p>
      <div className="space-y-0.5">
        <div className="mockup-row">
          <span className="mockup-dot bg-[#c45c5c]" />
          <span className="mockup-text flex-1">Inspection Period</span>
          <span className="mockup-text" style={{ color: "rgba(196,92,92,0.8)" }}>Overdue</span>
        </div>
        <div className="mockup-row">
          <span className="mockup-dot bg-[#d4944c]" />
          <span className="mockup-text flex-1">Appraisal Due</span>
          <span className="mockup-text">Apr 8</span>
        </div>
        <div className="mockup-row">
          <span className="mockup-dot bg-[#9aab7e]" />
          <span className="mockup-text flex-1">Act of Sale</span>
          <span className="mockup-text">Apr 30</span>
        </div>
      </div>
    </MockupShell>
  )
}

export function AirSignMockup() {
  return (
    <MockupShell>
      <p className="mockup-text mb-3" style={{ fontSize: "9px", letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(154,171,126,0.5)" }}>
        AirSign Envelope
      </p>
      <p className="mockup-text-bright text-sm mb-4">Purchase_Agreement_5834_Guice.pdf</p>

      <p className="mockup-text mb-2" style={{ fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(154,171,126,0.35)" }}>
        Signers
      </p>
      <div className="space-y-0.5 mb-5">
        <div className="mockup-row">
          <span className="w-5 h-5 rounded-full bg-[#9aab7e]/20 flex items-center justify-center text-[8px] text-[#9aab7e] shrink-0">✓</span>
          <span className="mockup-text-bright flex-1" style={{ fontSize: "0.75rem" }}>John Smith (Buyer)</span>
          <span className="mockup-badge bg-[#9aab7e]/15 text-[#9aab7e]">Signed</span>
        </div>
        <div className="mockup-row">
          <span className="w-5 h-5 rounded-full bg-[#d4944c]/20 flex items-center justify-center text-[8px] text-[#d4944c] shrink-0">●</span>
          <span className="mockup-text-bright flex-1" style={{ fontSize: "0.75rem" }}>Sarah Davis (Seller)</span>
          <span className="mockup-badge bg-[#d4944c]/10 text-[#d4944c]">Pending</span>
        </div>
      </div>

      <button className="w-full py-2 rounded bg-[#9aab7e]/20 text-[#9aab7e] text-xs font-medium tracking-wide uppercase">
        Send Reminder
      </button>
    </MockupShell>
  )
}

export function BriefMockup() {
  return (
    <MockupShell>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="mockup-text" style={{ fontSize: "9px", letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(154,171,126,0.5)" }}>
            Morning Brief
          </p>
          <p className="mockup-text-bright text-sm mt-1">Friday, April 4</p>
        </div>
        <span className="mockup-badge bg-[#d4944c]/15 text-[#d4944c]">Pending</span>
      </div>

      <div className="space-y-0.5">
        <div className="mockup-row">
          <span className="mockup-dot bg-[#c45c5c]" />
          <span className="mockup-text flex-1">2 overdue deadlines across pipeline</span>
          <span className="mockup-text" style={{ fontSize: "9px" }}>06:30</span>
        </div>
        <div className="mockup-row">
          <span className="mockup-dot bg-[#d4944c]" />
          <span className="mockup-text flex-1">Appraisal due today — 5834 Guice Dr</span>
          <span className="mockup-text" style={{ fontSize: "9px" }}>06:30</span>
        </div>
        <div className="mockup-row">
          <span className="mockup-dot bg-[#9aab7e]" />
          <span className="mockup-text flex-1">3 contacts need follow-up this week</span>
          <span className="mockup-text" style={{ fontSize: "9px" }}>06:30</span>
        </div>
      </div>

      <div className="flex gap-2 mt-5">
        <button className="flex-1 py-2 rounded bg-[#9aab7e]/20 text-[#9aab7e] text-xs">Approve</button>
        <button className="flex-1 py-2 rounded bg-white/5 text-white/30 text-xs">Dismiss</button>
      </div>
    </MockupShell>
  )
}

export function VoiceMockup() {
  return (
    <MockupShell>
      <p className="mockup-text mb-4" style={{ fontSize: "9px", letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(154,171,126,0.5)" }}>
        Voice Command
      </p>

      {/* Input bar */}
      <div className="flex items-center gap-3 bg-white/5 rounded-lg px-4 py-3 mb-5">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9aab7e" strokeWidth="1.5" className="shrink-0 opacity-60">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
        </svg>
        <span className="mockup-text-bright text-sm" style={{ fontStyle: "italic", opacity: 0.6 }}>
          &quot;Create a transaction at 5834 Guice Drive&quot;
        </span>
      </div>

      {/* Response */}
      <div className="bg-[#9aab7e]/8 rounded-lg px-4 py-3 border border-[#9aab7e]/10">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#9aab7e]" />
          <span className="mockup-text" style={{ fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#9aab7e" }}>
            Classified — create_transaction
          </span>
        </div>
        <p className="mockup-text" style={{ lineHeight: "1.6" }}>
          Transaction created at 5834 Guice Dr.<br />
          Deadlines auto-calculated from today.
        </p>
      </div>
    </MockupShell>
  )
}
