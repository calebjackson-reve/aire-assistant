# AGENT A: AirSign End-to-End Signing Flow
**Priority:** HIGHEST — The signature product must work completely
**Goal:** A user can create an envelope, upload a PDF, place fields, send it, and a signer can open the link, sign the document, and get a sealed PDF back. Every step verified with Playwright.

---

## CONTEXT

Working directory: `c:\Users\cjjfr\OneDrive\AIRE ALL FILES\aire-assistant\`
Stack: Next.js 16, Prisma, Neon PostgreSQL, Clerk, Vercel Blob, Resend
Dev server: `http://localhost:3000` (already running)
All env vars are set: `BLOB_READ_WRITE_TOKEN`, `RESEND_API_KEY`, `AIRSIGN_INTERNAL_SECRET`

### What Already Works (Verified by CEO Playwright test)
- `/airsign` — Dashboard loads, shows envelope counts
- `/airsign/[id]` — PDF renders via pdf.js canvas (was broken, now fixed)
- Field placement — click Signature/Date/etc, click on PDF, field appears with correct signer
- Field editing — label, signer dropdown, required checkbox, delete all work
- Signer display — name, email, role, audit trail visible

### What's Broken (Found by CEO test)
1. **Fields don't persist after save** — "Save N Fields" button clicks, but after page reload, FIELDS (0). The save API may not be wiring correctly.
2. **Send for signing fails silently** — Button clicks but status stays DRAFT. The send API at `/api/airsign/envelopes/[id]/send` requires `fields.length > 0` in DB. If fields didn't save, send will always fail with "No signature fields placed."
3. **SSR returns 500 on envelope detail** — Page recovers client-side but initial server render fails. Check for Prisma query issues or serialization errors.
4. **Public signing flow untested** — `/sign/[token]` has never been tested with real placed fields + real PDF.
5. **Sealed PDF generation untested** — `lib/airsign/seal-pdf.ts` has never run in a real flow.

---

## YOUR MISSION — 5 PHASES

### PHASE 1: FIX FIELD SAVE (30 min)
This is the root cause of everything else failing.

1. Read `app/api/airsign/envelopes/[id]/fields/route.ts` — understand how fields are saved
2. Read `app/airsign/[id]/EnvelopeDetail.tsx` — find the save button handler, what API it calls, what payload it sends
3. Start dev server, open browser console
4. Place a signature field, click "Save 1 Field" — watch the network tab for the API call
5. Check: Does the POST/PUT fire? What's the response? Do fields exist in DB after?
6. Fix the bug. Common issues:
   - Fields saved with wrong envelope ID
   - SignerId not mapped correctly (client sends signer name, API expects signer ID)
   - Percentage coordinates calculated wrong
   - Prisma create failing silently
7. **Verify:** Place 3 fields, save, reload page — all 3 fields must still be there

### PHASE 2: FIX SEND FLOW (30 min)
Once fields persist, send should work.

1. Place fields, save, verify they persist
2. Click "Send for signing" — watch network tab
3. Expected: POST to `/api/airsign/envelopes/[id]/send`
4. Check response — if 422 with "No signature fields placed", fields still aren't in DB
5. If 200 — status should change to SENT, page should show signing URLs
6. Check: Does the page refresh/update status? Does it show the signing links?
7. Check Resend dashboard (or console logs) for email delivery
8. **Verify:** Envelope status = SENT, signer has a signing URL, email sent/logged

### PHASE 3: TEST PUBLIC SIGNING (1 hour)
This is the signer's experience — must be dead simple.

1. Get the signing URL from Phase 2 (either from Resend email, console log, or envelope detail "Copy link")
2. Open `/sign/[token]` in the browser
3. Check:
   - PDF renders with field overlays showing what needs to be filled
   - Progress indicator shows "1 of N fields"
   - Click signature field → SignatureModal opens
   - Can draw a signature on canvas
   - Can type a signature (6 fonts available)
   - After signing, field shows completed
   - After all fields complete, "Submit" button appears
4. Click Submit — check that:
   - Signer's `signedAt` timestamp is set in DB
   - If all signers complete, envelope status → COMPLETED
   - Audit trail logs the signing event
5. Fix any bugs found — mobile touch events, canvas sizing, modal z-index issues

### PHASE 4: TEST SEALED PDF (30 min)
After all signers complete, the sealed PDF should generate.

1. After Phase 3 completion, check if sealed PDF was generated
2. Read `lib/airsign/seal-pdf.ts` — understand what it does:
   - Embeds signature images at field coordinates
   - Adds audit certificate page (signer names, timestamps, IPs, hashes)
   - Returns the final PDF bytes
3. Check: Is the sealed PDF URL stored on the envelope?
4. Download the sealed PDF — verify signatures are embedded, audit page exists
5. If seal-pdf crashes, check:
   - pdf-lib encoding issues (already fixed Unicode → ASCII in prior session)
   - Signature image format (must be PNG/JPEG, not SVG)
   - Page coordinate mapping (percentage → absolute)

### PHASE 5: PLAYWRIGHT E2E TEST (30 min)
Use Chrome DevTools MCP to run the full flow automated.

1. Navigate to `/airsign/new` → create envelope
2. Upload a test PDF
3. Add a signer
4. Navigate to envelope detail → place 3 fields (Signature, Date, Text)
5. Save fields → verify FIELDS (3) after reload
6. Send for signing → verify status = SENT
7. Get signing URL → navigate to `/sign/[token]`
8. Complete all fields → submit
9. Navigate back to envelope detail → verify COMPLETED status
10. Check for sealed PDF link

**Report test results to `AGENT_MISSIONS/TEST_RESULTS.md`**

---

## KEY FILES

| File | Purpose |
|------|---------|
| `app/airsign/[id]/EnvelopeDetail.tsx` | Main UI — field placement, save, send buttons |
| `app/api/airsign/envelopes/[id]/fields/route.ts` | Field save API |
| `app/api/airsign/envelopes/[id]/send/route.ts` | Send envelope API |
| `app/sign/[token]/SigningFlow.tsx` | Public signing UI |
| `app/api/airsign/sign/[token]/route.ts` | Signing submission API |
| `lib/airsign/seal-pdf.ts` | PDF sealing with signatures + audit cert |
| `components/airsign/PDFViewer.tsx` | PDF renderer (pdf.js canvas) |
| `components/airsign/FieldPlacer.tsx` | Field placement overlay |
| `components/airsign/SignatureModal.tsx` | Signature capture (draw + type) |

## DO NOT
- Rebuild the PDF viewer (it works)
- Change the Prisma schema (it's correct)
- Add new pages or routes (they exist)
- Skip the Playwright verification — every fix must be browser-tested
