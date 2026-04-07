import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"

export default async function HistoryPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const activities = await prisma.agentActivity.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  })

  const grouped = activities.reduce<Record<string, typeof activities>>((acc, a) => {
    const day = a.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    if (!acc[day]) acc[day] = []
    acc[day].push(a)
    return acc
  }, {})

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="mb-8">
        <p className="text-[#6b7d52] text-xs tracking-[0.15em] uppercase">Build History</p>
        <h1 className="font-[family-name:var(--font-cormorant)] italic text-[#1e2416] text-3xl mt-1">
          Agent Timeline
        </h1>
      </div>

      {Object.keys(grouped).length === 0 ? (
        <div className="card-glass !rounded-xl !p-8 text-center">
          <p className="text-[#6b7d52]/40 text-sm">No build history yet</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([day, entries]) => (
            <div key={day}>
              <p className="text-[#6b7d52] text-xs font-medium tracking-wider uppercase mb-3">{day}</p>
              <div className="space-y-1">
                {entries.map((a) => {
                  const severityColor =
                    a.severity === "critical" || a.severity === "error"
                      ? "text-[#c45c5c]"
                      : a.severity === "warn"
                        ? "text-[#d4944c]"
                        : "text-[#6b7d52]"

                  return (
                    <div key={a.id} className="card-glass !rounded-lg !p-3 flex items-center gap-3">
                      <span className="font-mono text-[10px] text-[#1e2416]/30 shrink-0 w-14">
                        {a.createdAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1e2416]/5 text-[#6b7d52]/60 font-mono shrink-0">
                        {a.agent}
                      </span>
                      <span className="text-[10px] text-[#1e2416]/30 shrink-0">{a.action}</span>
                      <p className={`text-xs truncate flex-1 ${severityColor}`}>{a.message}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
