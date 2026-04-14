# A6 — Compliance cluster baseline (2026-04-14)

Route: `/aire/compliance` (B).

## Current state
Auth-gated. `app/aire/compliance/page.tsx` exists; grep flagged `forest-deep` / `brown-border` / `copper` legacy tokens in this file. No `IssueCard.tsx`, `RuleExplainerPopover.tsx`, `ComplianceScoreChart.tsx`, or `/api/compliance/export` route.

## A-grade criteria (from brief)
- Each issue cites LREC rule with plain-English explainer popover on hover.
- "Fix in transaction" deep-links.
- Monthly score chart (IBM Plex Mono labels, sage area fill, 6-month trend).
- Audit-ready "Proof of Diligence" PDF export.
- Severity via `status-pending` + `status-overdue` tokens; Cormorant italic for rule numbers (§1503); Space Grotesk body.

## Violations observed
- `app/aire/compliance/page.tsx` — contains legacy `forest-deep` / `brown-border` / `copper` palette tokens (per brand-palette grep; F1 violation — they're in the "NEVER USE" list).
- No `components/compliance/IssueCard.tsx`, `RuleExplainerPopover.tsx`, `ComplianceScoreChart.tsx` — all missing.
- No `app/api/compliance/export/route.ts` — PDF export endpoint missing.
- Rule citation UX: cannot confirm plain-English popover; component absent.

## Surprises
- Rules engine backend (`lib/louisiana-rules-engine.ts`) is COMPLETE per project CLAUDE.md — so the data is already there; the UI is what's missing.

## Severity
High. "B" blueprint rating but the surface is entirely cards-of-text today with no issue hierarchy, no scoring trend, and uses banned tokens. Everything except the scanner backend is net-new.
