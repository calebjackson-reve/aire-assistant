# Paragon MLS Mastery Plan
**Drafted:** 2026-04-13 · **Branch:** `cma/engine` · **Owner:** Caleb (B24140 sole access)
**Method:** DevTools-MCP-driven mapping → autonomous batch execution

> Goal: every Paragon surface that can feed the AIRE platform is mapped, scraped, and wired into Neon. Future feature work becomes 15-min builds, not multi-hour reverse engineering.

---

## Amplified brief (per `amplify-prompt` skill)

**Task:** Inventory every Paragon interface, map its DOM via Chrome DevTools MCP, and integrate each into `lib/cma/scrapers/mls.ts` with a corresponding test script and snapshot output.

**Files I will touch:**
- `lib/cma/scrapers/mls.ts` (extend with one function per surface)
- `lib/cma/scrapers/snapshots/mls_paragon/` (per-surface snapshot files)
- `lib/cma/scrapers/dom_maps/` (NEW — JSON DOM maps per surface, source of truth for selectors)
- `scripts/test-cma-paragon-*.ts` (one runner per surface)
- `lib/cma/SOURCE_INTELLIGENCE.md` (append per-surface field dictionary)

**Patterns to mirror:**
- Single-shot per surface; one selector restart per day per safety rules
- DevTools MCP for reconnaissance (read-only, no account risk)
- Playwright scraper (`lib/cma/scrapers/base.ts`) for production capture
- `__name` shim injection via `injectNameShim()` for every evaluate
- Frame URL diff for fresh-frame extraction (avoid stale-frame leak)
- Hard-nav `popup.goto()` between batch iterations (not popup recycling)

**Locked constraints:**
- Account B24140 — never thrash, single shot per address per run
- 7-day session reuse, captcha = HALT, 2-fail = HALT
- DevTools MCP runs in a SEPARATE Chrome instance (zero overlap with Playwright scraper)
- Snapshots only — never persist raw HTML
- 50-150ms human-paced typing for any Paragon write operation (no writes in this plan; scope = read-only mapping)

**Env vars touched:** none (all flows use existing storageState)

**Acceptance criteria per phase:**
1. DOM map (`*.dom.json`) committed for the surface
2. Scraper function added to `mls.ts`
3. Test script runs single-shot end-to-end PASS
4. Snapshot file produced under `snapshots/mls_paragon/<surface>/`
5. SOURCE_INTELLIGENCE.md updated with field dictionary
6. Commit message: `feat(cma): Phase N — <surface> mapped + scraper`

---

## Phase status (lifecycle: ❌ pending · 🚧 in-progress · ✅ done)

### Already done (Day 2–4)
- ✅ **Phase 0** ROAM SSO login + 7-day session reuse (`paragonLogin`, `paragonSmokeTest`)
- ✅ **Phase 1** Saved Presentations list nav + recon
- ✅ **Phase 2** Enumerate all 28 saved CMAs (paginated)
- ✅ **Phase 3** Drill into one CMA → Step 2 Comparables → extract comps
- ✅ **Phase 4** Batch harvest all 23 active CMAs (111 comps captured)

### Coming next (this autonomous run)
- 🚧 **Phase 5** Listing Detail page — open one MLS#, capture full property record (Beds, Baths, Year, Lot Size, Style, Subdivision, Schools, Mineral Rights, Foundation, Room Dimensions, Features, Photos, History)
- ❌ **Phase 6** Customize Columns dialog — add hidden columns to comp grid (Beds, Baths, Year Built, DOM, Sold Date) so future harvests are richer
- ❌ **Phase 7** Hot Sheets — price drops, new listings, back-on-market, new pendings (daily deal-finding signal feeding Morning Brief)
- ❌ **Phase 8** Market Monitor — Active/Pending/Closed/Expired counts (right-sidebar widget; market velocity signal for Morning Brief)
- ❌ **Phase 9** SEARCH tab — full search builder; resume Day-3 work; auto-pull Sold comps within radius/date for any subject
- ❌ **Phase 10** CMA Wizard Step 3 Adjustments — capture Caleb's manual adjustment values (ground truth for tuning `ADJUSTMENTS` constants)
- ❌ **Phase 11** Saved Property Searches — reusable search templates (footer link "Load Saved Quick Search")
- ❌ **Phase 12** Re-harvest 23 CMAs with enriched columns from Phase 6 + Step 3 adjustments from Phase 10

### Backlog (later session, lower priority)
- LISTINGS tab (his active inventory)
- CONTACTS tab (client database)
- TAX records lookup
- Reverse Prospecting
- ROSTER / RESOURCES (low value)
- EasyCMA (alternative CMA flow)
- FINANCIALS calculator
- Photo download from listings

---

## DOM map convention

For each surface I create `lib/cma/scrapers/dom_maps/<surface>.dom.json`:

```jsonc
{
  "surface": "comp_grid_step2",
  "url_pattern": "/CMA/Comparable.mvc/ComparableList?...",
  "frame_predicate": "url.includes('/CMA/Comparable.mvc')",
  "tables": {
    "header": { "selector": "table.ui-jqgrid-htable", "row": "thead tr" },
    "body":   { "selector": "table#cmaList.ui-jqgrid-btable", "row": "tbody tr" }
  },
  "columns": [
    { "name": "MLS#", "index": 5, "type": "string" },
    { "name": "Price", "index": 9, "type": "currency" },
    ...
  ],
  "actions": [
    { "label": "Customize", "selector": "button:has-text('Customize')" }
  ]
}
```

This file becomes the source of truth — scraper code references column names, not raw indices.

---

## Execution rules (autonomous mode)

1. After each phase: commit + update this plan + mark TodoWrite complete
2. If any surface needs Caleb's input (login, MFA, modal click), **STOP** and ask
3. If 2 selector failures on same surface within one phase → HALT, ask for screenshot/walkthrough
4. Hourly self-check: are recent snapshots growing? If not, something is broken — halt and report
5. Caleb interrupts at any time = stop after current step, summarize, await direction
