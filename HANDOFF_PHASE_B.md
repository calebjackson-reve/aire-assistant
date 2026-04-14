# Phase B Handoff — UI Coherence Pass

**Written:** 2026-04-13 (end of consolidation session)
**Branch state:** `main` at `ce03360`, tag `v1.0-consolidation`
**TypeScript:** 0 errors
**Ready to pick up:** Phase B from MASTER_ROADMAP.md

---

## What got done tonight (Phase A complete)

1. ✅ Fixed 4 TypeScript errors in `lib/cma/*` (commit `9fc8f7a`)
2. ✅ Committed WIP + `MASTER_ROADMAP.md` on cma/engine (commit `c49e597`)
3. ✅ Merged `cma/engine` → `main` (commit `ccb446d`)
4. ✅ Merged `tcs/flagship` → `main` (commit `9c5059f`)
5. ✅ Merged `airsign/v2` → `main` with conflict resolution on `app/airsign/page.tsx` (commit `71caabe`)
6. ✅ Ported 6 intel APIs + 7 engines + db/client + insurance + publisher from aire-intelligence repo (commit `ce03360`)
7. ✅ Tagged `v1.0-consolidation`
8. ✅ Removed `airsign-v2` worktree (tcs-flagship worktree still present — file locks, manual cleanup later)

---

## What's still sitting on disk (cleanup when convenient)

- `aire-assistant/aire-assistant-tcs-flagship/` — merged worktree, OneDrive-locked, `git worktree remove --force` when safe
- `aire-assistant/aire-assistant-airsign-v2/` — should be gone; double-check
- `aire-assistant/.claude/worktrees/agent-*` — 6 ephemeral parallel-agent scratch pads, safe to prune with `git worktree prune`
- `aire-intelligence/` repo — all production APIs now in `aire-assistant/app/api/intel/` + `aire-assistant/lib/intel/`. Safe to archive + delete.
- `Demo 2 AIRE/demo 3/` — unused personal brand attempt; archive + delete

Run when OneDrive isn't holding files:
```bash
cd "C:/Users/cjjfr/OneDrive/AIRE ALL FILES/aire-assistant"
git worktree list
git worktree remove aire-assistant-tcs-flagship --force
git worktree prune
```

---

## Phase B goal (next session)

**One polished, coherent UI across all 41 pages using `aire-frontend-design` skill + Concept B + Daylight/Nocturne theme system.**

### Priority pages to upgrade (in order)

| # | Page | Why first | File anchor |
|---|---|---|---|
| 1 | `/aire` dashboard | Top of funnel — first impression | `app/aire/page.tsx` |
| 2 | `/aire/transactions/[id]` | Most-used workspace — where agents live | `app/aire/transactions/[id]/page.tsx` |
| 3 | `/aire/cma/new` | **NEW page** — surfaces CMA Day 5 engine (11.53% MAPE) | create under `app/aire/cma/new/` |
| 4 | `/aire/intel` | **NEW page** — hub for AVM/flood/neighborhood/insurance | create under `app/aire/intel/` |
| 5 | `/airsign` | Redesign already merged; audit templates + broker queue links | `app/airsign/page.tsx` |
| 6 | `/aire/tcs/new` | TCS walkthrough — audit Day 9 UC flow surface | `app/aire/tcs/new/page.tsx` (or wherever Day 4 put it) |
| 7 | `/airsign/templates` (if not yet)  | Library UI for reusable LREC + custom templates | check if built |
| 8 | `/airsign/broker` | Broker compliance queue UI | check if built |

### Design system reminders (from `aire-frontend-design` skill)

- **Palette:** Sage #9aab7e · Olive #6b7d52 · Cream #f5f2ea · Linen #e8e4d8 · Deep Forest #1e2416 (NO blue, white, black, gold, copper)
- **Fonts:** Cormorant Garamond italic (display) · Space Grotesk (body) · IBM Plex Mono (numbers)
- **Theme:** Nocturne default on `/aire/*` + `/airsign/*`, Daylight on marketing. Toggle persists in localStorage.
- **Layout:** Concept B — 64w sidebar rail (expands to 240w on hover), ⌘K command bar, dense Attio table, pinned brief
- **Motion:** `rotateX/Y` max 4° tilt on cards, `translateZ(8px)` page transitions, spring easing `cubic-bezier(0.34, 1.56, 0.64, 1)`
- **Responsive:** 375 / 768 / 1280 / 1920 all in the same PR. Never "mobile later."
- **Self-eval:** 8-criteria rubric before claiming done, revise anything < 8/10.

### Ui-lab experiments to mirror
Already built at `app/aire/ui-lab/experiments/`:
- `command-bar-opening` — ⌘K entrance rotateX
- `magnetic-cta` — cursor-tracking CTA
- `tilt-card` — hover tilt card
- `sparkline-hero` — big stat + sage sparkline
- `scroll-reveal` — translateY + opacity
- `section-transition` — translateZ page transition

---

## Phase C + D reminders (not this session)

**Phase C — Public launch (2 weeks out):**
- Port aire-intelligence homepage to `app/(marketing)/`
- Public tools pages: AVM, Flood, Neighborhood, Insurance, Backtest, Market Pulse, Cash Flow
- Free AVM → email capture → AIRE Pro funnel
- 4 Baton Rouge SEO blog posts

**Phase D — Revenue levers (month 2-12):**
- Brokerage partnerships
- LoopImport migration flow ("Switch from Dotloop in 10 minutes")
- Voice ⌘K Whisper upgrade
- Referral program
- Compliance audit weekly email

---

## Open technical items to watch

1. **TCS Day 10+** — TCS `cma/engine` Day 6 never shipped. When/if UI is built, wire CMA output into the TCS "subject entry" step.
2. **Intel DB** — `INTEL_DATABASE_URL` env var needs to be set in Vercel + local to power the AVM/flood/backtest routes. Routes gracefully fall back to static ZIP data if unset, so deploy won't break.
3. **AirSign v2 tests** — `scripts/test-airsign-v2.ts` (33/33) should be re-run on main to confirm no regression from merge.
4. **Morning Brief** — Day 7 TCS researcher pulls in-flight sessions. Verify it still works after merges.
5. **Prisma migrations** — airsign/v2 + tcs/flagship each added schema migrations. Verify `npx prisma migrate status` is clean before first deploy to prod.

---

## The $100K/mo North Star (repeat)

950 paid users × blended $105/mo = $100K/mo. Target hit = month 12.
Every feature decision passes the test: **does this move new Pro signups this month?**
If no → parking lot.

— End of Phase A.
