import prisma from "@/lib/prisma"

type Props = {
  userId: string
  limit?: number
}

const TRIGGER_LABEL: Record<string, string> = {
  document_uploaded: "Document filed",
  deadline_passed: "Deadline lapsed",
  deadline_completed: "Deadline cleared",
  manual: "Manual update",
  voice_command: "Voice command",
  system: "System",
}

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return "just now"
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

export async function ActivityStream({ userId, limit = 8 }: Props) {
  const events = await prisma.workflowEvent.findMany({
    where: { transaction: { userId } },
    include: {
      transaction: { select: { id: true, propertyAddress: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  })

  if (events.length === 0) {
    return (
      <div className="py-10 text-center">
        <p
          className="text-[11px] uppercase tracking-[0.24em]"
          style={{ fontFamily: "var(--font-ibm-mono)", color: "rgba(179,194,149,0.40)" }}
        >
          No activity yet
        </p>
        <p
          className="mt-3 text-[13px] italic"
          style={{
            fontFamily: "var(--font-cormorant)",
            color: "rgba(232,228,216,0.35)",
          }}
        >
          Workflow events will appear here as deals progress.
        </p>
      </div>
    )
  }

  return (
    <ol className="relative space-y-0.5">
      {/* Thread line */}
      <span
        aria-hidden
        className="absolute left-[7px] top-3 bottom-3 w-px"
        style={{
          background:
            "linear-gradient(180deg, rgba(179,194,149,0.20), rgba(179,194,149,0.02))",
        }}
      />
      {events.map((e, idx) => {
        const label = TRIGGER_LABEL[e.trigger] ?? e.trigger
        const statusChange = e.fromStatus ? `${e.fromStatus} → ${e.toStatus}` : e.toStatus
        const isFirst = idx === 0
        return (
          <li
            key={e.id}
            className="relative grid grid-cols-[16px_1fr_auto] gap-x-4 items-start py-2.5 pl-0.5"
          >
            <span
              aria-hidden
              className="relative w-4 h-4 flex items-center justify-center mt-[3px]"
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{
                  background: isFirst ? "#9aab7e" : "rgba(179,194,149,0.40)",
                  boxShadow: isFirst ? "0 0 0 4px rgba(154,171,126,0.14)" : undefined,
                }}
              />
            </span>
            <div className="min-w-0">
              <p
                className="text-[13px] leading-snug truncate"
                style={{ color: "#e8e4d8" }}
              >
                {label}
                <span className="opacity-55 mx-1.5">·</span>
                <span className="opacity-70">{e.transaction.propertyAddress}</span>
              </p>
              <p
                className="mt-0.5 text-[10px] uppercase tracking-[0.18em] truncate"
                style={{
                  fontFamily: "var(--font-ibm-mono)",
                  color: "rgba(179,194,149,0.55)",
                }}
              >
                {statusChange}
              </p>
            </div>
            <span
              className="text-[10px] uppercase tracking-[0.18em] whitespace-nowrap mt-1 tabular-nums"
              style={{
                fontFamily: "var(--font-ibm-mono)",
                color: "rgba(179,194,149,0.45)",
              }}
            >
              {timeAgo(new Date(e.createdAt))}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
