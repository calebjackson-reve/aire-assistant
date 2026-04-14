// app/aire/relationships/page.tsx
// Weekly Relationship Intelligence Dashboard — 4-agent scoring + hit list.
// Unified with DarkLayout forest theme.

import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import Link from "next/link"
import { ContactImporter } from "./ContactImporter"

export default async function RelationshipsPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in?redirect_url=/aire/relationships")

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
  })
  if (!user) redirect("/sign-in")

  const latestRun = await prisma.relationshipIntelLog.findFirst({
    where: { agentId: user.id },
    orderBy: { runDate: "desc" },
    select: { runDate: true },
  })

  const hitList = latestRun
    ? await prisma.relationshipIntelLog.findMany({
        where: {
          agentId: user.id,
          runDate: latestRun.runDate,
          recommendation: { not: "Skip" },
        },
        include: { contact: true },
        orderBy: { finalScore: "desc" },
        take: 10,
      })
    : []

  const totalScored = latestRun
    ? await prisma.relationshipIntelLog.count({
        where: { agentId: user.id, runDate: latestRun.runDate },
      })
    : 0

  const totalContacts = await prisma.contact.count({
    where: { agentId: user.id },
  })

  // Score distribution for analytics
  const allScores = latestRun
    ? await prisma.relationshipIntelLog.findMany({
        where: { agentId: user.id, runDate: latestRun.runDate },
        select: { finalScore: true, recommendation: true, channel: true },
      })
    : []

  const channelBreakdown = {
    call: allScores.filter((s) => s.channel === "call").length,
    text: allScores.filter((s) => s.channel === "text").length,
    email: allScores.filter((s) => s.channel === "email").length,
    skip: allScores.filter((s) => s.channel === "skip").length,
  }

  const avgScore = allScores.length > 0
    ? Math.round(allScores.reduce((a, s) => a + s.finalScore, 0) / allScores.length)
    : 0

  const lastRunLabel = latestRun
    ? new Date(latestRun.runDate).toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric",
      })
    : null

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-[family-name:var(--font-cormorant)] italic text-[#1e2416] text-3xl">
            Relationship Intelligence
          </h1>
          <p className="text-[#6b7d52]/60 text-sm mt-1">
            {lastRunLabel
              ? `Last scored ${lastRunLabel} · ${totalScored} of ${totalContacts} contacts`
              : `${totalContacts} contacts · Not yet scored`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/aire/relationships/new"
            className="text-sm text-[#6b7d52]/60 hover:text-[#1e2416] transition-colors"
          >
            + Add Contact
          </Link>
          <RunButton agentId={user.id} />
        </div>
      </div>

      {/* CSV Import */}
      <ContactImporter />

      {/* Stats row */}
      {totalContacts > 0 && latestRun && (
        <div className="grid grid-cols-6 gap-3 mb-8">
          <div className="bg-[#f5f2ea] border border-[#9aab7e]/20 rounded-lg p-4">
            <p className="text-[#6b7d52]/60 text-xs mb-1">Total</p>
            <p className="font-[family-name:var(--font-mono)] text-2xl font-light text-[#1e2416]">{totalContacts}</p>
          </div>
          <div className="bg-[#f5f2ea] border border-[#9aab7e]/20 rounded-lg p-4">
            <p className="text-[#6b7d52]/60 text-xs mb-1">Scored</p>
            <p className="font-[family-name:var(--font-mono)] text-2xl font-light text-[#6b7d52]">{totalScored}</p>
          </div>
          <div className="bg-[#f5f2ea] border border-[#9aab7e]/20 rounded-lg p-4">
            <p className="text-[#6b7d52]/60 text-xs mb-1">Avg Score</p>
            <p className={`font-[family-name:var(--font-mono)] text-2xl font-light ${avgScore >= 60 ? "text-status-active" : avgScore >= 40 ? "text-status-warning" : "text-[#6b7d52]/50"}`}>{avgScore}</p>
          </div>
          <div className="bg-[#f5f2ea] border border-[#9aab7e]/20 rounded-lg p-4">
            <p className="text-[#6b7d52]/60 text-xs mb-1">Call</p>
            <p className="font-[family-name:var(--font-mono)] text-2xl font-light text-status-active">{channelBreakdown.call}</p>
          </div>
          <div className="bg-[#f5f2ea] border border-[#9aab7e]/20 rounded-lg p-4">
            <p className="text-[#6b7d52]/60 text-xs mb-1">Text</p>
            <p className="font-[family-name:var(--font-mono)] text-2xl font-light text-status-warning">{channelBreakdown.text}</p>
          </div>
          <div className="bg-[#f5f2ea] border border-[#9aab7e]/20 rounded-lg p-4">
            <p className="text-[#6b7d52]/60 text-xs mb-1">Email</p>
            <p className="font-[family-name:var(--font-mono)] text-2xl font-light text-[#6b7d52]">{channelBreakdown.email}</p>
          </div>
        </div>
      )}

      {/* Empty states */}
      {totalContacts === 0 && (
        <div className="bg-[#f5f2ea] border border-[#9aab7e]/20 rounded-xl p-12 text-center">
          <p className="text-[#1e2416] font-medium mb-1">No contacts yet</p>
          <p className="text-[#6b7d52]/60 text-sm mb-6">
            Import your contacts from Google, Follow Up Boss, Dotloop, or your phone — or add them one by one.
          </p>
          <Link
            href="/aire/relationships/new"
            className="inline-block bg-[#6b7d52] hover:bg-[#5a6c44] text-[#f5f2ea] text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            Add First Contact
          </Link>
        </div>
      )}

      {totalContacts > 0 && hitList.length === 0 && (
        <div className="bg-[#f5f2ea] border border-[#9aab7e]/20 rounded-xl p-12 text-center">
          <p className="text-[#1e2416] font-medium mb-1">
            {latestRun ? "No contacts ready this week" : "Hit list not generated yet"}
          </p>
          <p className="text-[#6b7d52]/60 text-sm mb-6">
            {latestRun
              ? `AIRE analyzed ${totalScored} contacts — none scored high enough to action this week.`
              : "Run AIRE's Relationship Intelligence to score your contacts."}
          </p>
        </div>
      )}

      {/* Hit List */}
      {hitList.length > 0 && (
        <div>
          <h2 className="text-[#1e2416] font-medium mb-4">Weekly hit list</h2>
          <div className="space-y-3">
            {hitList.map((item, index) => (
              <HitListCard key={item.id} item={item} rank={index + 1} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

type HitListItem = {
  id: string
  finalScore: number
  recommendation: string
  channel: string
  priority: string
  reasoning: string
  suggestedMessage: string
  behavioralScore: number
  lifeEventScore: number
  marketTimingScore: number
  recencyScore: number
  contact: {
    firstName: string
    lastName: string
    email: string | null
    phone: string | null
    type: string
    neighborhood: string | null
    tags: string[]
    lastContactedAt: Date | null
  }
}

function HitListCard({ item, rank }: { item: HitListItem; rank: number }) {
  const contact = item.contact

  const channelIcon: Record<string, string> = {
    call: "Call",
    text: "Text",
    email: "Email",
    skip: "Skip",
  }

  const priorityStyles: Record<string, string> = {
    urgent: "text-status-red bg-status-red/10",
    high: "text-status-amber bg-status-amber/10",
    normal: "text-[#6b7d52] bg-[#9aab7e]/10",
    low: "text-[#6b7d52]/60 bg-[#9aab7e]/8",
  }

  const daysSince = contact.lastContactedAt
    ? Math.floor((Date.now() - new Date(contact.lastContactedAt).getTime()) / 86400000)
    : null

  return (
    <div className="bg-[#f5f2ea] border border-[#9aab7e]/20 rounded-xl p-5">
      <div className="flex items-start gap-4">
        <div className="shrink-0 w-8 h-8 rounded-full bg-[#9aab7e]/15 flex items-center justify-center">
          <span className="text-sm font-medium text-[#6b7d52]/60">{rank}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="font-medium text-[#1e2416]">
                {contact.firstName} {contact.lastName}
              </h3>
              <p className="text-xs text-[#6b7d52]/60 mt-0.5">
                {contact.type}
                {contact.neighborhood ? ` · ${contact.neighborhood}` : ""}
                {daysSince !== null ? ` · ${daysSince}d since contact` : " · Never contacted"}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityStyles[item.priority] || priorityStyles.low}`}>
                {item.priority}
              </span>
              <span className="text-xs text-[#6b7d52] font-medium">{channelIcon[item.channel]}</span>
              <span className="text-sm font-medium text-[#1e2416]">{item.finalScore}</span>
            </div>
          </div>

          <p className="text-sm text-[#6b7d52]/60 mt-2 leading-relaxed">{item.reasoning}</p>

          {item.suggestedMessage && (
            <div className="mt-3 rounded-lg bg-[#f5f2ea] border border-[#9aab7e]/20 p-3">
              <p className="text-[10px] text-[#6b7d52]/60 mb-1 font-medium uppercase tracking-wider">
                Suggested {item.recommendation}
              </p>
              <p className="text-sm text-[#1e2416] italic">
                &quot;{item.suggestedMessage}&quot;
              </p>
            </div>
          )}

          <div className="flex gap-4 mt-3">
            <ScorePill label="Behavior" score={item.behavioralScore} />
            <ScorePill label="Life Event" score={item.lifeEventScore} />
            <ScorePill label="Market" score={item.marketTimingScore} />
            <ScorePill label="Warmth" score={item.recencyScore} />
          </div>

          <div className="flex gap-2 mt-3">
            {contact.phone && (
              <a
                href={`tel:${contact.phone}`}
                className="text-xs bg-[#f5f2ea] hover:bg-[#9aab7e]/8 text-[#6b7d52]/70 hover:text-[#1e2416] px-3 py-1.5 rounded-lg transition-colors border border-[#9aab7e]/20"
              >
                {contact.phone}
              </a>
            )}
            {contact.email && (
              <a
                href={`mailto:${contact.email}`}
                className="text-xs bg-[#f5f2ea] hover:bg-[#9aab7e]/8 text-[#6b7d52]/70 hover:text-[#1e2416] px-3 py-1.5 rounded-lg transition-colors border border-[#9aab7e]/20"
              >
                {contact.email}
              </a>
            )}
            <Link
              href={`/aire/communications?name=${encodeURIComponent(contact.firstName + " " + contact.lastName)}&type=${contact.type}`}
              className="text-xs text-[#6b7d52] hover:text-[#1e2416] px-3 py-1.5 rounded-lg transition-colors border border-[#9aab7e]/20"
            >
              Draft message
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function ScorePill({ label, score }: { label: string; score: number }) {
  const color =
    score >= 70 ? "text-status-green" :
    score >= 40 ? "text-status-amber" :
    "text-[#6b7d52]/60"

  return (
    <div className="text-center">
      <p className={`text-xs font-bold ${color}`}>{score}</p>
      <p className="text-[10px] text-[#6b7d52]/60">{label}</p>
    </div>
  )
}

function RunButton({ agentId }: { agentId: string }) {
  return (
    <form action="/api/cron/relationship-intelligence" method="POST">
      <input type="hidden" name="agentId" value={agentId} />
      <button
        type="submit"
        className="text-sm bg-[#f5f2ea] hover:bg-[#9aab7e]/8 text-[#6b7d52]/70 hover:text-[#1e2416] px-4 py-2 rounded-lg transition-colors border border-[#9aab7e]/20"
      >
        Run Now
      </button>
    </form>
  )
}
