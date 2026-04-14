import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import Link from "next/link"
import { DarkLayout } from "@/components/layouts/DarkLayout"
import { HairlineDivider } from "@/components/ui/primitives/HairlineDivider"

type EnvelopeStatus = "DRAFT" | "SENT" | "IN_PROGRESS" | "COMPLETED" | "VOIDED" | "EXPIRED" | "DECLINED"

const STATUS_DOT: Record<EnvelopeStatus, string> = {
  COMPLETED: "#6b7d52",
  SENT: "#9aab7e",
  IN_PROGRESS: "#d4944c",
  DRAFT: "rgba(30,36,22,0.25)",
  DECLINED: "#c4787a",
  VOIDED: "#c4787a",
  EXPIRED: "rgba(30,36,22,0.18)",
}

const STATUS_LABEL_COLOR: Record<EnvelopeStatus, string> = {
  COMPLETED: "#4a5638",
  SENT: "#6b7d52",
  IN_PROGRESS: "#9a6b2c",
  DRAFT: "rgba(30,36,22,0.45)",
  DECLINED: "#8a3a3a",
  VOIDED: "#8a3a3a",
  EXPIRED: "rgba(30,36,22,0.35)",
}

function SectionLabel({ number, title, count }: { number: string; title: string; count?: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-[11px] text-[#9aab7e]/50">{number}</span>
      <h2 className="font-[family-name:var(--font-cormorant)] text-[#1e2416] text-lg tracking-wide">
        {title}
      </h2>
      {count !== undefined && (
        <span className="font-mono text-[10px] text-[#6b7d52]/35">({count})</span>
      )}
      <div className="flex-1 h-px bg-[#e8e4d8]/60" />
    </div>
  )
}

export default async function AirSignPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in?redirect_url=/airsign")

  const user = await prisma.user.findUnique({ where: { clerkId: userId } })
  if (!user) redirect("/sign-in")

  const envelopes = await prisma.airSignEnvelope.findMany({
    where: { userId: user.id },
    include: {
      signers: { select: { name: true, signedAt: true } },
      _count: { select: { fields: true } },
    },
    orderBy: { updatedAt: "desc" },
  })

  const counts: Record<EnvelopeStatus, number> = {
    DRAFT: 0, SENT: 0, IN_PROGRESS: 0, COMPLETED: 0, VOIDED: 0, EXPIRED: 0, DECLINED: 0,
  }
  for (const e of envelopes) counts[e.status as EnvelopeStatus]++

  const totalActive = counts.SENT + counts.IN_PROGRESS
  const completionRate = envelopes.length > 0
    ? Math.round((counts.COMPLETED / envelopes.length) * 100)
    : 0

  const today = new Date()
  const dateStr = today.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  })

  const STATUS_TILES: { key: EnvelopeStatus; label: string }[] = [
    { key: "DRAFT", label: "Draft" },
    { key: "SENT", label: "Sent" },
    { key: "IN_PROGRESS", label: "In progress" },
    { key: "COMPLETED", label: "Completed" },
    { key: "VOIDED", label: "Voided" },
    { key: "EXPIRED", label: "Expired" },
  ]

  return (
    <DarkLayout>
      <div data-theme="daylight" className="min-h-screen bg-[#f5f2ea]">
        <div className="max-w-3xl mx-auto px-4 sm:px-8 py-12 sm:py-16">

          {/* ── Header ── */}
          <header className="mb-12">
            <p className="font-mono text-[10px] text-[#6b7d52] tracking-[0.3em] uppercase mb-4">
              AIRE Signatures
            </p>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <h1 className="font-[family-name:var(--font-cormorant)] italic text-[#1e2416] text-4xl sm:text-5xl leading-[1.1]">
                AirSign
              </h1>
              <div className="sm:text-right">
                <p className="text-[#1e2416] text-sm">{dateStr}</p>
                {envelopes.length > 0 ? (
                  <div className="flex items-center gap-2 mt-1.5 sm:justify-end">
                    <span className={`w-1.5 h-1.5 rounded-full ${totalActive > 0 ? "bg-[#6b7d52] animate-pulse" : "bg-[#6b7d52]/40"}`} />
                    <span className="font-mono text-[10px] text-[#6b7d52]/70 uppercase tracking-wider">
                      {totalActive} active · {completionRate}% complete
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mt-1.5 sm:justify-end">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#6b7d52]/40" />
                    <span className="font-mono text-[10px] text-[#6b7d52]/70 uppercase tracking-wider">
                      No envelopes yet
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-6">
              <HairlineDivider tone="light" />
            </div>
          </header>

          {/* ── Empty state ── */}
          {envelopes.length === 0 ? (
            <div className="py-24 text-center">
              <p className="font-[family-name:var(--font-cormorant)] italic text-[#1e2416]/30 text-2xl mb-3">
                No envelopes yet
              </p>
              <p className="text-[#6b7d52]/60 text-sm leading-relaxed max-w-sm mx-auto mb-6">
                Send your first document for electronic signature. Contracts,
                disclosures, and addenda — signed without leaving AIRE.
              </p>
              <Link
                href="/airsign/new"
                className="inline-block text-[11px] uppercase tracking-[0.14em] rounded-md px-5 py-2.5 bg-[#6b7d52] text-[#f5f2ea] font-medium hover:bg-[#5a6b43] transition-colors"
              >
                + New envelope
              </Link>
              <div className="mt-8 h-px w-16 bg-[#e8e4d8] mx-auto" />
            </div>
          ) : (
            <div className="space-y-14">

              {/* ── 01 Status ── */}
              <section>
                <SectionLabel number="01" title="Status" />
                <div className="mt-5 grid grid-cols-3 sm:grid-cols-6 gap-0.5">
                  {STATUS_TILES.map(({ key, label }) => {
                    const count = counts[key]
                    const emphasized = key === "COMPLETED" && count > 0
                    return (
                      <div
                        key={key}
                        className="px-4 py-3.5 text-center hover:bg-[#e8e4d8]/40 transition-colors rounded"
                      >
                        <p
                          className={`font-mono text-[22px] leading-none tabular-nums ${
                            emphasized ? "text-[#6b7d52]" : "text-[#1e2416]"
                          }`}
                          style={{ fontWeight: 500 }}
                        >
                          {count}
                        </p>
                        <p className="font-mono text-[9px] text-[#6b7d52]/50 uppercase tracking-[0.18em] mt-2">
                          {label}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </section>

              <hr className="border-0 h-px bg-[#e8e4d8]" />

              {/* ── 02 Envelopes ── */}
              <section>
                <SectionLabel number="02" title="Envelopes" count={envelopes.length} />
                <div className="mt-5 space-y-0.5">
                  {envelopes.map((env) => {
                    const signed = env.signers.filter((s) => s.signedAt).length
                    const status = env.status as EnvelopeStatus
                    const updatedStr = new Date(env.updatedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                    return (
                      <Link
                        key={env.id}
                        href={`/airsign/${env.id}`}
                        className="group grid grid-cols-[8px_1fr_auto_80px] gap-x-4 px-4 py-3.5 items-center rounded-lg hover:bg-[#e8e4d8]/45 transition-colors"
                      >
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ background: STATUS_DOT[status] }}
                        />
                        <div className="min-w-0">
                          <p className="text-[#1e2416] text-sm leading-snug truncate group-hover:text-[#6b7d52] transition-colors">
                            {env.name}
                          </p>
                          <p className="font-mono text-[10px] text-[#6b7d52]/50 uppercase tracking-wider mt-0.5 truncate">
                            {env.signers.length} signer{env.signers.length === 1 ? "" : "s"} · {signed}/{env.signers.length} signed · {env._count.fields} field{env._count.fields === 1 ? "" : "s"}
                          </p>
                        </div>
                        <span
                          className="font-mono text-[10px] uppercase tracking-[0.14em] whitespace-nowrap hidden sm:block"
                          style={{ color: STATUS_LABEL_COLOR[status] }}
                        >
                          {status.replace(/_/g, " ")}
                        </span>
                        <span className="font-mono text-[11px] text-[#1e2416]/45 text-right tabular-nums">
                          {updatedStr}
                        </span>
                      </Link>
                    )
                  })}
                </div>
              </section>

              <hr className="border-0 h-px bg-[#e8e4d8]" />

              {/* ── 03 Send a new one ── */}
              <section>
                <SectionLabel number="03" title="Send a new one" />
                <div className="mt-5 flex items-center justify-between gap-6 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <p className="font-[family-name:var(--font-cormorant)] italic text-[#1e2416] text-xl">
                      Send a document for signature.
                    </p>
                    <p className="text-[#6b7d52]/70 text-sm mt-1.5 leading-relaxed">
                      Upload a PDF, place fields, invite signers. Sealed copy returned automatically.
                    </p>
                  </div>
                  <Link
                    href="/airsign/new"
                    className="shrink-0 text-[11px] uppercase tracking-[0.14em] rounded-md px-5 py-2.5 bg-[#6b7d52] text-[#f5f2ea] font-medium hover:bg-[#5a6b43] transition-colors"
                  >
                    + New envelope
                  </Link>
                </div>
              </section>

              {/* ── Report footer ── */}
              <div className="pt-8 text-center">
                <div className="h-px w-12 bg-[#e8e4d8] mx-auto mb-4" />
                <p className="font-mono text-[9px] text-[#6b7d52]/30 uppercase tracking-[0.3em]">
                  AirSign · {envelopes.length} envelope{envelopes.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </DarkLayout>
  )
}
