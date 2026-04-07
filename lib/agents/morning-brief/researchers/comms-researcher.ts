import prisma from "@/lib/prisma"
import { getUnanswered } from "@/lib/comms"
import { type UnansweredMessage } from "@/lib/comms/types"

export interface CommsResearchResult {
  unanswered: UnansweredMessage[]
  missedCalls: Array<{
    callerPhone: string
    callerName: string | null
    callTime: Date
    hoursAgo: number
  }>
  stats: {
    totalUnanswered: number
    criticalCount: number
    highCount: number
    missedCallCount: number
    oldestUnansweredHours: number
  }
}

/**
 * Morning Brief researcher: surface unanswered messages and missed calls.
 * Runs as part of the 6:30 AM Morning Brief pipeline.
 */
export async function researchComms(userId: string): Promise<CommsResearchResult> {
  // Get unanswered inbound messages
  const unanswered = await getUnanswered(userId)

  // Get unreturned missed calls from last 48 hours
  const missedCalls = await prisma.missedCallLog.findMany({
    where: {
      userId,
      returned: false,
      callTime: { gte: new Date(Date.now() - 48 * 3600000) },
    },
    orderBy: { callTime: "desc" },
  })

  const critical = unanswered.filter((m) => m.urgency === "critical")
  const high = unanswered.filter((m) => m.urgency === "high")
  const oldest = unanswered.length > 0 ? Math.max(...unanswered.map((m) => m.hoursUnanswered)) : 0

  return {
    unanswered,
    missedCalls: missedCalls.map((c) => ({
      callerPhone: c.callerPhone,
      callerName: c.callerName,
      callTime: c.callTime,
      hoursAgo: Math.round((Date.now() - c.callTime.getTime()) / 3600000),
    })),
    stats: {
      totalUnanswered: unanswered.length,
      criticalCount: critical.length,
      highCount: high.length,
      missedCallCount: missedCalls.length,
      oldestUnansweredHours: Math.round(oldest),
    },
  }
}
