# A8 — Comms cluster baseline (2026-04-14)

Routes: `/aire/email` (C, EmailDashboard.tsx) + `/aire/communications` (C+, CommunicationsHub.tsx).

## Current state
Both auth-gated; brief already rates these the two worst of the cluster ("C" and "C+").

## A-grade criteria (from brief)
- Token migration off `forest-deep` / `brown-border` / `copper` (F1).
- Unified feed: email + SMS + calls, channel glyphs sage/olive/brass.
- Draft reply uses last 3 thread exchanges for context; tone selector (warm/direct/legal) swaps in <1s.
- Undo toast (5s window) after send.
- Sentiment strip per party; optional call transcription.
- IBM Plex Mono timestamps; Cormorant italic subject lines.

## Violations observed
- `app/aire/email/EmailDashboard.tsx:117,131,191,244,285,379` — 6× `bg-white border border-[#d4c8b8]` cards (F1 violation; `[#d4c8b8]` not in palette).
- `app/aire/communications/CommunicationsHub.tsx` — contains legacy `forest-deep`/`brown-border`/`copper` tokens per grep.
- `app/aire/email/EmailDashboard.tsx` uses `bg-gray|text-gray|bg-zinc` (in count grep).
- No `SentimentStrip.tsx` or `ToneSelector.tsx` under `components/comms/`.
- No unified stream component — email and comms are separate routes without shared feed.

## Surprises
- Two parallel views for what's essentially one inbox. Brief intends unification; today it's split across two pages.

## Severity
Critical. Lowest grade in the product per blueprint. Both files need F1 token sweep + new components + backend context wiring. Biggest UX delta for daily driver.
