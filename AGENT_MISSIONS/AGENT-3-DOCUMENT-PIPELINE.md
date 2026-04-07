# AGENT 3 MISSION: Document Pipeline — Upload, Classify, Extract, Auto-File
**Priority:** HIGH — Connects AirSign and TC. Documents are the blood of every deal.
**Goal:** Agent uploads a PDF anywhere in the app → system auto-classifies it, extracts every field, links it to the right transaction, and tells the agent what it found. Zero manual data entry.

---

## CONTEXT — READ BEFORE DOING ANYTHING

You are working in: `c:\Users\cjjfr\OneDrive\AIRE ALL FILES\aire-assistant\`
Stack: Next.js 14, Prisma, Neon PostgreSQL, Clerk auth, Vercel, Claude API (Anthropic)

### What Already Exists (DO NOT REBUILD)
- `lib/document-classifier.ts` — Claude API classification + pattern matching + few-shot learning
- `lib/document-extractor.ts` — PDF text extraction + AcroForm field reading
- `lib/multi-pass-extractor.ts` — 5-pass Claude Vision extraction (real, production-grade)
- `lib/document-memory.ts` — Learning system that improves from past classifications
- `lib/document-autofiler.ts` — Auto-links documents to transactions by matching extracted data
- `app/api/documents/extract/route.ts` — Full extraction endpoint (WORKS)
- `app/api/documents/upload/route.ts` — Upload endpoint (classifies by filename ONLY — does NOT extract)
- `app/aire/documents/page.tsx` — Documents page (may exist)

### The Critical Gap
**Upload does NOT trigger extraction.** When a user uploads a PDF:
1. It gets stored in Vercel Blob ✓
2. It gets classified by filename pattern ✓  
3. A Document record is created in Prisma ✓
4. **It does NOT run the multi-pass extractor** ← THIS IS THE GAP
5. **It does NOT auto-file to a transaction** ← AND THIS
6. **It does NOT show extracted fields to the user** ← AND THIS

The extraction code is REAL and WORKING at `/api/documents/extract`. It just never gets called after upload.

---

## YOUR MISSION — 5 PHASES

### PHASE 1: WIRE UPLOAD → EXTRACTION
**Time estimate: 1 hour**

The single most important fix in the entire platform.

1. Read `app/api/documents/upload/route.ts` completely
2. Read `app/api/documents/extract/route.ts` completely
3. After the upload route classifies the document, add a call to run extraction:
   - Option A: Call the extract logic directly (import the functions)
   - Option B: Make an internal fetch to `/api/documents/extract`
   - **Prefer Option A** — no network hop, same request context
4. The extraction should:
   - Get the uploaded PDF from Blob URL
   - Run classification (already done by upload — pass the result through)
   - Run multi-pass Vision extraction (the 5-pass Claude pipeline)
   - Save extracted fields to the Document record in Prisma
   - Run auto-filer to link document to matching transaction
   - Trigger workflow state machine: `onDocumentUploaded(transactionId, docType, userId)`

**Key files to modify:**
- `app/api/documents/upload/route.ts` — add extraction call after upload
- Possibly `lib/document-autofiler.ts` — verify it correctly matches documents to transactions

**Test:**
```bash
# Upload a test PDF via curl
curl -X POST http://localhost:3000/api/documents/upload \
  -H "Content-Type: multipart/form-data" \
  -F "file=@test.pdf" \
  -F "transactionId=<some-transaction-id>"
```

Verify in Prisma Studio:
- Document record exists with `extractedData` field populated
- Document is linked to correct transaction
- WorkflowEvent logged

**DONE WHEN:** Upload a PDF → extraction runs automatically → fields saved to DB.

### PHASE 2: UPLOAD UI IN TRANSACTION DETAIL
**Time estimate: 1.5 hours**

Add a document upload experience to the transaction detail Documents tab.

1. Read `components/tc/TransactionDetail.tsx` — find the Documents tab
2. Add upload functionality:
   - Drag-and-drop zone: "Drop documents here or click to upload"
   - Accepts: PDF, JPG, PNG (for scanned documents)
   - Shows upload progress bar
   - After upload + extraction completes, shows:
     ```
     ✓ Purchase Agreement detected
     Extracted: Buyer: John Smith, Seller: Jane Doe
     Price: $200,000, Closing: May 15, 2026
     Auto-filed to this transaction
     ```
   - If extraction finds a different transaction match, ask: "This looks like it belongs to [other deal]. File here or move it?"

3. Document list in the tab:
   - Show all documents linked to this transaction
   - Each document shows: type badge, filename, upload date, extracted fields preview
   - Click document → expand to show all extracted data
   - Download button for original PDF
   - If document came from AirSign → show signing status

**UI Requirements:**
- Upload zone is prominent — not hidden behind a button
- During extraction (takes 5-10 seconds), show: "Analyzing document... Extracting fields..."
- Success state is celebratory — the agent should feel like the system just saved them 20 minutes of data entry

**DONE WHEN:** Agent drags a PDF onto the Documents tab → sees extracted data in 10 seconds.

### PHASE 3: DOCUMENT INTELLIGENCE DISPLAY
**Time estimate: 1.5 hours**

When a document is extracted, the data should be USEFUL, not just raw JSON.

1. Create a document detail component that shows extracted data in a structured way:

**For Purchase Agreement (LREC-101):**
```
PARTIES
  Buyer: John Smith
  Seller: Jane Doe
  Buyer's Agent: Caleb Jackson
  Seller's Agent: N/A

DEAL TERMS
  Purchase Price: $200,000
  Earnest Money: $5,000
  Financing: Conventional
  Closing Date: May 15, 2026

KEY DATES
  Inspection Deadline: May 1, 2026
  Financing Deadline: April 25, 2026
  Appraisal Deadline: April 20, 2026

LOUISIANA SPECIFIC
  Parish: East Baton Rouge
  Flood Zone: X (no flood insurance required)
  Mineral Rights: Seller retains
  Termite Certificate: Required
```

**For Property Disclosure (LREC-102):**
```
PROPERTY CONDITION
  Foundation Issues: None disclosed
  Roof Age: 5 years
  HVAC Age: 3 years
  Known Defects: Minor crack in garage floor
  Lead Paint: No (built 2005)
  
RED FLAGS
  ⚠️ "As-is" language detected in Section 4
  ⚠️ Seller noted previous water damage (repaired 2022)
```

2. For each document type, create a structured display template
3. Highlight RED FLAGS — anything unusual the agent should know about:
   - "As-is" clauses
   - Unusual contingencies
   - Missing required disclosures
   - Dates that don't match the transaction record
   - Price discrepancies

4. **Auto-sync extracted data to transaction:**
   - If a purchase agreement is uploaded and the transaction doesn't have buyer/seller names yet, ask: "Update transaction with extracted data?" → one click to sync

**DONE WHEN:** Agent uploads a document and gets a formatted, highlighted summary with red flags.

### PHASE 4: DOCUMENT CHECKLIST BY DEAL STAGE
**Time estimate: 1 hour**

Every deal stage requires certain documents. Show the agent what's missing.

1. Create `lib/documents/document-checklist.ts`:

```typescript
const REQUIRED_DOCUMENTS = {
  UNDER_CONTRACT: [
    { type: 'PURCHASE_AGREEMENT', label: 'Purchase Agreement (LREC-101)', required: true },
    { type: 'PROPERTY_DISCLOSURE', label: 'Property Disclosure (LREC-102)', required: true },
    { type: 'EARNEST_MONEY_RECEIPT', label: 'Earnest Money Receipt', required: true },
    { type: 'LEAD_PAINT_DISCLOSURE', label: 'Lead Paint Disclosure', required: 'if built before 1978' },
    { type: 'AGENCY_DISCLOSURE', label: 'Agency Disclosure', required: true },
  ],
  INSPECTION: [
    { type: 'INSPECTION_REPORT', label: 'Home Inspection Report', required: true },
    { type: 'TERMITE_CERTIFICATE', label: 'Termite/WDI Certificate', required: true },
    { type: 'REPAIR_REQUEST', label: 'Repair Request (if applicable)', required: false },
    { type: 'REPAIR_RESPONSE', label: 'Seller Repair Response', required: false },
  ],
  APPRAISAL: [
    { type: 'APPRAISAL_REPORT', label: 'Appraisal Report', required: true },
    { type: 'APPRAISAL_ADDENDUM', label: 'Appraisal Contingency Addendum', required: false },
  ],
  FINANCING: [
    { type: 'LOAN_APPROVAL', label: 'Loan Approval Letter', required: true },
    { type: 'CLOSING_DISCLOSURE', label: 'Closing Disclosure (CD)', required: true },
  ],
  CLOSING: [
    { type: 'TITLE_COMMITMENT', label: 'Title Commitment', required: true },
    { type: 'SURVEY', label: 'Survey', required: false },
    { type: 'HOA_DOCS', label: 'HOA Documents (if applicable)', required: false },
    { type: 'FINAL_WALKTHROUGH', label: 'Final Walk-Through Confirmation', required: true },
  ],
}
```

2. Display in the Documents tab as a checklist:
```
UNDER CONTRACT (3 of 5 complete)
  ✓ Purchase Agreement — uploaded Mar 28
  ✓ Property Disclosure — uploaded Mar 28  
  ✓ Earnest Money Receipt — uploaded Mar 30
  ○ Lead Paint Disclosure — NOT REQUIRED (built 2005)
  ○ Agency Disclosure — MISSING ⚠️ [Upload]

INSPECTION (0 of 2 complete)  
  ○ Home Inspection Report — DUE IN 5 DAYS [Upload]
  ○ Termite Certificate — DUE IN 5 DAYS [Upload]
```

3. Missing required documents = action items that surface in:
   - Transaction detail header
   - Main dashboard alerts
   - Morning brief

**DONE WHEN:** Agent sees exactly which documents are missing for their current deal stage.

### PHASE 5: BATCH UPLOAD + EMAIL ATTACHMENT SCANNING
**Time estimate: 1 hour**

1. **Batch Upload:**
   - Allow multiple files in the upload zone
   - Process each file independently (parallel classification + extraction)
   - Show results as a list: "3 documents processed: 2 filed, 1 needs manual review"

2. **Email Attachment Integration:**
   - `lib/agents/email-scanner.ts` already scans emails for PDF attachments
   - Verify it correctly:
     - Downloads PDF attachments from Gmail
     - Runs classification
     - Creates Document records
     - Links to transactions
   - Wire extraction into this flow (same gap as Phase 1 — scan finds doc but doesn't extract)

3. **Document Memory Enhancement:**
   - When agent corrects a classification ("This isn't an inspection report, it's an addendum"), save the correction
   - `lib/document-memory.ts` already has this capability — verify it works
   - Next time a similar document is uploaded, the correction is applied

**DONE WHEN:** Can upload 5 PDFs at once, all get classified and extracted. Email scanner finds attachments and processes them.

---

## SUCCESS CRITERIA — HOW CALEB WILL TEST

1. Go to a transaction detail → Documents tab
2. Drag a purchase agreement PDF onto the upload zone
3. See "Analyzing document..." for a few seconds
4. See: "Purchase Agreement detected — Buyer: X, Seller: Y, Price: $Z"
5. Document appears in the checklist with green checkmark
6. Extracted data matches what's in the PDF
7. Upload 3 more documents → all classified and extracted correctly
8. Missing documents show with red "MISSING" badges
9. Document data auto-suggests updating transaction record

If all 9 steps work → Document Pipeline is DONE.

---

## RULES
- DO NOT rebuild the classifier, extractor, or multi-pass pipeline. They work. Just wire them together.
- DO NOT skip the Claude Vision extraction. It's the most accurate extraction method.
- The extraction takes 5-10 seconds (Claude API call per pass) — always show loading state.
- ANTHROPIC_API_KEY is already in .env.local — the extraction code uses it.
- If a document can't be classified, default to "OTHER" and let the user manually categorize.
- If extraction fails, still save the document — don't lose the upload.
- If you hit a blocker, write it to `AGENT_MISSIONS/BLOCKERS.md`.
- If you modify shared files, document in `AGENT_MISSIONS/SHARED_CHANGES.md`.
