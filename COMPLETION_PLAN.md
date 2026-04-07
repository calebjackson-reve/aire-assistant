# AIRE Platform — Completion Plan
**Created:** April 4, 2026
**Purpose:** Single source of truth for what's done, what's left, and how we'll know it's finished.

---

## HOW TO USE THIS FILE
- This is the ONLY document that defines "done" for each tool.
- When working with Claude.ai or Claude Code, point them here.
- Each tool has: what exists, what's broken, what to build, and a done checklist.
- Check boxes get marked as each item is verified working.

---

## PLATFORM OVERVIEW

| Layer | Description | Status |
|-------|-------------|--------|
| Auth (Clerk) | Sign up, sign in, session management | WORKING |
| Database (Neon + Prisma) | 29 tables, seeded with test data | WORKING |
| User Auto-Creation | Clerk webhook creates User on signup | NEEDS WEBHOOK SECRET |
| Billing (Stripe) | $97 PRO / $197 INVESTOR checkout | NEEDS WEBHOOK SECRET |
| Deployment (Vercel) | Hosting, crons, env vars | NOT DEPLOYED TO PROD YET |

---

## TOOL 1: DOCUMENT PIPELINE (Classify + Extract + Auto-File)

### What Exists (Real Code)
- `lib/document-classifier.ts` — Claude API classification + pattern matching + few-shot learning
- `lib/document-extractor.ts` — PDF text extraction + AcroForm field reading
- `lib/multi-pass-extractor.ts` — 5-pass Claude Vision extraction (Parties, Deal Terms, Dates, LA Specifics, Signatures)
- `lib/document-memory.ts` — Learning from past classifications
- `lib/document-autofiler.ts` — Auto-links extracted docs to transactions
- `app/api/documents/extract/route.ts` — Full extraction endpoint (works)
- `app/api/documents/upload/route.ts` — Upload endpoint (classifies only, does NOT extract)

### What's Broken
- Upload does NOT trigger extraction — user uploads a PDF, it gets classified by filename but no fields are extracted
- No drag-and-drop upload UI in the transaction detail Documents tab
- Document viewer doesn't exist — can't preview uploaded PDFs in-app

### What To Build
1. Wire upload route to call extraction after classification
2. Add upload button/drag-drop in transaction detail Documents tab
3. Add document list with extracted field preview in Documents tab

### Done Checklist
- [ ] User uploads a PDF on the transaction Documents tab
- [ ] PDF gets classified (type detected: Purchase Agreement, Disclosure, etc.)
- [ ] PDF fields get extracted (buyer name, seller name, price, dates, etc.)
- [ ] Extracted data displays in the Documents tab
- [ ] Document auto-links to the correct transaction
- [ ] Workflow state machine advances on document upload

---

## TOOL 2: CONTRACT WRITING ENGINE

### What Exists (Real Code)
- `lib/contracts/contract-writer.ts` — Claude NL parsing + pdf-lib PDF generation
- `lib/contracts/clause-library.ts` — 50+ real Louisiana legal clauses
- `lib/contracts/lrec-fields.ts` — LREC-101, 102, 103 form definitions
- `lib/document-generator.ts` — PDF generation (purchase agreements, addenda)
- `app/api/contracts/write/route.ts` — API that takes NL input, returns PDF
- `app/aire/contracts/new/ContractForm.tsx` — Form UI (NL input, form type, preview, generate)
- `app/aire/contracts/page.tsx` — Contract list page

### What's Broken
- Nothing fundamentally broken — generates real PDFs from natural language
- PDFs are AI-generated drafts, not filled official LREC fillable forms (acceptable for v1)
- "Send for Signatures" button needs BLOB_READ_WRITE_TOKEN to upload PDF to AirSign

### What To Build
1. Set BLOB_READ_WRITE_TOKEN env var
2. Test end-to-end: NL input → PDF → download
3. Test end-to-end: NL input → PDF → send to AirSign for signatures

### Done Checklist
- [ ] Type "Write a purchase agreement for 123 Oak Dr, buyer John Smith, seller Jane Doe, $200K" → PDF generates
- [ ] PDF downloads successfully with real content (not blank/placeholder)
- [ ] PDF contains correct Louisiana clauses (inspection, financing, termite, etc.)
- [ ] "Send for Signatures" creates AirSign envelope with the PDF attached
- [ ] Generated contract appears in /aire/contracts list

---

## TOOL 3: AIRSIGN (Electronic Signatures)

### What Exists (Real Code)
- `app/airsign/page.tsx` — Envelope dashboard
- `app/airsign/new/page.tsx` — Create envelope
- `app/airsign/[id]/EnvelopeDetail.tsx` — Field placement + signer management
- `app/sign/[token]/SigningFlow.tsx` — Public signing page (draw/type signature)
- `components/airsign/FieldPlacer.tsx` — Click-to-place fields on PDF
- `components/airsign/SignatureModal.tsx` — Signature capture (6 fonts + canvas draw)
- `lib/airsign/seal-pdf.ts` — Embeds signatures + audit certificate into PDF
- All API routes: upload, envelopes CRUD, fields, send, sign, webhook

### What's Broken
- `BLOB_READ_WRITE_TOKEN` not set → PDF upload to Vercel Blob fails (no persistent storage)
- `RESEND_API_KEY` not set → signing invitation emails only log to console
- `AIRSIGN_INTERNAL_SECRET` not set → completion webhook auth fails
- Without blob storage, the entire flow breaks at step 1 (upload PDF)

### What To Build
1. Set BLOB_READ_WRITE_TOKEN in Vercel + .env.local
2. Set RESEND_API_KEY in Vercel + .env.local
3. Set AIRSIGN_INTERNAL_SECRET in Vercel + .env.local
4. Test full signing flow end-to-end

### Done Checklist
- [ ] Create new envelope on /airsign/new
- [ ] Upload a PDF (stored in Vercel Blob, displays in UI)
- [ ] Add signers (name + email)
- [ ] Place signature/date/text fields on PDF pages
- [ ] Click "Send" — signers receive email with signing link
- [ ] Signer opens link, views PDF, fills fields, draws/types signature
- [ ] After all signers complete, sealed PDF generates with audit certificate
- [ ] Sealed PDF downloadable from envelope detail page
- [ ] Webhook fires → creates Document record → advances workflow

---

## TOOL 4: EMAIL INTELLIGENCE (Scan + Triage + Draft Replies)

### What Exists (Real Code)
- `lib/comms/gmail-scanner.ts` — Real Gmail API integration with OAuth
- `lib/comms/response-detector.ts` — DB-driven response matching + urgency classification
- `lib/comms/draft-replies.ts` — Claude API draft generation (Ninja Selling persona)
- `app/api/email/triage/route.ts` — Returns unanswered, missed calls, categorized emails
- `app/api/email/scan-now/route.ts` — Triggers full comms scan
- `app/api/email/draft-reply/route.ts` — On-demand Claude draft generation
- `app/aire/email/EmailDashboard.tsx` — Full triage UI
- `app/aire/settings/email/page.tsx` — Gmail connection settings
- `lib/agents/email-scanner.ts` — Separate agent that scans emails for document attachments

### What's Broken
- No Gmail OAuth token in DB — scanner has nothing to scan
- Gmail OAuth connection flow on settings page not tested end-to-end
- SMS scanner needs TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN
- Comms scan cron runs every 30min but with no connected accounts, it does nothing

### What To Build
1. Set up Gmail OAuth credentials (Google Cloud Console → OAuth client → callback URL)
2. Test Gmail connection from /aire/settings/email
3. Set Twilio credentials for SMS
4. Run a real scan and verify triage dashboard populates

### Done Checklist
- [ ] Connect Gmail account from /aire/settings/email
- [ ] "Scan Now" button fetches real emails from Gmail
- [ ] Unanswered emails appear in triage dashboard with urgency badges
- [ ] "Draft Reply" generates a real Claude-written response
- [ ] Missed calls section populates (requires Twilio)
- [ ] Comms scan cron auto-runs and finds new messages
- [ ] Morning Brief includes email/comms section with real data

---

## TOOL 5: VOICE COMMAND PIPELINE

### What Exists (Real Code)
- `components/VoiceCommandBar.tsx` — Voice UI with browser speech recognition
- `app/api/voice-command/route.ts` — v1 classification endpoint
- `app/api/voice-command/v2/route.ts` — v2 with Claude classification
- `app/api/voice-command/v2/stream/route.ts` — SSE streaming endpoint
- `app/api/voice-command/execute/route.ts` — Action execution
- `lib/voice-action-executor.ts` — 28 regex patterns, 9 intents
- `lib/voice-pipeline.ts` — Optimized pipeline
- `app/aire/voice-analytics/page.tsx` — Analytics dashboard

### What's Broken
- Uses browser Web Speech API (Chrome only, accuracy varies)
- Voice bar may not be visible on all pages (check layout)

### What To Build
- Nothing critical — this works. Future enhancement: Whisper integration for better accuracy.

### Done Checklist
- [ ] Voice bar appears on /aire dashboard
- [ ] Click mic, speak "Show my pipeline" → returns transaction list
- [ ] "What deadlines are due this week" → returns deadline info
- [ ] Voice analytics page shows timing + intent distribution

---

## TOOL 6: MORNING BRIEF

### What Exists (Real Code)
- `app/api/cron/morning-brief/route.ts` — Cron endpoint (5 researchers + QA + synthesis)
- `lib/agents/morning-brief/` — Full researcher pipeline
- `app/aire/morning-brief/page.tsx` — Brief viewer with approve/dismiss

### What's Broken
- Nothing fundamentally broken
- Quality depends on having real data (transactions, contacts, emails)

### Done Checklist
- [ ] Manually trigger morning brief generation via API
- [ ] Brief appears on /aire/morning-brief with sections (deadlines, pipeline, contacts, actions)
- [ ] Approve/dismiss buttons work
- [ ] Brief includes real transaction data from DB

---

## TOOL 7: COMPLIANCE SCANNER

### What Exists (Real Code)
- `app/api/compliance/scan/route.ts` — Scan endpoint
- `lib/louisiana-rules-engine.ts` — Louisiana-specific compliance rules
- `app/aire/compliance/page.tsx` — Scanner UI

### What's Broken
- Nothing — scans work against transaction data in DB

### Done Checklist
- [ ] Run compliance scan from /aire/compliance
- [ ] Results show Louisiana-specific rule violations (if any)
- [ ] Can scan a specific transaction

---

## TOOL 8: TRANSACTION COORDINATOR

### What Exists (Real Code)
- Full CRUD: create, list, detail, update, delete
- 5-tab detail view: Overview, Deadlines, Documents, Communications, Contracts
- Deadline auto-calculation, workflow state machine
- Party communications (needs RESEND_API_KEY for email, Twilio for SMS)

### What's Broken
- Comms quick-send templates need RESEND_API_KEY
- SMS needs Twilio credentials

### Done Checklist
- [ ] Create a new transaction from /aire/transactions/new
- [ ] Transaction appears in list with correct data
- [ ] Detail page shows all 5 tabs with real data
- [ ] Mark a deadline as complete → updates DB
- [ ] Workflow advances when documents are uploaded

---

## TOOL 9: BILLING (Stripe)

### What Exists (Real Code)
- `app/billing/page.tsx` — 3-tier pricing (Free, $97 Pro, $197 Investor)
- `app/api/billing/checkout/route.ts` — Creates Stripe checkout session
- `app/api/webhooks/stripe/route.ts` — Handles payment events, updates user tier
- Price IDs configured in .env.local

### What's Broken
- STRIPE_WEBHOOK_SECRET is empty — webhook signature verification fails
- Checkout redirects to Stripe but completion webhook won't fire without the secret

### What To Build
1. Set STRIPE_WEBHOOK_SECRET from Stripe dashboard
2. Test checkout in Stripe test mode

### Done Checklist
- [ ] Click "Subscribe" on PRO tier → redirects to Stripe checkout
- [ ] Complete test payment → webhook fires → user tier updates to PRO
- [ ] User returns to app → sees PRO features unlocked
- [ ] Same flow works for INVESTOR tier

---

## ENV VARS NEEDED (The Real Blockers)

| Var | Where to Get | What It Unblocks |
|-----|-------------|-----------------|
| `BLOB_READ_WRITE_TOKEN` | Already in .env.local | AirSign PDF storage, contract storage |
| `RESEND_API_KEY` | resend.com → API Keys | AirSign emails, TC comms, email triage |
| `AIRSIGN_INTERNAL_SECRET` | Generate any random string | AirSign webhook auth |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Webhooks → Signing secret | Billing tier updates |
| `CLERK_WEBHOOK_SECRET` | Clerk Dashboard → Webhooks → Signing secret | Auto-create users on signup |
| `TWILIO_ACCOUNT_SID` | Twilio Console | SMS notifications |
| `TWILIO_AUTH_TOKEN` | Twilio Console | SMS notifications |
| `GOOGLE_CLIENT_ID` | Google Cloud Console → OAuth | Gmail connection |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console → OAuth | Gmail connection |

---

## BUILD ORDER (What to do in what sequence)

### Phase 1: Foundation (Do First)
1. Set CLERK_WEBHOOK_SECRET → auto-create users on signup works
2. Set STRIPE_WEBHOOK_SECRET → billing checkout completes
3. Set AIRSIGN_INTERNAL_SECRET → any random 32-char string
4. Verify BLOB_READ_WRITE_TOKEN works (already in .env.local)
5. Update NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL to point to /aire/onboarding

### Phase 2: Core Tools (AirSign + Contracts)
6. Test AirSign full flow: upload → place fields → send → sign → seal
7. Set RESEND_API_KEY → AirSign emails + TC comms work
8. Test contract writer: NL → PDF → download
9. Test contract → AirSign: generate PDF → send for signatures

### Phase 3: Document Pipeline
10. Wire upload route to trigger extraction after classification
11. Add upload UI to transaction detail Documents tab
12. Test: upload PDF → auto-classify → extract fields → display

### Phase 4: Email Intelligence
13. Set up Google OAuth credentials (Google Cloud Console)
14. Test Gmail connection from /aire/settings/email
15. Run a real email scan → verify triage dashboard populates
16. Set Twilio credentials → SMS + missed calls work

### Phase 5: Integration Testing
17. Full user journey: Sign up → onboarding → create transaction → upload doc → write contract → send for signatures → signer signs → sealed PDF → morning brief shows it
18. Billing journey: Sign up free → upgrade to PRO → features unlock
19. Voice commands: speak → action executes → result displays

### Phase 6: Deploy
20. Push to Vercel with all env vars set
21. Verify all crons run (8 scheduled jobs)
22. Test production signing flow with real email delivery
23. Verify Stripe webhooks in production

---

## HOW TO KNOW IT'S COMPLETE

The platform is "v1 complete" when ALL of these work for a real user:

1. Sign up → land on onboarding → connect integrations
2. Create a transaction with real deal info
3. Upload a document → it classifies and extracts automatically
4. Write a contract from natural language → download PDF
5. Send contract for signatures via AirSign → signer receives email
6. Signer opens link, signs, sealed PDF generates
7. Morning brief shows deal status, deadlines, action items
8. Compliance scan catches Louisiana rule violations
9. Voice command executes an action successfully
10. Billing upgrade works end-to-end
11. Email triage shows real inbox data with draft replies

When all 11 work → ship it.

---

## FOR CLAUDE.AI / CLAUDE CODE

If Caleb sends you to this file, READ IT FIRST. Do not:
- Suggest installing context systems that already exist
- Propose rewriting CLAUDE.md
- Create new folder structures (.aide, etc.)
- Build things that are already built (check the "What Exists" sections)

Instead:
- Pick up from the BUILD ORDER where we left off
- Fix the specific broken thing Caleb is asking about
- Mark checklist items as complete when verified
