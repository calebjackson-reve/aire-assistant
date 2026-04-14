import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import { DarkLayout } from "@/components/layouts/DarkLayout"
import { normalizeRole } from "@/lib/airsign/v2/auth"
import { BrokerDashboardClient } from "./BrokerDashboardClient"

export const dynamic = "force-dynamic"

export default async function BrokerDashboardPage() {
  const { userId: clerkId } = await auth()
  if (!clerkId) redirect("/sign-in?redirect_url=/airsign/broker")
  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) redirect("/sign-in")

  const membership = await prisma.brokerageMember.findUnique({
    where: { userId: user.id },
    include: { brokerage: true },
  })
  if (!membership) {
    return (
      <DarkLayout>
        <div className="max-w-3xl mx-auto px-6 py-20 text-center">
          <p className="text-[#9aab7e] text-xs tracking-[0.08em] uppercase mb-3">AirSign</p>
          <h1 className="font-[family-name:var(--font-cormorant)] text-[#e8e4d8] text-4xl mb-4">No brokerage</h1>
          <p className="text-[#e8e4d8]/50 mb-6">Join or create a brokerage to access the broker dashboard.</p>
          <a
            href="/airsign/brokerage"
            className="inline-block bg-[#6b7d52] text-[#f5f2ea] px-6 py-2.5 rounded-md text-sm font-medium hover:bg-[#5a6b43] transition-colors"
          >
            Go to brokerage settings
          </a>
        </div>
      </DarkLayout>
    )
  }

  const role = normalizeRole(membership.role)
  if (role !== "BROKER_OWNER" && role !== "COMPLIANCE_OFFICER") {
    return (
      <DarkLayout>
        <div className="max-w-3xl mx-auto px-6 py-20 text-center">
          <h1 className="font-[family-name:var(--font-cormorant)] text-[#e8e4d8] text-4xl mb-4">Not authorized</h1>
          <p className="text-[#e8e4d8]/50">Your role ({role}) cannot access the compliance review queue.</p>
        </div>
      </DarkLayout>
    )
  }

  const now = new Date()
  const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [pendingReviews, completedCount, envelopeStats, topAgents] = await Promise.all([
    prisma.complianceReview.findMany({
      where: { brokerageId: membership.brokerageId, status: "PENDING" },
      include: {
        envelope: { select: { id: true, name: true, userId: true, transactionId: true, createdAt: true, status: true } },
        submittedBy: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: { submittedAt: "asc" },
    }),
    prisma.complianceReview.count({
      where: {
        brokerageId: membership.brokerageId,
        status: { in: ["APPROVED", "REJECTED", "CHANGES_REQUESTED"] },
        reviewedAt: { gte: last30 },
      },
    }),
    prisma.airSignEnvelope.groupBy({
      by: ["status"],
      where: { brokerageId: membership.brokerageId, createdAt: { gte: last30 } },
      _count: true,
    }),
    prisma.airSignEnvelope.groupBy({
      by: ["userId"],
      where: { brokerageId: membership.brokerageId, createdAt: { gte: last30 } },
      _count: true,
      orderBy: { _count: { userId: "desc" } },
      take: 5,
    }),
  ])

  const topAgentUsers = topAgents.length
    ? await prisma.user.findMany({
        where: { id: { in: topAgents.map((a) => a.userId) } },
        select: { id: true, firstName: true, lastName: true, email: true },
      })
    : []

  return (
    <DarkLayout>
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-[#9aab7e] text-xs tracking-[0.08em] uppercase mb-2">AirSign · Broker</p>
            <h1 className="font-[family-name:var(--font-cormorant)] text-[#e8e4d8] text-4xl leading-tight">
              {membership.brokerage.name}
            </h1>
            <p className="text-[#e8e4d8]/50 text-sm mt-2">Compliance review queue · Last 30 days of activity</p>
          </div>
          <div className="text-right">
            <p className="text-[#e8e4d8]/40 text-[10px] tracking-[0.1em] uppercase">Your role</p>
            <p className="text-[#9aab7e] text-sm font-[family-name:var(--font-cormorant)]">{role.replace(/_/g, " ")}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <StatCard label="Pending review" value={pendingReviews.length} tone="warn" />
          <StatCard label="Reviewed (30d)" value={completedCount} />
          <StatCard
            label="Envelopes sent"
            value={envelopeStats.filter((s) => s.status !== "DRAFT").reduce((a, b) => a + b._count, 0)}
          />
          <StatCard
            label="Completed"
            value={envelopeStats.find((s) => s.status === "COMPLETED")?._count ?? 0}
            tone="success"
          />
        </div>

        <BrokerDashboardClient
          initialQueue={pendingReviews.map((r) => ({
            id: r.id,
            envelopeId: r.envelopeId,
            envelopeName: r.envelope.name,
            envelopeStatus: r.envelope.status,
            submittedAt: r.submittedAt.toISOString(),
            submittedBy:
              `${r.submittedBy.firstName ?? ""} ${r.submittedBy.lastName ?? ""}`.trim() || r.submittedBy.email,
          }))}
        />

        <div className="mt-10">
          <p className="text-[#8a9070] text-[11px] tracking-[0.1em] uppercase mb-4">Top agents (30d)</p>
          <div className="bg-[#1e2416]/40 border border-[#4a5638]/50 rounded-lg divide-y divide-[#4a5638]/40">
            {topAgents.map((row) => {
              const u = topAgentUsers.find((x) => x.id === row.userId)
              const name = u ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email : row.userId
              return (
                <div key={row.userId} className="flex items-center justify-between px-5 py-3">
                  <p className="text-[#e8e4d8] text-sm">{name}</p>
                  <p className="text-[#9aab7e] font-[family-name:var(--font-mono)] text-sm">{row._count}</p>
                </div>
              )
            })}
            {topAgents.length === 0 && (
              <div className="px-5 py-8 text-center text-[#8a9070] text-sm">No envelopes in this window.</div>
            )}
          </div>
        </div>
      </div>
    </DarkLayout>
  )
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "warn" | "success" }) {
  const toneClass =
    tone === "warn" ? "text-[#b5956a]" : tone === "success" ? "text-[#9aab7e]" : "text-[#e8e4d8]"
  return (
    <div className="bg-[#1e2416]/40 border border-[#4a5638]/50 backdrop-blur-sm rounded-lg p-5">
      <p className="text-[#8a9070] text-[10px] tracking-[0.1em] uppercase mb-2">{label}</p>
      <p className={`font-[family-name:var(--font-mono)] text-3xl leading-none ${toneClass}`}>{value}</p>
    </div>
  )
}
