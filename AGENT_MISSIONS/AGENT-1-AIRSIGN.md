# AGENT 1 MISSION: AirSign — Electronic Signature Platform
**Priority:** HIGHEST — Nothing moves without signatures
**Goal:** AirSign works end-to-end like DocuSign/DotLoop but simpler, faster, and built for Louisiana real estate agents who aren't tech-savvy.

---

## CONTEXT — READ BEFORE DOING ANYTHING

You are working in: `c:\Users\cjjfr\OneDrive\AIRE ALL FILES\aire-assistant\`
Stack: Next.js 14, Prisma, Neon PostgreSQL, Clerk auth, Vercel
The codebase already has AirSign built — DO NOT start from scratch.

### What Already Exists (DO NOT REBUILD)
- `lib/airsign/seal-pdf.ts` — PDF manipulation with pdf-lib (embeds signatures, audit certificate)
- `app/api/airsign/upload/route.ts` — PDF upload to Vercel Blob
- `app/api/airsign/envelopes/route.ts` — Envelope CRUD (create, list)
- `app/api/airsign/envelopes/[id]/route.ts` — Envelope detail
- `app/api/airsign/envelopes/[id]/fields/route.ts` — Field placement API
- `app/api/airsign/envelopes/[id]/send/route.ts` — Send envelope (Resend email)
- `app/api/airsign/sign/[token]/route.ts` — Signer authentication + submission
- `app/api/airsign/webhook/route.ts` — Completion webhook
- `app/airsign/page.tsx` — Envelope dashboard
- `app/airsign/new/page.tsx` — Create envelope
- `app/airsign/[id]/EnvelopeDetail.tsx` — Field placement UI
- `app/sign/[token]/SigningFlow.tsx` — Public signing page
- `components/airsign/FieldPlacer.tsx` — Drag-and-drop field placement on PDF
- `components/airsign/SignatureModal.tsx` — Signature capture (draw + type, 6 fonts)

### What's Broken Right Now
1. `BLOB_READ_WRITE_TOKEN` — already in .env.local, but upload flow may not be tested
2. `RESEND_API_KEY` — NOT set. Emails log to console instead of sending.
3. `AIRSIGN_INTERNAL_SECRET` — NOT set. Webhook auth fails.
4. Upload → Place Fields → Send → Sign → Seal flow has never been tested end-to-end with real data

---

## YOUR MISSION — 5 PHASES

### PHASE 1: ENV VARS + SMOKE TEST
**Time estimate: 30 minutes**

1. Check `.env.local` for these vars:
   - `BLOB_READ_WRITE_TOKEN` — should already exist
   - `RESEND_API_KEY` — if missing, generate a random placeholder and log a warning
   - `AIRSIGN_INTERNAL_SECRET` — if missing, generate: `openssl rand -hex 32` equivalent and set it
2. Start dev server: `npx next dev`
3. Navigate to `/airsign` — verify dashboard loads
4. Navigate to `/airsign/new` — verify create page loads
5. Check Prisma schema has all AirSign models: `Envelope`, `Signer`, `EnvelopeField`, `AuditEvent`
6. Run: `npx prisma studio` — verify tables exist and are accessible

**DONE WHEN:** Dashboard loads, create page loads, Prisma models accessible.

### PHASE 2: UPLOAD + ENVELOPE CREATION FLOW
**Time estimate: 1 hour**

Test and fix the flow:
1. Go to `/airsign/new`
2. User should be able to:
   - Enter envelope name/subject
   - Upload a PDF document
   - PDF displays a preview (page thumbnails)
   - Add signers (name + email)
   - Click "Create Envelope" → redirects to envelope detail
3. If upload fails (Blob token issue), debug and fix
4. If PDF preview doesn't render, implement a simple PDF.js viewer or image-based preview
5. Verify envelope saves to DB with status DRAFT
6. Verify signers save with unique signing tokens

**Test Data:**
- Use any PDF (download a sample LREC form or use a test PDF)
- Signer: "Test User", "test@example.com"

**DONE WHEN:** Can create envelope with uploaded PDF + signers, see it in dashboard, click into detail.

### PHASE 3: FIELD PLACEMENT + SEND
**Time estimate: 1-2 hours**

Test and fix:
1. On envelope detail (`/airsign/[id]`):
   - PDF renders with field placement overlay
   - Can click to place fields: Signature, Initials, Date, Text, Checkbox
   - Can drag fields to reposition
   - Can resize fields
   - Can assign fields to specific signers
   - Can delete fields
   - "Smart Place" button auto-places fields for LREC forms
2. Fields save to DB via API
3. "Send" button:
   - Validates: has document, has signers, has fields, fields assigned to signers
   - Updates envelope status to SENT
   - Sets 30-day expiration
   - Sends email to each signer with unique signing link
   - If RESEND_API_KEY missing: log the signing URLs to console AND display them in the UI so we can test manually

**CRITICAL FIX NEEDED:** If emails can't send, the signing URLs MUST be visible in the envelope detail UI. Add a "Copy Signing Link" button next to each signer if it doesn't exist.

**DONE WHEN:** Can place fields on PDF, assign to signers, click Send, and access signing links.

### PHASE 4: SIGNING FLOW (THE MONEY SHOT)
**Time estimate: 1-2 hours**

This is what signers see. It must be DEAD SIMPLE.

Test and fix `/sign/[token]`:
1. Open signing link → loads envelope with PDF
2. PDF displays with field overlays showing what needs to be filled
3. Progress bar shows "3 of 7 fields completed"
4. Click signature field → opens SignatureModal:
   - TYPE tab: Pick from 6 handwriting fonts, type name, see preview
   - DRAW tab: Draw signature with finger/mouse, clear button
   - Apply → signature appears on PDF
5. Click initials field → same modal but smaller, auto-fills initials
6. Date fields → auto-fill with today's date
7. Text fields → inline text input
8. Checkboxes → click to toggle
9. After all required fields filled → "Complete Signing" button activates
10. Click complete → submits all field values + signature images to API
11. Success screen: "Document signed successfully"
12. API checks if all signers have completed:
    - If yes → triggers `sealEnvelope()`:
      - Fetches original PDF
      - Embeds all signatures, text, dates, checkboxes at correct positions
      - Adds audit certificate page (who signed, when, IP, seal ID)
      - Uploads sealed PDF to Blob
      - Updates envelope status to COMPLETED
      - Fires webhook → creates Document record in DB
    - If no → updates signer status, waits for remaining signers

**UX Requirements (Dummy-Proof):**
- Large touch targets (minimum 44px) for mobile
- Clear visual indicators: green checkmark on completed fields
- "Decline to Sign" option with reason input
- No login required — token-based access only
- Works on phone browsers (responsive, touch events)

**DONE WHEN:** Can complete full signing flow on desktop AND mobile, sealed PDF generates.

### PHASE 5: POLISH + PRODUCTION READINESS
**Time estimate: 1 hour**

1. **Envelope Dashboard (`/airsign`):**
   - Shows all envelopes with status badges (Draft, Sent, In Progress, Completed, Declined)
   - Sort by date, filter by status
   - Click into any envelope → detail view
   - Completed envelopes show "Download Sealed PDF" button
   
2. **Notifications:**
   - When signer completes → notify sender (in-app at minimum, email if Resend works)
   - When all signers done → notify sender with sealed PDF link
   
3. **Audit Trail:**
   - Every action logged: created, sent, viewed, signed, sealed
   - Audit events visible in envelope detail
   - Audit certificate page in sealed PDF includes all events

4. **Error Handling:**
   - Expired envelope (>30 days) → show "This document has expired" to signer
   - Already signed → show "You've already signed this document"
   - Invalid token → show "Invalid signing link"
   - Network errors during signing → save progress locally, retry

5. **Integration with TC:**
   - When envelope completes, webhook creates a Document record linked to the transaction
   - Workflow state machine advances (if document triggers a state change)

**DONE WHEN:** Full happy path + all error states handled. Dashboard is usable. Sealed PDFs download.

---

## SUCCESS CRITERIA — HOW CALEB WILL TEST

Caleb will do this exact flow:
1. Go to `/airsign/new`
2. Upload a PDF
3. Add signer: his own email
4. Place signature + date fields
5. Click Send
6. Open signing link (from email or copied from UI)
7. Sign the document
8. Download the sealed PDF
9. Verify the sealed PDF has his signature embedded + audit page

If all 9 steps work → AirSign is DONE.

---

## RULES
- DO NOT rebuild existing components. Fix what's broken.
- DO NOT add features not in this spec. No template library, no payment capture, no bulk send. That's v2.
- DO NOT change the database schema unless absolutely necessary (and document why).
- DO NOT remove the console.log fallback for emails — keep it as backup.
- Test every change. Don't just write code and assume it works.
- If you hit a blocker you can't solve, write it to `AGENT_MISSIONS/BLOCKERS.md` with details.
- If you have to modify a file also used by other agents (like layout.tsx or schema.prisma), document the change in `AGENT_MISSIONS/SHARED_CHANGES.md`.
