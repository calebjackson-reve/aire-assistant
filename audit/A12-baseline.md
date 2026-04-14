# A12 — Documents + Research + MLS cluster baseline (2026-04-14)

Routes: `/aire/documents` (C+), `/aire/research` (B−), `/aire/mls-input` (B).

## Current state
All auth-gated. Documents page uses `bg-white` + legacy border palette + Playfair hard-coded.

## A-grade criteria (from brief)
- Documents: drop-zone hero, library below, per-doc confidence badges, re-extract button, document DNA heatmap.
- Research: theme-aware (no hard-coded `#1e2416`); research canvas mode with source trust scores.
- MLS Input: Cormorant not Playfair; structured preview before submit; photo-URL scraping.
- Cormorant italic doc types; IBM Plex Mono confidence %.

## Violations observed
- `app/aire/documents/page.tsx:150` — `fontFamily: "'Playfair Display', serif"` (F3 violation).
- `app/aire/documents/page.tsx:8` — contains 8 `bg-white` occurrences (grep count).
- `app/aire/documents/upload/DocumentUploader.tsx` — `transition-all`.
- `app/aire/research/page.tsx` — uses `bg-zinc|text-zinc` classes (in grep families); no theme-token usage, hard-coded colors.
- `app/aire/mls-input/MLSAutoFillWizard.tsx` — `transition-all` and `bg-gray/text-gray/bg-zinc/text-zinc` tokens.
- No document DNA / confidence-heatmap components.

## Surprises
- MLS Input page has a wizard, but fonts and surface tokens are hard-coded (not CSS-var-driven per F2 bootstrap).

## Severity
High. Documents is C+ in blueprint; most visible + daily surface of the trio. Research has F2 theme-var debt that breaks any future Daylight/Nocturne switching.
