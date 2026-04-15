# Overnight Routines Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Conductor routine system that dispatches ≤3 parallel subagents nightly at 23:00 CT, ships ≤3 PRs, and auto-reprioritizes tomorrow's work via an error loop.

**Architecture:** Documentation-first (queue.yaml + conductor.md prompt are the "program"). Two small TypeScript utilities (`paragon-lookup`, `routine-dry-run`) provide operator-grade introspection. A local Claude skill enforces the contract when the Conductor runs. Cron lives in Claude Code Cloud.

**Tech Stack:** Markdown + YAML for configs, TypeScript (`tsx` runner) + `node:test` (built-in) for logic + tests, `gh` CLI for PR ops, Claude Code Cloud `schedule` skill for cron.

**Source spec:** [`docs/superpowers/specs/2026-04-14-overnight-routines-design.md`](../specs/2026-04-14-overnight-routines-design.md)

---

## File Structure

### Create

| Path | Purpose |
|---|---|
| `docs/routines/README.md` | Operator-facing docs, morning review protocol |
| `docs/routines/conductor.md` | Master prompt the scheduled agent reads on wake |
| `docs/routines/queue.yaml` | Prioritized task list (auto-mutated nightly) |
| `docs/routines/error-loop.md` | Explicit error-handling contract |
| `lib/cma/paragon-field-index.json` | Auto-maintained field → surface/selector index |
| `lib/cma/field-index/build.ts` | Builds index from `lib/cma/scrapers/dom_maps/*.dom.json` |
| `lib/cma/field-index/build.test.ts` | Test — builds expected shape from fixtures |
| `lib/cma/field-index/lookup.ts` | Fuzzy field lookup |
| `lib/cma/field-index/lookup.test.ts` | Test — returns expected entries for queries |
| `scripts/paragon-lookup.ts` | CLI: `npm run paragon:lookup -- "mineral rights"` |
| `scripts/field-index-build.ts` | CLI: `npm run field-index:build` |
| `scripts/routine-dry-run.ts` | Local simulation of Conductor loop |
| `scripts/routine-dry-run.test.ts` | Test — queue mutation logic |
| `.claude/skills/aire-routine/SKILL.md` | Local skill enforcing Conductor contract |
| `.claude/skills/aire-routine/references/queue-schema.md` | Full queue schema reference |
| `.claude/skills/aire-routine/references/conductor-contract.md` | Step-by-step operator contract |

### Modify

| Path | Change |
|---|---|
| `package.json` | Add `paragon:lookup`, `field-index:build`, `routine:dry-run`, `routine:test` scripts |
| `CLAUDE.md` (project) | Append "## Overnight Routines" section with morning protocol + link to README |
| `C:\Users\cjjfr\.claude\projects\c--Users-cjjfr-OneDrive-AIRE-ALL-FILES-aire-assistant\memory\MEMORY.md` | Add pointer to routine system memory |

### New memory file

| Path | Purpose |
|---|---|
| `C:\Users\cjjfr\.claude\projects\c--Users-cjjfr-OneDrive-AIRE-ALL-FILES-aire-assistant\memory\project_overnight_routines.md` | Persistent memory about the routine system |

---

## Phases

- **Phase 0** — Precursor verification (Caleb actions)
- **Phase 1** — Documentation scaffolding
- **Phase 2** — Field index (TDD) + lookup CLI
- **Phase 3** — Dry-run simulator (TDD)
- **Phase 4** — Local skill wrapper
- **Phase 5** — Wire into CLAUDE.md + MEMORY.md
- **Phase 6** — Register cron on Claude Code Cloud
- **Phase 7** — Night 1 validation (read-only)

---

## Phase 0 — Precursor Verification

**Caleb's actions, not code. Plan executor verifies before Phase 6.**

- [ ] **Step 0.1: Confirm Claude Code Cloud access**

Caleb logs into `https://claude.ai/code` and confirms scheduled-agent / remote-trigger UI is visible. If not on correct plan, upgrade before Phase 6.

- [ ] **Step 0.2: GitHub PAT for Conductor PRs**

Create a fine-grained PAT scoped to `calebjackson-reve/aire-assistant` with permissions: `contents: write`, `pull_requests: write`, `metadata: read`. Store in Claude Code Cloud secrets as `GH_ROUTINE_TOKEN`.

- [ ] **Step 0.3: Copy repo secrets to Cloud**

From `.env.local`, mirror to Cloud secrets: `ANTHROPIC_API_KEY`, `DATABASE_URL` (optional — routine does not write to DB in v1).

Mark Step 0 complete only when all three are confirmed. Phase 1–5 can run in parallel with Step 0 (they don't need Cloud yet).

---

## Phase 1 — Documentation Scaffolding

### Task 1: Create routine docs folder + operator README

**Files:**
- Create: `docs/routines/README.md`

- [ ] **Step 1.1: Create README with morning protocol**

Write this exact content to `docs/routines/README.md`:

```markdown
# AIRE Overnight Routines

**Pattern:** Claude Code Cloud scheduled agent (the "Conductor") fires nightly at 23:00 CT, dispatches ≤3 parallel subagents against `queue.yaml`, ships ≤3 PRs, and writes a morning report.

## Files

| File | Role |
|---|---|
| `conductor.md` | Master prompt read by the scheduled agent |
| `queue.yaml` | Task queue — auto-mutated nightly |
| `error-loop.md` | Failure → next-night-priority contract |
| `YYYY-MM-DD-report.md` | Morning report (one per night) |

## Morning review protocol (10 min/day)

1. Open the newest `YYYY-MM-DD-report.md`
2. Check **Landed** section — merge or close the 1–3 PRs
3. Check **Failed** section — scan root cause, approve or override the auto-queued fix
4. Check **Open Questions** — answer any `halted_for_caleb` items by editing `queue.yaml` directly
5. Check **Paragon Field Index Delta** — confirm new fields look right

## Kill switches

- **Pause for the night:** set `paused: true` at top of `queue.yaml`. Conductor wakes, writes a skip report, exits.
- **Stop entirely:** delete the scheduled agent via Claude Code Cloud dashboard. Takes effect immediately.
- **Reject bad PR:** `gh pr close <num>` — Conductor detects closed PRs on next run and appends to error-log as a rejection pattern.

## Safety rails (enforced by `conductor.md`)

- Max 3 PRs per night
- Max 1 Paragon task per night (B24140 serialization)
- No force-push, ever
- No writes to `app/`, `lib/`, `components/`, `prisma/`, `scripts/` on `main` directly — feature code goes through PRs only
- Captcha detection → immediate abort + error-log entry
- OneDrive lock tolerance: 3 retries with 10s backoff
- Two failures on same task on same night → halt + ask Caleb in morning report

## Running locally (debug)

```bash
npm run routine:dry-run         # Simulate a Conductor run without PRs
npm run paragon:lookup -- "beds" # Operator lookup — <30s Paragon mastery tool
npm run field-index:build       # Rebuild field index from dom_maps
```
```

- [ ] **Step 1.2: Commit**

```bash
cd "c:/Users/cjjfr/OneDrive/AIRE ALL FILES/aire-assistant"
git add docs/routines/README.md
git commit -m "docs(routines): operator README + morning protocol"
```

### Task 2: Create `conductor.md` master prompt

**Files:**
- Create: `docs/routines/conductor.md`

- [ ] **Step 2.1: Write the Conductor master prompt**

Write this exact content to `docs/routines/conductor.md`:

```markdown
# Conductor Master Prompt

You are the AIRE Overnight Conductor. You wake on cron `0 23 * * *` CT in Claude Code Cloud. You have one job: ship measurable progress overnight against the AIRE codebase without breaking anything.

## On wake — run this procedure exactly

### Step 1 — Housekeeping

```bash
cd aire-assistant
git fetch origin
git checkout main
git pull --ff-only
git worktree prune
```

Remove any worktree under `.claude/worktrees/agent-*` whose HEAD commit is older than 48h:

```bash
for wt in $(git worktree list --porcelain | grep "worktree .*agent-" | awk '{print $2}'); do
  last_commit=$(git -C "$wt" log -1 --format=%ct)
  now=$(date +%s)
  if [ $((now - last_commit)) -gt 172800 ]; then
    git worktree remove --force "$wt"
  fi
done
```

### Step 2 — Read state

- `docs/routines/queue.yaml` — the task queue
- `docs/routines/error-loop.md` — the contract
- `C:\Users\cjjfr\.claude\memory\error-log.md` — global learnings
- `PARAGON_MASTERY_PLAN.md` — phase status (for Paragon tasks)

If `queue.yaml` has `paused: true`: write a skip report and exit cleanly. Do not mutate the queue.

### Step 3 — Pick tasks

Rules:
- Pick at most 3 tasks from `queue.yaml#seed_tasks` where `status == pending` and `depends_on` entries are all `completed`.
- Max 1 task per domain (`paragon`, `platform`, `ui`).
- If last 3 nights have ≥2 Paragon failures (check error-log), SKIP paragon domain tonight.
- Tasks are selected in priority order (highest first). Ties broken by `created_at`.

### Step 4 — Dispatch

For each picked task:

1. Create worktree: `../aire-assistant-routine-<task.id>` on branch `routine/<YYYY-MM-DD>-<task.id>`
2. Invoke the `aire-routine` skill (it loads the queue schema + conductor contract)
3. If `task.skill` is set (e.g. `aire-paragon-operator`), ALSO invoke that skill first — its safety rules override generic rules
4. Give the subagent this brief:
   - The task entry from `queue.yaml`
   - A pointer to the relevant section of the error-log
   - Acceptance criteria from `task.acceptance`
   - Budget: 30 minutes wall clock per task (Claude Code Cloud tasks can run long; we self-impose this cap)
5. Subagent returns structured result: `{status, files_changed, errors[], learnings[]}`.

### Step 5 — Ship

For each task with `status: "success"`:
1. Verify diff is scoped: no writes to `main`-only paths outside the feature area.
2. Commit in the worktree with message `feat|fix|docs(<domain>): <one-line summary>\n\n[routine] task <task.id>`
3. Push branch: `git push -u origin routine/<YYYY-MM-DD>-<task.id>`
4. Open PR: `gh pr create --title "[routine] <task.id>" --body-file <generated-body.md> --reviewer calebjackson-reve`
5. PR body template:
   ```
   ## Summary
   <one-paragraph>

   ## Acceptance Met
   - [x] item 1
   - [x] item 2

   ## Files Changed
   <list>

   ## Learnings
   <any appended to error-log>

   ---
   Opened by overnight Conductor · see `docs/routines/<date>-report.md`
   ```

For each task with `status: "failed"`:
1. Do NOT push or open a PR.
2. Append to `C:\Users\cjjfr\.claude\memory\error-log.md` using the format in `error-loop.md`.
3. Insert a new `queue.yaml` entry at priority 11 with `root_cause` populated (per `error-loop.md`).
4. If this is the second failure on same task → set original task `status: halted_for_caleb`.

### Step 6 — Field-index refresh (Paragon)

If any Paragon task succeeded with dom_map changes:
```bash
npm run field-index:build
```
Commit the resulting `lib/cma/paragon-field-index.json` along with the queue/report metadata (direct to `main` is allowed for this file — it is auto-generated metadata).

### Step 7 — Report + queue mutation

Write `docs/routines/<YYYY-MM-DD>-report.md` with sections:

```markdown
# Nightly Report — <YYYY-MM-DD>

## Summary
<wall-clock duration, tasks attempted/landed/failed, PRs opened>

## Landed
<PR links + one-line each>

## Failed
<task id + root cause + auto-queued fix id>

## Tomorrow's Queue (top 5)
<output of next `queue.yaml` top 5 after mutation>

## Paragon Field Index Delta
<new fields added / surfaces mapped>

## Open Questions for Caleb
<any halted_for_caleb tasks>

## Metrics
- Tasks attempted: N
- Tasks landed: N
- PRs opened: N
- Field-index entries added: N
- Error-log entries added: N
- Wall clock: Nm
```

Mutate `queue.yaml`: increment `attempts` on failures, set `status: completed` on successes, insert auto-queued fix tasks, update `updated` timestamp.

### Step 8 — Commit metadata to main

Allowed paths for direct `main` commits (FORBIDDEN everywhere else):
- `docs/routines/*.md` (report)
- `docs/routines/queue.yaml`
- `C:\Users\cjjfr\.claude\memory\error-log.md`
- `lib/cma/paragon-field-index.json`

```bash
git add <only those paths>
git commit -m "[routine] nightly <YYYY-MM-DD>: <N landed / <N> failed"
git push origin main
```

### Step 9 — Exit cleanly

Log final metrics, exit with code 0. Any unhandled exception → write crash report to `docs/routines/<YYYY-MM-DD>-crash.md` and exit 1.

## Non-negotiables

1. **Never** `git push --force`.
2. **Never** write to `app/`, `lib/` (except `lib/cma/paragon-field-index.json`), `components/`, `prisma/`, or `scripts/` on the `main` branch directly. Always feature branch + PR.
3. **Never** skip the PARAGON safety-rule skill when task domain is `paragon`.
4. **Never** run two Paragon tasks in parallel (B24140 lockout risk).
5. **Never** solve a captcha. Detection = abort + error-log.
6. **Always** prune old agent worktrees before dispatching new ones (OneDrive lock protection).
7. **Always** verify `git branch --show-current` in worktrees before commit (learned from 2026-04-13 global error-log entry).
8. **Always** respect `queue.yaml#paused: true`.
```

- [ ] **Step 2.2: Commit**

```bash
git add docs/routines/conductor.md
git commit -m "docs(routines): Conductor master prompt"
```

### Task 3: Create seeded `queue.yaml`

**Files:**
- Create: `docs/routines/queue.yaml`

- [ ] **Step 3.1: Write queue with seeded tasks**

Write this exact content to `docs/routines/queue.yaml`:

```yaml
version: 1
updated: 2026-04-14T00:00:00Z
paused: false
dry_run: false
max_prs_per_night: 3
max_paragon_tasks_per_night: 1

seed_tasks:
  - id: branch-triage-sweep
    domain: platform
    skill: null
    priority: 10
    status: pending
    depends_on: []
    created_at: 2026-04-14
    max_attempts: 2
    attempts: 0
    brief: |
      Inventory all local worktrees and branches. For each:
      - Last commit author + date
      - Ahead/behind main
      - Open PR if any
      Write docs/routines/branch-inventory-<DATE>.md with recommendations per branch:
      - MERGE (if clean + valuable)
      - REBASE (if divergent but valuable)
      - ARCHIVE (if abandoned)
      - DELETE (if superseded)
      DO NOT execute any destructive git operations. Recommendations only.
    acceptance:
      - docs/routines/branch-inventory-<DATE>.md exists
      - Report covers all 16 unmerged branches listed in HANDOFF_PHASE_B.md
      - No `git branch -D` or `git push --force` executed

  - id: paragon-field-index-backfill
    domain: paragon
    skill: aire-paragon-operator
    priority: 10
    status: pending
    depends_on: []
    created_at: 2026-04-14
    max_attempts: 2
    attempts: 0
    brief: |
      READ-ONLY. Walk lib/cma/scrapers/dom_maps/*.dom.json and confirm
      lib/cma/paragon-field-index.json covers every field documented in the maps.
      If gaps: update field-index/build.ts to cover them, re-run, commit updated index.
      No live Paragon traffic. No new surface mapping.
    acceptance:
      - npm run field-index:build exits 0
      - Every field in every dom_map.json appears in paragon-field-index.json
      - npm run paragon:lookup -- "beds" returns a result

  - id: dogfood-smoke-regression
    domain: platform
    skill: null
    priority: 9
    status: pending
    depends_on: []
    created_at: 2026-04-14
    max_attempts: 2
    attempts: 0
    brief: |
      Run tests/smoke-dogfood Playwright suite. Compare results to last green run.
      Write docs/routines/dogfood-regression-<DATE>.md with pass/fail per flow.
      If any flow fails: capture screenshot + console, append to error-log, create
      GitHub issue (not PR — this is diagnosis, not fix).
    acceptance:
      - docs/routines/dogfood-regression-<DATE>.md exists
      - Playwright report artifact attached
      - Any regressions tracked as issues

  - id: paragon-p5-listing-detail
    domain: paragon
    skill: aire-paragon-operator
    priority: 9
    status: pending
    depends_on: [paragon-field-index-backfill]
    created_at: 2026-04-14
    max_attempts: 2
    attempts: 0
    brief: |
      Phase 5 of PARAGON_MASTERY_PLAN.md — Listing Detail page.
      Follow paragon-operator safety rules exactly. Single-shot. One address.
      Capture: Beds, Baths, Year, Lot Size, Style, Subdivision, Schools,
      Mineral Rights, Foundation, Room Dimensions, Features, Photos, History.
    acceptance:
      - dom_maps/listing_detail.dom.json extended (current file is partial)
      - lib/cma/scrapers/mls.ts has scrapeListingDetail(mlsId)
      - scripts/test-cma-paragon-listing-detail.ts passes single-shot
      - snapshots/mls_paragon/listing_detail/<mlsId>.json written
      - SOURCE_INTELLIGENCE.md field dictionary updated

  - id: airsign-e2e-audit
    domain: platform
    skill: null
    priority: 8
    status: pending
    depends_on: []
    created_at: 2026-04-14
    max_attempts: 2
    attempts: 0
    brief: |
      Run Playwright over: create envelope → upload PDF → place fields →
      add signer → send → sign → verify seal.
      Use tests/smoke-dogfood as reference harness.
      Report broken steps in docs/routines/airsign-audit-<DATE>.md.
    acceptance:
      - Report exists with pass/fail per step
      - Broken steps have screenshots + console logs
      - Regressions opened as GitHub issues (not PRs)

  - id: voice-offline-fastpath-audit
    domain: platform
    skill: null
    priority: 8
    status: pending
    depends_on: []
    created_at: 2026-04-14
    max_attempts: 2
    attempts: 0
    brief: |
      Replay fixture utterances against lib/voice-pipeline.ts offline fastpath.
      Measure hit rate across the 28 regex patterns. Report misses with suggested
      new patterns.
    acceptance:
      - docs/routines/voice-fastpath-<DATE>.md with hit rate
      - Miss analysis with suggested patterns

  - id: tc-workflow-audit
    domain: platform
    skill: null
    priority: 7
    status: pending
    depends_on: []
    created_at: 2026-04-14
    max_attempts: 2
    attempts: 0
    brief: |
      Exercise every state transition in lib/workflow/state-machine.ts using
      a seeded test transaction. Verify WorkflowEvent rows written correctly.
    acceptance:
      - docs/routines/tc-workflow-<DATE>.md with state-coverage matrix
      - Any broken transitions filed as issues

  - id: paragon-p6-customize-columns
    domain: paragon
    skill: aire-paragon-operator
    priority: 7
    status: pending
    depends_on: [paragon-p5-listing-detail]
    created_at: 2026-04-14
    max_attempts: 2
    attempts: 0
    brief: |
      Phase 6 of PARAGON_MASTERY_PLAN.md — Customize Columns dialog.
      Goal: add hidden columns (Beds, Baths, Year Built, DOM, Sold Date)
      to comp grid so future harvests are richer.
    acceptance:
      - dom_maps/customize_columns.dom.json committed
      - lib/cma/scrapers/mls.ts has customizeCompColumns(cols[])
      - scripts/test-cma-paragon-customize-columns.ts passes
      - SOURCE_INTELLIGENCE.md updated

  - id: nightly-type-build-probe
    domain: platform
    skill: null
    priority: 7
    status: pending
    depends_on: []
    created_at: 2026-04-14
    max_attempts: 2
    attempts: 0
    brief: |
      Run `npx tsc --noEmit` then `npm run build`. If errors, capture the first
      10 errors and open GitHub issue per error group.
    acceptance:
      - docs/routines/build-probe-<DATE>.md
      - tsc --noEmit exit code recorded
      - next build exit code recorded

  - id: error-log-analyzer
    domain: platform
    skill: null
    priority: 6
    status: pending
    depends_on: []
    created_at: 2026-04-14
    max_attempts: 2
    attempts: 0
    brief: |
      Cluster last 14 days of error-log.md entries by failure signature.
      Propose systemic fixes (e.g. "4 Paragon selector-drift errors → add DOM
      map diff check to Conductor Step 3"). Write docs/routines/error-analysis-<DATE>.md.
    acceptance:
      - Analysis report exists
      - ≥3 proposed systemic fixes OR "no systemic patterns detected"

  - id: remote-claude-branch-triage
    domain: platform
    skill: null
    priority: 5
    status: pending
    depends_on: [branch-triage-sweep]
    created_at: 2026-04-14
    max_attempts: 2
    attempts: 0
    brief: |
      Read-only review of origin/claude/* branches. For each: summarize diff
      vs main, flag MERGE / ARCHIVE / NEEDS-REVIEW.
    acceptance:
      - docs/routines/remote-claude-branches-<DATE>.md exists

failed_tasks: []
learned_rules: []
```

- [ ] **Step 3.2: Commit**

```bash
git add docs/routines/queue.yaml
git commit -m "docs(routines): seed queue.yaml with 11 priority tasks"
```

### Task 4: Create `error-loop.md`

**Files:**
- Create: `docs/routines/error-loop.md`

- [ ] **Step 4.1: Write error-loop contract**

Write this exact content to `docs/routines/error-loop.md`:

```markdown
# Error Loop Contract

## When a subagent task fails

1. Conductor receives result:
   ```json
   {
     "status": "failed",
     "task_id": "paragon-p5-listing-detail",
     "errors": [
       {
         "step": "scrapeListingDetail",
         "selector": "#listing-detail-header",
         "message": "Element not found after 10s",
         "trace": "...",
         "screenshot": "lib/cma/scrapers/debug/2026-04-14T23-15-02.png"
       }
     ],
     "learnings": []
   }
   ```

2. Conductor appends to `C:\Users\cjjfr\.claude\memory\error-log.md`:

   ```markdown
   ## Error — 2026-04-14T23:15:02Z — paragon-p5-listing-detail — selector drift on #listing-detail-header

   **Task:** paragon-p5-listing-detail
   **Attempt:** 1 of 2
   **Step:** scrapeListingDetail
   **Root cause:** Selector `#listing-detail-header` returned no match. DOM likely changed.
   **Evidence:** lib/cma/scrapers/debug/2026-04-14T23-15-02.png
   **Next action:** queued fix task `fix-paragon-p5-listing-detail-selector-drift` at priority 11.
   ```

3. Conductor inserts a new `queue.yaml` entry at priority 11 (above everything):

   ```yaml
   - id: fix-paragon-p5-listing-detail-selector-drift
     domain: paragon
     skill: aire-paragon-operator
     priority: 11
     status: pending
     depends_on: []
     created_at: 2026-04-14
     max_attempts: 1
     attempts: 0
     root_cause: "selector #listing-detail-header not found; DOM drift"
     evidence: "lib/cma/scrapers/debug/2026-04-14T23-15-02.png"
     brief: |
       Re-map the listing detail page header using DevTools MCP (separate
       Chrome instance). Update dom_maps/listing_detail.dom.json. Retry
       the original task paragon-p5-listing-detail after this succeeds.
     acceptance:
       - dom_maps/listing_detail.dom.json selector updated
       - paragon-p5-listing-detail task retry succeeds
   ```

4. If this is the SECOND failure of the same original task:
   - Set original task `status: halted_for_caleb`
   - Do NOT insert a new fix task
   - Add to report's "Open Questions for Caleb" section

## When a PR is closed without merge (rejection signal)

Conductor detects via `gh pr list --state closed --search "[routine]"` on next wake:

1. If PR was closed via `gh pr merge --delete-branch`: treated as accepted.
2. If PR was closed WITHOUT merge (branch not merged): append to `error-log.md`:

   ```markdown
   ## Rejection — 2026-04-15 — <task-id> — PR closed unmerged

   **PR:** <url>
   **Closing comment:** <first 200 chars>
   **Learning:** Do not propose this approach again for task <task-id>.
   ```

   And add to `queue.yaml#learned_rules`:

   ```yaml
   learned_rules:
     - source_task: <task-id>
       rule: "<closing comment summarized>"
       added: <date>
   ```

   Future task dispatches include `learned_rules` in the subagent brief.

## Success learnings

When a task succeeds with a non-trivial insight (subagent populates `learnings[]`):

```markdown
## Learning — 2026-04-14 — <task-id> — <one-line>

**Context:** <paragraph>
**Applied:** <how future sessions should apply this>
```

Appended to `error-log.md` (same file — both errors and learnings accumulate there for single-source truth).
```

- [ ] **Step 4.2: Commit**

```bash
git add docs/routines/error-loop.md
git commit -m "docs(routines): error-loop contract — fail/reject/learn paths"
```

---

## Phase 2 — Field Index (TDD)

### Task 5: Write failing test for `buildFieldIndex()`

**Files:**
- Create: `lib/cma/field-index/build.test.ts`

- [ ] **Step 5.1: Write the failing test**

Write this exact content to `lib/cma/field-index/build.test.ts`:

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFieldIndex } from "./build.ts";

test("buildFieldIndex aggregates fields from all dom_maps", async () => {
  const fixture = {
    "listing_detail": {
      surface: "listing_detail",
      fields: {
        beds: { label: "Beds", selector: "td[data-field='Beds']", type: "integer" },
        mineral_rights: { label: "Mineral Rights", selector: ".mineral-rights .value", type: "string" },
      },
    },
    "comp_grid_step2": {
      surface: "comp_grid_step2",
      fields: {
        beds: { label: "Beds", selector: "td.col-beds", type: "integer" },
      },
    },
  };

  const index = buildFieldIndex(fixture);

  assert.equal(index.version, 1);
  assert.ok(index.fields["Beds"]);
  assert.deepEqual(index.fields["Beds"].surfaces.sort(), ["comp_grid_step2", "listing_detail"]);
  assert.equal(index.fields["Beds"].type, "integer");
  assert.ok(index.fields["Mineral Rights"]);
  assert.deepEqual(index.fields["Mineral Rights"].surfaces, ["listing_detail"]);
});

test("buildFieldIndex handles empty input", () => {
  const index = buildFieldIndex({});
  assert.equal(index.version, 1);
  assert.deepEqual(index.fields, {});
});
```

- [ ] **Step 5.2: Run the test — expect failure**

```bash
cd "c:/Users/cjjfr/OneDrive/AIRE ALL FILES/aire-assistant"
npx tsx --test lib/cma/field-index/build.test.ts
```

Expected output: test fails with module-not-found error on `./build.ts`.

### Task 6: Implement `buildFieldIndex()`

**Files:**
- Create: `lib/cma/field-index/build.ts`

- [ ] **Step 6.1: Implement minimal code to pass the test**

Write this exact content to `lib/cma/field-index/build.ts`:

```typescript
export type DomMapField = {
  label: string;
  selector: string;
  type: string;
};

export type DomMap = {
  surface: string;
  fields: Record<string, DomMapField>;
};

export type FieldIndexEntry = {
  surfaces: string[];
  selector: string;
  type: string;
  dom_map_refs: string[];
};

export type FieldIndex = {
  version: 1;
  last_updated: string;
  fields: Record<string, FieldIndexEntry>;
};

export function buildFieldIndex(domMaps: Record<string, DomMap>): FieldIndex {
  const fields: Record<string, FieldIndexEntry> = {};

  for (const [surfaceKey, map] of Object.entries(domMaps)) {
    for (const [fieldKey, field] of Object.entries(map.fields ?? {})) {
      const label = field.label;
      if (!fields[label]) {
        fields[label] = {
          surfaces: [],
          selector: field.selector,
          type: field.type,
          dom_map_refs: [],
        };
      }
      if (!fields[label].surfaces.includes(map.surface)) {
        fields[label].surfaces.push(map.surface);
      }
      fields[label].dom_map_refs.push(`dom_maps/${surfaceKey}.dom.json#fields.${fieldKey}`);
    }
  }

  return {
    version: 1,
    last_updated: new Date().toISOString(),
    fields,
  };
}
```

- [ ] **Step 6.2: Run the test — expect pass**

```bash
npx tsx --test lib/cma/field-index/build.test.ts
```

Expected: both tests pass.

- [ ] **Step 6.3: Commit**

```bash
git add lib/cma/field-index/build.ts lib/cma/field-index/build.test.ts
git commit -m "feat(field-index): buildFieldIndex aggregates dom_maps"
```

### Task 7: Write failing test for `lookupField()`

**Files:**
- Create: `lib/cma/field-index/lookup.test.ts`

- [ ] **Step 7.1: Write the failing test**

Write this exact content to `lib/cma/field-index/lookup.test.ts`:

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { lookupField } from "./lookup.ts";
import type { FieldIndex } from "./build.ts";

const fixture: FieldIndex = {
  version: 1,
  last_updated: "2026-04-14T00:00:00Z",
  fields: {
    "Beds": {
      surfaces: ["listing_detail", "comp_grid_step2"],
      selector: "td[data-field='Beds']",
      type: "integer",
      dom_map_refs: ["dom_maps/listing_detail.dom.json#fields.beds"],
    },
    "Mineral Rights": {
      surfaces: ["listing_detail"],
      selector: ".mineral-rights .value",
      type: "string",
      dom_map_refs: ["dom_maps/listing_detail.dom.json#fields.mineral_rights"],
    },
    "Year Built": {
      surfaces: ["listing_detail"],
      selector: ".year-built",
      type: "integer",
      dom_map_refs: [],
    },
  },
};

test("lookupField exact match", () => {
  const results = lookupField(fixture, "Beds");
  assert.equal(results.length, 1);
  assert.equal(results[0].name, "Beds");
});

test("lookupField case-insensitive", () => {
  const results = lookupField(fixture, "beds");
  assert.equal(results.length, 1);
  assert.equal(results[0].name, "Beds");
});

test("lookupField partial match", () => {
  const results = lookupField(fixture, "mineral");
  assert.equal(results.length, 1);
  assert.equal(results[0].name, "Mineral Rights");
});

test("lookupField no match returns empty", () => {
  const results = lookupField(fixture, "nonexistent");
  assert.deepEqual(results, []);
});

test("lookupField multi-word partial", () => {
  const results = lookupField(fixture, "year");
  assert.equal(results.length, 1);
  assert.equal(results[0].name, "Year Built");
});
```

- [ ] **Step 7.2: Run test — expect fail**

```bash
npx tsx --test lib/cma/field-index/lookup.test.ts
```

Expected: fails with module not found.

### Task 8: Implement `lookupField()`

**Files:**
- Create: `lib/cma/field-index/lookup.ts`

- [ ] **Step 8.1: Implement**

Write this exact content to `lib/cma/field-index/lookup.ts`:

```typescript
import type { FieldIndex, FieldIndexEntry } from "./build.ts";

export type LookupResult = {
  name: string;
  entry: FieldIndexEntry;
};

export function lookupField(index: FieldIndex, query: string): LookupResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const results: LookupResult[] = [];
  for (const [name, entry] of Object.entries(index.fields)) {
    if (name.toLowerCase().includes(q)) {
      results.push({ name, entry });
    }
  }
  return results.sort((a, b) => a.name.localeCompare(b.name));
}
```

- [ ] **Step 8.2: Run test — expect pass**

```bash
npx tsx --test lib/cma/field-index/lookup.test.ts
```

Expected: all 5 tests pass.

- [ ] **Step 8.3: Commit**

```bash
git add lib/cma/field-index/lookup.ts lib/cma/field-index/lookup.test.ts
git commit -m "feat(field-index): lookupField fuzzy case-insensitive search"
```

### Task 9: Build CLI — `field-index:build` script

**Files:**
- Create: `scripts/field-index-build.ts`
- Modify: `package.json`

- [ ] **Step 9.1: Write the builder script**

Write this exact content to `scripts/field-index-build.ts`:

```typescript
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildFieldIndex, type DomMap } from "../lib/cma/field-index/build.ts";

const DOM_MAPS_DIR = path.resolve("lib/cma/scrapers/dom_maps");
const OUTPUT_PATH = path.resolve("lib/cma/paragon-field-index.json");

function loadDomMaps(): Record<string, DomMap> {
  const result: Record<string, DomMap> = {};
  const files = readdirSync(DOM_MAPS_DIR).filter((f) => f.endsWith(".dom.json"));
  for (const file of files) {
    const surfaceKey = file.replace(/\.dom\.json$/, "");
    const raw = readFileSync(path.join(DOM_MAPS_DIR, file), "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed.surface && typeof parsed.surface === "string") {
      result[surfaceKey] = {
        surface: parsed.surface,
        fields: parsed.fields ?? {},
      };
    }
  }
  return result;
}

const maps = loadDomMaps();
const index = buildFieldIndex(maps);
writeFileSync(OUTPUT_PATH, JSON.stringify(index, null, 2));
console.log(`Wrote ${OUTPUT_PATH} — ${Object.keys(index.fields).length} unique fields from ${Object.keys(maps).length} surfaces`);
```

- [ ] **Step 9.2: Add npm script**

Modify `package.json` — add these inside the `"scripts"` object (keep existing ones):

```json
"field-index:build": "tsx scripts/field-index-build.ts",
"paragon:lookup": "tsx scripts/paragon-lookup.ts",
"routine:dry-run": "tsx scripts/routine-dry-run.ts",
"routine:test": "tsx --test lib/cma/field-index/*.test.ts scripts/*.test.ts"
```

Final `scripts` block should look like:

```json
"scripts": {
  "dev": "next dev",
  "build": "prisma generate && next build",
  "start": "next start",
  "lint": "eslint",
  "seed": "tsx prisma/seed.ts",
  "field-index:build": "tsx scripts/field-index-build.ts",
  "paragon:lookup": "tsx scripts/paragon-lookup.ts",
  "routine:dry-run": "tsx scripts/routine-dry-run.ts",
  "routine:test": "tsx --test lib/cma/field-index/*.test.ts scripts/*.test.ts"
}
```

- [ ] **Step 9.3: Run builder against real dom_maps**

```bash
npm run field-index:build
```

Expected: writes `lib/cma/paragon-field-index.json` with fields from `listing_detail.dom.json` and `paragon_home.dom.json`.

Note: current dom_maps may not contain `fields` objects yet — if output has 0 fields, that is expected. The `paragon-field-index-backfill` queue task will populate them.

- [ ] **Step 9.4: Commit**

```bash
git add scripts/field-index-build.ts lib/cma/paragon-field-index.json package.json
git commit -m "feat(field-index): builder script + npm scripts"
```

### Task 10: Build CLI — `paragon:lookup`

**Files:**
- Create: `scripts/paragon-lookup.ts`

- [ ] **Step 10.1: Write CLI**

Write this exact content to `scripts/paragon-lookup.ts`:

```typescript
import { readFileSync } from "node:fs";
import path from "node:path";
import { lookupField } from "../lib/cma/field-index/lookup.ts";
import type { FieldIndex } from "../lib/cma/field-index/build.ts";

const INDEX_PATH = path.resolve("lib/cma/paragon-field-index.json");
const query = process.argv.slice(2).join(" ").trim();

if (!query) {
  console.error("Usage: npm run paragon:lookup -- \"<field name>\"");
  process.exit(2);
}

let index: FieldIndex;
try {
  index = JSON.parse(readFileSync(INDEX_PATH, "utf-8"));
} catch (e) {
  console.error(`Missing ${INDEX_PATH}. Run: npm run field-index:build`);
  process.exit(3);
}

const results = lookupField(index, query);

if (results.length === 0) {
  console.log(`No match for "${query}".`);
  console.log(`Index has ${Object.keys(index.fields).length} fields. Last updated ${index.last_updated}.`);
  process.exit(1);
}

for (const r of results) {
  console.log(`\n${r.name}`);
  console.log(`  surfaces:  ${r.entry.surfaces.join(", ")}`);
  console.log(`  selector:  ${r.entry.selector}`);
  console.log(`  type:      ${r.entry.type}`);
  for (const ref of r.entry.dom_map_refs) {
    console.log(`  dom_map:   ${ref}`);
  }
}
console.log("");
```

- [ ] **Step 10.2: Smoke test**

```bash
npm run paragon:lookup -- "beds"
```

Expected: if index has field data → prints entry. If index is empty (pre-backfill) → prints "No match".

- [ ] **Step 10.3: Commit**

```bash
git add scripts/paragon-lookup.ts
git commit -m "feat(field-index): paragon:lookup CLI for <30s field lookup"
```

---

## Phase 3 — Dry-Run Simulator (TDD)

### Task 11: Write failing test for queue-mutation logic

**Files:**
- Create: `scripts/routine-dry-run.test.ts`

- [ ] **Step 11.1: Write test**

Write this exact content to `scripts/routine-dry-run.test.ts`:

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { pickTasks, promoteError, markCompleted, type Queue } from "./routine-dry-run-lib.ts";

const baseQueue: Queue = {
  version: 1,
  updated: "2026-04-14T00:00:00Z",
  paused: false,
  dry_run: false,
  max_prs_per_night: 3,
  max_paragon_tasks_per_night: 1,
  seed_tasks: [
    { id: "a", domain: "platform", priority: 10, status: "pending", depends_on: [], attempts: 0, max_attempts: 2 },
    { id: "b", domain: "paragon", priority: 10, status: "pending", depends_on: [], attempts: 0, max_attempts: 2 },
    { id: "c", domain: "paragon", priority: 8, status: "pending", depends_on: [], attempts: 0, max_attempts: 2 },
    { id: "d", domain: "platform", priority: 9, status: "pending", depends_on: ["a"], attempts: 0, max_attempts: 2 },
    { id: "e", domain: "ui", priority: 7, status: "pending", depends_on: [], attempts: 0, max_attempts: 2 },
  ],
  failed_tasks: [],
  learned_rules: [],
};

test("pickTasks respects priority and domain caps", () => {
  const picked = pickTasks(baseQueue);
  const ids = picked.map((t) => t.id).sort();
  assert.deepEqual(ids, ["a", "b", "e"]);
});

test("pickTasks enforces max_paragon_tasks_per_night = 1", () => {
  const picked = pickTasks(baseQueue);
  const paragonCount = picked.filter((t) => t.domain === "paragon").length;
  assert.equal(paragonCount, 1);
});

test("pickTasks respects depends_on — d blocked by a pending", () => {
  const picked = pickTasks(baseQueue);
  assert.ok(!picked.some((t) => t.id === "d"));
});

test("pickTasks caps at max_prs_per_night=3", () => {
  const picked = pickTasks(baseQueue);
  assert.ok(picked.length <= 3);
});

test("pickTasks honors paused flag", () => {
  const paused = { ...baseQueue, paused: true };
  assert.deepEqual(pickTasks(paused), []);
});

test("promoteError inserts fix task at priority 11", () => {
  const q = structuredClone(baseQueue);
  const fixId = promoteError(q, "a", {
    step: "runTest",
    message: "TypeError",
    screenshot: null,
  });
  const fix = q.seed_tasks.find((t) => t.id === fixId);
  assert.ok(fix);
  assert.equal(fix.priority, 11);
  assert.equal(fix.status, "pending");
  assert.equal(fix.domain, "platform");
  const orig = q.seed_tasks.find((t) => t.id === "a");
  assert.equal(orig.attempts, 1);
});

test("promoteError on second failure halts original task", () => {
  const q = structuredClone(baseQueue);
  q.seed_tasks[0].attempts = 1;
  promoteError(q, "a", { step: "runTest", message: "TypeError", screenshot: null });
  const orig = q.seed_tasks.find((t) => t.id === "a");
  assert.equal(orig.status, "halted_for_caleb");
});

test("markCompleted updates status", () => {
  const q = structuredClone(baseQueue);
  markCompleted(q, "a");
  const t = q.seed_tasks.find((x) => x.id === "a");
  assert.equal(t.status, "completed");
});
```

- [ ] **Step 11.2: Run — expect fail**

```bash
npx tsx --test scripts/routine-dry-run.test.ts
```

Expected: module not found.

### Task 12: Implement mutation library

**Files:**
- Create: `scripts/routine-dry-run-lib.ts`

- [ ] **Step 12.1: Implement**

Write this exact content to `scripts/routine-dry-run-lib.ts`:

```typescript
export type TaskDomain = "platform" | "paragon" | "ui";
export type TaskStatus = "pending" | "completed" | "halted_for_caleb" | "failed";

export type Task = {
  id: string;
  domain: TaskDomain;
  priority: number;
  status: TaskStatus;
  depends_on: string[];
  attempts: number;
  max_attempts: number;
  skill?: string | null;
  brief?: string;
  acceptance?: string[];
  created_at?: string;
  root_cause?: string;
  evidence?: string;
};

export type Queue = {
  version: number;
  updated: string;
  paused: boolean;
  dry_run: boolean;
  max_prs_per_night: number;
  max_paragon_tasks_per_night: number;
  seed_tasks: Task[];
  failed_tasks: unknown[];
  learned_rules: unknown[];
};

export type ErrorDetail = {
  step: string;
  message: string;
  screenshot: string | null;
};

export function pickTasks(queue: Queue): Task[] {
  if (queue.paused) return [];

  const completedIds = new Set(queue.seed_tasks.filter((t) => t.status === "completed").map((t) => t.id));

  const eligible = queue.seed_tasks
    .filter((t) => t.status === "pending")
    .filter((t) => t.depends_on.every((dep) => completedIds.has(dep)))
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));

  const picked: Task[] = [];
  let paragonCount = 0;
  const domainsPicked = new Set<TaskDomain>();

  for (const t of eligible) {
    if (picked.length >= queue.max_prs_per_night) break;
    if (t.domain === "paragon" && paragonCount >= queue.max_paragon_tasks_per_night) continue;
    if (domainsPicked.has(t.domain)) continue;
    picked.push(t);
    domainsPicked.add(t.domain);
    if (t.domain === "paragon") paragonCount++;
  }

  return picked;
}

export function promoteError(queue: Queue, taskId: string, error: ErrorDetail): string {
  const task = queue.seed_tasks.find((t) => t.id === taskId);
  if (!task) throw new Error(`Task ${taskId} not found`);

  task.attempts += 1;

  if (task.attempts >= task.max_attempts) {
    task.status = "halted_for_caleb";
    return "";
  }

  const fixId = `fix-${taskId}-${Date.now()}`;
  queue.seed_tasks.unshift({
    id: fixId,
    domain: task.domain,
    priority: 11,
    status: "pending",
    depends_on: [],
    attempts: 0,
    max_attempts: 1,
    root_cause: error.message,
    evidence: error.screenshot ?? undefined,
    brief: `Re-investigate step "${error.step}" of task ${taskId}. Root cause: ${error.message}.`,
    acceptance: [`Original task ${taskId} retry succeeds`],
  });
  return fixId;
}

export function markCompleted(queue: Queue, taskId: string): void {
  const task = queue.seed_tasks.find((t) => t.id === taskId);
  if (!task) throw new Error(`Task ${taskId} not found`);
  task.status = "completed";
}
```

- [ ] **Step 12.2: Run test — expect pass**

```bash
npx tsx --test scripts/routine-dry-run.test.ts
```

Expected: all 8 tests pass.

- [ ] **Step 12.3: Commit**

```bash
git add scripts/routine-dry-run-lib.ts scripts/routine-dry-run.test.ts
git commit -m "feat(routines): queue mutation lib — pick/promote/complete"
```

### Task 13: Build dry-run CLI

**Files:**
- Create: `scripts/routine-dry-run.ts`

- [ ] **Step 13.1: Implement CLI**

Write this exact content to `scripts/routine-dry-run.ts`:

```typescript
import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { pickTasks, type Queue } from "./routine-dry-run-lib.ts";

const QUEUE_PATH = path.resolve("docs/routines/queue.yaml");

const raw = readFileSync(QUEUE_PATH, "utf-8");
const queue = parse(raw) as Queue;

console.log(`\n=== Conductor Dry Run — ${new Date().toISOString()} ===\n`);
console.log(`Queue: ${QUEUE_PATH}`);
console.log(`paused=${queue.paused}  dry_run=${queue.dry_run}  max_prs=${queue.max_prs_per_night}  max_paragon=${queue.max_paragon_tasks_per_night}`);
console.log(`Pending tasks: ${queue.seed_tasks.filter((t) => t.status === "pending").length}`);
console.log(`Completed tasks: ${queue.seed_tasks.filter((t) => t.status === "completed").length}`);
console.log(`Halted (waiting on Caleb): ${queue.seed_tasks.filter((t) => t.status === "halted_for_caleb").length}`);

const picked = pickTasks(queue);
console.log(`\n--- Would dispatch ${picked.length} task(s) tonight ---\n`);
for (const t of picked) {
  console.log(`  [${t.priority}] ${t.id}  domain=${t.domain}  skill=${t.skill ?? "-"}`);
}

console.log(`\n--- Would NOT dispatch ---\n`);
for (const t of queue.seed_tasks.filter((x) => x.status === "pending" && !picked.includes(x))) {
  const reason: string[] = [];
  if (t.depends_on.length > 0) {
    const unmet = t.depends_on.filter(
      (d) => !queue.seed_tasks.find((x) => x.id === d && x.status === "completed"),
    );
    if (unmet.length) reason.push(`blocked_by=${unmet.join(",")}`);
  }
  if (picked.some((p) => p.domain === t.domain)) reason.push(`domain_taken(${t.domain})`);
  if (!reason.length) reason.push("capacity");
  console.log(`  [${t.priority}] ${t.id}  (${reason.join(", ")})`);
}
console.log("");
```

- [ ] **Step 13.2: Install yaml parser (transitive or direct)**

```bash
npm install yaml --save
```

- [ ] **Step 13.3: Run dry-run**

```bash
npm run routine:dry-run
```

Expected output: shows which 3 tasks (or fewer) would dispatch tonight, and why the rest are held.

- [ ] **Step 13.4: Commit**

```bash
git add scripts/routine-dry-run.ts package.json package-lock.json
git commit -m "feat(routines): routine:dry-run CLI — local Conductor simulation"
```

---

## Phase 4 — Local Skill Wrapper

### Task 14: Create `aire-routine` skill

**Files:**
- Create: `.claude/skills/aire-routine/SKILL.md`
- Create: `.claude/skills/aire-routine/references/queue-schema.md`
- Create: `.claude/skills/aire-routine/references/conductor-contract.md`

- [ ] **Step 14.1: Write SKILL.md**

Write this exact content to `.claude/skills/aire-routine/SKILL.md`:

```markdown
---
name: aire-routine
description: AIRE Overnight Conductor enforcer. Loads the Conductor contract, queue schema, and safety rails for any scheduled routine run. TRIGGER on — overnight routine, Conductor, queue.yaml, nightly report, routine task, routine dry-run, routine error loop, error-loop.md, [routine] branch, paragon-field-index, field-index:build.
triggers:
  - overnight routine
  - Conductor
  - queue.yaml
  - nightly report
  - routine task
  - routine dry-run
  - error-loop.md
  - "[routine]"
  - paragon-field-index
  - field-index:build
---

# AIRE Routine Operator

When this skill fires, you are operating under the Conductor contract. Every action follows the scheduled-agent safety rails.

## First things you do when invoked

1. Read `docs/routines/conductor.md` — the master prompt.
2. Read `docs/routines/error-loop.md` — fail/reject/learn contract.
3. Read `docs/routines/queue.yaml` — current task queue.
4. If the task domain is `paragon`, ALSO load the `aire-paragon-operator` skill.

## Non-negotiables

1. Max 3 PRs per night.
2. Max 1 Paragon task per night (B24140 lockout risk).
3. No force-push, ever.
4. Feature code goes to feature branches + PRs. Direct writes to `main` allowed ONLY for: `docs/routines/*.md`, `docs/routines/queue.yaml`, `C:\Users\cjjfr\.claude\memory\error-log.md`, `lib/cma/paragon-field-index.json`.
5. Captcha = abort + error-log append.
6. Two failures on same task on same night = halt, ask Caleb in morning report.
7. OneDrive file locks: retry 3x with 10s backoff before giving up.
8. Always `git branch --show-current` before committing in a worktree.

## Structured result shape

Every dispatched task MUST return to the Conductor:

```json
{
  "status": "success" | "failed" | "halted",
  "task_id": "<id>",
  "files_changed": ["path1", "path2"],
  "errors": [{"step": "...", "message": "...", "screenshot": "..." | null}],
  "learnings": [{"context": "...", "applied": "..."}]
}
```

## References

- `references/queue-schema.md` — full YAML schema with example entries
- `references/conductor-contract.md` — step-by-step operator contract

## Local simulation

Before any real routine run, Caleb (or the Conductor in debug mode) runs:

```bash
npm run routine:dry-run
```

This shows which tasks would dispatch without actually running them.
```

- [ ] **Step 14.2: Write queue-schema reference**

Write this exact content to `.claude/skills/aire-routine/references/queue-schema.md`:

```markdown
# queue.yaml Schema Reference

## Top-level fields

| Field | Type | Purpose |
|---|---|---|
| `version` | number | Schema version. Bump on breaking changes. |
| `updated` | ISO datetime | Last mutation timestamp. |
| `paused` | bool | `true` → Conductor writes skip report and exits. |
| `dry_run` | bool | `true` → Conductor runs all logic but opens no PRs, pushes nothing. |
| `max_prs_per_night` | number | Hard cap. Usually 3. |
| `max_paragon_tasks_per_night` | number | Hard cap. Usually 1. |
| `seed_tasks` | Task[] | The task queue. |
| `failed_tasks` | object[] | Historical archive of tasks that exceeded max_attempts. |
| `learned_rules` | object[] | Rules derived from PR rejections. |

## Task shape

| Field | Type | Purpose |
|---|---|---|
| `id` | kebab-case string | Stable unique identifier. |
| `domain` | `platform` \| `paragon` \| `ui` | Determines parallelism caps. |
| `skill` | string \| null | Skill that must be loaded for this task (e.g. `aire-paragon-operator`). |
| `priority` | number | Higher = picked first. Fix tasks use 11. Normal 5–10. |
| `status` | `pending` \| `completed` \| `halted_for_caleb` \| `failed` | Task lifecycle. |
| `depends_on` | string[] | Task IDs that must be `completed` before this task is eligible. |
| `created_at` | ISO date | When queued. |
| `max_attempts` | number | Usually 2. |
| `attempts` | number | Increments on each failure. |
| `brief` | string (multiline) | Full task description for the subagent. |
| `acceptance` | string[] | Checklist the subagent verifies before returning `status: success`. |
| `root_cause` | string? | Populated by Conductor when inserting fix tasks. |
| `evidence` | string? | Screenshot/log path for fix tasks. |

## Example — normal task

```yaml
- id: paragon-p5-listing-detail
  domain: paragon
  skill: aire-paragon-operator
  priority: 9
  status: pending
  depends_on: [paragon-field-index-backfill]
  created_at: 2026-04-14
  max_attempts: 2
  attempts: 0
  brief: |
    Phase 5 of PARAGON_MASTERY_PLAN.md — Listing Detail page capture.
  acceptance:
    - dom_maps/listing_detail.dom.json committed with full field set
    - lib/cma/scrapers/mls.ts has scrapeListingDetail(mlsId)
    - scripts/test-cma-paragon-listing-detail.ts passes single-shot
    - SOURCE_INTELLIGENCE.md updated
```

## Example — auto-inserted fix task

```yaml
- id: fix-paragon-p5-listing-detail-selector-drift
  domain: paragon
  skill: aire-paragon-operator
  priority: 11
  status: pending
  depends_on: []
  created_at: 2026-04-15
  max_attempts: 1
  attempts: 0
  root_cause: "selector #listing-detail-header not found; DOM drift"
  evidence: "lib/cma/scrapers/debug/2026-04-14T23-15-02.png"
  brief: |
    Re-map the listing detail header via DevTools MCP in a separate Chrome.
    Update dom_maps/listing_detail.dom.json. Verify with single-shot scrape.
  acceptance:
    - dom_maps/listing_detail.dom.json header selector updated
    - Original task paragon-p5-listing-detail retry succeeds
```
```

- [ ] **Step 14.3: Write conductor-contract reference**

Write this exact content to `.claude/skills/aire-routine/references/conductor-contract.md`:

```markdown
# Conductor Operator Contract

This is the step-by-step contract the scheduled agent follows. Full prose version is in `docs/routines/conductor.md`. This reference is the TL;DR.

## On wake — 9 steps

1. **Housekeeping** — fetch, checkout main, pull, prune worktrees (remove agent-* older than 48h).
2. **Read state** — queue.yaml, error-log.md, PARAGON_MASTERY_PLAN.md. If `paused: true`, skip-report and exit.
3. **Pick tasks** — priority-sorted, ≤3 total, ≤1 paragon, no duplicate domains, deps must be `completed`.
4. **Dispatch** — one worktree per task, `aire-routine` skill loaded + domain skill if any, 30-min wall-clock budget per task.
5. **Ship** — success → commit + push + `gh pr create --reviewer calebjackson-reve`. Failure → no push, error-log entry, fix task queued at priority 11.
6. **Field-index refresh** — if any paragon task touched dom_maps, run `npm run field-index:build`.
7. **Report** — write `docs/routines/<DATE>-report.md` with Landed/Failed/Tomorrow/FieldDelta/OpenQuestions/Metrics sections.
8. **Commit metadata** — report + queue + error-log + field-index → direct push to main with `[routine]` prefix.
9. **Exit 0** (or crash-report + exit 1).

## Branch naming

`routine/<YYYY-MM-DD>-<task.id>`

Example: `routine/2026-04-15-paragon-p5-listing-detail`

## Commit message format

Feature commits (in worktree):
```
<type>(<scope>): <one-line>

[routine] task <task.id>
```

Metadata commits (on main):
```
[routine] nightly <DATE>: <N> landed / <N> failed
```

## PR body template

```
## Summary
<paragraph>

## Acceptance Met
- [x] <each item from task.acceptance>

## Files Changed
<list>

## Learnings
<any appended to error-log>

---
Opened by overnight Conductor · see docs/routines/<DATE>-report.md
```
```

- [ ] **Step 14.4: Commit skill**

```bash
git add .claude/skills/aire-routine/
git commit -m "feat(skills): aire-routine local skill — Conductor contract enforcer"
```

---

## Phase 5 — Wire Into CLAUDE.md + MEMORY.md

### Task 15: Append "Overnight Routines" section to project CLAUDE.md

**Files:**
- Modify: `c:\Users\cjjfr\OneDrive\AIRE ALL FILES\aire-assistant\CLAUDE.md`

- [ ] **Step 15.1: Append routines section**

Open `aire-assistant/CLAUDE.md` and append this exact section at the END of the file (after all existing content):

```markdown

## Overnight Routines

**Pattern:** Claude Code Cloud scheduled agent (the Conductor) runs nightly at 23:00 CT. Dispatches ≤3 parallel subagents against `docs/routines/queue.yaml`, ships ≤3 PRs, writes `docs/routines/<DATE>-report.md` in the morning.

**Operator protocol (every morning, ~10 min):**
1. Read `docs/routines/<newest-date>-report.md`
2. Merge or close the 1–3 PRs
3. Review any `halted_for_caleb` entries in `queue.yaml`

**Kill switches:**
- `docs/routines/queue.yaml` → set `paused: true` to skip a night
- Delete scheduled agent on Claude Code Cloud dashboard to stop entirely

**Local utilities:**
- `npm run routine:dry-run` — simulate tonight's dispatch
- `npm run paragon:lookup -- "<field>"` — <30s Paragon field lookup
- `npm run field-index:build` — rebuild field index from dom_maps

**Full design:** `docs/superpowers/specs/2026-04-14-overnight-routines-design.md`
**Master prompt:** `docs/routines/conductor.md`
**Error contract:** `docs/routines/error-loop.md`
**Local skill:** `.claude/skills/aire-routine/SKILL.md` (auto-loads when routine keywords fire)
```

- [ ] **Step 15.2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude-md): Overnight Routines section + morning protocol"
```

### Task 16: Update MEMORY.md pointer

**Files:**
- Create: `C:\Users\cjjfr\.claude\projects\c--Users-cjjfr-OneDrive-AIRE-ALL-FILES-aire-assistant\memory\project_overnight_routines.md`
- Modify: `C:\Users\cjjfr\.claude\projects\c--Users-cjjfr-OneDrive-AIRE-ALL-FILES-aire-assistant\memory\MEMORY.md`

- [ ] **Step 16.1: Create memory file**

Write this exact content to `C:\Users\cjjfr\.claude\projects\c--Users-cjjfr-OneDrive-AIRE-ALL-FILES-aire-assistant\memory\project_overnight_routines.md`:

```markdown
---
name: Overnight Routines (Conductor)
description: Claude Code Cloud scheduled agent running nightly at 23:00 CT against docs/routines/queue.yaml; dispatches ≤3 subagents, ships ≤3 PRs, feeds errors back into next-night priorities
type: project
---

Built 2026-04-14. Scheduled agent on Claude Code Cloud, cron `0 23 * * *` CT.

**Why:** Parallel agent sessions left 16 unmerged branches, 7 ephemeral worktrees, Paragon phases 5–12 pending, and untested AirSign/TC/Voice. Caleb wanted Nick-Saraev-style autonomous overnight workers with max velocity + error-loop learning.

**How to apply:**
- Morning routine: read `aire-assistant/docs/routines/<newest>-report.md`, merge PRs, review halted tasks.
- To pause: set `docs/routines/queue.yaml#paused: true`.
- To add a task: append to `seed_tasks` with `priority: 5–10` and proper `depends_on`.
- The `aire-routine` skill auto-fires when routine-related keywords appear.

Files:
- `docs/routines/` — conductor.md, queue.yaml, error-loop.md, reports
- `lib/cma/paragon-field-index.json` — <30s Paragon lookup index (auto-maintained)
- `scripts/paragon-lookup.ts` — CLI
- `scripts/routine-dry-run.ts` — local simulator
- `.claude/skills/aire-routine/` — Conductor contract enforcer skill

Safety rails: ≤3 PRs/night · ≤1 Paragon task/night · no force-push · no feature-code writes to main · captcha=abort · 2 failures=halt_for_caleb.

Full spec: `docs/superpowers/specs/2026-04-14-overnight-routines-design.md`.
Full plan: `docs/superpowers/plans/2026-04-14-overnight-routines.md`.
```

- [ ] **Step 16.2: Append pointer to MEMORY.md**

Open `C:\Users\cjjfr\.claude\projects\c--Users-cjjfr-OneDrive-AIRE-ALL-FILES-aire-assistant\memory\MEMORY.md` and append this line at the end:

```markdown
- [**Overnight Routines (Conductor) 2026-04-14**](project_overnight_routines.md) — scheduled Cloud agent @ 23:00 CT · queue.yaml-driven · ≤3 PRs/night · error loop reprioritizes tomorrow
```

No commit on this file — it is a user-memory file, not in the git repo.

---

## Phase 6 — Register Cron on Claude Code Cloud

### Task 17: Verify Phase 0 precursors complete

- [ ] **Step 17.1: Confirm with Caleb**

Ask Caleb to confirm:
1. Claude Code Cloud access — ✅ / ❌
2. `GH_ROUTINE_TOKEN` secret stored on Cloud — ✅ / ❌
3. `ANTHROPIC_API_KEY` mirrored to Cloud — ✅ / ❌

If any ❌ — STOP. Do not proceed.

### Task 18: Register the scheduled agent

- [ ] **Step 18.1: Invoke the `schedule` skill**

Invoke the Superpowers `schedule` skill with these parameters:

- **Agent name:** `aire-nightly-conductor`
- **Cron:** `0 23 * * *` (timezone: `America/Chicago`)
- **Repo:** `calebjackson-reve/aire-assistant`
- **Branch to start from:** `main`
- **Working directory:** repo root
- **Prompt:** "Read `docs/routines/conductor.md` and follow the contract exactly. First invoke the `aire-routine` skill via the Skill tool."
- **Secrets:** `GH_ROUTINE_TOKEN`, `ANTHROPIC_API_KEY`
- **Max wall-clock:** 90 minutes total run

The `schedule` skill will produce a remote-trigger URL. Save it to `docs/routines/README.md` under a new "Cron registration" section.

- [ ] **Step 18.2: Commit cron URL**

```bash
git add docs/routines/README.md
git commit -m "docs(routines): record scheduled-agent registration"
```

---

## Phase 7 — Night 1 Validation (Read-Only)

### Task 19: Ship a read-only-only queue for night 1

- [ ] **Step 19.1: Temporarily restrict queue.yaml**

Before first scheduled firing, edit `docs/routines/queue.yaml`:

- Set every task's `status` to `halted_for_caleb` EXCEPT these two read-only tasks:
  - `branch-triage-sweep` (read-only by brief)
  - `paragon-field-index-backfill` (read-only — no live Paragon)

- [ ] **Step 19.2: Commit restricted queue**

```bash
git add docs/routines/queue.yaml
git commit -m "[routine] night-1 validation — restrict queue to 2 read-only tasks"
git push origin main
```

### Task 20: Manual trigger + morning review

- [ ] **Step 20.1: Manually trigger the Conductor via the schedule skill's remote-trigger URL**

Fire the scheduled agent on-demand. Watch the run. When it completes:

- Verify `docs/routines/<TODAY>-report.md` exists and is well-formed
- Verify 1 PR opened (for `branch-triage-sweep` — it produces a new docs file)
- Verify `lib/cma/paragon-field-index.json` updated
- Verify NO writes to `app/`, `lib/` (except field-index), `components/`, `prisma/`, `scripts/` directly on main

- [ ] **Step 20.2: Decide go / no-go**

If all checks pass: restore full queue, enable nightly cron, done.
If any check fails: capture diagnosis in `docs/routines/night-1-postmortem.md`, set queue to `paused: true`, fix issues, retry.

- [ ] **Step 20.3: Restore full queue + commit**

```bash
# Revert all halted_for_caleb overrides except any tasks legitimately halted
git add docs/routines/queue.yaml
git commit -m "[routine] night-1 validation passed — restoring full queue"
git push origin main
```

---

## Self-Review Checklist

After writing this plan, the author verified:

1. **Spec coverage:**
   - G1 (nightly report) → Task 2 Step 2.1 (`conductor.md` Step 7)
   - G2 (≤3 PRs/night) → Tasks 2, 14, 12 (enforced in prompt + skill + pickTasks)
   - G3 (Paragon surfaces mapped produces DOM map + scraper + test + field dict) → seed tasks `paragon-p5-*`, `paragon-p6-*` in queue.yaml
   - G4 (<30s lookup) → Tasks 5–10 (build + lookup + CLI)
   - G5 (error loop reprioritization) → Tasks 4, 11, 12 (error-loop.md + promoteError)
   - Safety rails (§5 of spec) → Tasks 2, 14 (conductor.md + skill non-negotiables)
   - Integration with existing skills (§7) → Task 14 + conductor prompt step 4
   - Observability (§8) — v1 report-file only → Task 2 Step 7
   - Rollback (§9) → Task 1 Step 1.1 (kill switches)
   - Testing strategy (§11) → Phases 3 (dry-run) + 7 (night-1 read-only)
   - Deliverables 1–11 from §12 all mapped to tasks

2. **Placeholder scan:** No TBDs. All code blocks are complete. All file paths absolute where cross-machine, project-relative where in-repo. No "similar to task N" references.

3. **Type consistency:**
   - `Queue`, `Task`, `TaskDomain`, `TaskStatus`, `FieldIndex`, `FieldIndexEntry`, `DomMap` — each defined once, imported from canonical location.
   - `pickTasks`, `promoteError`, `markCompleted`, `buildFieldIndex`, `lookupField` — signatures match between test and implementation.
   - `[routine]` commit prefix used consistently.
   - Branch name format `routine/<YYYY-MM-DD>-<task-id>` used in both prompt and contract reference.

---

**Plan complete.**
