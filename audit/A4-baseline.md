# A4 — Contracts cluster baseline (2026-04-14)

Routes: `/aire/contracts` (B+), `/aire/contracts/new` (B−, ContractForm.tsx).

## Current state
Both auth-gated. `ContractForm.tsx` exists with NL input, form-type select, txn picker, preview. `PdfPreview.tsx` and `ClauseLibraryDrawer.tsx` do not exist.

## A-grade criteria (from brief)
- Live PDF preview pane, rerenders ≤1s debounced.
- Clause library drawer with drag-and-drop.
- Voice dictation stub (wires to C3).
- `bg-white` form inputs → `bg-surface-elevated-daylight` (F1 token migration).
- Cream canvas when PDF active; IBM Plex Mono for field values; Cormorant section titles.
- Generate button uses GlossyToggle (C6).
- Env vars: `BLOB_READ_WRITE_TOKEN`, `RESEND_API_KEY`, `ANTHROPIC_API_KEY`.

## Violations observed
- No `PdfPreview.tsx` or `ClauseLibraryDrawer.tsx` in `components/contracts/` — confirmed absent.
- F1 input-color violation not verified (need to grep inside `ContractForm.tsx`); NL form likely inherits `bg-white` pattern from peer pages.
- No `iframe` or pdf-lib preview component wired in the form.
- Fillable LREC PDFs: open question per brief; generator still builds from scratch in `lib/document-generator.ts`.

## Surprises
- Contract list page already at B+ per blueprint — among the less-bad authenticated surfaces.
- `aire-assistant-tcs-flagship/app/aire/contracts/` mirrors — two contract trees exist.

## Severity
Medium-High. The Writer is "B−" — lowest in cluster. Missing preview pane is the headline UX gap; clause library is net-new but not critical-path.
