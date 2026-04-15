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
