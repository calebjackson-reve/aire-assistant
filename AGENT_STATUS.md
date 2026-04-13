# AGENT_STATUS.md
*Overnight parallel-agent coordination log. Each agent owns a branch + scope.
Every 2h checkpoint: append to your section the list of components / files /
tokens you've shipped so siblings can consume them.*

---

## Agent 4 — UI Remodel (branch: `ui/remodel`)
**Owner:** Caleb + Claude (primary UI architect)
**Scope:** `app/aire/ui-lab/*` — Concept B Daylight + Nocturne theme system.
Owns all `DESIGN.md` edits (tonight: none — holding for morning review).
Will NOT touch `/aire/page.tsx`, `app/aire/layout.tsx`, or `DESIGN.md` this
pass; those land in a follow-up after the mocks pass review.

### Checkpoint 2026-04-13 (Phase 1 scaffold landed — commit `4a23ab9`)

**Shipped — safe to import from `app/aire/ui-lab/_components/`:**
- `Dashboard` (default export — the full themed dashboard)
- `ThemeToggle` (sun/moon, localStorage-persisted, 240ms cross-fade)
- Icon helpers, `StatTile`, `StatusChip`, `UrgencyDot`, `Kbd`, `KbdHint`,
  `DealCard`, `Sparkline`, `CommandPill`, `Breadcrumb`, `MobileBottomBars`
  (all internal to Dashboard.tsx for now — promote if siblings want them
  as top-level primitives)

**Shipped — CSS variables available via `.ui-lab-scope[data-theme="..."]`**
(see `app/aire/ui-lab/_theme.css`):
| Token | Daylight | Nocturne |
|---|---|---|
| `--surface-base` | Cream | Deep Forest |
| `--surface-rail` | Deep Forest | near-black forest |
| `--surface-card` | Warm White | Warm White (floats) |
| `--surface-emph` | Deep Forest | near-black forest |
| `--text-strong / body / soft / muted / subtle / accent` | theme-aware |
| `--accent-primary-bg / -fg` | Olive / Cream | Sage / Deep Forest |
| `--shadow-raised / -elev / -float` | 3-stop DF-tinted | heavier DF-tinted |
| `--glow-highlight / -specular / -hairline / -cta` | palette-tinted |
| `--num-shadow` | `none` | `0 0 8px rgba(sage,0.15)` (pending audit) |

**Utility classes available** (scoped under `.ui-lab-scope`):
- `.ulb-card` / `.ulb-card-elev` / `.ulb-card-float` — card surfaces
- `.ulb-specular` — ::before top-left radial sage glow
- `.ulb-tilt` — hover translateZ + rotateX/Y + hairline glow ring
- `.ulb-row` — hover translateX(2px) on rows
- `.ulb-activity-row` — stagger-mount rise
- `.ulb-num` — mono numeral with themed text-shadow
- Cards override text vars → dark text always resolves inside cards
  regardless of outer theme

**Responsive matrix wired:**
- `< 768`: bottom 5-tab strip, sticky composer above tabs, table → card stack
- `768–1023`: icon rail visible, table compresses (drops `Closing` col at `< lg`)
- `≥ 1024`: full layout with right rail

**Motion:** transform + opacity only. 240ms standard. Reduced-motion honored.

### Known holds
- Text-shadow audit (0 0 8px sage/0.15 on Nocturne mono numerals) — shots
  pending this pass; will dial to 8% or remove if visible as glow on any of
  cheap-1080p / OLED / external monitor
- `/aire/page.tsx` not yet promoted — waiting morning review of mocks
- `DESIGN.md` — not touching tonight (owner responsibility; any token
  requests from Agents 1/3 queue here for morning review)

### Checkpoint 2026-04-13 Phase 2 landed (commit pending)

**Shipped (Phase 2 / Part B — 6 experiments, zero new deps):**
Mount any of these under `/aire/ui-lab/experiments/*`:
- `01 · tilt-card` — 3D tilt with cursor-follow specular highlight (pure React + CSS)
- `02 · scroll-reveal` — IntersectionObserver + translateY stagger (Linear-grade)
- `03 · magnetic-cta` — cursor-magnet button with spring damping via RAF loop
- `04 · sparkline-hero` — 1080-wide self-drawing mono sparkline (stroke-dashoffset)
- `05 · command-bar-opening` — ⌘K entrance: blur + scale + rotateX + 40ms stagger
- `06 · section-transition` — View Transitions API with zero-dep React fallback

Gallery index: `/aire/ui-lab/experiments`

**Shipped (Part C — MAP_VISION.md at repo root):**
- Recommended engine: **Cesium + Google Photorealistic 3D Tiles** (free tier
  covers year-one)
- 7 use cases ranked by pitch impact; MVP = A/B/C/D (fly-to / parish / flood / dots)
- Two UX layout options (split 40/60 vs. full-bleed with drawer) with
  recommendations per surface
- Year-one cost: ~$5–15/mo at 10K property views
- Effort estimate: 7 days post-remodel
- Mapbox Studio `aire-botanical` style spec for 2D fallback
- Appendix — top 5 "holy crap" patterns ranked by wow × ease × brand fit

**Shipped (Part D — top-5 recommendation memo):**
In `MAP_VISION.md` § appendix. Ranking: cinematic fly-to / scroll-reveal /
magnetic CTA / 3D tilt card / command-bar entrance.

**Theme fix (uncommitted, landing with Phase 2 commit):**
- PageTransition `transform` ancestor trapped `fixed inset-0` Dashboard
  into 0-height — switched Dashboard to natural `min-h-screen w-full` flow
- Cards override `--text-strong / -body / -soft / -muted / -subtle /
  -accent / -border-base / -border-soft` so text inside Warm White cards
  always resolves dark regardless of outer theme

### Known holds
- Text-shadow audit (Nocturne mono numeral glow) — Chrome DevTools MCP
  disconnected twice mid-session and Clerk prod keys block autonomous
  sign-in from localhost. Audit + 6 verification shots need a fresh
  capture pass in a future session. Swap to DEV Clerk keys + mint sign-in
  token with `sk_test_*` to unblock (details in session error-log).
- Phase 2 Part A inspo scrape — subagent sandbox can't launch Playwright
  or firecrawl. Deferred.
- `/aire/page.tsx`, `app/aire/layout.tsx`, `DESIGN.md` — still untouched,
  awaiting morning review of `ui/remodel` mocks.
- `.env.local` — restored to **PROD Clerk keys** at end of session. Backup
  `.env.local.prod-backup` deleted. Safe.

---

## Token Requests Queue (inbound from Agents 1 / 3)
*Agents 1 and 3: append requests here. I will review in the morning before
any DESIGN.md edits.*

_(empty)_

---
