---
name: run-cma
description: Run a Comparative Market Analysis on a Louisiana property — ensemble pricing, price-per-square-foot band, neighborhood context, AIRE confidence score. Use when the user says "what's this house worth", "pull comps", "run a CMA", "price this listing", or names an address and expects a valuation.
type: read
surface: mcp:run-cma
triggers:
  - "run a CMA"
  - "run comps"
  - "what's it worth"
  - "price this listing"
  - "pull comps on"
  - "comparative market analysis"
requiresConfirmation: false
---

# run-cma

Wraps `/api/intelligence/cma`. Returns an ensemble estimate composed of:

1. Active MLS comps (Paragon / ROAM) within a user-controlled radius
2. PropStream + RPR sold comps with recency weighting
3. Neighborhood trend (median PPS, DOM, absorption) via the Intelligence layer
4. AIRE confidence tier (A–D) with low-confidence flags surfaced

## When to use

Any pricing question. Reads only — safe to auto-run without confirmation.

Prefer over `find-comps` until the `/api/data/comps` endpoint lands; `find-comps`
is currently a stub.

## Inputs

- `address` — required, any Louisiana-parseable address
- `radiusMiles` — default 0.5, max 10
- `lookbackMonths` — default 6, max 36
- `propertyType` — optional filter (single-family, condo, land)

## Guardrails

- MLS source-of-truth rule: never quote a CMA without naming the data sources
  (GBRAR MLS via Paragon, PropStream, RPR). The response includes these; pass
  them through when summarizing to Caleb.
- Low confidence (tier C/D) = surface the flags verbatim; never paper over
  thin comps.
- Louisiana-specific: flood zone + parish property-tax impact appear in the
  neighborhood block — include them when advising on pricing.

## Related

- `find-comps` — stub today; will return raw comp rows once implemented.
- `scan-compliance` — unrelated; do not chain unless the user asks.
- `write-contract` — a common follow-up is "…and draft a counter at that
  price" — prompt Caleb to confirm before jumping.
