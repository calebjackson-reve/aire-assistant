# A9 — Ops / Monitoring cluster baseline (2026-04-14)

Routes: `/aire/monitoring` + `/monitoring/history` (B+), `/aire/system-status` (B+), `/aire/learning` (B+).

## Current state
All four auth-gated. Brief consistently rates B+ — cluster is the healthiest tier of authenticated surfaces.

## A-grade criteria (from brief)
- 7 agent personas (Iris/Atlas/Juno/Orion/Vera/Kai/Mira placeholder) with initials on sage circles 32px.
- Recovery buttons (retry/pause/disable) inline on failed cron rows.
- Learning page: weekly "AI improvement" card.
- SLA threshold config inline on system-status.
- Agent pulse animation when running (C1 primitive); recovery button shine-sweep (C6).
- 1/2/3 grid at 375/768/1280.

## Violations observed
- `components/ops/AgentPersona.tsx` — does not exist.
- No recovery-action buttons wired (no `retry`/`pause`/`disable` handlers grep-visible on monitoring page).
- No "AI improvement" weekly card on `LearningDashboard.tsx`.
- Agent naming unconfirmed — placeholder list (Iris/Atlas/…) per brief; must be blessed.

## Surprises
- System Status page loads an entire system-health payload from `lib/ops/health.ts` (per project CLAUDE.md) — data is available for SLA chart, just not rendered.
- Cluster is the lightest-lift A-grade path; mainly additive.

## Severity
Low-Medium. Starting state is B+ on all four surfaces. Deliverable is decorative (personas) + one new component + SLA UI. No palette violations observed on these pages.
