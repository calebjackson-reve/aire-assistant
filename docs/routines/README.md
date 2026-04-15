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
