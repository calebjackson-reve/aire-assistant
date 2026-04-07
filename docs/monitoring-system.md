# AIRE Monitoring System

## Overview
Real-time monitoring for all 4 AIRE agents. Tracks phase progress, errors, metrics, and activity logs.

## Components

### PowerShell Dashboard
`scripts/monitor-agents.ps1` — terminal-based, reads SKILLSPEC.md every 10s.
```powershell
powershell -ExecutionPolicy Bypass -File scripts/monitor-agents.ps1
```

### Web Dashboard
- `/aire/monitoring` — real-time agent status, metrics, activity feed, control panel
- `/aire/monitoring/history` — historical build timeline grouped by day

### API Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/monitoring/snapshot` | GET | Full monitoring snapshot (agents, errors, metrics) |
| `/api/monitoring/activity` | GET | Recent activity (optional `?agent=agent-1&limit=20`) |
| `/api/monitoring/activity` | POST | Log activity `{agent, action, message, phase?, severity?, metadata?}` |
| `/api/monitoring/metrics` | GET | Metrics by name `?name=build_time&since=2026-04-04` |
| `/api/monitoring/metrics` | POST | Log metric `{name, value, agent?, metadata?}` |
| `/api/monitoring/errors` | GET | Recent errors (optional `?since=2026-04-04`) |

### Database Models
- `AgentActivity` — logs every agent action (phase completions, errors, blockers)
- `BuildMetric` — numeric metrics (API routes, type errors, build times)

### Library
Import from `@/lib/monitoring`:
```typescript
import { logPhaseComplete, logError, logBlocker, logMetric, getMonitoringSnapshot } from "@/lib/monitoring"

// Log a phase completion
await logPhaseComplete("agent-4", 5, "Activity logger built")

// Log an error
await logError("agent-1", "MLS API timeout", { endpoint: "/api/data/market" })

// Log a metric
await logMetric("api_routes", 71, "agent-4")
```

## Files Created
```
lib/monitoring/
  types.ts          — TypeScript types + agent definitions
  activity-logger.ts — Log/query activities and metrics
  snapshot.ts        — Build full monitoring snapshot
  index.ts           — Barrel export

components/monitoring/
  MonitoringDashboard.tsx — Main client dashboard (auto-refresh 10s)
  AgentCard.tsx           — Agent status card with progress bar
  ActivityFeed.tsx        — Scrollable activity feed
  MetricsPanel.tsx        — Metric cards with delta tracking
  ControlPanel.tsx        — Manual agent controls

app/aire/monitoring/
  page.tsx               — Monitoring dashboard page
  history/page.tsx       — Historical build timeline

app/api/monitoring/
  snapshot/route.ts      — GET snapshot
  activity/route.ts      — GET/POST activities
  metrics/route.ts       — GET/POST metrics
  errors/route.ts        — GET errors

scripts/
  monitor-agents.ps1     — PowerShell terminal dashboard
```
