# AIRE Assistant — Project Instructions

## Stack
Next.js 16, React 19, Prisma 6.19, Neon PostgreSQL, Clerk auth, Stripe billing, Vercel, Twilio
Schema source of truth: `prisma/schema.prisma` — never duplicate schemas elsewhere.

## Build Status

| System | Status | Key Files |
|--------|--------|-----------|
| Document Pipeline (classify, extract, memory) | COMPLETE | `lib/document-classifier.ts`, `lib/document-extractor.ts`, `lib/document-memory.ts`, `lib/multi-pass-extractor.ts` |
| Email Intelligence (Agent 1) | COMPLETE | `lib/agents/email-scanner.ts`, email schema models |
| Voice Commands v1 | COMPLETE | `app/api/voice-command/route.ts`, `components/VoiceCommandBar.tsx` |
| Voice Pipeline v2 (Optimized) | COMPLETE | `lib/voice-pipeline.ts`, `app/api/voice-command/v2/route.ts` |
| Voice Streaming (SSE) | COMPLETE | `app/api/voice-command/v2/stream/route.ts`, VoiceCommandBar SSE consumer |
| Voice Analytics Dashboard | COMPLETE | `app/aire/voice-analytics/page.tsx`, `app/api/voice-command/analytics/route.ts` |
| Voice Action Execution | COMPLETE | `lib/voice-action-executor.ts`, `app/api/voice-command/execute/route.ts` |
| Compliance & LA Rules | COMPLETE | `app/api/compliance/scan/route.ts`, `lib/louisiana-rules-engine.ts` |
| Morning Brief (Agent 3) | COMPLETE | `app/api/cron/morning-brief/route.ts`, `lib/agents/morning-brief/` |
| Relationship Intelligence | COMPLETE | `lib/agents/relationship-intelligence.ts`, `app/api/cron/relationship-intelligence/route.ts` |
| Workflow State Machine | COMPLETE | `lib/workflow/state-machine.ts` |
| AirSign Layer 1 (CRUD+Signing) | COMPLETE | `lib/airsign/seal-pdf.ts`, `app/api/airsign/`, `app/sign/[token]/` |
| AirSign Layer 2 (Field Placement+Email) | COMPLETE | `components/airsign/FieldPlacer.tsx`, Resend in send route |
| AirSign Layer 3 (Signature Capture+Seal) | COMPLETE | `components/airsign/SignatureModal.tsx`, image embed in seal-pdf |
| Document Auto-Filing | COMPLETE | `lib/document-autofiler.ts` |
| TC Transaction CRUD | COMPLETE | `app/api/transactions/[id]/route.ts` (GET/PATCH/DELETE) |
| TC Deadline Management | COMPLETE | `app/api/transactions/[id]/deadlines/route.ts` |
| TC Dashboard Pages | COMPLETE | `app/aire/transactions/page.tsx`, `app/aire/transactions/[id]/page.tsx` |
| TC Transaction Detail UI | COMPLETE | `components/tc/TransactionDetail.tsx`, `components/tc/TransactionTimeline.tsx` |
| TC Party Communications | COMPLETE | `lib/tc/party-communications.ts`, `app/api/tc/send-update/route.ts` |
| TC Vendor Scheduling | COMPLETE | `lib/tc/vendor-scheduler.ts`, `app/api/tc/schedule-vendor/route.ts` |
| TC Notifications (email+SMS) | COMPLETE | `lib/tc/notifications.ts` |
| TC Morning Brief | COMPLETE | `lib/tc/morning-brief.ts`, `app/api/tc/morning-brief/route.ts` |
| TC Automation Cron | COMPLETE | `app/api/cron/tc-reminders/route.ts` |
| Document Generation (LREC forms) | COMPLETE | `lib/document-generator.ts`, `app/api/documents/generate/route.ts` |
| Contract Writing Engine | COMPLETE | `lib/contracts/` (lrec-fields, clause-library, contract-writer) |
| Contract API | COMPLETE | `app/api/contracts/write/route.ts` (NL + structured → PDF) |
| Voice → Contract Pipeline | COMPLETE | `write_contract` intent in voice executor + v2 pipeline |
| Data Layer (Intelligence Merge) | COMPLETE | `lib/data/` (6 engines, DB queries, cache, sync), `app/api/data/` (8 routes) |
| Data Sync Cron | COMPLETE | `app/api/cron/data-sync/route.ts`, `lib/data/sync/` |
| Intelligence CMA API | COMPLETE | `app/api/intelligence/cma/route.ts` (ensemble + PPS + neighborhood) |
| Intelligence Tables (Neon) | COMPLETE | 7 tables created: properties_clean, market_snapshots, aire_scores, job_runs, error_logs, raw_imports, backtest_results |
| Data Import API | COMPLETE | `app/api/data/import/route.ts` (MLS + PropStream JSON import) |
| Backtest Engine | COMPLETE | `lib/data/engines/backtest.ts`, `app/api/data/backtest/route.ts` |
| Data Health Dashboard | COMPLETE | `app/aire/data-health/page.tsx`, `app/api/data/health/tables/route.ts` |
| Morning Brief Market Data | COMPLETE | `lib/agents/morning-brief/researchers/market-researcher.ts` wired into cron |
| Morning Brief Intelligence Layer | COMPLETE | Pipeline deals enriched with AIRE scores; market researcher pulls scoring health + low-confidence flags; synthesis prompt includes intelligence insights |
| Intelligence Admin Dashboard | COMPLETE | `app/aire/intelligence/ScoredPropertiesTable.tsx`, `app/api/data/admin/route.ts` — browse/search/filter scored properties by confidence tier |
| Monitoring Dashboard | COMPLETE | `app/aire/monitoring/page.tsx`, `app/api/monitoring/`, `lib/monitoring/` |
| Monitoring History View | COMPLETE | `app/aire/monitoring/history/page.tsx` |
| Communication Monitor | COMPLETE | `lib/comms/` (gmail, sms, calls, response detection, draft replies) |
| Comms Morning Brief Researcher | COMPLETE | `lib/agents/morning-brief/researchers/comms-researcher.ts` |
| Comms Scan Cron (30min) | COMPLETE | `app/api/cron/comms-scan/route.ts` |
| Cron Registry (vercel.json) | COMPLETE | 8 crons: morning-brief, deadline-alerts, rel-intel, email-scan, data-sync, tc-reminders, comms-scan |
| Email Triage API | COMPLETE | `app/api/email/triage/`, `draft-reply/`, `handle/`, `scan-now/` |
| Email Triage UI | COMPLETE | `app/aire/email/EmailDashboard.tsx` (missed calls, needs response, draft reply, handled) |
| Email Settings Page | COMPLETE | `app/aire/settings/email/page.tsx` (connected accounts, connect Gmail) |
| TC Full UI (Dashboard→Detail flow) | COMPLETE | Dashboard with pipeline value, search/filter list, tabbed detail (overview/deadlines/docs/comms/contracts), nav badges |
| Transaction Search + Filter | COMPLETE | `app/aire/transactions/TransactionList.tsx` (client-side search, status filter, sort by closing/price/recent) |
| Transaction Comms Tab | COMPLETE | Quick-send templates (Offer Accepted, Inspection, Closing, Update) calling `/api/tc/send-update` |
| Contract Writer UI | COMPLETE | `app/aire/contracts/new/ContractForm.tsx` (NL input, form type, txn picker, field preview, Generate & Send for Signatures) |
| Contract List Page | COMPLETE | `app/aire/contracts/page.tsx` (generated docs with status badges) |
| Morning Brief Viewer | COMPLETE | `app/aire/morning-brief/page.tsx` (deadlines, pipeline, contacts, actions, approval) |
| Nav Badge Counts | COMPLETE | `app/aire/layout.tsx` passes active/overdue counts to `DarkLayout` sidebar |
| Billing Flow (Stripe) | COMPLETE | `app/billing/page.tsx` (on-brand, $97/$197 pricing), `app/api/billing/checkout/`, webhook sets tier on checkout |
| Document Upload UI | COMPLETE | `app/api/documents/upload/route.ts` (Blob + classify + workflow), upload button in TransactionDetail Documents tab |
| Settings Page | COMPLETE | `app/aire/settings/page.tsx` (email config + billing links), nav link added |

## DO NOT REBUILD
- Document classifier, extractor, memory, multi-pass pipeline
- Morning Brief (researchers, QA validator, synthesis, approval gate)
- Relationship Intelligence (4-agent scoring, consensus, hit list)
- Compliance scan + Louisiana rules engine
- AirSign signing flow + seal-pdf
- Workflow state machine + WorkflowEvent logging
- Voice v1 route (kept for backward compat, v2 is the active endpoint)
- Monitoring system (dashboard, API, activity logger, history)
- Communication monitor (gmail scanner, sms scanner, response detector)

## What's Next
1. **Set Twilio credentials** — TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN (SMS notifications + comms scanner)
2. **Deploy and verify** — Push to Vercel, test billing checkout end-to-end with Stripe test mode
3. **Document extraction on upload** — Wire /api/documents/upload to run multi-pass extraction after blob upload

## Voice Pipeline Enhancement Backlog
1. ~~**Streaming classification**~~ DONE — SSE endpoint at `/api/voice-command/v2/stream`
2. **Whisper integration** — Replace browser Web Speech API with OpenAI Whisper for higher accuracy transcription, especially for Louisiana place names (Tchoupitoulas, Thibodaux, etc.).
3. ~~**Multi-turn conversation**~~ DONE — Implicit entity resolution from last command's transaction; Claude prompt includes multi-turn instructions
4. **Voice-triggered AirSign** — "Send the purchase agreement to John Smith for signature" → auto-creates AirSign envelope with document + signer.
5. ~~**Offline fast-path expansion**~~ DONE — 28 regex patterns across 9 intents (was 6 patterns). Covers pipeline, deadlines, transactions, contracts, compliance, status updates, market analysis, parties, ROI.

## Agent Integration Contracts
- **After classifying a document:** call `onDocumentUploaded(transactionId, docType, userId)` from `lib/workflow/state-machine.ts`
- **After voice command status update:** call `advanceTransaction({...trigger: "voice_command"})` from `lib/workflow/state-machine.ts`
- **After AirSign envelope completed:** webhook fires at `/api/airsign/webhook` → creates Document + advances workflow

## Contract Writing Engine Enhancement Backlog
1. **Fillable PDF templates** — Fill actual LREC PDF forms (AcroForm) instead of generating from scratch. Requires obtaining official LREC fillable PDFs.
2. **Parish records API** — Auto-pull legal descriptions (lot/block/subdivision) from parish assessor websites. East Baton Rouge, Ascension, Livingston priority.
3. **Counter-offer generation** — "Counter at $195K with 10-day inspection" → generates counter-offer addendum referencing original PA.
4. **Clause negotiation AI** — "Make the inspection clause stronger" → rewrites clause with buyer-favorable language.
5. **Contract comparison** — Compare two versions of a contract and highlight changes (redline mode).

## AIRE Pages (26 total)
/aire — Dashboard (pipeline value header, morning brief, active txns, stats, 4 quick actions incl Run Compliance)
/aire/transactions — Transaction list (search by address/buyer/seller/MLS, filter by status, sort by closing/price/recent)
/aire/transactions/new — Create transaction form (full fields: property, prices, parties, dates)
/aire/transactions/[id] — Transaction detail (5 tabs: Overview, Deadlines grouped by urgency with Complete buttons, Documents, Communications with quick-send templates, Contracts with generate link)
/aire/contracts — Contract list
/aire/contracts/new — Contract writer (NL input, form selector, preview, generate)
/aire/morning-brief — Morning brief viewer
/aire/compliance — Compliance scanner
/aire/communications — Communications
/aire/relationships — Relationship intelligence
/aire/email — Email intelligence
/aire/monitoring — Agent monitoring dashboard (real-time, auto-refresh)
/aire/monitoring/history — Build history timeline
/aire/intelligence — Market intelligence + scored properties admin table
/aire/voice-analytics — Voice pipeline timing, intent distribution, fast-path rate
/aire/settings — Settings hub (email accounts, billing link)
/aire/settings/email — Gmail connection + email triage settings
/airsign — Envelope dashboard
/airsign/new — Create envelope
/airsign/[id] — Envelope detail (field placement, signers, audit, sealed PDF)
/sign/[token] — Public signing page (signature modal, draw/type)

## TC UI Gap Analysis (2026-04-04)
### What works end-to-end in the UI today:
- Dashboard → see all active transactions, pipeline value, overdue count, morning brief link
- Transaction list → search, filter by status, sort, click into any deal
- Transaction detail → tabbed view with Overview (deal info + parties), Deadlines (grouped by urgency, one-click complete), Documents, Communications (quick-send templates), Contracts
- Create transaction → full form with all fields, redirect to detail on success
- Write contract → NL input, form type, transaction picker, field preview, generate PDF, send for signatures via AirSign
- Morning brief → full daily brief with deadlines, pipeline, contacts, action items, approve/dismiss
- Navigation → sidebar with badge counts for active transactions and overdue deadlines

### What would NOT work for a real user:
1. **Communications require RESEND_API_KEY** — Quick-send templates call `/api/tc/send-update` but emails fall back to console.log without the env var. SMS needs Twilio credentials.
2. **Document upload in transaction detail** — No upload button in the Documents tab yet. Documents are created via API/AirSign webhook but no drag-and-drop UI.
3. **Contract "Send for Signatures" needs BLOB_READ_WRITE_TOKEN** — The PDF is generated and can be downloaded, but AirSign envelope creation needs blob storage for the PDF file.

## Agent 2 Gap Analysis (2026-04-04)
### Top 3 things a user would hit today that would NOT work:
1. **PDF download from contracts** — `/api/contracts/write` returns base64 PDF, but no persistent URL. Without `BLOB_READ_WRITE_TOKEN`, generated contracts can only be downloaded in-session (no reload persistence). Fix: set env var or add local file storage fallback.
2. **AirSign emails won't send** — `RESEND_API_KEY` is not set. Signing invitation emails fall back to console.log. Signers can only get their links via the "Copy signing link" button in the envelope detail page.
3. **Vendor list is hardcoded** — `lib/tc/vendor-scheduler.ts` has placeholder vendor entries with empty phone/email. Needs Agent 1 to add a Vendor model to Prisma, or Caleb to populate the JSON vendor list with real Baton Rouge vendors.

### Working end-to-end today (no env vars needed):
- Transaction CRUD (create, list, detail, update, delete)
- Contract writing from natural language → PDF download
- Deadline auto-calculation from contract dates
- Workflow state machine (advance, history, auto-advance on doc upload)
- Voice command classification + execution (via `/api/voice-command/v2`)
- Document classification + extraction
- Compliance scanning with Louisiana rules engine
- Morning brief generation

## AirSign Completion Audit (2026-04-04)

**Status: Production-ready pending env vars.**

### AirSign Routes (12 total):
- Pages: `/airsign` (dashboard), `/airsign/new` (create), `/airsign/[id]` (detail+field placement), `/sign/[token]` (public signing)
- APIs: `envelopes` (CRUD), `envelopes/[id]` (detail), `envelopes/[id]/fields` (field placement), `envelopes/[id]/send` (email delivery), `sign/[token]` (signer auth+submit), `upload` (PDF upload), `webhook` (completion handler)

### E2E Test: 7/7 pass (scripts/test-airsign-flow.ts)
- Envelope CRUD, signer tokens, field placement, signing simulation, PDF sealing, audit events

### Fixes Applied:
1. **Mobile signing** — Added touch event handlers (onTouchStart/Move/End) to SignatureModal canvas + DPI-corrected coordinate mapping
2. **Webhook reliability** — Each step (document creation, workflow advance, notifications) now has independent try/catch so one failure doesn't block others
3. **PDF seal encoding** — Replaced Unicode checkmark (✓) with ASCII "X" to avoid WinAnsi encoding error in pdf-lib

### What Works Without Any Env Vars:
- Create envelope, upload PDF, place fields, add signers
- Send envelope (emails logged to console with full signing URLs)
- Signers can open `/sign/[token]`, view PDF, fill fields, sign with draw or type
- Smart field auto-placement for LREC forms
- Copy signing link button for manual sharing
- Sealed PDF generation with audit certificate page
- Webhook fires on completion → creates Document record, advances workflow

### Blockers (env vars needed for full production):
- All env vars now set (see below)

## Env Vars (All Set as of 2026-04-06)
All env vars are configured in `.env.local`. No missing vars.
- `DATABASE_URL` — Neon PostgreSQL (host: ep-muddy-cherry-am44pnvo-pooler, updated 2026-04-06)
- `ANTHROPIC_API_KEY`, `CLERK_SECRET_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`, `BLOB_READ_WRITE_TOKEN`, `AIRSIGN_INTERNAL_SECRET`, `AIRE_WEBHOOK_SECRET`
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

## TypeScript Fixes (2026-04-06)
- `app/airsign/page.tsx:23` — Added `DECLINED: 0` to EnvelopeStatus counts object (missing enum variant)
- `app/components/layout/Navbar.tsx:68` — Removed `afterSignOutUrl` prop from `<UserButton />` (deprecated in Clerk v7)
- `tsc --noEmit` returns 0 errors, `next build` passes clean
