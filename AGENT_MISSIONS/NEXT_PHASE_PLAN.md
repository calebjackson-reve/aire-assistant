# AIRE — Next Phase Plan
*Created 2026-04-05 after Agent 4 test verification run*

## Where We Are

**Finished definition** (from CLAUDE.md + SUCCESS_CRITERIA.md):
An AIRE user can sign up → create a transaction → upload a PDF that auto-classifies and extracts → write a contract in natural language → send it for signatures → signer signs on their phone → sealed PDF generates with audit trail → morning brief shows the deal + deadlines + actions → compliance scanner catches Louisiana violations → voice command executes actions → billing upgrade unlocks features → Gmail triage drafts replies.

**Today's state after testing:**
- 8/8 UI tests PASS — every page loads, every component renders
- LREC Form Monitor built + verified (Agent 4 new autonomous research system)
- Learning engine + 4 new skills + research docs all in place
- **TWO blockers remain:** empty webhook secrets, and one untested integration flow

---

## The Blockers (Ordered by Criticality)

### Blocker 1 — CLERK_WEBHOOK_SECRET empty
**Impact:** Users who sign up don't get a User row created in Prisma → every downstream query fails.
**Fix:** 5 minutes. Clerk Dashboard → Webhooks → Create endpoint → copy signing secret → paste in `.env.local`.

### Blocker 2 — STRIPE_WEBHOOK_SECRET empty
**Impact:** Paid checkout succeeds on Stripe, but user tier never updates in DB. Billing upgrade silently broken.
**Fix:** 5 minutes. Stripe Dashboard → Developers → Webhooks → Add endpoint → copy signing secret → paste.

### Blocker 3 — Document upload UI not wired
**Impact:** Documents tab in transaction detail has no drag-and-drop. Users can't upload PDFs from the UI even though the API exists.
**Fix:** 30 minutes. Add react-dropzone → TransactionDetail Documents tab → POST to `/api/documents/upload` → trigger extraction.

### Blocker 4 — AirSign fields don't persist
**Impact:** From SUCCESS_CRITERIA Tool 1 notes. Agent places fields on PDF, hits save, reloads → fields gone.
**Fix:** 1-2 hours. Debug `components/airsign/FieldPlacer.tsx` + `/api/airsign/envelopes/[id]/fields` save/load.

### Blocker 5 — Voice API returns 404 (likely Clerk guard config)
**Impact:** Voice bar in browser probably works (authed user), but API can't be tested headlessly.
**Fix:** 15 minutes. Verify route handler + middleware matcher, add test seam or internal-secret bypass for testing.

---

## Phase Plan

### PHASE A — Unblock (45 minutes, user + Claude Code)
**Goal:** Remove the webhook secret blockers so every downstream flow works.

1. **CLERK_WEBHOOK_SECRET** — user grabs from Clerk dashboard, pastes in `.env.local`
2. **STRIPE_WEBHOOK_SECRET** — user grabs from Stripe dashboard (test mode), pastes in `.env.local`
3. Restart dev server
4. Test signup flow → verify User row created in Prisma
5. Test billing checkout (test card `4242 4242 4242 4242`) → verify webhook fires → user tier updates to PRO

**Command to run:** None — user action required for secret retrieval. Then:
```
Please verify the Clerk + Stripe webhooks work end-to-end. Sign up a test user, check Prisma for the User row, then upgrade to Pro in test mode and verify the tier updated.
```

---

### PHASE B — Wire Document Upload UI (1 hour, Claude Code)
**Goal:** Documents tab accepts drag-and-drop PDFs that auto-classify and extract.

1. Install `react-dropzone` (`npm i react-dropzone`)
2. Add Dropzone component to `components/tc/TransactionDetail.tsx` Documents tab
3. On drop: POST file to `/api/documents/upload` with `transactionId`
4. Verify upload → classify → extract → display extracted fields inline
5. Verify document appears in documents list with classification badge
6. Verify document count updates on transaction list card

**Command to run:**
```
Wire the document upload UI in the Documents tab of TransactionDetail.tsx using react-dropzone. Hit /api/documents/upload with the transaction ID. Show classification + extracted fields after upload. Test by uploading a sample PDF.
```

---

### PHASE C — Fix AirSign Field Persistence (1-2 hours, Claude Code)
**Goal:** Fields placed on PDF save and reload correctly.

1. Read current FieldPlacer save logic + fields API route
2. Identify where the persistence is failing (DB write? Fetch on reload?)
3. Fix root cause (likely: missing field in schema, wrong Prisma query, or stale state on reload)
4. Test: create envelope → upload PDF → place 3 fields → save → reload → verify all 3 fields still there
5. Test full signing flow: place fields → send → sign → seal → verify sealed PDF

**Command to run:**
```
Fix the AirSign field persistence bug. Fields placed on a PDF aren't saving across page reloads. Read components/airsign/FieldPlacer.tsx and app/api/airsign/envelopes/[id]/fields/route.ts. Find the root cause, fix it, and verify end-to-end by placing fields and reloading.
```

---

### PHASE D — Full Lifecycle Test (30 minutes, Playwright + user)
**Goal:** Run the 11-step lifecycle from SUCCESS_CRITERIA.md to prove everything works together.

1. Sign up a new test account
2. Create a transaction (742 Evergreen Terrace, $325K, Homer/Ned)
3. Upload a purchase agreement PDF → verify auto-classify + extract
4. Write a contract in NL: "Purchase agreement for 742 Evergreen Terrace, buyer Homer Simpson, seller Ned Flanders, $315000, closing May 5 2026"
5. Generate PDF → download works
6. Send for signatures via AirSign → signer receives email (check Resend logs or inbox)
7. Open signing link in another tab → sign → submit
8. Verify sealed PDF generates with audit certificate
9. Check morning brief shows the deal + deadlines + actions
10. Run compliance scan → verify any Louisiana violations caught
11. Try voice command "Show my pipeline" → verify response

**Command to run:**
```
Run the full 11-step lifecycle test from SUCCESS_CRITERIA.md end-to-end using Playwright. Start at /sign-up with a fresh test account. Document every step that passes and every step that fails with the specific error. Don't skip any step.
```

---

### PHASE E — Deploy to Vercel (30 minutes, Claude Code + user)
**Goal:** Production deployment with all env vars + crons + LREC monitor live.

1. `git add . && git commit -m "..."` the LREC monitor + research engine + fixes
2. `git push` to trigger Vercel deployment
3. Verify all env vars are set in Vercel dashboard (pull from `.env.local`)
4. Verify 9 crons are registered in Vercel
5. Trigger LREC monitor manually in production — verify it can reach LREC website from Vercel IPs (was blocked from dev machine)
6. Test Stripe checkout in production test mode

**Command to run:**
```
Deploy to Vercel production. Verify all 9 crons registered, run the LREC monitor once from production to confirm the external fetch works (it was blocked from the dev machine), and smoke test /aire/morning-brief and /aire/compliance in prod.
```

---

### PHASE F — Agent 1 Critical AirSign Fixes (2-3 hours, Claude Code)
**Goal:** Ship the top 3 e-sign gaps identified in research (RECOMMENDATIONS.md).

1. **Sequential signing order** — add `signingOrder` to Signer model, gate delivery by order
2. **Decline to sign** — add `declinedAt` + `declineReason`, decline button on signing page
3. **Token expiration** — add `expiresAt` to Signer, default 14 days, check in sign route

**Command to run:**
```
Implement Agent 4's CRITICAL recommendations for AirSign from AGENT_MISSIONS/RECOMMENDATIONS.md: sequential signing order, decline to sign flow, and token expiration. Update prisma schema, migrate, wire UI, test end-to-end.
```

---

### PHASE G — Polish & Ship (1-2 hours)
**Goal:** Final cleanup before going public.

1. Remove test/debug endpoints (`/api/cron/lrec-test`, `/api/research/lrec-test`)
2. Verify all 26 AIRE pages load in production
3. Run Lighthouse audit on `/aire` and `/airsign` for perf
4. Kill any unused env vars
5. Update CURRENT_STATE.md with shipped features
6. Tag v1.0.0 release

---

## Task List (Copy This)

- [ ] **A1** — Set CLERK_WEBHOOK_SECRET in .env.local
- [ ] **A2** — Set STRIPE_WEBHOOK_SECRET in .env.local
- [ ] **A3** — Test signup → User row created in Prisma
- [ ] **A4** — Test Stripe checkout → tier upgrades
- [ ] **B1** — Install react-dropzone
- [ ] **B2** — Wire Dropzone to TransactionDetail Documents tab
- [ ] **B3** — Test upload → classify → extract → display
- [ ] **C1** — Debug AirSign field persistence bug
- [ ] **C2** — Fix field save/load on envelope detail
- [ ] **C3** — Test: place fields → reload → still there
- [ ] **D1** — Full 11-step lifecycle Playwright test
- [ ] **D2** — Document any step failures
- [ ] **D3** — Fix failures and re-run
- [ ] **E1** — Git commit + push to Vercel
- [ ] **E2** — Verify env vars in Vercel dashboard
- [ ] **E3** — Trigger LREC monitor in production
- [ ] **E4** — Smoke test prod URLs
- [ ] **F1** — Add signingOrder to AirSign
- [ ] **F2** — Add decline to sign flow
- [ ] **F3** — Add token expiration
- [ ] **G1** — Remove test endpoints
- [ ] **G2** — Verify all 26 AIRE pages
- [ ] **G3** — Lighthouse audit
- [ ] **G4** — Update CURRENT_STATE.md
- [ ] **G5** — Tag v1.0.0

---

## Command to Start Next Session

Paste this into Claude Code to pick up exactly where we are:

```
Read AGENT_MISSIONS/NEXT_PHASE_PLAN.md. We're starting Phase A. I've already set CLERK_WEBHOOK_SECRET and STRIPE_WEBHOOK_SECRET in .env.local. Verify the webhook flows work end-to-end: sign up a test user (check Prisma for the User row), then upgrade to Pro in test mode (check the tier updated). Then move to Phase B: wire the document upload UI in TransactionDetail.tsx Documents tab using react-dropzone.
```

---

## What "Done" Means

The platform is v1.0 when a real Louisiana agent can:
1. Sign up and land on onboarding
2. Create a deal
3. Upload a PDF → auto-classified + extracted
4. Write a contract in plain English → get a PDF
5. Send for signatures → buyer/seller receive email
6. Signers sign on their phone → sealed PDF generated
7. See everything on the morning brief
8. Get compliance warnings for Louisiana-specific issues
9. Voice-command the system
10. Upgrade to Pro → features unlock

**All 10 steps working without any env var errors = ship it.**

Current estimate: Phases A-D complete v1.0 (roughly 4-5 hours of focused work). Phases E-G polish for launch.
