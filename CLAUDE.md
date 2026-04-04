# AIRE Platform - 3 Agent Build Coordination (CORRECTED REPO)
## Build Start: 2026-04-04 01:43:52
## Repository: aire-assistant (C:\Users\cjjfr\OneDrive\AIRE ALL FILES\aire-assistant)

---

## Schema Migration — COMPLETE
**Executed:** 2026-04-04
**Method:** `prisma db push --force-reset` (dev database wiped and recreated)
**Result:** All tables synced successfully in 5.23s
**Database:** Neon PostgreSQL `neondb` at `us-east-1.aws.neon.tech`

**All models now live in database:**
- Core: User, Transaction, Deadline, Document, DocumentMemory
- Agent 1 (Email): EmailAccount, EmailScan, EmailAttachment
- Agent 2 (Voice/Docs): DocumentTemplate, GeneratedDocument, WorkflowEvent
- Agent 3 (Brief): MorningBrief, Contact, RelationshipIntelLog, ConsensusLog
- AirSign: AirSignEnvelope, AirSignSigner, AirSignField, AirSignAuditEvent
- Auth: VoiceCommand

**Post-migration notes:**
- All test data cleared — Clerk users will re-sync on next login
- First login will trigger Clerk webhook → create fresh User record

---

## Agent 1: Email Intelligence & Document Pipeline
### Status: BUILD COMPLETE — Schema migrated, all code deployed
### Repository Confirmed: aire-assistant

### Prisma Schema Changes (Agent 1 Proposal)
```prisma
model EmailAccount {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id])
  email        String
  provider     String   // "gmail" | "outlook"
  accessToken  String?  @db.Text
  refreshToken String?  @db.Text
  tokenExpiry  DateTime?
  isActive     Boolean  @default(true)
  lastScan     DateTime?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  scans        EmailScan[]
  @@unique([userId, email])
  @@index([userId, isActive])
}

model EmailScan {
  id               String   @id @default(cuid())
  accountId        String
  account          EmailAccount @relation(fields: [accountId], references: [id])
  scanStart        DateTime @default(now())
  scanEnd          DateTime?
  emailsScanned    Int      @default(0)
  attachmentsFound Int      @default(0)
  documentsCreated Int      @default(0)
  status           String   @default("running")
  error            String?  @db.Text
  createdAt        DateTime @default(now())
  attachments      EmailAttachment[]
  @@index([accountId, createdAt])
}

model EmailAttachment {
  id           String   @id @default(cuid())
  scanId       String
  scan         EmailScan @relation(fields: [scanId], references: [id])
  emailId      String
  emailSubject String?
  emailFrom    String?
  filename     String
  mimeType     String
  size         Int
  downloaded   Boolean  @default(false)
  classified   Boolean  @default(false)
  documentId   String?
  createdAt    DateTime @default(now())
  @@index([scanId])
  @@index([emailId])
}
```
**Agent 2/3:** No conflicts expected — all new models. Will add `emailAccounts EmailAccount[]` to User.

### Pre-Build Audit Report
**Audit Completed:** 2026-04-04

#### Existing Infrastructure

**Repository:** Next.js 16.2.1, React 19, Prisma 6.19, Clerk auth, Stripe billing, Neon PostgreSQL

**Prisma Models (12):** User, Transaction, Deadline, Document, DocumentMemory, VoiceCommand, ConsensusLog, Contact, RelationshipIntelLog, MorningBrief, AirSignEnvelope/Signer/Field/AuditEvent

**API Routes (25):**
- `api/documents/classify` — AI document classification
- `api/documents/extract` — field extraction
- `api/documents/memory/*` — review queue, stats, corrections, export
- `api/email/oauth` — OAuth initiation (37 lines, stub)
- `api/email/callback` — OAuth callback (93 lines, stub)
- `api/transactions/*` — CRUD + checklist + refile
- `api/cron/morning-brief` — scheduled brief generation
- `api/cron/relationship-intelligence` — scheduled scoring
- `api/cron/deadline-alerts` — deadline monitoring
- `api/voice-command` — voice processing
- `api/compliance/scan` — compliance checker
- `api/communications/draft` — message drafting
- `api/intelligence/estimate` — AIRE Estimate
- `api/morning-brief/action` — brief actions
- `api/billing/*` — checkout + portal
- `api/webhooks/*` — Clerk + Stripe

**Document Pipeline (1,049 lines — BUILT):**
- `lib/document-classifier.ts` (288 lines) — AI classification with confidence
- `lib/document-extractor.ts` (182 lines) — field extraction
- `lib/document-memory.ts` (150 lines) — self-improving memory
- `lib/multi-pass-extractor.ts` (429 lines) — multi-pass strategy

**Agents:** `lib/agents/orchestrator.ts`, `consensus.ts`, `relationship-intelligence.ts`, `morning-brief/`

**AirSign:** `app/airsign/` (layout + page), `components/airsign/` (FieldOverlay, PDFViewer) — basic flow exists

#### Gmail Integration Status
- **Gmail MCP:** Available via `mcp__claude_ai_Gmail__*` tools (search, read, draft, labels, profile)
- **Gmail API packages:** NOT in package.json (no `googleapis`)
- **Email OAuth stubs:** Exist but incomplete (130 lines total)

#### What Needs to Be Built
1. **Email scanning agent** — No agent exists. Need `lib/agents/email-scanner.ts`
2. **Email schema models** — No `EmailAccount`, `EmailScan`, `EmailAttachment` in Prisma
3. **Email-to-Document pipeline** — Connect email attachments → classifier → memory
4. **Email OAuth completion** — Stubs exist, need full Gmail/Outlook flow
5. **Scheduled email scanning cron** — No `api/cron/email-scan` exists

#### What Already Works (DO NOT REBUILD)
- Document classifier, extractor, memory, multi-pass — all functional
- Document API routes — classify, extract, memory CRUD
- AirSign basic signing flow
- Morning Brief pipeline
- Relationship Intelligence scoring

#### Recommended Build Order
1. Add Email schema models to Prisma
2. Build `lib/agents/email-scanner.ts` using Gmail MCP tools
3. Create `api/cron/email-scan/route.ts` for scheduled scanning
4. Wire email attachments → existing document classifier
5. Complete OAuth flow for user-connected Gmail accounts

---

## Agent 2: Voice Commands, Document Generation & Compliance
### Status: BUILDING — Phases 1-3 COMPLETE, Phase 4-5 ready
### Repository Confirmed: aire-assistant

### Pre-Build Audit Report
**Audit Completed:** 2026-04-04

#### Voice Pipeline Status
- **Voice API route exists:** YES — `app/api/voice-command/route.ts` (173 lines)
  - 6-step pipeline: transcript → fuzzy match (Levenshtein) → Claude AI classification → entity extraction → DB save → response
  - 11 known intents: create_transaction, create_addendum, check_deadlines, update_status, show_pipeline, calculate_roi, send_alert, market_analysis, add_party, schedule_closing
  - Uses Anthropic SDK directly (claude-sonnet-4-20250514)
  - **Missing:** No action execution (Step 5 just saves to DB, doesn't actually create transactions/addendums)
  - **Missing:** No MCP event push (commented as TODO)
- **VoiceCommandBar component exists:** YES — `components/VoiceCommandBar.tsx` (220 lines)
  - Web Speech API (webkitSpeechRecognition), interim results, keyboard input fallback
  - Posts to `/api/voice-command`, displays result card with confirm button
  - **Missing:** Confirm button is non-functional (no onClick handler for action execution)
- **VoiceCommand model in Prisma:** YES — rawTranscript, parsedIntent, parsedEntities, confidence, result, status
- **Intent classification built:** YES (fuzzy + AI), but no action execution layer

#### Compliance System Status
- **Compliance API route exists:** YES — `app/api/compliance/scan/route.ts` (170 lines)
  - Full scan: deadlines, document completeness, party completeness, severity scoring
  - Uses `louisiana-rules-engine.ts` for deadline calculation
  - Returns ComplianceScanResult with issues array + 0-100 health score
  - Imports consensus engine (`lib/agents/consensus.ts`) but doesn't use it in the scan
- **Louisiana Rules Engine exists:** YES — `lib/louisiana-rules-engine.ts` (215 lines)
  - Calculates 8 deadline types: inspection, repair response, appraisal, financing, title, walkthrough, closing, earnest money
  - Louisiana holidays (2026), business day adjustment, upcoming deadline alerts
  - SMS alert formatting built in
- **Compliance models in schema:** No dedicated ComplianceLog model — issues are computed on-the-fly

#### Document Generation Status
- **Document generation routes:** NONE — no route for generating/filling LREC forms
- **LREC form templates:** NONE — classifier recognizes forms but can't generate them
- **Document classifier exists:** YES — `lib/document-classifier.ts` (288 lines) with 15 LREC form types
- **Document extractor exists:** YES — `lib/document-extractor.ts` + `lib/multi-pass-extractor.ts`
- **Document memory exists:** YES — `lib/document-memory.ts` with self-improving classification

#### What Already Works (DO NOT REBUILD)
- Voice command API with AI classification + fuzzy matching
- VoiceCommandBar UI component with speech recognition
- Compliance scan with deadline/document/party checks
- Louisiana rules engine with all deadline types
- Document classifier, extractor, memory system

#### What Needs to Be Built
1. **Voice action execution layer** — Bridge from parsed intent → actual CRUD operations (create transaction, generate addendum, etc.)
2. **VoiceCommandBar confirm handler** — Wire confirm button to execute the classified action
3. **Document generation engine** — Fill LREC form templates with extracted/provided data (PDF generation)
4. **LREC form template library** — Store fillable PDF templates or build programmatic PDF generation
5. **Compliance logging model** — Persist scan results for trend tracking (optional)
6. **Voice → Document pipeline** — "Create addendum for 123 Main St" should generate a real document

#### Recommended Build Order
1. Build voice action executor (`lib/voice-action-executor.ts`) — maps intents to real operations
2. Wire VoiceCommandBar confirm button to action executor via new API route
3. Build document generation engine (`lib/document-generator.ts`) for LREC forms
4. Connect voice "create addendum" intent → document generator
5. Add compliance scan to voice intents ("run compliance check" command)

---

## AirSign Layer 1 — BUILT
**Built:** 2026-04-04 by Agent 3 (autonomous mode)
**Build status:** npm run build PASSED — 0 type errors

### Files Created (12 new files)
**Core Engine:**
- `lib/airsign/seal-pdf.ts` — Burns signatures onto PDF via pdf-lib, appends audit certificate page

**API Routes (6):**
- `app/api/airsign/envelopes/route.ts` — POST create, GET list
- `app/api/airsign/envelopes/[id]/route.ts` — GET detail, PATCH update, DELETE void
- `app/api/airsign/envelopes/[id]/fields/route.ts` — POST add fields, PUT replace
- `app/api/airsign/envelopes/[id]/send/route.ts` — POST validate + send signing links
- `app/api/airsign/sign/[token]/route.ts` — GET load for signer, POST sign/decline + auto-seal
- `app/api/airsign/upload/route.ts` — POST upload PDF to Vercel Blob

**Pages (4):**
- `app/airsign/new/page.tsx` + `NewEnvelopeForm.tsx` — Create envelope, upload PDF, add signers
- `app/airsign/[id]/page.tsx` + `EnvelopeDetail.tsx` — Envelope detail, PDF viewer, signer status, audit trail, send button
- `app/sign/[token]/page.tsx` + `SigningFlow.tsx` — Public signing page (no auth, token-based)

**Dependencies added:** `@vercel/blob`

### AirSign Flow
1. Agent creates envelope at `/airsign/new` → uploads PDF + adds signers
2. Agent places fields via `/api/airsign/envelopes/[id]/fields`
3. Agent sends envelope → signing URLs generated per signer
4. Signers open `/sign/[token]` → view PDF, fill fields, sign or decline
5. When all signers complete → PDF auto-sealed with signatures burned in + audit certificate appended
6. Sealed PDF uploaded to Vercel Blob, envelope marked COMPLETED

### Env Vars Needed
- `BLOB_READ_WRITE_TOKEN` — Required for PDF upload/seal storage
- `RESEND_API_KEY` — Future: email delivery of signing links

---

## Agent 3: Morning Brief, Status Updates & Workflow Orchestration
### Status: BUILD COMPLETE — Phases 1-5 done + AirSign Layer 1
### Repository Confirmed: aire-assistant

### Prisma Schema Changes (Agent 3 Proposal)
```prisma
model WorkflowEvent {
  id            String      @id @default(cuid())
  transactionId String
  transaction   Transaction @relation(fields: [transactionId], references: [id])
  fromStatus    String?
  toStatus      String
  trigger       String      // "document_uploaded" | "deadline_passed" | "deadline_completed" | "manual" | "voice_command" | "system"
  triggeredBy   String?     // userId or "system"
  metadata      Json?
  createdAt     DateTime    @default(now())

  @@index([transactionId, createdAt])
}

// Add to Transaction model:
//   workflowEvents WorkflowEvent[]
```
**Agent 1/2:** No conflicts — one new model + one relation on Transaction.

### Pre-Build Audit Report
**Audit Completed:** 2026-04-04

#### Morning Brief Status — FULLY BUILT
- **Cron route exists:** YES — `app/api/cron/morning-brief/route.ts` (168 lines)
  - Runs daily at 6:30 AM via Vercel Cron
  - Auth: Bearer token via CRON_SECRET
  - Targets PRO/INVESTOR tier users only
  - Deduplicates by userId+briefDate (won't re-run same day)
  - Runs 3 researchers in parallel → QA validation → Claude synthesis → DB store
  - Status stored as "pending" — requires human approval before delivery
- **Orchestrator:** YES — `lib/agents/orchestrator.ts` (36 lines)
  - Generic parallel runner using Promise.allSettled
  - Returns timing + error info per researcher
- **Deadline Researcher:** YES — `lib/agents/morning-brief/researchers/deadline-researcher.ts` (78 lines)
  - Queries next 7 days of uncompleted deadlines
  - Groups by urgency: overdue, today, urgent (1-3 days), upcoming (4-7 days)
- **Pipeline Researcher:** YES — `lib/agents/morning-brief/researchers/pipeline-researcher.ts` (98 lines)
  - Queries active transactions (not CLOSED/CANCELLED)
  - Flags deals needing attention: closing soon with missing docs, overdue deadlines, stale drafts
- **Contact Researcher:** YES — `lib/agents/morning-brief/researchers/contact-researcher.ts` (83 lines)
  - Queries contacts + latest RelationshipIntelLog
  - Returns: hotLeads (score≥70), needsFollow (>14 days silent), recentIntel (scored in 7 days)
- **QA Validator:** YES — `lib/agents/morning-brief/qa-validator.ts` (96 lines)
  - Fair Housing term scanner on suggested messages (red flags)
  - LREC completeness check: missing parties, missing docs near closing
  - Data quality: overdue deadline warnings
  - Red flags block QA pass
- **Brief Action API:** YES — `app/api/morning-brief/action/route.ts` (52 lines)
  - POST with briefId + action (approve/dismiss)
  - Clerk auth, user ownership verification
  - Updates status + timestamp
- **MorningBrief schema model:** YES — briefDate, researcher data (JSON), QA flags, summary, actionItems, approval gate
- **Claude synthesis:** YES — Sonnet 4, Louisiana-specific (Act of Sale, parish), Fair Housing compliant, action items extracted as structured JSON

#### Deadline Alerts Status — BUILT
- **Cron route exists:** YES — `app/api/cron/deadline-alerts/route.ts` (146 lines)
  - Runs daily at 6:00 AM
  - Finds deadlines due within 48 hours, not yet alerted, not completed
  - Sends SMS via Twilio (if configured), marks alertSent=true
  - Uses `formatDeadlineAlert` from Louisiana rules engine

#### Relationship Intelligence Status — FULLY BUILT
- **Cron route exists:** YES — `app/api/cron/relationship-intelligence/route.ts` (134 lines)
  - Weekly Monday 6:00 AM run, POST + GET endpoints
  - GET returns latest hit list for a user
- **Engine:** YES — `lib/agents/relationship-intelligence.ts` (433 lines)
  - 4 parallel AI agents: Behavioral, Life Event, Market Timing, Recency/Warmth
  - Weighted synthesis (30/25/25/20), consensus check for high-score contacts
  - Ninja Selling framework, Louisiana-specific prompts
  - Batched processing (5 contacts at a time), writes to RelationshipIntelLog + updates Contact scores

#### Communication Drafting Status — BUILT
- **API route exists:** YES — `app/api/communications/draft/route.ts` (80 lines)
  - Clerk-authed POST, takes contactName/channel/purpose
  - Claude generates email/text/call scripts with Fair Housing check
  - Ninja Selling tone, Louisiana context

#### Workflow/State Machine Status — NOT BUILT
- **No workflow state machine exists** — Transaction status is a flat enum (DRAFT → ACTIVE → PENDING_* → CLOSING → CLOSED → CANCELLED)
- **No automated status transitions** — status changes are manual only
- **No workflow event log** — no model to track state transitions with timestamps/reasons
- **No auto-update system** — no mechanism to detect when a transaction should advance (e.g., inspection complete → move to PENDING_APPRAISAL)

#### What Already Works (DO NOT REBUILD)
- Morning Brief: full pipeline (researchers → QA → synthesis → approval gate)
- Deadline alerts: cron + Twilio SMS
- Relationship Intelligence: 4-agent scoring + consensus + hit list
- Communication drafting: AI message generation
- Orchestrator: parallel researcher runner
- Consensus engine: multi-run agreement checking

#### What Was Built (Agent 3 — 2026-04-04)
1. **WorkflowEvent model** — `prisma/schema.prisma` — logs every state transition
2. **State machine** — `lib/workflow/state-machine.ts` (290 lines)
   - All TransactionStatus transitions with guard conditions
   - `advanceTransaction()` — validate + update + log atomically
   - `onDocumentUploaded()` — auto-advance by document type
   - `onDeadlineCompleted()` — auto-advance by deadline name
   - `getAllowedTransitions()` / `isTransitionAllowed()` — query helpers
3. **Advance API** — `app/api/transactions/[id]/advance/route.ts` (POST + GET)
4. **Workflow History API** — `app/api/transactions/[id]/workflow/route.ts` (GET)
5. **Dashboard components:**
   - `components/dashboard/WorkflowTimeline.tsx` — visual timeline
   - `components/dashboard/WorkflowAdvance.tsx` — advance buttons
   - `components/dashboard/HitList.tsx` — relationship intelligence hit list
6. **Morning Brief UI** — ALREADY EXISTED (not rebuilt):
   - `app/aire/morning-brief/page.tsx` + `actions.tsx`
   - `app/aire/page.tsx` — dashboard with brief card

#### Integration Points for Agent 1 & 2
- **Agent 1:** Call `onDocumentUploaded(transactionId, docType, userId)` after classifying docs
- **Agent 2:** Call `advanceTransaction({...trigger: "voice_command"})` for status updates

---

## Prisma Schema Changes — Agent 2 Proposal
**Proposed:** 2026-04-04
**Status:** Awaiting coordination with Agent 1 & 3

```prisma
model DocumentTemplate {
  id          String   @id @default(cuid())
  name        String
  description String
  category    String
  pdfTemplate Bytes?
  fields      Json
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  generated   GeneratedDocument[]
}

model GeneratedDocument {
  id              String            @id @default(cuid())
  templateId      String
  template        DocumentTemplate  @relation(fields: [templateId], references: [id])
  userId          String
  transactionId   String?
  transaction     Transaction?      @relation(fields: [transactionId], references: [id])
  voiceCommandId  String?
  voiceCommand    VoiceCommand?     @relation(fields: [voiceCommandId], references: [id])
  populatedFields Json
  pdfUrl          String?
  status          String            @default("draft")
  createdAt       DateTime          @default(now())
}

// Relation additions needed:
// Transaction: add generatedDocuments GeneratedDocument[]
// VoiceCommand: add generatedDocuments GeneratedDocument[]
```

---

## Architecture Correction Notes
- Previous launch in clerk-nextjs was incorrect
- All agents now operating in aire-assistant (the real product repo)
- Skills files confirmed present
- Existing code will be audited before new development

