# AIRE Workspace Blueprint v2 — The $100K/Month Build Spec

**Status:** Master spec for the authenticated AIRE workspace (`/aire/*` + `/airsign/*`).
**Date:** 2026-04-14 (overnight session).
**Author:** Claude (main thread), synthesizing audit + research + Caleb's prior blueprints.
**Builds on:** [A_GRADE_BLUEPRINT.md](../../../A_GRADE_BLUEPRINT.md) v1, [JARVIS_RESEARCH.md](../../../JARVIS_RESEARCH.md), [AGENT_BRIEFS.md](../../../AGENT_BRIEFS.md).
**Adds:** integrated audit findings, new homepage vocabulary applied workspace-wide, voice command catalog, workflow choreography, learning loop architecture, component library taxonomy.
**Reading time:** ~45 minutes top-to-bottom. Designed to be skimmed by chapter.

---

## Chapter 1 — Executive Summary

### 1.1 What we're building

A unified workspace at `/aire/*` + `/airsign/*` that feels like one continuous tool — Linear × Attio × Superhuman density, Kinfolk warm editorial styling — replacing the current pages that each invented their own theme system, hardcoded their own colors, and broke the locked Daylight/Nocturne contract.

### 1.2 Why this matters

Caleb's revenue thesis: this product earns **$100K/month minimum** when 1,000 agents each pay $97/month. The bar is therefore not "good enough to ship" — it's "good enough that an agent who closes 5 deals/month feels the tool is worth more than 1 deal's commission split per year."

That means every page must:
- Read as a single hand designed it (no theme drift)
- Move with intention (no `transition: all`, no broken motion)
- Earn its existence in <3 seconds (clear value prop, obvious primary action)
- Work on a phone in a parking lot (mobile-first is non-negotiable)

### 1.3 How v2 differs from v1 (the existing A_GRADE_BLUEPRINT.md)

| Dimension | v1 (A_GRADE_BLUEPRINT.md) | v2 (this doc) |
|---|---|---|
| Per-page specs | ✓ 36 surfaces specced | ✓ 8 priority pages re-specced through new homepage vocabulary |
| Foundation work | ✓ F1–F5 listed | ✓ F1–F5 status verified against current code (most partial, 2 done) |
| Cluster runbook | ✓ A1–A14 cluster IDs | ✓ Refined to 5 waves with worktree-based parallelism |
| Voice command catalog | ✗ missing | ✓ NEW — every command, which page handles it, what state it changes |
| Workflow choreography | ✗ missing | ✓ NEW — voice → txn → contract → AirSign as one continuous flow with shared state spec |
| Learning loop arch | △ JARVIS_RESEARCH gestures at it | ✓ NEW — full event schema + weekly cron + auto-improvement proposal pipeline |
| Component library taxonomy | △ F4 lists primitives | ✓ NEW — every shared molecule named, spec'd, file-anchored |
| New homepage vocabulary | ✗ pre-dates the 8-scene homepage | ✓ NEW — all chapters reframe through the cinematic vocabulary just shipped |

v1 is **not** discarded. v2 is the **active spec** every parallel agent reads first.

### 1.4 Tonight's deliverable vs full project scope

**Tonight (autonomous, ~5–7 hrs):**
1. This blueprint document, complete and self-reviewed
2. Foundation work F1–F5 finished (the per-page redesign cannot start until these merge)
3. Memory save + nightly report

**Tomorrow (with Caleb's morning review + parallel agent dispatch, ~8–12 hrs wall-clock):**
- Build wave: 3 concurrent agents on isolated worktrees per cluster
- Integration pass: merge worktrees, run tsc + next build + Playwright dogfood smoke
- Final review pass at 375/768/1280 widths

### 1.5 Reading guide for skimmers

- **Want the "what changed and why" summary?** Read Ch.1 (this) + Ch.4 (foundation status).
- **Designing a specific page?** Read Ch.3 (vocabulary) + Ch.5 (your page).
- **Implementing voice?** Ch.6 + Ch.8.
- **Building a feature that crosses pages?** Ch.7.
- **Reusable component questions?** Ch.9.
- **Tomorrow's parallel build dispatcher?** Ch.10.

---

## Chapter 2 — Current State (Audit Findings, 2026-04-14)

The audit agent read every priority page in the existing `/aire/*` workspace. Findings are verbatim where useful, paraphrased where dense.

### 2.1 Theme system: BROKEN

The single largest source of inconsistency.

- `/aire/layout.tsx` correctly forces `data-theme="nocturne"` via FOUC-safe inline script before first paint
- BUT individual pages (`/aire/morning-brief`, `/airsign`, parts of `/aire/transactions`) override to Daylight by hardcoding `bg-[#f5f2ea]` etc.
- No theme toggle exists in the workspace — Caleb cannot switch even if he wanted to
- CSS variables exist (`--surface-base`, `--text-body`, `--accent-primary-bg`) but are ignored in favor of inline hex everywhere
- DarkLayout shell wraps Daylight content on `/airsign` — the visual conflict is visible

**Fix:** F2 (theme bootstrap) needs to be repaired AND every page audited for inline hex overrides. v2 makes Nocturne the authoritative default for `/aire/*` + `/airsign/*` and Daylight the default for marketing (`/`, `/billing`, `/sign-in`). A `<ThemeToggle>` component lives in the workspace top bar.

### 2.2 Color palette: hardcoded hex everywhere

The intended palette (sage / olive / cream / linen / forest) lives in `app/globals.css` as CSS variables. But pages route around the variables and inline hex, defeating the locked-palette contract.

Concrete repeats found in audit:
- `#6b7d52`, `#9aab7e`, `#b3c295` (intended sage/olive)
- `#d4944c` (warning amber — should be `--color-status-pending` = `#b8a36b`)
- `#c4787a`, `#c45c5c`, `#8b4a4a` (error reds — should converge on `--color-error` = `#8b4a4a`)
- `#f5f2ea`, `#e8e4d8` (cream/linen — should be `--color-cream` / `--color-linen`)
- `#1e2416` (forest — should be `--color-forest`)

**Fix:** F1 (token canonicalization) is partially done — tokens exist in globals.css. The missing half is the grep-and-replace pass that nukes inline hex and replaces with `var(--color-X)` or Tailwind class. Every parallel agent is forbidden from writing inline hex in their cluster.

### 2.3 Data layer: SOLID

Every Prisma query in the audited pages is well-structured. Includes are appropriate (no N+1). Lightweight count queries in the layout for badges. JSON blob parsing in morning brief works. **No data layer changes needed for this redesign.** This is the single biggest derisking finding.

### 2.4 Per-page audit verdicts

| Page | Lines | Theme observed | Vocabulary status | Verdict |
|---|---|---|---|---|
| `/aire/page.tsx` (Dashboard) | 535 | Nocturne hardcoded | Cormorant + Plex Mono ✓; inline hex overrides ✗ | Polish-only |
| `/aire/transactions/page.tsx` | 297 | Daylight + Nocturne mixed | CSS vars used then overridden by hex | Redesign-shell-keep-data |
| `/aire/transactions/[id]/page.tsx` | 45 (router) + child | Nocturne implicit | Router clean; child has heavy inline hex | Full rewrite (of child component) |
| `/aire/morning-brief/page.tsx` | 371 | Daylight forced | Cormorant ✓ + Plex Mono ✓; hex hardcoded | Polish-only |
| `/airsign/page.tsx` | 283 | Daylight forced inside DarkLayout (conflict) | Cormorant ✓; theme conflict ✗ | Redesign-shell-keep-data |
| `/aire/contracts/page.tsx` | 80 | Nocturne implicit | Cormorant ✓ + Plex Mono ✓; minor hex | Polish-only |
| `/aire/contracts/new/page.tsx` | 22 (router) + child | Nocturne implicit | Router thin; child needs audit | Full rewrite (of ContractForm child) |
| `/aire/settings/page.tsx` | 68 | Nocturne implicit | Cormorant ✓; minor hex | Polish-only |
| `/aire/demo-mode/page.tsx` | 480 (just shipped) | Nocturne intentional | New homepage vocabulary ✓ | Already done (reference exemplar) |

**Scope distribution:**
- 50% polish-only (Dashboard, Morning Brief, Contracts list, Settings)
- 25% redesign-shell-keep-data (Transactions list, AirSign dashboard)
- 25% full-rewrite of child component (Transaction Detail, Contract Writer)

This is **far less work than the original "redesign 27 pages" framing suggested**. The data layer is intact; the structure is mostly intact. The work is primarily theme repair + inline-hex-to-token conversion + child component refactors.

### 2.5 Cross-cutting observations from the audit

- Vocabulary is *intended* (Cormorant headlines, Plex Mono numerals) but *implemented* inconsistently across pages — some use the CSS var, some inline-hex the same color
- TransactionList (client component on `/aire/transactions`) implements the responsive table → card collapse correctly — keep this pattern, mirror elsewhere
- TransactionDetail (`components/tc/`) is a 5-tab monolith that needs decomposition into compound components (one file per tab)
- ContractForm exists but wasn't audited — likely needs error-state polish + inline preview
- DarkLayout sidebar (`app/aire/layout.tsx` wrapper) is the right shell — the issue is what gets rendered inside it, not the shell itself

---

## Chapter 3 — The New Homepage Vocabulary (apply to every workspace page)

The 8-scene homepage shipped tonight (commit 5737c47 + tonight's 10 new files) established a vocabulary that did not previously exist on the marketing site. v2's central thesis: **port that vocabulary into the workspace so the public→authenticated transition feels like one continuous product, not two stitched ones.**

### 3.1 The 7 vocabulary moves to port (each one fits the locked AIRE rules)

#### Move 1 — Editorial eyebrow + giant Cormorant italic headline + olive accent on the verb
Used everywhere on the homepage. Pattern:
```
[10px IBM Plex Mono uppercase eyebrow in muted sage]
[Cormorant italic 36–56px headline in deep forest, with the pivotal phrase in olive]
[Space Grotesk 16px body, max-w-md, ink-muted color]
```
Workspace application: every page header. Replaces the current "h1 with hardcoded hex color" pattern.

#### Move 2 — Stat pill row (3–4 items) with IBM Plex Mono number + 3px olive left border
Tonight's `SceneMorningBrief` and `SceneStatShowcase` both use this. Pattern:
- Cream surface (`#f0ece2`) or Forest tinted glass on dark
- 3px olive left border (or sage on dark)
- IBM Plex Mono 20–28px value
- Space Grotesk 11px uppercase 0.06em label below
- Sub-label optional in muted sage

Workspace application: dashboard hero stats, transaction list hero stats, morning brief priority counts, AirSign envelope status counts.

#### Move 3 — Glass dark card with hairline highlight
Tonight's voice scene + pipeline kanban + embedded demo all use this. Pattern:
```css
background: rgba(245,242,234,0.025); /* near-transparent cream */
border: 1px solid rgba(74,86,56,0.5); /* olive border at 50% */
border-radius: 12px;
box-shadow:
  0 1px 0 rgba(245,242,234,0.06) inset,  /* hairline top highlight */
  0 12px 40px rgba(30,36,22,0.35);       /* deep forest tinted shadow */
```
Workspace application: every elevated surface on Nocturne — transaction detail tabs, contract preview, AirSign envelope tile, learning insights card, monitoring panel.

#### Move 4 — Window chrome bar (3 dots + IBM Plex Mono breadcrumb + status pill)
Tonight's `SceneEmbeddedDemo` and `ScenePipelineKanban` use this. Treats every panel like a fake terminal/browser window — gives the workspace a "tools for serious people" texture.

Pattern:
```
[3 dots: 0.5 opacity red/amber/sage] [breadcrumb: AIRE / Pipeline · 18 active deals] [right pill: Live]
```
Workspace application: panel headers across the workspace. Make every "card with a header" look like a window.

#### Move 5 — Scroll-driven reveal (translateY + opacity, no height/width)
Tonight's `SceneMorningBrief` pinned reveal, `SceneStatShowcase` line-by-line breakdown. Implemented via Framer Motion `useScroll` + `useTransform`.
Workspace application: sparse — use only on the **dashboard hero** (pipeline pulse reveals as user scrolls) and the **transaction detail timeline** (events reveal as user scrolls into the timeline tab). Don't overuse — workspace is a tool, not a marketing page.

#### Move 6 — Magnetic CTA + tilt card
Tonight's `SceneCalebStory` MagneticCTA component (cursor-tracking translateX/Y on hover) and TiltPhoto (4° max rotateX/Y). Both use Framer Motion springs.
Workspace application:
- **Magnetic CTA** on the *single* primary action of any page (not on every button — it loses meaning)
- **Tilt card** on stat cards, deal cards, AirSign envelope tiles — anywhere a card is the primary content unit and benefits from "I can grab this" affordance

#### Move 7 — Section eyebrow with scene number
The homepage uses `Voice Commands · Scene 03` style section labels. Workspace adaptation: skip the "Scene 03" but keep the IBM Plex Mono uppercase eyebrow on every section. Already partially in use; make it universal.

### 3.2 Anti-vocabulary (workspace must avoid)

Carry these straight from the homepage rules — they are equally instant-fail in the workspace:
- ✗ Default Tailwind blue/indigo/sky/violet/cyan
- ✗ Pure white `#ffffff` page backgrounds (use `--color-cream`)
- ✗ Pure black `#000000` text or shadows (use `--color-forest`)
- ✗ `transition: all`
- ✗ Animating `height`, `width`, `color`, or `background-color`
- ✗ Same display font twice in a row without a Space Grotesk element between
- ✗ 4th font (Inter, Newsreader, Roboto — retired)
- ✗ Material Symbols icon font — use `lucide-react`
- ✗ Stock photography of strangers — only Caleb's actual photography
- ✗ Sci-fi copy ("Neural Path", "Quantum Density", "Synthetic Protocol")
- ✗ Drop shadows in `rgba(0,0,0,...)` — always `rgba(30,36,22,...)`

### 3.3 Where to source the vocabulary in code

Every parallel agent imports from these canonical files instead of re-implementing:
- **Tokens:** `app/globals.css` `:root` and `[data-theme]` blocks
- **Motion:** `lib/motion/scroll-theatre.ts` (created tonight) — `useScrollReveal`, `useParallax`, `useStaggerChildren`, `flipHelper`
- **Voice demo:** `app/components/landing/VoiceDemoCapture.tsx` — re-use for the workspace voice overlay
- **Kanban:** `app/components/landing/PipelineKanbanDemo.tsx` — re-use as the AirSign envelope kanban
- **Stat pills:** mirror `SceneMorningBrief` + `SceneStatShowcase`
- **Glass dark card:** mirror `SceneEmbeddedDemo` + `ScenePipelineKanban`
- **Window chrome:** mirror `SceneEmbeddedDemo`
- **Tilt card:** mirror `SceneCalebStory.TiltPhoto` + `app/aire/ui-lab/experiments/tilt-card`
- **Magnetic CTA:** mirror `SceneCalebStory.MagneticCTA` + `app/aire/ui-lab/experiments/magnetic-cta`

These become the new component library (Ch.9 names them).

---

## Chapter 4 — Foundation Work Status (F1–F5)

The original A_GRADE_BLUEPRINT.md v1 listed 5 foundation tasks that must complete before parallel agents dispatch. v2 verifies each against current code and updates status.

### 4.1 F1 — Token canonicalization

**v1 status:** Pending.
**v2 verified status:** **PARTIAL — DONE 60%**

Done:
- `app/globals.css` defines all 5 locked palette tokens + extended palette + status tokens + hairline + shadow tint
- Theme-aware tokens via `:root` and `[data-theme="nocturne"]` blocks exist
- Tailwind class aliases (`bg-sage`, `text-olive`, etc.) work via `@theme inline` block

Still pending:
- Grep-and-replace inline hex across `/aire/*` pages — audit confirms 8+ pages still use hex like `#6b7d52` instead of `var(--color-olive)` or `bg-olive`
- Nuke list still has hits: `bg-zinc-*`, `bg-white`, deprecated aliases (`cream-warm`, `cream-cool`, `cream-dim`)

**Tonight's action:** finish the grep-and-replace pass. One commit per cluster of files (e.g., "feat(tokens): purge inline hex from /aire/transactions"). This is a **main-thread serial task** — must finish before parallel build.

### 4.2 F2 — Theme bootstrap + toggle

**v1 status:** Pending.
**v2 verified status:** **PARTIAL — DONE 40%**

Done:
- FOUC-safe inline script in `app/aire/layout.tsx:9–15` sets `data-theme="nocturne"` before first paint
- `app/aire/layout.tsx:51` wraps content in `<div className="ui-lab-scope" data-theme="nocturne">`

Still pending:
- Several `/aire/*` pages override the theme by hardcoding cream backgrounds (`bg-[#f5f2ea]`) — they break the contract
- No `<ThemeToggle>` component exists — user cannot switch
- No `prefers-color-scheme` honor on first visit
- No `localStorage` persistence

**Tonight's action:** create `components/ui/ThemeToggle.tsx`, wire it into the DarkLayout sidebar header, fix every page that overrides the inherited theme. Same main-thread serial task as F1.

### 4.3 F3 — Cormorant Garamond sweep (replace any remaining Playfair Display)

**v1 status:** Pending.
**v2 verified status:** **DONE — verified 0 hits**

`grep -rln "Playfair Display" app/ components/ lib/` returned 0 matches. The sweep is complete (commit 310cede per memory). No action needed.

### 4.4 F4 — Shared primitives consolidation

**v1 status:** Pending.
**v2 verified status:** **PARTIAL — DONE 50%**

Done:
- `components/ui/primitives/` directory exists
- `components/ui/primitives.tsx` re-export file exists

Still pending (audit will tell exactly which primitives need creation vs re-export — see Ch.9 for the full taxonomy):
- `<SectionLabel>` (12px uppercase Plex Mono + olive underline)
- `<HairlineDivider>` (theme-aware)
- `<StatPill>` (3px olive left border, IBM Plex Mono number)
- `<StatusBadge>` (5 variants — Active/Pending/Overdue/Info/Draft)
- `<GlassCard>` (Nocturne elevated surface with hairline highlight)
- `<WindowChrome>` (3 dots + breadcrumb + status pill — new pattern from homepage)
- `<TiltCard>` (4° max rotateX/Y wrapper — new from homepage)
- `<MagneticButton>` (cursor-tracking primary action — new from homepage)

`<SegmentErrorBoundary>` and `<FeedbackButtons>` already exist — re-export from primitives.

**Tonight's action:** create the missing primitives. Each is a small file (50–120 lines). One commit per primitive.

### 4.5 F5 — Motion library consolidation

**v1 status:** Pending.
**v2 verified status:** **PARTIAL — DONE 40%**

Done tonight:
- `lib/motion/scroll-theatre.ts` created (4 hooks + flipHelper)

Still pending:
- `lib/motion/spring-presets.ts` — named presets (`SPRING_UI`, `SPRING_PAGE`, `SPRING_HERO`) so agents don't re-derive cubic-bezier values
- `lib/motion/tilt.ts` — extract the TiltPhoto move from `SceneCalebStory` into a reusable hook `useTilt(maxDeg, perspective)`
- `lib/motion/magnetic.ts` — extract the MagneticCTA move into a reusable hook `useMagnetic(strength)`
- `lib/motion/window-enter.ts` — the `rotateX(8deg → 0)` command bar entrance from `app/aire/ui-lab/experiments/command-bar-opening`

**Tonight's action:** extract these helpers. Each is ~30–60 lines. Lets every page mount motion the same way.

### 4.6 F6 (NEW) — Voice command surface unification

The audit revealed that voice commands are wired through `/api/voice-command/v2` correctly, but the *UI surface* (where the user triggers voice + sees feedback) is fragmented — `WisprShell` is the dictation overlay, `VoiceCommandBar` is a different bar, and tonight's `VoiceDemoCapture` is a third. The workspace needs ONE assistant overlay that supersedes these.

**v2 status:** NEW — adds to v1's foundation list.

**Tonight's action:** spec only (in Ch.6 voice command catalog). Do NOT implement tonight — JARVIS_RESEARCH.md proposed `AssistantOverlay.tsx` with structured action proposals; this needs Caleb's design approval before code lands. Tonight's blueprint locks the spec; tomorrow's build wave includes one cluster (`A11 Voice + Settings` from v1) that owns this.

### 4.7 Foundation completion sequence (tonight, serial)

```
1. F1 inline-hex grep + replace                 [~90 min, main thread]
2. F2 ThemeToggle + theme-leak fixes            [~60 min, main thread]
3. F4 missing primitives (SectionLabel,
   StatPill, GlassCard, WindowChrome,
   TiltCard, MagneticButton, StatusBadge,
   HairlineDivider)                             [~90 min, main thread]
4. F5 motion helpers (spring-presets, tilt,
   magnetic, window-enter)                      [~60 min, main thread]
5. tsc --noEmit + next build verify             [~10 min]
6. Commit each step separately, tag the
   merged result v2.0-foundation                [~5 min]
```

Total foundation: ~5 hours of focused main-thread work. Within tonight's budget.

After F1–F5 complete, tomorrow's build wave can dispatch the per-cluster parallel agents (Ch.10) safely.

---

*[End of Chapters 1–4. Per-page redesign chapters (5), voice catalog (6), workflow choreography (7), learning loop (8), component library (9), and build sequence (10) follow in the next commit.]*
