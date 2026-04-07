# AIRE Platform — Success Criteria
**What "done" means for every tool. No ambiguity.**
**Last updated:** April 4, 2026

---

## HOW TO READ THIS
Each tool has three sections:
- **Must Work** — Non-negotiable. If any of these fail, the tool is NOT done.
- **User Experience** — What a real agent (non-technical) should see and feel.
- **Playwright Test** — The exact automated steps that prove it works.

---

## TOOL 1: AIRSIGN (Electronic Signatures)

### Must Work
- [ ] Create envelope with name + subject
- [ ] Upload any PDF (1-20 pages) — stored in Vercel Blob, renders in browser
- [ ] Add 1-3 signers with name + email
- [ ] Place signature, initials, date, text, and checkbox fields on any page of the PDF
- [ ] Fields persist after page reload (save to DB works)
- [ ] Assign fields to specific signers (each signer only sees their fields)
- [ ] "Send for signing" changes status DRAFT → SENT
- [ ] Each signer receives email with branded signing link (via Resend)
- [ ] Signing link opens `/sign/[token]` — PDF renders with field overlays
- [ ] Signer can draw signature on canvas (works on mobile with touch)
- [ ] Signer can type signature (6 font choices)
- [ ] After filling all fields, signer submits — `signedAt` timestamp recorded
- [ ] After ALL signers complete, status → COMPLETED
- [ ] Sealed PDF generates with signatures embedded at correct positions
- [ ] Sealed PDF includes audit certificate page (names, emails, IPs, timestamps, hash)
- [ ] Sealed PDF downloadable from envelope detail page
- [ ] Completion webhook fires → creates Document record → advances workflow
- [ ] Audit trail logs every event (created, sent, viewed, signed, completed)

### User Experience
A Louisiana real estate agent who has never used technology beyond their phone should be able to:
1. Click "+ New envelope"
2. Upload a purchase agreement PDF
3. Add buyer and seller as signers
4. Click where signatures go on the PDF
5. Hit Send
6. Both parties get an email, tap the link, sign on their phone
7. Agent gets a sealed PDF back with all signatures + audit trail
8. Total time: under 5 minutes

### Playwright Test
```
1. Navigate /airsign/new
2. Fill envelope name: "Test PA — 123 Main St"
3. Upload test PDF
4. Add signer: "John Buyer", "john@test.com"
5. Click Create → redirect to /airsign/[id]
6. Verify PDF renders (canvas element visible, no error text)
7. Click Signature button → click on PDF at buyer line
8. Click Date button → click on PDF at date line
9. Verify FIELDS (2) in sidebar
10. Click "Save 2 Fields" → wait 2s → reload page
11. Verify FIELDS (2) still shows (persistence check)
12. Click "Send for signing" → verify status = SENT
13. Get signing URL from page or console
14. Navigate to /sign/[token]
15. Verify PDF renders with field overlays
16. Click signature field → signature modal opens
17. Draw/type signature → submit
18. Fill date field
19. Click Submit
20. Navigate back to /airsign/[id]
21. Verify status = COMPLETED
22. Verify "Download Sealed PDF" link exists
```

---

## TOOL 2: TRANSACTION COORDINATOR

### Must Work
- [ ] Create transaction with: address, city, state, zip, type, MLS#, list/offer/accepted price, buyer/seller info, lender, title company, contract date, closing date, inspection date
- [ ] Transaction appears in list immediately after creation
- [ ] List shows search (by address, buyer, seller, MLS), filter (All/Active/Pending/Closed), sort (Recent/Closing Date/Price)
- [ ] Transaction detail loads with 5 tabs: Overview, Deadlines, Documents, Communications, Contracts
- [ ] Overview tab shows: property info, parties, price, status badge, days on market, progress bar
- [ ] Deadlines auto-calculate from contract/closing/inspection dates
- [ ] Deadlines grouped by urgency: overdue (red), today (orange), upcoming (yellow), future (gray)
- [ ] "Mark Complete" on a deadline → updates DB, removes from pending list
- [ ] Smart suggestions appear based on deal stage ("Missing: Inspection Report", "Inspection deadline in 5 days")
- [ ] Documents tab shows uploaded docs with classification badges + extracted fields
- [ ] Communications tab has quick-send templates (Offer Accepted, Inspection Scheduled, Closing Update, General)
- [ ] Quick-send fires real email via Resend to buyer/seller/lender
- [ ] Contracts tab links to contract writer + shows generated contracts
- [ ] Sidebar nav badge shows active transaction count
- [ ] Pipeline value on dashboard updates with transaction prices
- [ ] No duplicate transactions in the list

### User Experience
A real estate agent should be able to:
1. Click "+ New" on the transactions page
2. Enter the deal info (address, buyer, seller, price, dates)
3. See their deal appear in the pipeline immediately
4. Click into it and see exactly what needs to happen next
5. Mark deadlines as done with one click
6. Send a quick update to the buyer with one click
7. Never wonder "what step am I on" — the system tells them

### Playwright Test
```
1. Navigate /aire/transactions
2. Verify list loads with existing transactions
3. Click "+ New" → navigate to /aire/transactions/new
4. Fill form: 742 Evergreen Terrace, $325K, buyer Homer Simpson, seller Ned Flanders
5. Submit → verify redirect to /aire/transactions/[id]
6. Verify Overview tab: address, buyer, seller, price all correct
7. Click Deadlines tab → verify deadlines calculated
8. Click "Mark Complete" on first deadline → verify it updates
9. Click Documents tab → verify upload zone exists
10. Click Communications tab → verify quick-send templates
11. Navigate back to /aire/transactions → verify new deal in list
12. Test search: type "Evergreen" → only matching deal shows
13. Test filter: click "Active" → only active deals show
```

---

## TOOL 3: DOCUMENT PIPELINE

### Must Work
- [ ] Upload PDF from transaction detail Documents tab (drag-and-drop or click)
- [ ] PDF stored in Vercel Blob (persistent URL)
- [ ] Document classified by type: Purchase Agreement, Disclosure, Inspection Report, Addendum, Closing Statement, etc.
- [ ] Classification confidence shown (high/medium/low badge)
- [ ] For text-based PDFs: AcroForm or text stream extraction runs
- [ ] For scanned/image PDFs: Multi-pass Claude Vision extraction runs
- [ ] Extracted fields displayed inline in Documents tab (buyer, seller, price, dates, address)
- [ ] Document auto-filed to correct transaction (matches by address/parties)
- [ ] Workflow state machine advances on document upload
- [ ] Document record created in Prisma with: name, type, fileUrl, filledData, extractedText, checklistStatus
- [ ] LREC form detection (LREC-101, 102, 103, etc.) with form number shown
- [ ] Multiple documents can be uploaded to same transaction
- [ ] Document memory logs the classification for future learning

### User Experience
A real estate agent should be able to:
1. Open a transaction
2. Click the Documents tab
3. Drag a PDF onto the page (or click upload)
4. See it instantly classified: "Purchase Agreement (95% confidence)"
5. See extracted fields: "Buyer: John Smith, Price: $200,000, Closing: May 1"
6. Never manually type deal info — the system reads the document

### Playwright Test
```
1. Navigate to /aire/transactions/[id] → Documents tab
2. Verify upload zone visible (drag-and-drop area or button)
3. Upload a test PDF via file input
4. Wait for processing (classification + extraction)
5. Verify classification badge appears (e.g., "Purchase Agreement")
6. Verify extracted fields display (at minimum: 1 party name + 1 price/date)
7. Verify document appears in the documents list
8. Navigate to /aire/transactions → verify doc count updated on deal card
```

---

## TOOL 4: CONTRACT WRITER

### Must Work
- [ ] Natural language input: "Write a purchase agreement for [address], buyer [name], seller [name], price [$X]"
- [ ] Claude API parses the NL input into structured fields
- [ ] PDF generates with correct: property address, buyer/seller names, price, dates, contingencies
- [ ] Louisiana-specific clauses included: inspection, financing, termite, flood zone, lead paint (if pre-1978), property condition
- [ ] PDF downloadable immediately after generation
- [ ] Generated contract saved to DB and appears in `/aire/contracts` list
- [ ] "Send for Signatures" creates AirSign envelope with the PDF + parties as signers
- [ ] Form type selector available (LREC-101, 102, 103 if applicable)
- [ ] Transaction picker available (link contract to existing deal)
- [ ] Field preview shows parsed fields before generation

### User Experience
A real estate agent should be able to:
1. Click "Write Contract"
2. Type or speak: "Purchase agreement for 123 Oak Dr, buyer is John Smith, seller is Jane Doe, price $200K, 10 day inspection, conventional financing"
3. See the parsed fields (verify they're correct)
4. Click Generate → get a PDF in seconds
5. Click "Send for Signatures" → buyer and seller get signing emails
6. Total time: under 2 minutes for a basic purchase agreement

### Playwright Test
```
1. Navigate /aire/contracts/new
2. Type NL input: "Purchase agreement for 742 Evergreen Terrace, buyer Homer Simpson, seller Ned Flanders, $315000, closing May 5 2026"
3. Verify field preview populates (address, buyer, seller, price)
4. Click Generate → wait for API response
5. Verify PDF download link appears
6. Click download → verify file is a valid PDF (not empty)
7. Navigate /aire/contracts → verify new contract in list
8. Click "Send for Signatures" → verify redirect to AirSign
```

---

## TOOL 5: MORNING BRIEF

### Must Work
- [ ] Brief renders with date header and generation timestamp
- [ ] Executive Summary section — 2-3 sentences about the day's priorities
- [ ] Deadlines section — grouped by urgency (overdue, today, upcoming)
- [ ] Pipeline section — active deals with status and days to close
- [ ] Contacts section — who to reach out to today (relationship intelligence)
- [ ] Required Actions — numbered list of specific things to do
- [ ] Approve/Dismiss buttons functional (updates DB status)
- [ ] Brief uses real transaction data from DB (not placeholder text)
- [ ] Cron generates brief daily at 6:30 AM CT
- [ ] Brief accessible from dashboard quick-link and `/aire/morning-brief`
- [ ] No crashes on any data shape (arrays, objects, nulls all handled)

### User Experience
A real estate agent should:
1. Open AIRE every morning
2. See their brief on the dashboard or click "Brief" in the sidebar
3. Read 30 seconds: what's urgent, what's coming, who to call
4. Click Approve → brief is acknowledged
5. Feel like they have a personal assistant who prepped their day

### Playwright Test
```
1. Navigate /aire/morning-brief
2. Verify page loads without error (no crash, no blank page)
3. Verify "Executive Summary" section has text content
4. Verify "Required Actions" section has numbered items
5. Verify Approve/Dismiss buttons visible
6. Click Approve → verify status updates to "Approved"
```

---

## TOOL 6: COMPLIANCE SCANNER

### Must Work
- [ ] Scans all active transactions against Louisiana LREC rules
- [ ] Shows compliance score (percentage)
- [ ] Critical issues highlighted in red with "CRITICAL" badge
- [ ] Warnings shown with "WARNING" badge
- [ ] Each violation shows: rule description, property address, what's wrong, how many days overdue
- [ ] Deadline violations detected (earnest money, inspection, financing, closing)
- [ ] Missing document violations detected (disclosure, inspection report, etc.)
- [ ] Can scan a specific transaction
- [ ] Results update when transactions are updated (not stale)

### User Experience
A real estate agent should:
1. Click "Compliance" in sidebar (or "Run Compliance" on dashboard)
2. See at a glance: how many issues, how serious
3. Know exactly which deal has which problem
4. Never get surprised by a missed deadline or missing document

### Playwright Test
```
1. Navigate /aire/compliance
2. Verify page loads with scan results
3. Verify at least one compliance issue shows (we have overdue deadlines in test data)
4. Verify CRITICAL badge appears on overdue items
5. Verify property address shown on each violation
```

---

## TOOL 7: VOICE COMMANDS

### Must Work
- [ ] Voice bar visible on `/aire` dashboard
- [ ] Click mic → browser speech recognition activates (Chrome only)
- [ ] Spoken command classified by intent (28 regex patterns + Claude fallback)
- [ ] "Show my pipeline" → returns transaction list
- [ ] "What deadlines are due this week" → returns deadline info
- [ ] "Update status on [address] to [status]" → updates transaction
- [ ] SSE streaming endpoint returns results in real-time
- [ ] Voice analytics page shows: total commands, avg response time, fast-path rate, intent distribution
- [ ] Failed classifications return "I didn't understand" with suggestions (not a crash)

### User Experience
A real estate agent should:
1. Click the mic button
2. Say what they want in plain English
3. Get an answer or action in under 3 seconds
4. Feel like talking to a smart assistant, not a command line

### Playwright Test
```
1. Navigate /aire
2. Verify voice bar component visible
3. Navigate /aire/voice-analytics
4. Verify analytics dashboard loads (metrics, charts, timing)
5. Test API directly: POST /api/voice-command/v2 with body {"transcript": "show my pipeline"}
6. Verify response contains intent and result data
```

---

## TOOL 8: EMAIL INTELLIGENCE

### Must Work
- [ ] `/aire/email` shows triage dashboard with 3 categories: Needs Response, Missed Calls, Critical
- [ ] "Connect Gmail" button visible when no account connected
- [ ] Gmail OAuth flow works (redirect to Google, get token, store in DB)
- [ ] "Scan Now" triggers inbox scan
- [ ] Unanswered emails categorized by urgency
- [ ] "Draft Reply" generates Claude-written response in Ninja Selling tone
- [ ] Missed calls section populated (requires Twilio)
- [ ] Comms scan cron runs every 30 minutes
- [ ] Morning brief includes email/comms section

### User Experience
A real estate agent should:
1. Connect their Gmail once
2. See which emails need a response (sorted by urgency)
3. Click "Draft Reply" → get a professional response they can edit and send
4. Never miss a client message again

### Playwright Test
```
1. Navigate /aire/email
2. Verify triage dashboard loads
3. Verify "Connect Gmail" button visible (or connected account shown)
4. Verify 3 category cards: Needs Response, Missed Calls, Critical
5. Navigate /aire/settings/email
6. Verify email settings page loads
```

---

## TOOL 9: BILLING (Stripe)

### Must Work
- [ ] 3 tiers displayed: AIRE Access ($0), AIRE Pro ($97/mo), AIRE Investor ($197/mo)
- [ ] Each tier lists correct features
- [ ] "Subscribe" on Pro → redirects to Stripe checkout (test mode)
- [ ] Complete test payment → Stripe webhook fires → user tier updates to PRO in DB
- [ ] User returns to app → PRO features unlocked (subscription gates work)
- [ ] Same flow for Investor tier ($197)
- [ ] Free tier users see gated features with upgrade prompts
- [ ] Webhook signature verification works (STRIPE_WEBHOOK_SECRET set)

### User Experience
A real estate agent should:
1. See the pricing page and understand what each tier includes
2. Click Subscribe → seamless Stripe checkout
3. Come back to the app → everything just works at their tier level
4. Never see a broken checkout or confusing error

### Playwright Test
```
1. Navigate /billing
2. Verify 3 pricing cards render with correct prices ($0/$97/$197)
3. Verify feature lists on each card
4. Verify "Subscribe" button exists on Pro and Investor cards
5. Click Subscribe on Pro → verify redirect to Stripe checkout URL
```

---

## THE FULL LIFECYCLE TEST (End-to-End)

When ALL tools pass individually, run this sequence:

```
1. Sign up → land on onboarding
2. Create a transaction (742 Evergreen Terrace, $325K)
3. Upload a purchase agreement PDF → auto-classifies + extracts
4. Write a contract from natural language → generates PDF
5. Send contract for signatures via AirSign → signer gets email
6. Signer opens link → signs document → sealed PDF generates
7. Morning brief shows the deal, deadlines, action items
8. Compliance scan catches any violations
9. Voice command: "Show my pipeline" → returns the deal
10. Billing: upgrade to Pro → features unlock
11. Email: connect Gmail → scan inbox (requires real Gmail OAuth)
```

**When all 11 steps work → ship it.**

---

## CURRENT STATUS (April 4, 2026)

| Tool | Pages Load | Core Function | E2E Tested | Status |
|------|-----------|---------------|------------|--------|
| AirSign | PASS | Fields don't save | NO | Agent A working |
| TC | PASS | Duplicates in list | NO | Agent B working |
| Documents | PASS | Upload wired but untested | NO | Agent B Phase 3 |
| Contracts | PASS | Writer untested in browser | NO | Agent B Phase 4 |
| Morning Brief | PASS | Works (crash fixed) | YES | DONE |
| Compliance | PASS | Works with real violations | YES | DONE |
| Voice | PASS | Untested with real input | NO | Future |
| Email | PASS | Needs Gmail OAuth | NO | Future |
| Billing | PASS | Needs Stripe webhook test | NO | Future |
