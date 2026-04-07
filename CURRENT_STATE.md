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

## VERIFIED WORKING ✅ (2026-04-06)
- AirSign email delivery — Resend sends branded "Signature Requested" emails to signers
- AirSign signing flow — upload, place fields, send, sign on mobile, audit trail
- Neon DB connected (ep-muddy-cherry-am44pnvo-pooler), Prisma synced, user seeded
- All env vars configured in .env.local (Anthropic, Stripe, Resend, Blob, Twilio, Google OAuth, Clerk)
- Sign-in page branded, OAuth reduced to 6 providers
- Voice command overlay wired to /api/voice-command/v2 with browser TTS

## NEEDS ATTENTION 🟡
- Brief page design quality doesn't match AirSign — needs full redesign
- Document classifier returns "unknown" for some LREC filenames — fallback added, needs testing
- Duplicate document detection added but not yet shown in UI (warnings in API response only)
- Address mismatch warning added but not yet shown in UI
- /billing checkout — Stripe keys set but end-to-end checkout not browser-tested
- Gmail OAuth — stubs exist, full token flow incomplete
- Signing page UX — signer sees agent's field placer UI, needs simplified "fill and sign" view

## NOT BUILT YET 🔲
- Document folder system (Dotloop-style categories per transaction)
- TC checklist UI (task list with completion tracking)
- Brief page redesign (match AirSign quality)
- Calendar integration (Google Calendar API)
- Content Agent (autonomous scheduling + publishing)
- Google Contacts import (vCard route exists, needs UI)
- Whisper integration (route built, needs OPENAI_API_KEY)
- MLS address autocomplete (routes built, needs MLS API key from broker)

## NEXT PRIORITY
1. Wire MLS API key from broker meeting (2026-04-07)
2. Redesign Brief page to match AirSign quality
3. Build document folder system with TC checklist per transaction
4. Test billing checkout end-to-end
5. Complete Gmail OAuth flow

## ENV VARS (All Set)
All configured in .env.local — DATABASE_URL, ANTHROPIC_API_KEY, CLERK_SECRET_KEY, STRIPE_SECRET_KEY, RESEND_API_KEY, BLOB_READ_WRITE_TOKEN, TWILIO_*, GOOGLE_CLIENT_ID/SECRET, AIRSIGN_INTERNAL_SECRET, AIRE_WEBHOOK_SECRET

## BUILD HISTORY
- 2026-03-29: Initial deploy — homepage, auth, billing, AirSign dashboard, Morning Brief
- 2026-04-04 (multi-agent): Document pipeline, TC CRUD, AirSign Layer 1-3, Voice pipeline, Compliance, Contracts, Data layer, Monitoring, Comms monitor, Onboarding, Subscription gates
- 2026-04-04 (continued): Morning Brief intelligence wiring, Intelligence admin table, Voice SSE streaming, Voice analytics dashboard
- 2026-04-06: Full audit + voice command system + AirSign upgrades + transaction wizard + contract auto-fill + document intelligence + deploy to aireintel.org
