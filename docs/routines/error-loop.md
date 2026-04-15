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
