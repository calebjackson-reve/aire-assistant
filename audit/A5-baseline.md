# A5 — AirSign cluster baseline (2026-04-14)

Routes: `/airsign` (B+), `/airsign/new` (B), `/airsign/[id]` (B+), `/sign/[token]` (B+, public).

## Current state
Three `/airsign/*` routes auth-gated. Public `/sign/[token]` attempted server render and returned 500 (Prisma build error — `./app/api/airsign/sign/[token]/route.ts` trace in dev server log).

## A-grade criteria (from brief)
- Dashboard: kanban with 5 status columns, drag-drop hits API, per-envelope progress bar.
- New: template library (LREC PA / LC / Addendum) + bulk-mode CSV.
- Detail: audit timeline with IBM Plex Mono timestamps, signer heatmap, chaining metadata.
- Public signing: mobile-first, 44px tap targets, DPI-correct canvas, Lighthouse a11y 95+.
- Cream canvas on public signing page; Nocturne elsewhere.
- Env vars: `BLOB_READ_WRITE_TOKEN`, `RESEND_API_KEY`, `AIRSIGN_INTERNAL_SECRET`.

## Violations observed
- `app/airsign/page.tsx:2` and `app/airsign/new/NewEnvelopeForm.tsx:2` — `transition-all`.
- `app/airsign/[id]/EnvelopeDetail.tsx` — contains `transition-all` + `bg-gray|text-gray|bg-zinc|text-zinc` tokens (from grep count row).
- `app/airsign/templates/TemplatesClient.tsx:6` — `transition-all`.
- `app/sign/[token]/SigningFlow.tsx` contains `transition-all` and gray/zinc classes.
- No kanban component (`page.tsx` uses counts object only; blueprint requires drag-and-drop status columns).
- No signer heatmap component under `components/airsign/`.

## Surprises
- `/sign/[token]` returns **500** in this environment because `./lib/prisma.ts` cannot resolve `@prisma/client` (Prisma not generated — OneDrive DLL lock blocker). Affects only dev build here, not production.
- `aire-assistant-tcs-flagship/app/airsign/...` duplicate tree present.

## Severity
High. Public signing page is the only public authenticated-adjacent flow and it's the runtime-blocker surface. Lots of grayscale tokens + `transition-all` across all four files.
