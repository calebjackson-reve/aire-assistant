# A13 — Tools cluster baseline (2026-04-14)

Routes: `/aire/tools/buyers` (B−), `/aire/tools/sellers` (B−).

## Current state
Both auth-gated. Both pages are almost structurally identical — `h1` / `h2` use Playfair Display with hard-coded `#1e2416`.

## A-grade criteria (from brief)
- Tool card grid with generate buttons.
- Net Sheet (LA closing cost template), Pre-Listing Checklist, Offer Strategy Advisor, Buyer Persona generator.
- Cards tilt on hover (C2); Cormorant card titles; IBM Plex Mono numeric outputs.
- 1/2/3 card columns responsive.
- Env: `ANTHROPIC_API_KEY` for persona + advisor.

## Violations observed
- `app/aire/tools/buyers/page.tsx:30,478` — `Playfair Display, Georgia, serif` + `color: "#1e2416"` (F3 + F2 violations).
- `app/aire/tools/sellers/page.tsx:18,440` — same Playfair + `#1e2416` pattern.
- No `components/tools/NetSheet.tsx`, `PreListingChecklist.tsx`, `OfferStrategyAdvisor.tsx`, `BuyerPersona.tsx` — all four missing.
- No tilt-on-hover primitive wired (blueprint requires C2 application).

## Surprises
- Both pages are skeletons with `h1` + card grids but no functional generators — they're routes with UI but the "tools" don't do work yet. Brief assigns full build-out to A13.

## Severity
Medium-High. Two twinned surfaces sharing violations + missing feature bodies. Build is mostly net-new components rather than cleanup.
