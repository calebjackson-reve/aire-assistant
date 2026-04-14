# A2 — Transactions cluster baseline (2026-04-14)

Routes: `/aire/transactions` (B), `/aire/transactions/new` (B), `/aire/tcs` (unaudited).

## Current state
All three auth-gated (redirect to `/sign-in`). `/aire/tcs` exists as a distinct path (not a redirect) — `app/aire/tcs/new/TCSWalkthrough.tsx` present.

## A-grade criteria (from brief)
- Attio-style dense typed table, sticky header, inline status cycling, row-level 14d sparkline.
- Keyboard nav (`j/k/enter//`); saved views URL+localStorage backed.
- Mobile card stack with swipe-to-action.
- New Transaction: voice-intake stub, LREC PA drop-zone, auto-populate from parish assessor lookup.
- Nocturne palette; IBM Plex Mono for prices/dates/MLS IDs.

## Violations observed
- `app/aire/transactions/new/TransactionWizard.tsx:10` — `transition-all`.
- `app/aire/tcs/new/TCSWalkthrough.tsx:232,625` — Playfair Display hard-coded (F3 violation; Cormorant is canonical).
- `components/transactions/RowSparkline.tsx` and `SavedViews.tsx` — do not exist; no row-density sparkline, no saved-views primitive.
- No evidence of keyboard nav hooks (`/`, `j/k`) in `TransactionList.tsx` (list exists but is not Attio-dense per blueprint B rating).

## Surprises
- `/aire/tcs` is a real surface with its own walkthrough (not a redirect) — blueprint §4.31 says "audit first, may be legacy." Confirm: it IS distinct.
- Legacy `app/dashboard/transactions/page.tsx` exists with `bg-white` + `transition-all` — orphaned duplicate that should die.

## Severity
High. Core agent workflow; list density + keyboard nav missing entirely and `/aire/tcs` is duplicate TC surface creating split-brain with `/aire/transactions`.
