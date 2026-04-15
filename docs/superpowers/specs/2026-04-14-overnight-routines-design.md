# Overnight Routines — Autonomous Conductor Design

**Date:** 2026-04-14
**Owner:** Caleb Jackson
**Pattern:** Claude Code Cloud scheduled agents (Nick Saraev "routines")
**Status:** Design — awaiting approval before implementation plan

---

## 1. Problem Statement

AIRE has three parallel workstreams that need autonomous overnight progress:

1. **Paragon Mastery** — Phases 5–12 of `PARAGON_MASTERY_PLAN.md` pending. Goal: operator-grade Paragon knowledge recoverable in <30s per field.
2. **Platform Hardening** — Dogfood smoke, AirSign, TC flows, Voice pipeline all need automated testing + regression tracking.
3. **Branch Consolidation** — 16 unmerged branches + 7 ephemeral worktrees + 3 abandoned remote `claude/*` branches from prior parallel-agent sessions.

Caleb reviews the overnight output each morning. Max throughput, guarded by shared-memory error loops so no mistake repeats.

---

## 2. Goals (Observable)

- **G1** — Every morning at 7am CT, a `docs/routines/YYYY-MM-DD-report.md` exists with: what ran, what landed, what failed, tomorrow's queue.
- **G2** — Max **3 PRs/night** opened against `github.com/calebjackson-reve/aire-assistant`, each scoped to one area (Paragon / Platform-Test / UI-Polish).
- **G3** — Every Paragon surface mapped (P5–P12) produces: `dom_maps/<surface>.dom.json` + field entries in `lib/cma/SOURCE_INTELLIGENCE.md` + test script in `scripts/test-cma-paragon-<surface>.ts`.
- **G4** — "Paragon master in <30s" = any Paragon field name Caleb says → Conductor-indexed field dictionary returns page, selector, data type, example value in one query. Measurable via `scripts/paragon-lookup.ts`.
- **G5** — Error-log entries auto-promote to next-night's top priority. Same error never executes a failed approach twice.

## 3. Non-Goals

- NOT a local background daemon (no machine required).
- NOT a replacement for the existing `schedule` / `loop` skills — it USES them.
- NOT running aggressive Paragon traffic. Safety rules from `aire-paragon-operator` are absolute; one serialized Paragon touch per night max.
- NOT writing production frontend code without human design review (Phase B UI work stays manual unless queue entry explicitly approved).

---

## 4. Architecture — The Conductor

```
                 ┌──────────────────────────────────────────┐
                 │ Claude Code Cloud — cron `0 23 * * *` CT │
                 │          (the Conductor routine)          │
                 └──────────────────────────────────────────┘
                                     │
           ┌─────────────────────────┼─────────────────────────┐
           │                         │                         │
           ▼                         ▼                         ▼
  Read & prioritize           Dispatch ≤3 parallel       Aggregate + ship
  - queue.yaml                 subagents (isolated        - Open PRs
  - error-log.md               worktrees)                 - Rewrite queue
  - MEMORY.md                  - Paragon job              - Append error-log
  - PARAGON_MASTERY_PLAN       - Platform-test job        - Write report
                               - UI-audit / triage job
```

### 4.1 Components

| Component | Location | Purpose |
|---|---|---|
| Conductor prompt | `docs/routines/conductor.md` | The master prompt the scheduled agent reads on wake |
| Job queue | `docs/routines/queue.yaml` | Prioritized task list, auto-mutated nightly |
| Error loop | `C:\Users\cjjfr\.claude\memory\error-log.md` (existing) + `docs/routines/error-loop.md` | Failures promote to top of queue |
| Field dictionary | `lib/cma/SOURCE_INTELLIGENCE.md` (existing) + `lib/cma/paragon-field-index.json` (new) | The <30s lookup index |
| Lookup CLI | `scripts/paragon-lookup.ts` (new) | Operator-grade field query tool |
| Nightly report | `docs/routines/YYYY-MM-DD-report.md` (generated) | Morning briefing |
| Routine skill wrapper | `.claude/skills/aire-routine/SKILL.md` (new, local skill) | Enforces the Conductor contract when invoked |

### 4.2 Conductor loop (one run)

1. **Prune** — `git worktree prune`; remove any worktree in `.claude/worktrees/agent-*` older than 48h.
2. **Sync** — `git fetch origin`; `git checkout main`; `git pull --ff-only`.
3. **Read** — `queue.yaml` → top 3 tasks not blocked by open PRs.
4. **Dispatch** — For each task, create `../aire-assistant-routine-<slug>` worktree, spawn subagent with task brief + relevant skill.
5. **Execute** — Each subagent runs under its domain skill (aire-paragon-operator / dogfood smoke / ui audit). Results return as `{status, files_changed, errors[], learnings[]}`.
6. **Ship** — For each successful task: commit, push branch, open PR via `gh pr create`. For each failed task: append to `error-log.md` with full reproduction context, push error-loop entry to top of `queue.yaml`.
7. **Report** — Write `docs/routines/YYYY-MM-DD-report.md` with sections: Landed · Failed · Tomorrow's Queue · Paragon Field Index Delta · Open Questions for Caleb.
8. **Commit metadata to `main`** — Conductor commits ONLY the nightly report, `queue.yaml` mutation, `error-log.md` appends, and `paragon-field-index.json` updates directly to `main` with `[routine]` commit-message prefix. All feature code goes to feature branches via PR only. Conductor is forbidden from writing to any `app/`, `lib/`, `components/`, `prisma/`, `scripts/` path on `main` directly.

### 4.3 `queue.yaml` schema

```yaml
version: 1
updated: 2026-04-14T23:00:00Z
seed_tasks:
  - id: paragon-p5-listing-detail
    domain: paragon
    skill: aire-paragon-operator
    priority: 10
    status: pending
    depends_on: []
    acceptance:
      - dom_maps/listing_detail.dom.json committed
      - lib/cma/scrapers/mls.ts has scrapeListingDetail()
      - scripts/test-cma-paragon-listing-detail.ts passes single-shot
      - SOURCE_INTELLIGENCE.md field dictionary updated
    max_attempts: 2
    attempts: 0
  - id: branch-triage-sweep
    domain: platform
    skill: null
    priority: 9
    status: pending
    depends_on: []
    acceptance:
      - Every worktree-agent-* older than 48h removed
      - Report in docs/routines/branch-inventory-YYYY-MM-DD.md
      - No destructive changes to named branches
  # ... (full seed list in §6)
failed_tasks: []
learned_rules: []
```

### 4.4 Error loop mechanics

1. Subagent fails → returns `{errors: [{task, step, selector, message, trace}]}`.
2. Conductor appends to `error-log.md` with date + task id + reproduction.
3. Conductor inserts a new `queue.yaml` entry at priority = 11 (above everything):
   ```yaml
   - id: fix-paragon-p5-listing-detail-selector-drift
     priority: 11
     depends_on: []
     root_cause: "selector #listing-detail-header moved; see error-log.md#2026-04-14"
     acceptance:
       - DevTools MCP re-map captured
       - dom_map updated
       - original task retry succeeds
   ```
4. Next night: fix task runs first. If it succeeds, original task retries. If it fails twice total, task gets `status: halted_for_caleb` and appears at top of next morning's report.

### 4.5 Paragon master-in-<30s mechanism

`lib/cma/paragon-field-index.json` is auto-maintained by the Conductor after every Paragon surface job. Shape:

```json
{
  "version": 7,
  "last_updated": "2026-04-14T23:14:02Z",
  "fields": {
    "Beds": {
      "surfaces": ["listing_detail", "comp_grid_step2"],
      "selector": "td[data-field='Beds']",
      "type": "integer",
      "example": 3,
      "dom_map_ref": "dom_maps/listing_detail.dom.json#fields.beds"
    },
    "Mineral Rights": { "..." : "..." }
  }
}
```

`scripts/paragon-lookup.ts` query:

```bash
npm run paragon:lookup -- "mineral rights"
# → surface: listing_detail
#   selector: ".property-meta .mineral-rights span.value"
#   type: string (enum: included/excluded/reserved)
#   example: "All rights reserved by seller"
#   DOM map: dom_maps/listing_detail.dom.json#fields.mineral_rights
```

This is the concrete <30s mastery measurement — any Paragon field is one command away.

---

## 5. Safety Rails

| Rail | Enforcement |
|---|---|
| Max 3 PRs/night | Conductor refuses to dispatch 4th task, queues overflow for next night |
| No Paragon if 2 recent P-domain failures | Conductor checks last 3 nights of error-log; if 2+ Paragon failures, skips Paragon domain that night and notifies Caleb |
| B24140 serialization | Only ONE Paragon task dispatched per night, never parallel |
| No force-push | Conductor uses `gh pr create`, never `git push --force` |
| No main-branch writes except report/queue/error-log | Enforced by Conductor prompt — feature code goes to feature branches only |
| OneDrive lock tolerance | Retry worktree ops up to 3x with 10s backoff; if still locked, skip and note in report |
| Captcha HALT (inherited from Paragon skill) | Any captcha detection → immediate task abort + error-log entry |
| Daily PR cap per domain | Max 1 PR/night/domain. Prevents runaway automation on a broken area |

## 6. Seed Queue (initial priorities)

| Priority | ID | Domain | Why |
|---|---|---|---|
| 10 | `branch-triage-sweep` | platform | Prune 7 worktrees, inventory 16 unmerged branches, draft recommendations for Caleb morning review. Read-only first night. |
| 10 | `paragon-p5-listing-detail` | paragon | Unblocks enriched comp data; highest-value next Paragon phase |
| 9  | `dogfood-smoke-regression-sweep` | platform | Run 8-flow suite, compare to last green, report drift |
| 9  | `airsign-e2e-audit` | platform | Playwright run over envelope create → sign → seal; report broken steps |
| 8  | `voice-pipeline-offline-fastpath-audit` | platform | Re-run the 28 regex patterns, measure hit rate, report misses |
| 8  | `tc-workflow-state-machine-audit` | platform | Exercise advance paths, verify event logging end-to-end |
| 7  | `paragon-p6-customize-columns` | paragon | Depends on P5 complete |
| 7  | `nightly-type-and-build-probe` | platform | `tsc --noEmit` + `next build`; regression signal |
| 6  | `error-log-analyzer` | platform | Cluster similar errors, propose systemic fixes, write `docs/routines/error-analysis-YYYY-MM-DD.md` |
| 6  | `paragon-p7-hot-sheets` | paragon | After P6 |
| 5  | `remote-claude-branch-triage` | platform | Review `origin/claude/*` branches, summarize deltas vs main |
| 4 | (further Paragon P8–P12, Phase B UI tasks, remote `claude/*` triage) | mixed | Seeded but dormant until upstream dependencies clear |

Full seeded queue lives in `queue.yaml` after implementation.

## 7. Integration With Existing Systems

| System | How Conductor integrates |
|---|---|
| `aire-paragon-operator` skill | Paragon tasks set `skill: aire-paragon-operator` → subagent auto-fires safety rules + phase tracker |
| `PARAGON_MASTERY_PLAN.md` | Conductor updates phase status after each successful Paragon task |
| `error-log.md` (global) | Single source of truth; Conductor appends, never overwrites |
| `MEMORY.md` | Conductor reads for context; writes new memories when learnings are cross-session relevant (via `memory/` file pattern) |
| `tests/smoke-dogfood` (Playwright) | Platform-test subagent runs the 8-flow suite verbatim, compares to last green |
| `schedule` skill | Used ONCE at implementation time to register the Conductor cron |
| `aire-frontend-design` | UI tasks must reference DESIGN.md; Conductor queues UI tasks as "draft-only" until Caleb approves |
| CLAUDE.md files | Unchanged. Routine reads them but never rewrites. |
| GitHub | `gh pr create` with auto-generated PR body linking to nightly report |

## 8. Observability

- **v1 surface:** `docs/routines/YYYY-MM-DD-report.md` markdown file only. Read each morning.
- **Dashboard (`app/aire/routines/page.tsx`):** OUT OF SCOPE v1. Queued as a Phase B task after routine system is stable 14+ days.
- **Morning notification (Slack/email):** OUT OF SCOPE v1.
- **Metrics tracked per run (embedded in report):** tasks attempted, landed, failed, PRs opened, new field-index entries, new error-log entries, routine wall-clock duration.

## 9. Rollback Plan

- **Kill switch:** Delete the scheduled agent via `schedule` skill. Takes effect immediately.
- **Pause:** Set `queue.yaml#paused: true` — Conductor wakes, reads pause flag, writes skip report, exits cleanly.
- **Revert a bad PR:** Standard `gh pr close` + branch delete. Conductor detects closed PRs on next run and records as rejection (feeds error-log so same approach doesn't retry).

## 10. Open Questions (for Caleb before plan is written)

1. **Cron time:** 23:00 CT works? Or later (01:00) so dogfood smoke doesn't collide with your late sessions?
2. **PR reviewer:** Auto-request review from `@calebjackson-reve` on every routine PR? Or leave unassigned?
3. **Branch naming convention:** `routine/<date>-<task-id>` (e.g., `routine/2026-04-15-paragon-p5`)?
4. **Should Conductor auto-merge if all CI passes?** Default: **no** — always require human merge. Confirm.
5. **Secrets source:** Claude Code Cloud secrets manager — do you already have one configured, or do we need to set it up as a precursor step?
6. **First-night scope:** Should night 1 run read-only (just branch-triage + dogfood smoke + paragon field index from existing data) to validate the plumbing before letting it touch new Paragon surfaces?

## 11. Testing Strategy

Before the Conductor goes live on cron:

1. **Dry-run mode** — `queue.yaml#dry_run: true` makes Conductor plan-only: writes a would-do report, opens no PRs, touches no Paragon.
2. **Manual trigger** — Run the Conductor once on-demand via `schedule` skill's remote-trigger feature. Verify report quality, PR hygiene, error-loop wiring.
3. **First real cron** — Start with **one** dispatched task (branch-triage-sweep, safest). Grow parallelism across subsequent nights.

---

## 12. Deliverables (for writing-plans to consume)

1. `docs/routines/conductor.md` — master prompt
2. `docs/routines/queue.yaml` — seeded queue
3. `docs/routines/error-loop.md` — explicit error-handling contract
4. `docs/routines/README.md` — operator-facing docs
5. `lib/cma/paragon-field-index.json` — seeded from existing dom_maps
6. `scripts/paragon-lookup.ts` — <30s lookup CLI
7. `scripts/routine-dry-run.ts` — local simulation of Conductor loop
8. `.claude/skills/aire-routine/SKILL.md` — local skill wrapping the Conductor contract
9. `schedule` skill invocation — register cron
10. Updated `CLAUDE.md` (project root) — link to routine docs + morning-review protocol
11. Updated `MEMORY.md` — pointer to routine system

---

**End of spec. Awaiting Caleb review.**
