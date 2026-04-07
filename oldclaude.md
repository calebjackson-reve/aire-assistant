# AIRE Assistant — Project Instructions

## Stack
Next.js 16, React 19, Prisma 6.19, Neon PostgreSQL, Clerk auth, Stripe billing, Vercel, Twilio
Schema source of truth: `prisma/schema.prisma` — never duplicate schemas elsewhere.

## Build Status

| System | Status | Key Files |
|--------|--------|-----------|
| Document Pipeline (classify, extract, memory) | COMPLETE | `lib/document-classifier.ts`, `lib/document-extractor.ts`, `lib/document-memory.ts`, `lib/multi-pass-extractor.ts` |
| Email Intelligence (Agent 1) | COMPLETE | `lib/agents/email-scanner.ts`, email schema models |
| Voice Commands (Agent 2) | PHASES 1-3 DONE | `app/api/voice-command/route.ts`, `components/VoiceCommandBar.tsx` |
| Compliance & LA Rules | COMPLETE | `app/api/compliance/scan/route.ts`, `lib/louisiana-rules-engine.ts` |
| Morning Brief (Agent 3) | COMPLETE | `app/api/cron/morning-brief/route.ts`, `lib/agents/morning-brief/` |
| Relationship Intelligence | COMPLETE | `lib/agents/relationship-intelligence.ts`, `app/api/cron/relationship-intelligence/route.ts` |
| Workflow State Machine | COMPLETE | `lib/workflow/state-machine.ts` |
| AirSign Layer 1 | COMPLETE | `lib/airsign/seal-pdf.ts`, `app/api/airsign/`, `app/sign/[token]/` |
| Document Auto-Filing | COMPLETE | `lib/document-autofiler.ts`, wired into extract route |
| Upload UI Component | COMPLETE | `components/upload/DocumentUpload.tsx` |
| TC Notifications (email+SMS) | COMPLETE | `lib/tc/notifications.ts` |
| TC Morning Brief | COMPLETE | `lib/tc/morning-brief.ts`, `app/api/tc/morning-brief/route.ts` |
| TC Transaction CRUD | COMPLETE | `app/api/transactions/[id]/route.ts` (GET/PATCH/DELETE) |
| TC Deadline Management | COMPLETE | `app/api/transactions/[id]/deadlines/route.ts` (GET/POST complete) |
| TC Dashboard Pages | COMPLETE | `app/aire/transactions/page.tsx`, `app/aire/transactions/[id]/page.tsx` |
| TC Transaction Detail UI | COMPLETE | `components/tc/TransactionDetail.tsx` (deadlines, docs, workflow) |
| Document Generation (LREC forms) | COMPLETE | `lib/document-generator.ts`, `app/api/documents/generate/route.ts` |
| Voice Action Execution | COMPLETE | `lib/voice-action-executor.ts`, `app/api/voice-command/execute/route.ts` |
| Document Dashboard | COMPLETE | `app/aire/documents/page.tsx`, `app/api/documents/route.ts`, `app/api/documents/bulk/route.ts` |
| Document Viewer + Corrections | COMPLETE | `components/upload/DocumentViewer.tsx`, `app/api/documents/[id]/correct/route.ts` |
| Document Checklist | COMPLETE | `lib/extraction/checklist-generator.ts`, `app/api/documents/checklist/[transactionId]/route.ts` |
| Batch Upload | COMPLETE | `components/upload/BatchUpload.tsx` (multi-file, 5 concurrent) |
| Email Attachment Scanner | COMPLETE | `app/api/documents/scan-email/route.ts` (Gmail API + auto-classify + auto-file) |
| Data Layer (Intelligence Merge) | COMPLETE | `lib/data/` (engines, DB queries, market data), `app/api/data/` |
| TC Party Communications | COMPLETE | `lib/tc/party-communications.ts`, `app/api/tc/send-update/route.ts` |
| TC Vendor Scheduling | COMPLETE | `lib/tc/vendor-scheduler.ts`, `app/api/tc/schedule-vendor/route.ts` |
| TC Transaction Timeline UI | COMPLETE | `components/tc/TransactionTimeline.tsx` (visual deal pipeline) |
| TC Automation Cron | COMPLETE | `app/api/cron/tc-reminders/route.ts` (daily 6 AM) |

## DO NOT REBUILD
- Document classifier, extractor, memory, multi-pass pipeline
- Morning Brief (researchers, QA validator, synthesis, approval gate)
- Relationship Intelligence (4-agent scoring, consensus, hit list)
- Compliance scan + Louisiana rules engine
- AirSign Layer 1 signing flow
- Workflow state machine + WorkflowEvent logging

## What's Next
1. **AirSign Layer 2** — field placement UI, email delivery via Resend
2. **Verify billing checkout flow** end-to-end
3. **Wire data layer to Morning Brief** — use AIRE_DATA + ensemble scoring in daily briefs
4. **Backtest engine integration** — port `lib/engine/backtest.ts` for accuracy validation
5. **Admin dashboard for intelligence tables** — properties_clean, aire_scores, job_runs viewer

## Agent Integration Contracts (ALL WIRED)
- **After classifying a document:** `onDocumentUploaded()` called in `app/api/documents/extract/route.ts` (Step 7)
- **After voice command status update:** `advanceTransaction()` called in `lib/voice-action-executor.ts` updateTransactionStatus handler
- **Voice market analysis:** returns real AIRE_DATA neighborhood/metro stats from `lib/data/market-data.ts`
- **Data layer access:** all agents import from `@/lib/data` barrel export

## Env Vars Needed (Not Yet Set)
- `BLOB_READ_WRITE_TOKEN` — AirSign PDF upload/seal
- `RESEND_API_KEY` — AirSign signing link emails
- `AIRSIGN_INTERNAL_SECRET` — internal AirSign auth
- `AIRE_WEBHOOK_SECRET` — webhook verification

## Enhancement Suggestions (Agent 1 — 2026-04-04)
1. **Port backtest engine** — `aire-intelligence/lib/engine/backtest.ts` validates AIRE accuracy vs sold prices. Critical for the homepage "AIRE was within 5% on X% of comps" metric.
2. **Batch ensemble scoring cron** — Add `app/api/cron/ensemble-scoring/route.ts` to nightly-score all active properties. The engine exists (`lib/data/engines/ensemble.ts`) but no scheduled runner.
3. **Wire PPS/BPS into transaction detail UI** — `components/tc/TransactionDetail.tsx` could show PPS score alongside deadline/document info when a property_id matches.
4. **Intelligence table creation SQL** — The `properties_clean`, `market_snapshots`, `aire_scores`, `job_runs`, `error_logs`, `raw_imports`, `backtest_results` tables don't exist in Neon yet. Need a migration script to create them (they were in a separate DB in aire-intelligence).
5. **MCP server port** — The MLS and PropStream ingestion MCP servers still live in aire-intelligence. Consider moving them here or keeping them as external services that write to the shared Neon DB.

## TC Enhancement Backlog (Agent 2 — 2026-04-04)
1. **Automated party follow-ups** — After deadline completion, auto-send status update to buyer/seller via `party-communications.ts`. Wire into `onDeadlineCompleted()` in the state machine.
2. **Vendor contact database** — Replace hardcoded `PREFERRED_VENDORS` array with a Prisma `Vendor` model so agents can manage their own vendor lists per parish. Requires schema change (Agent 1).
3. **Transaction creation form** — Build `/app/aire/transactions/new/page.tsx` with a multi-step form: property info → parties → dates. Currently transactions are only created via API/voice.
4. **ShowTime/ShowingBoss integration** — Auto-schedule showings and pull feedback into transaction timeline. Would need API key + webhook receiver.
5. **Dotloop sync** — Wire existing `dotloopLoopId` field to Dotloop API for bidirectional document sync. The schema field exists but is unused.

## Document Engine Backlog (Agent 3 — 2026-04-04)
1. **OCR for scanned PDFs** — Current pipeline fails on image-only scanned docs (no text streams, no AcroForm). Integrate Tesseract.js or Google Vision API as a fallback extraction method before multi-pass vision.
2. **PDF storage to Vercel Blob** — Uploaded PDFs are processed but not stored. Add `@vercel/blob` upload in the extract route so DocumentViewer can render the actual PDF. Requires `BLOB_READ_WRITE_TOKEN`.
3. **Duplicate detection** — `document-memory.ts` hashes files but the extract route doesn't check for duplicates before creating a new Document record. Add hash-check before insert.
4. **Extraction confidence feedback loop** — When agents correct fields in DocumentViewer, feed those corrections back as few-shot examples for the specific document type (not just generic memory). This would specialize extraction per LREC form.
5. **Checklist auto-update on upload** — When a document is uploaded and auto-filed, automatically recalculate and cache the transaction's checklist completion percentage. Currently only computed on-demand via API.

## Build History
Full build log from 2026-04-04: `docs/build-log-2026-04-04.md`

## Self-Audit Findings (2026-04-04)
1. **No test suite** — no test runner, no test files. Add Vitest + critical path tests (classify, voice intent, state machine).
2. **AirSign email delivery is a TODO** — `app/api/airsign/envelopes/[id]/send/route.ts:81` needs Resend integration.
3. **No monitoring** — no Sentry, no structured logging. Production issues will be invisible.
4. **Intelligence tables not migrated** — `properties_clean`, `aire_scores`, `market_snapshots` need SQL migration to Neon.
5. **No transaction creation form** — only API/voice creation exists (noted in TC backlog #3).

## MISSION STATUS: COMPLETE — AWAITING NEW DIRECTIVE
Build verified: 65+ routes, 0 type errors. All agents operational.
Agents 1-3 completed 2026-04-04. Full logs: `docs/build-log-2026-04-04.md`
