import prisma from "@/lib/prisma"

type Severity = "info" | "warn" | "error" | "critical"

export async function logActivity(
  agent: string,
  action: string,
  message: string,
  opts?: { phase?: number; severity?: Severity; metadata?: Record<string, unknown> }
) {
  return prisma.agentActivity.create({
    data: {
      agent,
      action,
      message,
      phase: opts?.phase,
      severity: opts?.severity ?? "info",
      metadata: opts?.metadata ? JSON.parse(JSON.stringify(opts.metadata)) : undefined,
    },
  })
}

export async function logPhaseComplete(agent: string, phase: number, message: string) {
  return logActivity(agent, "phase_complete", message, { phase, severity: "info" })
}

export async function logError(agent: string, message: string, metadata?: Record<string, unknown>) {
  return logActivity(agent, "error", message, { severity: "error", metadata })
}

export async function logBlocker(agent: string, message: string) {
  return logActivity(agent, "blocker", message, { severity: "critical" })
}

export async function logMetric(name: string, value: number, agent?: string, metadata?: Record<string, unknown>) {
  return prisma.buildMetric.create({
    data: {
      name,
      value,
      agent,
      metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
    },
  })
}

export async function getRecentActivity(limit = 20) {
  return prisma.agentActivity.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  })
}

export async function getAgentActivity(agent: string, limit = 20) {
  return prisma.agentActivity.findMany({
    where: { agent },
    orderBy: { createdAt: "desc" },
    take: limit,
  })
}

export async function getErrors(since?: Date) {
  return prisma.agentActivity.findMany({
    where: {
      severity: { in: ["error", "critical"] },
      ...(since ? { createdAt: { gte: since } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  })
}

export async function getMetrics(name: string, since?: Date) {
  return prisma.buildMetric.findMany({
    where: {
      name,
      ...(since ? { createdAt: { gte: since } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  })
}
