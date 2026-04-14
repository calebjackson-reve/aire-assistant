---
name: write-contract
description: Generate a Louisiana LREC contract (purchase agreement, counter-offer, addendum, disclosure) from natural language or structured fields. Optionally route the finished PDF through AirSign for signature. Use when the user says "write a contract", "draft the PA", "generate a counter at $X", or any LREC form name.
type: action
surface: mcp:write-contract
triggers:
  - "write a contract"
  - "draft the PA"
  - "draft a purchase agreement"
  - "generate a counter"
  - "write an addendum"
  - "LREC"
requiresConfirmation: true
---

# write-contract

Wraps `/api/contracts/write` (the LREC contract writing engine). Accepts either
plain-English instructions or a structured `fields` object; the engine resolves
the form, fills every known field from the linked transaction, flags missing
ones, and returns a PDF.

## When to use

Use for first-draft generation of any LREC form. Do **not** use for amending
a contract already out for signature — that is a job for `send-envelope` + a
new envelope, or for manual review.

## Inputs

- `naturalLanguage` — free-form instructions (e.g. "counter at $195K, 10-day
  inspection, seller pays $3K in closing")
- `formType` — LREC form key (e.g. `PURCHASE_AGREEMENT`, `COUNTER_OFFER`,
  `ADDENDUM`)
- `transactionId` — auto-fills parties, price, dates, parcel info
- `fields` — explicit field overrides
- `sendForSignature` — if true, wraps the generated PDF in an AirSign envelope
  with default field placement

## Guardrails

- **Confirm the final PDF preview before Caleb signs anything.** This is the
  single highest-risk action in the registry — a bad contract goes to clients.
- Louisiana-specific: never skip Residential Property Disclosure, Lead Paint
  (homes pre-1978), or Sewer/Water disclosures. The engine enforces this; do
  not work around it.
- If `BLOB_READ_WRITE_TOKEN` is missing, the route returns the PDF as base64
  only — surface a download link rather than auto-sending.

## Related

- `send-envelope` — follow-up when `sendForSignature: false` and Caleb wants to
  send after reviewing.
- `scan-compliance` — run the Louisiana rules engine against the draft before
  sending.
