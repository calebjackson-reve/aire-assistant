import prisma from "@/lib/prisma"
import { AGENTS, type AgentStatus, type MonitoringSnapshot } from "./types"

export async function getMonitoringSnapshot(): Promise<MonitoringSnapshot> {
  const [activities, errors, metrics] = await Promise.all([
    prisma.agentActivity.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.agentActivity.findMany({
      where: { severity: { in: ["error", "critical"] } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.buildMetric.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ])

  // Build agent statuses from latest phase_complete activities
  const agents: AgentStatus[] = AGENTS.map((def) => {
    const agentActivities = activities.filter((a) => a.agent === def.id)
    const phaseCompletes = agentActivities.filter((a) => a.action === "phase_complete")
    const latestPhase = phaseCompletes.length > 0
      ? Math.max(...phaseCompletes.map((a) => a.phase ?? 0))
      : 0
    const lastAct = agentActivities[0]
    const hasError = agentActivities.some((a) => a.severity === "error" || a.severity === "critical")

    let status: AgentStatus["status"] = "pending"
    if (latestPhase >= def.totalPhases) status = "complete"
    else if (hasError) status = "error"
    else if (latestPhase > 0) status = "building"

    return {
      id: def.id,
      name: def.name,
      phase: latestPhase,
      totalPhases: def.totalPhases,
      status,
      lastActivity: lastAct?.message,
      lastActivityAt: lastAct?.createdAt,
    }
  })

  const totalPhases = agents.reduce((a, b) => a + b.totalPhases, 0)
  const donePhases = agents.reduce((a, b) => a + b.phase, 0)
  const overallProgress = totalPhases > 0 ? Math.round((donePhases / totalPhases) * 100) : 0

  return {
    timestamp: new Date(),
    agents,
    overallProgress,
    errors: errors.map((e) => ({
      id: e.id,
      agent: e.agent,
      action: e.action,
      phase: e.phase ?? undefined,
      message: e.message,
      severity: e.severity as "error" | "critical",
      createdAt: e.createdAt,
    })),
    recentActivity: activities.slice(0, 15).map((a) => ({
      id: a.id,
      agent: a.agent,
      action: a.action,
      phase: a.phase ?? undefined,
      message: a.message,
      severity: a.severity as "info" | "warn" | "error" | "critical",
      createdAt: a.createdAt,
    })),
    metrics: metrics.map((m) => ({
      name: m.name,
      value: m.value,
      agent: m.agent ?? undefined,
      createdAt: m.createdAt,
    })),
  }
}
