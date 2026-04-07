# Shared File Changes
<!-- Agents: Log changes to shared files here. Format: -->
<!-- ## Agent [N] — [File Changed] -->
<!-- **What:** description of change -->
<!-- **Why:** reason -->
<!-- **Impact on other agents:** what they need to know -->

## Agent 3 — `components/tc/TransactionDetail.tsx`
**What:** Major upgrade to Documents tab — drag-and-drop upload zone, extraction results display, document checklist by deal stage, batch upload support, expandable extracted fields per document.
**Why:** Phase 2-5 of Document Pipeline mission. Upload now triggers full extraction and shows results inline.
**Impact on other agents:** Agent 2 (TC) — the Documents tab now expects `fileUrl`, `filledData`, `pageCount` fields on Document objects. The transaction detail API already returns these via `include: { documents: true }`.

## Agent 3 — `app/api/documents/upload/route.ts`
**What:** Wired full extraction pipeline into upload route. After blob upload + classification, now runs AcroForm → text stream → multi-pass Vision extraction, auto-files to transactions, logs to document memory. Returns enriched response with classification, extraction, and auto-file results.
**Why:** Phase 1 — the critical gap. Upload previously only classified by filename.
**Impact on other agents:** Agent 1 (AirSign) — AirSign webhook that creates documents could also benefit from extraction, but that's a separate concern.

## Agent 2 — `components/tc/TransactionDetail.tsx`
**What:** Full rewrite with command center header (progress bar, Day X of Y, % complete, days-to-close), smart action cards powered by `lib/tc/smart-suggestions.ts`, 10 communication templates (up from 4) with preview-before-send, drag-and-drop upload zone with extraction results, quick action sidebar links.
**Why:** Phase 3-5 of TC Assistant mission. Agent opens a deal and immediately sees what to do next.
**Impact on other agents:** Agent 3 — Documents tab now shows drag-and-drop zone + extraction results (same data contract as before). No API changes.

## Agent 2 — `app/aire/transactions/new/NewTransactionForm.tsx`
**What:** Full rewrite with Quick Create mode (5 fields) + Full Details mode (3-step wizard). Added fields: Parish dropdown, Earnest Money, Financing Type, Buyer/Seller Agent, Your Role (buyer/seller/dual). Auto-calculated deadline preview.
**Why:** Phase 2 of TC mission. A new agent should create a deal in under 2 minutes.
**Impact on other agents:** None — this is Agent 2's owned file. API contract unchanged.

## Agent 2 — NEW `lib/tc/smart-suggestions.ts`
**What:** New file. Smart suggestions engine that analyzes a transaction's status, deadlines, documents, and party info to generate prioritized action items (urgent/warning/info). Used in TransactionDetail action cards.
**Why:** Phase 4 — automated nudges. Also exports `getDashboardAlerts()` for main dashboard use.
**Impact on other agents:** None — new file, read-only dependency from TransactionDetail.

## Agent 3 — `lib/agents/email-scanner.ts`
**What:** Added extraction + auto-filing after email attachment classification. Now runs multiPassExtract on downloaded PDFs and auto-files to transactions.
**Why:** Phase 5 — same extraction gap existed in email scanner flow.
**Impact on other agents:** None — this is Agent 3's owned file.
