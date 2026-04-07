import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import Link from "next/link"
import { DarkLayout } from "@/components/layouts/DarkLayout"

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

  const counts = { DRAFT: 0, SENT: 0, IN_PROGRESS: 0, COMPLETED: 0, VOIDED: 0, EXPIRED: 0, DECLINED: 0 }
  for (const e of envelopes) counts[e.status]++

  const statusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "bg-[#6b7d52]/20 text-[#9aab7e]"
      case "SENT":
      case "IN_PROGRESS":
        return "bg-[#9aab7e]/15 text-[#9aab7e]"
      case "DRAFT":
        return "bg-[#6b7d52]/10 text-[#e8e4d8]/60"
      case "DECLINED":
      case "VOIDED":
        return "bg-red-500/10 text-red-400"
      case "EXPIRED":
        return "bg-[#e8e4d8]/5 text-[#e8e4d8]/40"
      default:
        return "bg-[#6b7d52]/10 text-[#e8e4d8]/50"
    }
  }

  return (
    <DarkLayout>
      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-[family-name:var(--font-cormorant)] italic text-[#f5f2ea] text-3xl">
              AirSign
            </h1>
            <p className="text-[#e8e4d8]/60 text-sm tracking-wide mt-1">Electronic Signatures</p>
          </div>
          <Link
            href="/airsign/new"
            className="bg-[#6b7d52] text-[#f5f2ea] font-medium px-5 py-2.5 rounded text-sm hover:bg-[#6b7d52]/80 transition-colors"
          >
            + New Envelope
          </Link>
        </div>

        {/* Status Counts */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-8">
          {(["DRAFT", "SENT", "IN_PROGRESS", "COMPLETED", "VOIDED", "EXPIRED"] as const).map((s) => (
            <div key={s} className="card-glass rounded p-3 text-center">
              <p className={`text-xl font-mono font-light ${counts[s] > 0 && s === "COMPLETED" ? "text-[#9aab7e]" : "text-[#f5f2ea]"}`}>
                {counts[s]}
              </p>
              <p className="text-[#e8e4d8]/40 text-xs mt-0.5 capitalize">
                {s.replace(/_/g, " ").toLowerCase()}
              </p>
            </div>
          ))}
        </div>

        {/* Envelope List or Empty State */}
        {envelopes.length === 0 ? (
          <div className="card-glass rounded p-10 text-center">
            <p className="text-[#f5f2ea] mb-2">No envelopes yet</p>
            <p className="text-[#e8e4d8]/50 text-sm mb-5">
              Send your first document for electronic signature.
            </p>
            <Link
              href="/airsign/new"
              className="bg-[#6b7d52] text-[#f5f2ea] font-medium px-5 py-2.5 rounded text-sm hover:bg-[#6b7d52]/80 transition-colors"
            >
              Create Envelope
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {envelopes.map((env) => {
              const signed = env.signers.filter((s) => s.signedAt).length
              return (
                <div
                  key={env.id}
                  className="card-glass rounded p-4 hover:border-[#9aab7e]/20 transition-colors flex items-center justify-between"
                >
                  <Link href={`/airsign/${env.id}`} className="flex-1 min-w-0">
                    <p className="text-[#f5f2ea] text-sm font-medium">{env.name}</p>
                    <p className="text-[#e8e4d8]/50 text-xs mt-0.5">
                      <span className="font-mono">{env.signers.length}</span> signers
                      {" · "}
                      <span className="font-mono">{env._count.fields}</span> fields
                      {" · "}
                      <span className="font-mono">{signed}/{env.signers.length}</span> signed
                    </p>
                  </Link>
                  <div className="flex items-center gap-2 ml-4 shrink-0">
                    <span className={`text-[10px] px-2 py-0.5 rounded font-medium tracking-wide ${statusBadge(env.status)}`}>
                      {env.status.replace(/_/g, " ")}
                    </span>
                    <Link
                      href={`/airsign/${env.id}`}
                      className="text-[#e8e4d8]/50 text-xs border border-[#6b7d52]/30 rounded px-2 py-1 hover:border-[#9aab7e]/40 hover:text-[#e8e4d8]/70 transition-colors"
                    >
                      View
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </DarkLayout>
  )
}
