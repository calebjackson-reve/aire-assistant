# A14 — Billing + Auth + Onboarding cluster baseline (2026-04-14)

Routes: `/billing` (B+), `/sign-in` (B), `/onboarding` (B), `/` Landing (A).

## Current state
`/billing` and `/sign-in` are public; `/onboarding` auth-gated; `/` is landing. All four returned 500 in this environment after the Prisma build error propagated. Earlier sign-in capture (before compile cascade) confirmed Nocturne canvas + "Sign in to AIRE" Cormorant italic — Clerk widget did NOT render ("keys do not match" per server log).

## A-grade criteria (from brief)
- `/billing`: Daylight palette; trial countdown banner for FREE users; ROI calculator inline with numbers ticking on mount; Cormorant headings; IBM Plex Mono pricing.
- `/sign-in`: Clerk tap targets ≥44px on mobile; branded Clerk appearance tokens.
- `/onboarding`: 3 pre-populated sample deals (deletable); optional ElevenLabs voice greeting; Nocturne.
- Landing: reserve for Phase 3 polish.

## Violations observed
- `app/billing/page.tsx:2` — `transition-all`.
- `app/page.tsx:3` — `transition-all` (Landing; blueprint says "Phase 3", but rule still applies).
- `app/sign-in/[[...sign-in]]/page.tsx:2` — `transition-all`.
- `app/onboarding/OnboardingClient.tsx:9` — `transition-all`.
- No visible trial countdown banner in `/billing` (need ROI calc component; absent).
- Clerk `appearance={{...}}` brand tokens likely not set — sign-in page renders only shell text, no branded widget fallback path.

## Surprises
- `/sign-in` + `/billing` both crashed to 500 mid-audit-run due to `@prisma/client` module resolution failure. Public pages should not depend on Prisma; suggests `lib/prisma.ts` is imported somewhere in the shared root layout chain. Worth isolating.
- Clerk key mismatch is an env issue, not a UI issue — note but don't act.

## Severity
Medium. Surfaces are close to spec (B+ / B); violations are small (transition-all + missing banner). Clerk brand-token pass is easy win.
