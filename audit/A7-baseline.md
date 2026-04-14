# A7 — Relationships cluster baseline (2026-04-14)

Route: `/aire/relationships` (B−).

## Current state
Auth-gated. `app/aire/relationships/page.tsx` is extensively tabular with `bg-white` cards + `[#d4c8b8]` border (warm parchment, not on-palette).

## A-grade criteria (from brief)
- Editorial cards (not tabular); IBM Plex Mono score 32px on card corner.
- Constellation graph (force-directed); card hover tilt (C2); mobile collapses to list.
- Birthday/anniversary autopilot queue (14d ahead) with draft-send buttons.
- Palette: Nocturne; hit list shows top-10 contacts + score + last-contact + next-action.
- Env vars: `RESEND_API_KEY`, `TWILIO_*`, optional `OPENAI_API_KEY`.

## Violations observed
- `app/aire/relationships/page.tsx:105,109,113,117,121,125,134,149,222` — 9+ `bg-white` cards (F1 violation).
- `app/aire/relationships/page.tsx:252` — double-class collision: `bg-[#f5f2ea] bg-white border border-[#d4c8b8]/60/50` — malformed Tailwind (typo `/60/50`) plus override conflict.
- `app/aire/relationships/new/ContactForm.tsx` — `transition-all`.
- `components/relationships/ContactImporter.tsx` — brief flags bg-white fix; assumed present.
- No `ConstellationGraph.tsx` or `BirthdayAutopilot.tsx`.

## Surprises
- The `/60/50` opacity typo on line 252 means that class is silently dropped by Tailwind JIT — so the card has no border at that spot. Live visual bug hiding in static.
- Page is entirely Daylight-ish surface; blueprint says Nocturne.

## Severity
High. Strongest palette divergence on any authenticated page short of Data Health; plus the malformed class. Needs full redesign, not tweak.
