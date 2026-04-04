# AIRE Current Platform State
*Update this file after every deploy*

## LIVE ✅
- aireintel.org/ — V2 dark homepage
- aireintel.org/demo — TC demo with fake transactions
- aireintel.org/sign-in and /sign-up — Clerk auth working
- aireintel.org/billing — NEXT_PUBLIC_ Stripe price IDs added to Vercel, redeployed 2026-03-29
- aireintel.org/content — page compiles
- aireintel.org/dashboard/transactions — page compiles
- aireintel.org/documents/review — page compiles
- /api/voice-command — route exists (broken against real data — uses wrong prisma.user pattern)
- /api/content/generate-post — route compiles
- /api/cron/deadline-alerts — cron compiles
- /api/cron/relationship-intelligence — cron compiles
- /api/transactions — route compiles
- LREC form classification — 95% accuracy
- VoiceCommand table — confirmed in Neon DB
- Prisma Agent record — Caleb Jackson, PRO tier, confirmed in DB
- aireintel.org/aire — dashboard deployed (dynamic, auth-gated)
- aireintel.org/aire/relationships — deployed (dynamic, auth-gated)
- aireintel.org/airsign — real envelope dashboard querying AirSignEnvelope table, deployed 2026-03-29
- AirSign Prisma schema — AirSignEnvelope, AirSignSigner, AirSignField, AirSignAuditEvent tables live in Neon
- components/airsign/PDFViewer.tsx — PDF.js canvas renderer
- components/airsign/FieldOverlay.tsx — colored field rectangles on PDF
- aireintel.org/aire/morning-brief — Morning Brief Agent deployed 2026-03-29
- /api/cron/morning-brief — daily cron (6:30 AM), 3 parallel researchers + QA + Claude synthesis
- /api/morning-brief/action — approve/dismiss API for human approval gate

## BROKEN 🔴
- /aire/transactions — not built yet
- /aire/morning-brief — not built yet
- /airsign/new — not built yet
- /sign/[token] — signer portal not built yet
- /api/voice-command — compiles but broken (prisma.user instead of prisma.agent)
- /billing — verify checkout flow works in browser (env vars now set)

## NOT BUILT YET 🔲
- Email Scan Agent (/api/cron/email-scan)
- Morning Brief manual trigger test (hit /api/cron/morning-brief to confirm end-to-end) (/api/cron/morning-brief)
- Content Agent (scheduling + publishing)
- Intelligence Agent (CMA engine)
- Compliance Agent
- AirSign /airsign/new — create envelope page
- AirSign /airsign/[id] — envelope detail page with PDFViewer + FieldOverlay
- AirSign Layer 2 — signature capture
- AirSign Layer 3 — routing + email/SMS delivery
- AirSign Layer 4 — legal seal + audit certificate
- AirSign /sign/[token] — public signer portal
- Dotloop API integration
- Gmail OAuth for email scanning

## NEXT PRIORITY (in order)
1. Verify /billing checkout works in browser
4. Fix voice pipeline — run /build-agent voice after reading aire-voice-audit skill
5. Build AirSign Layer 1 — airsign-document-engine skill
