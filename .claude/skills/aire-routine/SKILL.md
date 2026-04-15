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
