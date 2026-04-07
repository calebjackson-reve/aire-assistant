/**
 * AIRE Agent Infrastructure — Run Tracking & Concurrency
 * Wraps agent execution with timing, status logging, and concurrency control.
 */

import prisma from "@/lib/prisma"

interface AgentRunOptions {
  agentName: string
  userId?: string
  fn: () => Promise<unknown>
}

/**
 * Execute an agent function with automatic run tracking.
 * Logs start time, completion, duration, and errors to AgentRun table.
 */
export async function withAgentRun({ agentName, userId, fn }: AgentRunOptions) {
  const run = await prisma.agentRun.create({
    data: {
      agentName,
      userId: userId || null,
      status: "running",
    },
  })

  const startTime = Date.now()

  try {
    const result = await fn()
    const durationMs = Date.now() - startTime

    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: "success",
        completedAt: new Date(),
        durationMs,
        resultMetadata: JSON.parse(JSON.stringify(typeof result === "object" ? result : { result })),
      },
    })

    return { success: true, runId: run.id, durationMs, result }
  } catch (error) {
    const durationMs = Date.now() - startTime

    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        completedAt: new Date(),
        durationMs,
        error: error instanceof Error ? error.message : String(error),
      },
    })

    return { success: false, runId: run.id, durationMs, error }
  }
}

/**
 * Get the status of all agents — last run time, success rate, etc.
 */
export async function getAgentRegistry() {
  const agents = [
    "morning_brief",
    "email_scan",
    "comms_scan",
    "relationship_intelligence",
    "deal_rescue",
    "lrec_guardian",
    "lead_scoring",
    "kpi_tracker",
    "data_sync",
    "tc_reminders",
    "deadline_alerts",
    "lrec_monitor",
  ]

  const registry = await Promise.all(
    agents.map(async (name) => {
      const lastRun = await prisma.agentRun.findFirst({
        where: { agentName: name },
        orderBy: { startedAt: "desc" },
      })

      const last24h = await prisma.agentRun.findMany({
        where: {
          agentName: name,
          startedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        select: { status: true, durationMs: true },
      })

      const successCount = last24h.filter((r) => r.status === "success").length
      const failCount = last24h.filter((r) => r.status === "failed").length
      const avgDuration = last24h.length > 0
        ? Math.round(last24h.reduce((s, r) => s + (r.durationMs || 0), 0) / last24h.length)
        : null

      return {
        name,
        lastRun: lastRun
          ? {
              status: lastRun.status,
              startedAt: lastRun.startedAt,
              completedAt: lastRun.completedAt,
              durationMs: lastRun.durationMs,
              error: lastRun.error,
            }
          : null,
        last24h: {
          total: last24h.length,
          success: successCount,
          failed: failCount,
          successRate: last24h.length > 0 ? Math.round((successCount / last24h.length) * 100) : null,
          avgDurationMs: avgDuration,
        },
      }
    })
  )

  return registry
}
