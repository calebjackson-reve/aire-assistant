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

  return (
    <DarkLayout>
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-warm text-sm tracking-wide mb-1">Document Signing</p>
            <h1 className="font-[family-name:var(--font-cormorant)] italic text-cream text-3xl">AirSign</h1>
          </div>
          <Link href="/airsign/new" className="bg-warm text-brown font-medium px-4 py-2 rounded text-sm hover:brightness-110 transition">
            + New envelope
          </Link>
        </div>

        {/* Counts */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-8">
          {(["DRAFT", "SENT", "IN_PROGRESS", "COMPLETED", "VOIDED", "EXPIRED"] as const).map((s) => (
            <div key={s} className="border border-brown-border rounded p-3 text-center">
              <p className={`text-xl font-light ${counts[s] > 0 && s === "COMPLETED" ? "text-warm" : "text-cream"}`}>
                {counts[s]}
              </p>
              <p className="text-cream-dim/50 text-xs mt-0.5 capitalize">{s.replace(/_/g, " ").toLowerCase()}</p>
            </div>
          ))}
        </div>

        {envelopes.length === 0 ? (
          <div className="border border-brown-border rounded p-10 text-center">
            <p className="text-cream mb-2">No envelopes yet</p>
            <p className="text-cream-dim text-sm mb-5">Send your first document for electronic signature.</p>
            <Link href="/airsign/new" className="bg-warm text-brown font-medium px-5 py-2 rounded text-sm hover:brightness-110 transition">
              Create envelope
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {envelopes.map((env) => {
              const signed = env.signers.filter((s) => s.signedAt).length
              const badgeStyle =
                env.status === "COMPLETED" ? "bg-green-500/10 text-green-400" :
                env.status === "SENT" || env.status === "IN_PROGRESS" ? "bg-warm/10 text-warm" :
                env.status === "VOIDED" ? "bg-red-500/10 text-red-400" :
                env.status === "EXPIRED" ? "bg-cream-dim/10 text-cream-dim/50" :
                "bg-brown-light text-cream-dim"
              return (
                <div key={env.id} className="border border-brown-border rounded p-4 hover:border-warm/20 transition-colors flex items-center justify-between">
                  <Link href={`/airsign/${env.id}`} className="flex-1 min-w-0">
                    <p className="text-cream text-sm font-medium">{env.name}</p>
                    <p className="text-cream-dim text-xs mt-0.5">
                      {env.signers.length} signers · {env._count.fields} fields · {signed}/{env.signers.length} signed
                    </p>
                  </Link>
                  <div className="flex items-center gap-2 ml-4 shrink-0">
                    <span className={`text-[10px] px-2 py-0.5 rounded ${badgeStyle}`}>
                      {env.status.replace(/_/g, " ")}
                    </span>
                    <Link href={`/airsign/${env.id}`} className="text-cream-dim text-xs border border-brown-border rounded px-2 py-1 hover:border-warm/30 transition">
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
