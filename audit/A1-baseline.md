# A1 — Dashboard cluster baseline (2026-04-14)

Routes: `/aire` (Dashboard, B+), `/aire/morning-brief` (already A).

## Current state
Dashboard + Morning Brief both auth-gated behind Clerk; redirect to branded `/sign-in` ("AIRE INTELLIGENCE" mono caption + Cormorant italic "Sign in to AIRE" on Deep Forest canvas — only decorative state renders, Clerk widget missing due to key mismatch). Actual authenticated content not visible without auth.

## A-grade criteria (from brief)
- Sparkline-hero pattern on pipeline number (30d trend).
- Activity stream pinned below, AgentPulseChip animating when agents run.
- Nocturne default (requires F2 theme-bootstrap fix).
- 4 quick actions use GlossyToggle (C6); Cormorant H1 "Today"; IBM Plex Mono for pipeline value.
- Creative upgrades: Revenue clock, Deal Meter, Live agent feed ticker.

## Violations observed (static review)
- `app/aire/page.tsx:3` — uses `transition-all` (rule §Anti-Generic Guardrails forbids).
- New components named in brief do not exist: `components/dashboard/PipelinePulse.tsx`, `ActivityStream.tsx`, `AgentPulseChip.tsx` — confirmed by filesystem check.
- No sparkline primitive wired; brief requires `ui-lab/experiments/sparkline-hero` mirror.
- Morning Brief is already A per blueprint — baseline OK; no changes needed.

## Surprises
- Auth-gated: redirected to `/sign-in`. Expected per brief.
- Sign-in page renders only chrome; Clerk widget absent — server log reports `Clerk: Refreshing the session token resulted in an infinite redirect loop... keys do not match`. Non-cluster blocker.
- Shadow directory `aire-assistant-tcs-flagship/` mirrors app/ with its own divergent copies (will contaminate future sweeps if not deleted).

## Severity
Medium. Morning Brief already A; Dashboard mainly missing new primitives rather than having offensive code. `transition-all` is a trivial fix. Creative upgrades are net-new.
