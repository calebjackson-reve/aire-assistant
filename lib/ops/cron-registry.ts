/**
 * Cron Registry — mirror of vercel.json schedules so the system-status
 * page can show last-run / success-fail for each cron.
 *
 * `agentName` is the value the route writes to `AgentRun.agentName` when it
 * logs a run. If a route does not currently log AgentRun, we just show
 * "no data yet" in the dashboard — the registry is the source of truth for
 * which crons *should* exist.
 */

export interface CronDef {
  id: string
  path: string
  schedule: string
  humanSchedule: string
  agentName: string | null // null = route doesn't log AgentRun yet
  description: string
}

export const CRON_REGISTRY: CronDef[] = [
  {
    id: "morning-brief",
    path: "/api/cron/morning-brief",
    schedule: "30 11 * * *",
    humanSchedule: "Daily 6:30 AM CT",
    agentName: "morning_brief",
    description: "Daily morning brief generation",
  },
  {
    id: "deadline-alerts",
    path: "/api/cron/deadline-alerts",
    schedule: "0 12 * * *",
    humanSchedule: "Daily 7:00 AM CT",
    agentName: null,
    description: "Send deadline reminders (email + SMS)",
  },
  {
    id: "relationship-intelligence",
    path: "/api/cron/relationship-intelligence",
    schedule: "0 13 * * 1",
    humanSchedule: "Mon 8:00 AM CT",
    agentName: null,
    description: "Weekly relationship intelligence scoring",
  },
  {
    id: "email-scan",
    path: "/api/cron/email-scan",
    schedule: "*/30 * * * *",
    humanSchedule: "Every 30 min",
    agentName: null,
    description: "Gmail attachment scanner",
  },
  {
    id: "data-sync",
    path: "/api/cron/data-sync",
    schedule: "0 7 * * *",
    humanSchedule: "Daily 2:00 AM CT",
    agentName: null,
    description: "Market data sync",
  },
  {
    id: "tc-reminders",
    path: "/api/cron/tc-reminders",
    schedule: "0 14 * * *",
    humanSchedule: "Daily 9:00 AM CT",
    agentName: null,
    description: "TC reminders and follow-ups",
  },
  {
    id: "comms-scan",
    path: "/api/cron/comms-scan",
    schedule: "*/30 * * * *",
    humanSchedule: "Every 30 min",
    agentName: null,
    description: "Communication monitor scan",
  },
  {
    id: "lrec-monitor",
    path: "/api/cron/lrec-monitor",
    schedule: "0 13 * * 1",
    humanSchedule: "Mon 8:00 AM CT",
    agentName: null,
    description: "LREC rule change monitor",
  },
  {
    id: "learning",
    path: "/api/cron/learning",
    schedule: "0 7 * * 0",
    humanSchedule: "Sun 2:00 AM CT",
    agentName: "learning_cron",
    description: "Weekly self-learning analysis",
  },
  {
    id: "deal-rescue",
    path: "/api/cron/deal-rescue",
    schedule: "0 6 * * *",
    humanSchedule: "Daily 1:00 AM CT",
    agentName: "deal_rescue",
    description: "At-risk deal rescue scan",
  },
  {
    id: "lead-scoring",
    path: "/api/cron/lead-scoring",
    schedule: "0 8 * * 1",
    humanSchedule: "Mon 3:00 AM CT",
    agentName: null,
    description: "Weekly lead scoring refresh",
  },
  {
    id: "kpi-tracker",
    path: "/api/cron/kpi-tracker",
    schedule: "0 3 1 * *",
    humanSchedule: "Monthly 10:00 PM CT",
    agentName: null,
    description: "Monthly KPI tracker rollup",
  },
  {
    id: "app-scanner",
    path: "/api/cron/app-scanner",
    schedule: "0 */6 * * *",
    humanSchedule: "Every 6 hours",
    agentName: null,
    description: "Codebase health scanner",
  },
  {
    id: "qa-test",
    path: "/api/cron/qa-test",
    schedule: "0 */6 * * *",
    humanSchedule: "Every 6 hours",
    agentName: null,
    description: "QA smoke test of critical routes",
  },
  {
    id: "deal-monitor",
    path: "/api/cron/deal-monitor",
    schedule: "0 11,15,19,23,3 * * *",
    humanSchedule: "5x daily",
    agentName: "deal_monitor",
    description: "Deal health monitor",
  },
  {
    id: "content-suggestions",
    path: "/api/cron/content-suggestions",
    schedule: "0 13 * * 1",
    humanSchedule: "Mon 8:00 AM CT",
    agentName: "content_suggestions",
    description: "Weekly content suggestions",
  },
]

export const EXTERNAL_SERVICES = [
  {
    id: "database",
    name: "Neon PostgreSQL",
    kind: "database",
    envVar: "DATABASE_URL",
  },
  {
    id: "stripe",
    name: "Stripe",
    kind: "billing",
    envVar: "STRIPE_SECRET_KEY",
  },
  {
    id: "resend",
    name: "Resend (email)",
    kind: "email",
    envVar: "RESEND_API_KEY",
  },
  {
    id: "twilio",
    name: "Twilio (SMS)",
    kind: "sms",
    envVar: "TWILIO_ACCOUNT_SID",
  },
  {
    id: "anthropic",
    name: "Anthropic Claude",
    kind: "llm",
    envVar: "ANTHROPIC_API_KEY",
  },
  {
    id: "openai",
    name: "OpenAI (Whisper)",
    kind: "llm",
    envVar: "OPENAI_API_KEY",
  },
  {
    id: "blob",
    name: "Vercel Blob",
    kind: "storage",
    envVar: "BLOB_READ_WRITE_TOKEN",
  },
  {
    id: "clerk",
    name: "Clerk (auth)",
    kind: "auth",
    envVar: "CLERK_SECRET_KEY",
  },
] as const
