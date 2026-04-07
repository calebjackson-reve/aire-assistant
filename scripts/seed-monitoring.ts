/**
 * Seed the monitoring database with real agent phase completion data.
 * Run with: npx tsx scripts/seed-monitoring.ts
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const AGENT_PHASES: Array<{
  agent: string
  phases: Array<{ phase: number; message: string; completedAt: string }>
}> = [
  {
    agent: "agent-1",
    phases: [
      { phase: 1, message: "Audit current schema — 14 models verified", completedAt: "2026-04-04T02:00:00Z" },
      { phase: 2, message: "Merge Paragon MLS integration", completedAt: "2026-04-04T03:00:00Z" },
      { phase: 3, message: "Merge PropStream integration", completedAt: "2026-04-04T04:00:00Z" },
      { phase: 4, message: "Build unified /api/data endpoints (8 routes)", completedAt: "2026-04-04T05:00:00Z" },
      { phase: 5, message: "Test all data flows — 15/15 engine tests pass", completedAt: "2026-04-04T06:00:00Z" },
      { phase: 6, message: "Document data architecture → docs/data-architecture.md", completedAt: "2026-04-04T07:00:00Z" },
    ],
  },
  {
    agent: "agent-2",
    phases: [
      { phase: 1, message: "Transaction CRUD operations built", completedAt: "2026-04-04T02:30:00Z" },
      { phase: 2, message: "Deadline monitoring system built", completedAt: "2026-04-04T03:30:00Z" },
      { phase: 3, message: "Transaction dashboard pages built", completedAt: "2026-04-04T04:30:00Z" },
      { phase: 4, message: "TC notification utilities built", completedAt: "2026-04-04T05:30:00Z" },
      { phase: 5, message: "Party communication templates (10 types) + send-update API", completedAt: "2026-04-04T06:30:00Z" },
      { phase: 6, message: "Vendor coordination scheduler + schedule-vendor API", completedAt: "2026-04-04T07:30:00Z" },
    ],
  },
  {
    agent: "agent-3",
    phases: [
      { phase: 1, message: "Core extraction engine — classifier + extractor", completedAt: "2026-04-04T02:15:00Z" },
      { phase: 2, message: "Multi-pass extraction strategy", completedAt: "2026-04-04T02:45:00Z" },
      { phase: 3, message: "Document memory — self-improving classification", completedAt: "2026-04-04T03:15:00Z" },
      { phase: 4, message: "Document API routes — classify, extract, memory CRUD", completedAt: "2026-04-04T03:45:00Z" },
      { phase: 5, message: "Auto-filing system", completedAt: "2026-04-04T04:15:00Z" },
      { phase: 6, message: "Upload UI component", completedAt: "2026-04-04T04:45:00Z" },
      { phase: 7, message: "Document dashboard page with search + filters", completedAt: "2026-04-04T05:15:00Z" },
      { phase: 8, message: "Document viewer with field correction + memory learning", completedAt: "2026-04-04T05:45:00Z" },
      { phase: 9, message: "Document checklist generator (LA-specific)", completedAt: "2026-04-04T06:15:00Z" },
      { phase: 10, message: "Batch upload component (multi-file, 5 concurrent)", completedAt: "2026-04-04T06:45:00Z" },
      { phase: 11, message: "Email attachment scanner — Gmail API integration", completedAt: "2026-04-04T07:15:00Z" },
      { phase: 12, message: "Full build verified — 0 type errors", completedAt: "2026-04-04T07:45:00Z" },
      { phase: 13, message: "Enhancement proposals logged → MISSION COMPLETE", completedAt: "2026-04-04T08:00:00Z" },
    ],
  },
  {
    agent: "agent-4",
    phases: [
      { phase: 1, message: "Coordination files created", completedAt: "2026-04-04T09:00:00Z" },
      { phase: 2, message: "PowerShell monitoring dashboard — scripts/monitor-agents.ps1", completedAt: "2026-04-04T09:30:00Z" },
      { phase: 3, message: "Web monitoring dashboard — /aire/monitoring", completedAt: "2026-04-04T10:00:00Z" },
      { phase: 4, message: "4 monitoring API endpoints", completedAt: "2026-04-04T10:15:00Z" },
      { phase: 5, message: "Activity logger — lib/monitoring/activity-logger.ts", completedAt: "2026-04-04T10:30:00Z" },
      { phase: 6, message: "Real-time notifications (10s auto-refresh)", completedAt: "2026-04-04T10:45:00Z" },
      { phase: 7, message: "Metrics panel with delta tracking", completedAt: "2026-04-04T11:00:00Z" },
      { phase: 8, message: "Agent control panel — advance phases, flag errors", completedAt: "2026-04-04T11:15:00Z" },
      { phase: 9, message: "Historical build timeline — /aire/monitoring/history", completedAt: "2026-04-04T11:30:00Z" },
      { phase: 10, message: "Build verified — 0 type errors, 71+ routes", completedAt: "2026-04-04T11:45:00Z" },
      { phase: 11, message: "Documentation — docs/monitoring-system.md", completedAt: "2026-04-04T12:00:00Z" },
      { phase: 12, message: "Quality audit — all imports valid, brand palette correct", completedAt: "2026-04-04T12:15:00Z" },
      { phase: 13, message: "Enhancement proposals logged → MISSION COMPLETE", completedAt: "2026-04-04T12:30:00Z" },
    ],
  },
]

const METRICS = [
  { name: "api_routes", value: 108, agent: null, createdAt: "2026-04-04T12:30:00Z" },
  { name: "type_errors", value: 0, agent: null, createdAt: "2026-04-04T12:30:00Z" },
  { name: "prisma_models", value: 22, agent: null, createdAt: "2026-04-04T12:30:00Z" },
  { name: "build_time_seconds", value: 13.4, agent: null, createdAt: "2026-04-04T12:30:00Z" },
  { name: "phase_progress", value: 6, agent: "agent-1", createdAt: "2026-04-04T07:00:00Z" },
  { name: "phase_progress", value: 6, agent: "agent-2", createdAt: "2026-04-04T07:30:00Z" },
  { name: "phase_progress", value: 13, agent: "agent-3", createdAt: "2026-04-04T08:00:00Z" },
  { name: "phase_progress", value: 13, agent: "agent-4", createdAt: "2026-04-04T12:30:00Z" },
]

async function seed() {
  console.log("Seeding monitoring data...")

  // Clear existing
  await prisma.agentActivity.deleteMany()
  await prisma.buildMetric.deleteMany()
  console.log("Cleared existing data")

  // Seed agent activities
  let activityCount = 0
  for (const agent of AGENT_PHASES) {
    for (const phase of agent.phases) {
      await prisma.agentActivity.create({
        data: {
          agent: agent.agent,
          action: "phase_complete",
          phase: phase.phase,
          message: phase.message,
          severity: "info",
          createdAt: new Date(phase.completedAt),
        },
      })
      activityCount++
    }
  }
  console.log(`Created ${activityCount} activity records`)

  // Seed metrics
  for (const metric of METRICS) {
    await prisma.buildMetric.create({
      data: {
        name: metric.name,
        value: metric.value,
        agent: metric.agent,
        createdAt: new Date(metric.createdAt),
      },
    })
  }
  console.log(`Created ${METRICS.length} metric records`)

  console.log("Done!")
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
