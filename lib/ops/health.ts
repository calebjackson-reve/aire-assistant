/**
 * System health probes for /aire/system-status.
 *
 * Each probe is defensive — never throws, always returns a typed health
 * result with latency + optional error string so the dashboard can render
 * even when half the world is on fire.
 */

import prisma from "@/lib/prisma"
import { CRON_REGISTRY, EXTERNAL_SERVICES, type CronDef } from "./cron-registry"

export type HealthState = "ok" | "warn" | "fail" | "unknown"

export interface ServiceHealth {
  id: string
  name: string
  kind: string
  state: HealthState
  latencyMs: number | null
  detail: string
  envConfigured: boolean
}

export interface CronHealth {
  id: string
  path: string
  humanSchedule: string
  description: string
  lastRunAt: string | null
  lastStatus: "success" | "failed" | "running" | "unknown"
  lastDurationMs: number | null
  lastError: string | null
  successRate7d: number | null
  totalRuns7d: number
  hasLogging: boolean
}

export interface SystemStatus {
  generatedAt: string
  db: ServiceHealth
  services: ServiceHealth[]
  crons: CronHealth[]
  summary: {
    servicesOk: number
    servicesTotal: number
    cronsOk: number
    cronsTotal: number
    cronsUnknown: number
  }
}

async function probeDatabase(): Promise<ServiceHealth> {
  const started = Date.now()
  try {
    await prisma.$queryRaw`SELECT 1`
    const latencyMs = Date.now() - started
    return {
      id: "database",
      name: "Neon PostgreSQL",
      kind: "database",
      state: latencyMs > 2000 ? "warn" : "ok",
      latencyMs,
      detail: latencyMs > 2000 ? "Slow query" : "Healthy",
      envConfigured: Boolean(process.env.DATABASE_URL),
    }
  } catch (err) {
    return {
      id: "database",
      name: "Neon PostgreSQL",
      kind: "database",
      state: "fail",
      latencyMs: Date.now() - started,
      detail: err instanceof Error ? err.message : "Query failed",
      envConfigured: Boolean(process.env.DATABASE_URL),
    }
  }
}

function envServiceHealth(svc: typeof EXTERNAL_SERVICES[number]): ServiceHealth {
  const configured = Boolean(process.env[svc.envVar])
  return {
    id: svc.id,
    name: svc.name,
    kind: svc.kind,
    state: configured ? "ok" : "warn",
    latencyMs: null,
    detail: configured ? "Credentials present" : `Missing ${svc.envVar}`,
    envConfigured: configured,
  }
}

async function cronHealth(def: CronDef): Promise<CronHealth> {
  if (!def.agentName) {
    return {
      id: def.id,
      path: def.path,
      humanSchedule: def.humanSchedule,
      description: def.description,
      lastRunAt: null,
      lastStatus: "unknown",
      lastDurationMs: null,
      lastError: null,
      successRate7d: null,
      totalRuns7d: 0,
      hasLogging: false,
    }
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000)

  try {
    const [last, recent] = await Promise.all([
      prisma.agentRun.findFirst({
        where: { agentName: def.agentName },
        orderBy: { startedAt: "desc" },
        select: {
          startedAt: true,
          status: true,
          durationMs: true,
          error: true,
        },
      }),
      prisma.agentRun.findMany({
        where: { agentName: def.agentName, startedAt: { gte: sevenDaysAgo } },
        select: { status: true },
      }),
    ])

    const total = recent.length
    const successes = recent.filter((r: { status: string }) => r.status === "success").length
    const successRate = total > 0 ? Math.round((successes / total) * 100) : null

    return {
      id: def.id,
      path: def.path,
      humanSchedule: def.humanSchedule,
      description: def.description,
      lastRunAt: last?.startedAt.toISOString() ?? null,
      lastStatus:
        last?.status === "success" || last?.status === "failed" || last?.status === "running"
          ? last.status
          : "unknown",
      lastDurationMs: last?.durationMs ?? null,
      lastError: last?.error ?? null,
      successRate7d: successRate,
      totalRuns7d: total,
      hasLogging: true,
    }
  } catch (err) {
    return {
      id: def.id,
      path: def.path,
      humanSchedule: def.humanSchedule,
      description: def.description,
      lastRunAt: null,
      lastStatus: "unknown",
      lastDurationMs: null,
      lastError: err instanceof Error ? err.message : String(err),
      successRate7d: null,
      totalRuns7d: 0,
      hasLogging: true,
    }
  }
}

export async function getSystemStatus(): Promise<SystemStatus> {
  const db = await probeDatabase()
  const services = EXTERNAL_SERVICES.map(envServiceHealth)
  const crons = await Promise.all(CRON_REGISTRY.map(cronHealth))

  const servicesOk = [db, ...services].filter((s) => s.state === "ok").length
  const servicesTotal = services.length + 1
  const cronsOk = crons.filter(
    (c) => c.lastStatus === "success" || (c.hasLogging && c.successRate7d !== null && c.successRate7d >= 80)
  ).length
  const cronsUnknown = crons.filter((c) => !c.hasLogging || c.lastStatus === "unknown").length

  return {
    generatedAt: new Date().toISOString(),
    db,
    services,
    crons,
    summary: {
      servicesOk,
      servicesTotal,
      cronsOk,
      cronsTotal: crons.length,
      cronsUnknown,
    },
  }
}
