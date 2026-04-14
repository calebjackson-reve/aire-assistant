# A3 — Transaction Detail cluster baseline (2026-04-14)

Route: `/aire/transactions/[id]` (A−).

## Current state
Auth-gated. `components/tc/TransactionDetail.tsx` and `TransactionTimeline.tsx` exist; per blueprint already at A−. Dummy `/aire/transactions/demo` redirects to sign-in (cannot verify runtime tabs without auth).

## A-grade criteria (from brief)
- Sticky tab strip with 5 progress dots per deal phase.
- Deal DNA strip: timeline of every touchpoint as colored pulse (email olive, sms sage, doc cream, deadline brass).
- AI co-pilot drawer (right rail, pre-loaded deal context; needs `ANTHROPIC_API_KEY`).
- Party risk/freshness scores on each buyer/seller.
- Mobile: sticky bottom tab strip.
- Tab switch `opacity 240ms` only (no slide).

## Violations observed
- `components/tc/CopilotDrawer.tsx` — does not exist; copilot functionality absent.
- No Deal DNA pulse layer in `TransactionTimeline.tsx` (existing timeline is list-oriented, not pulse-strip per spec).
- No progress-dot phase indicator in tab strip (cannot verify further without auth; but grepping `TransactionDetail.tsx` yields no "phase" / "progress-dot" marker).
- Party freshness scoring not present in transaction-fetch query.

## Surprises
- `aire-assistant-tcs-flagship/components/tc/TransactionDetail.tsx` exists as a divergent twin — pick-one-and-delete.
- Blueprint says baseline is A−, closest-to-done of authenticated surfaces.

## Severity
Medium. Existing page is solid; the A-grade ask is three additive features (progress dots, DNA strip, copilot drawer) plus a scoring backend tweak. No offensive code debt.
