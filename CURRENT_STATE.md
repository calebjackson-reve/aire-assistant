# AIRE Current Platform State
*Update this file after every deploy*

## LIVE ✅
- aireintel.org/ — V2 dark homepage with video hero, tool showcase, founder bio
- aireintel.org/sign-in and /sign-up — Clerk auth working
- aireintel.org/billing — Stripe price IDs set, checkout page deployed
- aireintel.org/aire — Dashboard (pipeline value, stats, morning brief, quick actions)
- aireintel.org/aire/transactions — Transaction list (search, filter, sort)
- aireintel.org/aire/transactions/new — Create transaction form
- aireintel.org/aire/transactions/[id] — Transaction detail (5 tabs: Overview, Deadlines, Documents, Comms, Contracts)
- aireintel.org/aire/contracts — Contract list + `/contracts/new` writer
- aireintel.org/aire/morning-brief — Daily brief viewer with approval gate
- aireintel.org/aire/compliance — Compliance scanner
- aireintel.org/aire/relationships — Relationship intelligence
- aireintel.org/aire/communications — Communications hub
- aireintel.org/aire/email — Email triage dashboard (missed calls, needs response, draft reply)
- aireintel.org/aire/intelligence — Market intelligence + scored properties admin table
- aireintel.org/aire/monitoring — Agent monitoring (real-time, auto-refresh)
- aireintel.org/aire/monitoring/history — Build history timeline
- aireintel.org/aire/data-health — Data health monitor (table counts, cache stats)
- aireintel.org/aire/voice-analytics — Voice pipeline analytics (timing, intents, fast-path)
- aireintel.org/airsign — Envelope dashboard
- aireintel.org/airsign/new — Create envelope
- aireintel.org/airsign/[id] — Envelope detail (signers, fields, audit log)
- aireintel.org/sign/[token] — Public signing portal (signature modal, draw/type)
- aireintel.org/aire/onboarding — 7-step onboarding checklist
- aireintel.org/aire/settings/email — Email settings (connected accounts)
- /api/voice-command/v2 — Optimized voice pipeline (classify + execute)
- /api/voice-command/v2/stream — SSE streaming voice responses
- /api/voice-command/execute — Voice action execution
- /api/contracts/write — NL + structured → PDF generation
- /api/documents/extract — Full extraction pipeline
- /api/compliance/scan — Louisiana rules engine
- /api/cron/morning-brief — Daily 6:30 AM (5 researchers + QA + Claude synthesis)
- /api/cron/deadline-alerts, tc-reminders, email-scan, data-sync, comms-scan, relationship-intelligence — 8 crons total
- AirSign Prisma schema — AirSignEnvelope, AirSignSigner, AirSignField, AirSignAuditEvent
- Stripe Subscription Gates — 13 features, 3 tiers (FREE/PRO/INVESTOR), 10 gated API routes
- LREC form classification — 95% accuracy
- VoiceCommand, MorningBrief, Contact, Transaction tables confirmed in Neon

## NEEDS VERIFICATION 🟡
- /billing — checkout flow needs browser test (env vars set but untested)
- Communications quick-send — emails fall back to console.log without RESEND_API_KEY
- AirSign email delivery — console.log fallback without RESEND_API_KEY

## NOT BUILT YET 🔲
- Content Agent (autonomous scheduling + publishing — only manual slide generator exists)
- Dotloop API integration (needs account credentials)
- Gmail OAuth completion (stubs exist, full redirect/token flow incomplete)

## ENV VARS NEEDED
- `BLOB_READ_WRITE_TOKEN` — AirSign PDF upload/seal + contract storage
- `RESEND_API_KEY` — AirSign signing emails + TC party communications
- `AIRSIGN_INTERNAL_SECRET` — internal AirSign webhook auth
- `AIRE_WEBHOOK_SECRET` — webhook verification

## BUILD HISTORY
- 2026-03-29: Initial deploy — homepage, auth, billing, AirSign dashboard, Morning Brief
- 2026-04-04 (multi-agent): Document pipeline, TC CRUD, AirSign Layer 1-3, Voice pipeline, Compliance, Contracts, Data layer, Monitoring, Comms monitor, Onboarding, Subscription gates
- 2026-04-04 (continued): Morning Brief intelligence wiring, Intelligence admin table, Voice SSE streaming, Voice analytics dashboard
