import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import { DarkLayout } from "@/components/layouts/DarkLayout"
import { listVisibleTemplates } from "@/lib/airsign/v2/templates"
import { TemplatesClient } from "./TemplatesClient"

export const dynamic = "force-dynamic"

export default async function TemplatesPage() {
  const { userId: clerkId } = await auth()
  if (!clerkId) redirect("/sign-in?redirect_url=/airsign/templates")
  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) redirect("/sign-in")

  const [templates, membership] = await Promise.all([
    listVisibleTemplates(user.id),
    prisma.brokerageMember.findUnique({
      where: { userId: user.id },
      include: { brokerage: { select: { id: true, name: true } } },
    }),
  ])

  const scopeCounts = {
    PERSONAL: templates.filter((t) => t.scope === "PERSONAL").length,
    OFFICE: templates.filter((t) => t.scope === "OFFICE").length,
    BROKERAGE: templates.filter((t) => t.scope === "BROKERAGE").length,
    MARKETPLACE: templates.filter((t) => t.scope === "MARKETPLACE").length,
  }

  return (
    <DarkLayout>
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-[#9aab7e] text-xs tracking-[0.08em] uppercase mb-2">AirSign</p>
            <h1 className="font-[family-name:var(--font-cormorant)] text-[#e8e4d8] text-4xl leading-tight">
              Template Library
            </h1>
            <p className="text-[#e8e4d8]/50 text-sm mt-2 max-w-xl">
              Reusable documents, clauses, task lists, and field layouts — scoped to you, your office, or the entire brokerage.
            </p>
          </div>
          {membership?.brokerage && (
            <div className="text-right">
              <p className="text-[#e8e4d8]/40 text-[10px] tracking-[0.1em] uppercase">Brokerage</p>
              <p className="text-[#9aab7e] text-sm font-[family-name:var(--font-cormorant)]">{membership.brokerage.name}</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {(
            [
              ["PERSONAL", scopeCounts.PERSONAL, "Yours only"],
              ["OFFICE", scopeCounts.OFFICE, "Your office"],
              ["BROKERAGE", scopeCounts.BROKERAGE, "Brokerage-wide"],
              ["MARKETPLACE", scopeCounts.MARKETPLACE, "AIRE curated"],
            ] as const
          ).map(([label, count, sub]) => (
            <div key={label} className="bg-[#1e2416]/40 border border-[#4a5638]/50 backdrop-blur-sm rounded-lg p-5">
              <p className="text-[#8a9070] text-[10px] tracking-[0.1em] uppercase mb-2">{label}</p>
              <p className="text-[#e8e4d8] font-[family-name:var(--font-mono)] text-3xl leading-none">{count}</p>
              <p className="text-[#e8e4d8]/40 text-xs mt-2">{sub}</p>
            </div>
          ))}
        </div>

        <TemplatesClient
          initialTemplates={templates.map((t) => ({
            id: t.id,
            scope: t.scope,
            kind: t.kind,
            name: t.name,
            description: t.description,
            folder: t.folder,
            formCode: t.formCode,
            pageCount: t.pageCount,
            updatedAt: t.updatedAt.toISOString(),
          }))}
          brokerageId={membership?.brokerageId ?? null}
          officeId={membership?.teamId ?? null}
        />
      </div>
    </DarkLayout>
  )
}
