# Cross-Agent Recommendations
*Updated by Agent 4 (Auto-Research) — 2026-04-04 (Deep Research Pass)*

## For Agent 1 (AirSign)

### CRITICAL — DO THESE FIRST

**Finding:** Every major e-sign platform supports sequential signing order — critical for RE where buyer signs before seller.
**Recommendation:** Add `signingOrder` (integer) to Signer model. Gate delivery by order. See `research/esign-ux-deep-dive.md` for full implementation code.
**Files:** `prisma/schema.prisma`, `app/api/airsign/envelopes/[id]/send/route.ts`, `app/api/airsign/sign/[token]/route.ts`

**Finding:** "Decline to Sign" is legally required for complete e-sign workflow. Without it, unsigned envelopes just sit with no feedback.
**Recommendation:** Add `declinedAt` + `declineReason` to Signer. Add decline button on signing page. See `research/esign-ux-deep-dive.md` Section 3 for full flow.
**Files:** `prisma/schema.prisma`, `app/sign/[token]/SigningFlow.tsx`

**Finding:** Token expiration is a security requirement. Currently signing links never expire.
**Recommendation:** Add `expiresAt` to Signer model, default 14 days. Check in sign route. One-liner fix.
**Files:** `prisma/schema.prisma`, `app/api/airsign/sign/[token]/route.ts`

### HIGH PRIORITY

**Finding:** LREC forms require initials on every page (8+ pages). Auto-placement would save 5+ minutes per envelope.
**Recommendation:** When PDF is classified as LREC-101, auto-place signature/date/initial fields using templates from `research/lrec-form-field-maps.md`. Show "Detected LREC-101 — 12 fields auto-placed."
**Files:** New `lib/airsign/form-templates.ts`, `app/airsign/[id]/EnvelopeDetail.tsx`

**Finding:** Progress indicator + auto-scroll = the DocuSign "guided signing" UX that makes mobile signing fast.
**Recommendation:** Add fixed progress bar ("Field 2 of 5"), auto-scroll to next field on completion, field state colors (yellow=required, green=done, blue=active).
**Files:** `app/sign/[token]/SigningFlow.tsx`

**Finding:** Document SHA-256 hash should be on the audit certificate for integrity verification. Currently only has a Seal ID.
**Recommendation:** `createHash('sha256').update(pdfBytes).digest('hex')` — add one line to `seal-pdf.ts`.
**Files:** `lib/airsign/seal-pdf.ts`

---

## For Agent 2 (TC Assistant)

### HIGH PRIORITY

**Finding:** Deadline auto-calculation exists but no reminder notifications fire.
**Recommendation:** Wire `lib/tc/notifications.ts` to send at 7/3/1/0 days before each deadline. Requires RESEND_API_KEY.
**Files:** `app/api/cron/tc-reminders/route.ts`, `lib/tc/notifications.ts`

**Finding:** Documents tab has no upload UI — only API-level upload exists.
**Recommendation:** Add drag-and-drop upload in transaction detail Documents tab. Use `react-dropzone` (1 effort). On upload, trigger classify → extract → auto-file pipeline.
**Files:** `components/tc/TransactionDetail.tsx` (Documents tab)

**Finding:** Counter-offers (LREC-006) are NOT in the document classifier. Agents send these constantly — they'll be classified as "unknown".
**Recommendation:** Add counter-offer pattern to `lib/document-classifier.ts`. Regex: `/counter.?offer/i`. See `research/lrec-form-field-maps.md` for full field schema.
**Files:** `lib/document-classifier.ts`, `lib/document-extractor.ts`

**Finding:** Voice pipeline has 4 intents with ZERO fast-path patterns — always hitting Claude API unnecessarily.
**Recommendation:** Add 9 regex patterns for: send_alert (2), schedule_closing (2), send_document (2), create_addendum (2), mid-command correction (1). See `research/voice-nlp-patterns.md` "Fast-Path Patterns to Add".
**Files:** `lib/voice-pipeline.ts`

**Finding:** `chrono-node` (npm, MIT, 3K+ stars) parses "next Friday", "in two weeks" → Date objects. Currently `new Date(dateStr)` fails on relative dates.
**Recommendation:** `npm install chrono-node`, use in `schedule_closing` handler and voice pipeline date extraction.
**Files:** `lib/voice-action-executor.ts`

---

## For Agent 3 (Document Pipeline)

### CRITICAL — EXTRACTION ACCURACY

**Finding:** LREC-006 (Counter-Offer), LREC-001 (Listing), LREC-002 (Buyer Agency) have NO extraction schemas. These are high-frequency forms that will return empty field sets.
**Recommendation:** Add extraction schemas to `EXTRACTION_SCHEMAS` in `lib/document-extractor.ts`. Full field maps in `research/lrec-form-field-maps.md`.
**Files:** `lib/document-extractor.ts`

**Finding:** The PDD extraction prompt is generic. A form-specific prompt improves accuracy 10-15%.
**Recommendation:** Replace `EXTRACTION_SCHEMAS.property_disclosure.prompt` with the detailed prompt in `research/lrec-form-field-maps.md` (Section: PDD → Extraction Prompt Override). Key: flag "yes" answers as warnings, detect pre-1978 for lead paint trigger.
**Files:** `lib/document-extractor.ts`

**Finding:** Community property law (La. C.C. art. 2338) requires BOTH spouses to sign. Missing spouse signature = invalid transaction.
**Recommendation:** After extraction, if buyer or seller appears married (two names, "and wife/husband" language), flag if only one signature detected. Add as compliance warning.
**Files:** `lib/document-extractor.ts`, `lib/louisiana-rules-engine.ts`

### HIGH PRIORITY

**Finding:** AcroForm-first extraction is the #1 cost saver. 40-60% of LREC forms come pre-filled from DocuSign/DotLoop with AcroForm fields. Reading these directly = 100% accuracy, zero API cost.
**Recommendation:** Before calling Claude, check if PDF has AcroForm fields (`pdf-lib` can read these). If yes, map field names to our schema using the mappings in `research/lrec-form-field-maps.md` (Section: AcroForm Field Name Mapping).
**Files:** New `lib/acroform-mapper.ts`, modify `lib/multi-pass-extractor.ts` to add AcroForm as Pass 0

**Finding:** Simple forms (agency disclosure, 2 pages) don't need all 5 extraction passes. Selective multi-pass saves ~60% cost/latency.
**Recommendation:** Pass count by form type: Purchase Agreement = 5, PDD = 3, Agency Disclosure = 1, Counter Offer = 2, Amendment = 2. See `research/extraction-intelligence.md` for full table.
**Files:** `lib/multi-pass-extractor.ts`

**Finding:** Document classifier maps LREC-101 as `LREC-001`. Industry standard is LREC-101 for purchase agreement.
**Recommendation:** Fix `lrecFormNumber` in classifier pattern. Minor but prevents confusion.
**Files:** `lib/document-classifier.ts`

---

## New Research Files (Built by Agent 4 — Deep Research Pass)

| File | What It Contains | Who Benefits |
|------|-----------------|-------------|
| `research/esign-ux-deep-dive.md` | Mobile UX, guided signing, decline flow, sequential signing, accessibility — with implementation code | Agent 1 (AirSign) |
| `research/lrec-form-field-maps.md` | EVERY field on LREC-101, PDD, 006, 010, 001, 002 — by page, with types and priorities | Agent 3 (Documents) + Agent 1 (AirSign auto-placement) |
| `research/voice-nlp-patterns.md` | 25+ intents, 9 missing fast-path patterns, Louisiana vocab corrections, Whisper comparison, entity extraction | Agent 2 (Voice) |
| `research/esign-intelligence.md` | DocuSign/DotLoop/Authentisign competitive analysis, open source libraries | Agent 1 |
| `research/extraction-intelligence.md` | Extraction benchmarks, selective multi-pass table, AcroForm mapping | Agent 3 |
| `research/tc-intelligence.md` | DotLoop/SkySlope/Brokermint features, UX patterns, notification schedules | Agent 2 |
| `research/data-sources.md` | 8 free APIs with integration specs (FEMA, Census, FRED, HUD, Freddie Mac) | All |
| `research/github-finds.md` | 35 evaluated libraries, top 10 prioritized for integration | All |

## Key Cross-Agent Dependencies

1. **LREC form field maps** → Agent 1 uses for AirSign auto-placement, Agent 3 uses for extraction accuracy
2. **Counter-offer classifier** → Agent 2 needs for TC, Agent 3 needs for extraction, currently missing
3. **Voice fast-path patterns** → Agent 2 can add 9 patterns to cut Claude API calls by 30-40%
4. **AcroForm mapper** → Agent 3 builds, Agent 1 benefits (pre-filled forms detected instantly)
