# AGENT B: TC + Document Pipeline + Contract Writer E2E
**Priority:** HIGH — The core deal management loop must work completely
**Goal:** An agent can create a transaction, upload a document that auto-classifies and extracts, write a contract from natural language, and send it for signing. Every step verified with Playwright.

---

## CONTEXT

Working directory: `c:\Users\cjjfr\OneDrive\AIRE ALL FILES\aire-assistant\`
Stack: Next.js 16, Prisma, Neon PostgreSQL, Clerk, Vercel Blob, Claude API
Dev server: `http://localhost:3000` (already running)
All env vars set including `ANTHROPIC_API_KEY`, `BLOB_READ_WRITE_TOKEN`

### What Already Works (Verified by CEO Playwright test)
- `/aire/transactions` — List loads with search, filter (All/Active/Pending/Closed), sort
- `/aire/transactions/[id]` — 5-tab detail with smart suggestions, deadline alerts, progress bar
- `/aire/compliance` — LREC rules engine finds real violations (2 critical, 18 warnings)
- `/aire/contracts` — List page with empty state + "Write Contract" button
- Document upload route — full extraction pipeline wired (classify → extract → auto-file → workflow advance)

### What Needs Testing/Fixing
1. **Duplicate transactions** — List shows 6 entries for 3 unique deals. Check DB seeding or query.
2. **Create transaction form** — `/aire/transactions/new` untested. Verify all fields work.
3. **Document upload in transaction detail** — Agent 3 built a drag-and-drop UI in Documents tab, but never browser-tested it.
4. **Contract writer E2E** — `/aire/contracts/new` form exists but NL input → PDF generation never tested in browser.
5. **Contract → AirSign flow** — "Send for Signatures" button on generated contract should create an AirSign envelope. Untested.
6. **Deadline "Mark Complete"** — Button visible but untested.
7. **Communications quick-send** — Templates exist but API call untested.

---

## YOUR MISSION — 6 PHASES

### PHASE 1: FIX DUPLICATE TRANSACTIONS (20 min)

1. Open `/aire/transactions` and count entries
2. Query DB directly: `npx prisma studio` or API call to check how many Transaction records exist
3. If duplicates exist from double-seeding, delete the duplicates
4. If the query is wrong (fetching all users' transactions), fix the `where` clause to filter by `userId`
5. **Verify:** Transaction list shows exactly 3 unique deals (5834 Guice Dr, 1422 Convention St, 8901 Highland Rd)

### PHASE 2: TEST CREATE TRANSACTION (30 min)

1. Navigate to `/aire/transactions/new`
2. Fill the form with test data:
   - Property: 742 Evergreen Terrace, Baton Rouge, LA 70808
   - List Price: $325,000
   - Offer Price: $315,000
   - Buyer: Homer Simpson, homer@test.com
   - Seller: Ned Flanders, ned@test.com
   - MLS: MLS-2026-TEST
   - Contract Date: today
   - Closing Date: 30 days from now
3. Submit → verify redirect to transaction detail
4. Verify all 5 tabs load with the entered data
5. Verify deadlines auto-calculated from contract/closing dates
6. Check sidebar badge count updated (should show 5 active now)
7. Fix any bugs — form validation, date parsing, API errors

### PHASE 3: TEST DOCUMENT UPLOAD + EXTRACTION (1 hour)

This is the critical pipeline test.

1. Go to transaction detail for 742 Evergreen Terrace → Documents tab
2. Check that a drag-and-drop upload zone exists (Agent 3 built this)
3. Create a simple test PDF:
   ```bash
   # Use the contract writer API to generate a test document
   curl -X POST http://localhost:3000/api/contracts/write \
     -H "Content-Type: application/json" \
     -d '{"input": "Purchase agreement for 742 Evergreen Terrace, buyer Homer Simpson, seller Ned Flanders, price $315000"}'
   ```
4. Upload that PDF to the Documents tab
5. Verify in the UI:
   - Classification badge appears (e.g., "Purchase Agreement" or "LREC-101")
   - Extracted fields display inline (buyer name, seller name, price, address)
   - Document auto-filed to this transaction (not a different one)
   - Workflow state machine advanced
6. If extraction doesn't run:
   - Check `app/api/documents/upload/route.ts` — the extraction pipeline is wired (steps 1-7)
   - Check browser console/network for errors
   - Check if `ANTHROPIC_API_KEY` is set (needed for Claude Vision multi-pass extraction)
7. Upload a second document (a disclosure or addendum) — verify it also classifies and extracts

### PHASE 4: TEST CONTRACT WRITER (30 min)

1. Navigate to `/aire/contracts/new`
2. Read `app/aire/contracts/new/ContractForm.tsx` — understand the form layout
3. Fill the form:
   - Natural language input: "Write a purchase agreement for 742 Evergreen Terrace, Baton Rouge LA 70808. Buyer is Homer Simpson, Seller is Ned Flanders. Purchase price $315,000. Closing date May 5, 2026. Standard inspection and financing contingencies. 10-day inspection period."
   - Form type: LREC-101 (if dropdown exists)
   - Transaction: 742 Evergreen Terrace (if picker exists)
4. Click Generate → wait for Claude API to process
5. Verify:
   - PDF generates (not empty/error)
   - PDF contains correct parties, price, address
   - Louisiana-specific clauses included (inspection, financing, termite, flood)
   - Download button works
   - Contract appears in `/aire/contracts` list
6. Fix any bugs — API timeout, Claude prompt issues, pdf-lib generation errors

### PHASE 5: TEST CONTRACT → AIRSIGN FLOW (30 min)

1. On the generated contract, click "Send for Signatures" (if button exists)
2. Verify:
   - PDF uploaded to Vercel Blob
   - AirSign envelope created with the PDF
   - Signers auto-populated from contract parties (Homer + Ned)
   - Redirect to AirSign envelope detail
3. If "Send for Signatures" doesn't exist or doesn't work:
   - Check `ContractForm.tsx` for the button handler
   - Check if it calls the AirSign envelope creation API
   - Wire it: POST to `/api/airsign/envelopes` with document URL + signer info from contract
4. **This connects to Agent A's work** — once the envelope is created, Agent A's fixed signing flow takes over

### PHASE 6: PLAYWRIGHT E2E TEST (30 min)

Full deal lifecycle test using Chrome DevTools MCP:

1. `/aire/transactions/new` → create transaction → verify in list
2. Transaction detail → Documents tab → upload PDF → verify extraction
3. `/aire/contracts/new` → write contract → verify PDF generates
4. Contract → "Send for Signatures" → verify AirSign envelope created
5. `/aire/compliance` → verify new transaction scanned
6. Transaction detail → Deadlines tab → "Mark Complete" on a deadline → verify update
7. Dashboard → verify pipeline value updated with new deal

**Report test results to `AGENT_MISSIONS/TEST_RESULTS.md`**

---

## KEY FILES

| File | Purpose |
|------|---------|
| `app/aire/transactions/page.tsx` | Transaction list |
| `app/aire/transactions/new/page.tsx` | Create transaction form |
| `app/aire/transactions/[id]/page.tsx` | Transaction detail (5 tabs) |
| `components/tc/TransactionDetail.tsx` | Detail component with tabs |
| `app/api/transactions/route.ts` | Transaction CRUD API |
| `app/api/documents/upload/route.ts` | Upload + classify + extract pipeline |
| `app/aire/contracts/new/ContractForm.tsx` | Contract writer form |
| `app/api/contracts/write/route.ts` | NL → PDF generation API |
| `lib/contracts/contract-writer.ts` | Claude NL parsing + pdf-lib generation |
| `lib/contracts/clause-library.ts` | 50+ Louisiana legal clauses |
| `lib/document-classifier.ts` | Pattern + Claude classification |
| `lib/multi-pass-extractor.ts` | 5-pass Claude Vision extraction |

## DO NOT
- Rebuild the document pipeline (it's wired — just test it)
- Rebuild the contract writer (it exists — just test it)
- Change the Prisma schema
- Skip the Playwright verification
- Build new features — this is a TEST AND FIX mission
