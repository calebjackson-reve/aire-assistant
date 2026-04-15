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
