# Research: 9 Integration Audit & Testing Phase
*Date: 2026-04-09*

## Scope
Audit all 9 integrations added in commit `9dddc04` to determine what's working, what's connected, what breaks, and what env vars are missing.

## What Exists (Prior State)

| System | Status Before | Key Files |
|--------|--------------|-----------|
| SMS/Twilio | 4 duplicated implementations, all console.log fallback | `lib/tc/notifications.ts`, `lib/tc/party-communications.ts`, `lib/tc/vendor-scheduler.ts`, `app/api/cron/deadline-alerts/route.ts` |
| Voice Pipeline | 28 fast-path patterns, 16 intents, `send_document` creates DRAFT only | `lib/voice-pipeline.ts`, `lib/voice-action-executor.ts` |
| AirSign | Full CRUD + signing + seal, 6 signature fonts already in SignatureModal | `components/airsign/SignatureModal.tsx`, `lib/airsign/seal-pdf.ts` |
| Morning Brief | 5 researchers (deadline, pipeline, contact, comms, market) | `app/api/cron/morning-brief/route.ts` |
| CMA Engine | 4-source ensemble + disagreement + PPS, requires manual input | `app/api/intelligence/cma/route.ts`, `lib/data/engines/` |
| MLS Autofill | 50+ Paragon fields extracted from docs, no upload API | `lib/paragon/mls-autofill.ts`, `lib/paragon/field-definitions.ts` |
| Content Generation | Campaign engine + marketing machine + slide generator, no scheduling | `app/api/content/campaign/route.ts`, `lib/agents/marketing-machine.ts` |
| Google Calendar | Not implemented (listed in CURRENT_STATE.md "NOT BUILT YET") | None |
| Meta Business Suite | Not implemented (CURRENT_STATE.md "NOT BUILT YET") | None |

## What Changed (9 Integrations)

### 1. Centralized Twilio Client
- **File:** `lib/twilio.ts` (NEW)
- **What it does:** DRYs up SMS sending into `sendSms()`, `fetchRecentMessages()`, `fetchRecentCalls()`
- **Env vars:** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- **Schema fields:** None (pure API client)
- **Status:** Code correct. NOT yet wired into existing callers (notifications.ts, party-communications.ts still use their own inline fetch). Standalone works but doesn't replace existing code yet.
- **Breaks:** Nothing — additive only

### 2. Google Calendar Integration
- **Files:** `lib/google/calendar.ts` (NEW), `lib/agents/morning-brief/researchers/calendar-researcher.ts` (NEW)
- **What it does:** Fetches today's events via Google Calendar API, calculates free slots, wired into morning brief
- **Env vars:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (already set)
- **Schema fields used:** `EmailAccount.userId`, `EmailAccount.provider`, ~~`EmailAccount.status`~~, `EmailAccount.accessToken`, `EmailAccount.refreshToken`, `EmailAccount.tokenExpiry`
- **CRITICAL BUG:** `lib/google/calendar.ts:62` — queries `status: "active"` but EmailAccount has `isActive: Boolean`, not `status: String`. **Calendar will always return empty.**
- **Breaks:** Silently fails (returns empty array), doesn't crash

### 3. Signature Font Picker
- **Status:** ALREADY COMPLETE — no changes needed
- **6 fonts:** Allura, Dancing Script (700), Great Vibes, Sacramento, Parisienne, Caveat (700)
- **File:** `components/airsign/SignatureModal.tsx`

### 4. Voice → AirSign Routing
- **Files modified:** `lib/voice-action-executor.ts`, `lib/voice-pipeline.ts`
- **What it does:** New `send_document_for_signature` intent auto-creates AirSign envelope, auto-places fields by form type, and sends
- **Schema fields used:** `AirSignEnvelope.*`, `AirSignSigner.signingOrder` (exists), ~~`AirSignSigner.status`~~ (DOES NOT EXIST), `AirSignField.xPercent/yPercent/widthPercent/heightPercent` (exist), ~~`AirSignAuditEvent.detail`~~ (DOES NOT EXIST)
- **CRITICAL BUG 1:** `voice-action-executor.ts:~1238` — `prisma.airSignSigner.updateMany({ data: { status: "PENDING" } })` — `AirSignSigner` has NO `status` field. Prisma will throw.
- **CRITICAL BUG 2:** `voice-action-executor.ts:~1253` — `prisma.airSignAuditEvent.create({ data: { detail: "..." } })` — field is `metadata: Json?`, not `detail: String`. Prisma will throw.
- **Breaks:** Runtime crash when voice command fires `send_document_for_signature`

### 5. Meta Business Suite API
- **Files:** `lib/meta-business.ts` (NEW), `lib/agents/morning-brief/researchers/social-researcher.ts` (NEW)
- **What it does:** Pulls real Instagram/Facebook engagement data from Meta Graph API
- **Env vars:** `META_ACCESS_TOKEN`, `META_PAGE_ID`, `META_IG_USER_ID` — **NOT SET** (new, need Meta Business account connection)
- **Schema fields:** None (pure API client)
- **Status:** Code correct. Will return empty data until Meta env vars are configured. Fails gracefully.
- **Breaks:** Nothing — returns `{ connected: false }` when not configured

### 6. Multi-Source CMA Auto-Fetch
- **File:** `lib/data/engines/multi-source-cma.ts` (NEW), `app/api/cma/route.ts` (NEW)
- **What it does:** Fetches from Paragon, PropStream, Zillow, RPR in parallel, runs ensemble
- **Env vars:** `RPR_API_KEY` (optional, new), `NEXT_PUBLIC_APP_URL`
- **Schema fields:** None (calls internal API routes)
- **Imports:** `runEnsemble`, `runDisagreement`, `runPPS`, `normalizeAddress` from existing engines
- **Status:** Code correct. Depends on internal API routes (`/api/data/paragon/sales`, `/api/data/propstream/property`, `/api/data/estimate`) being functional. RPR will return "not configured" without API key.
- **Breaks:** Likely partial data — Paragon/PropStream routes may return empty without data in tables

### 7. Pre-Listing Brief Generator
- **File:** `lib/pre-listing-brief.ts` (NEW), `app/api/pre-listing/route.ts` (NEW)
- **What it does:** Extracts data from old listings/appraisals, generates comprehensive listing brief
- **Env vars:** `ANTHROPIC_API_KEY` (already set)
- **Schema fields used:** `Transaction.id`, `Transaction.propertyAddress`, `Transaction.documents` (relation), ~~`Document.extractedData`~~ (DOES NOT EXIST)
- **CRITICAL BUG:** `pre-listing-brief.ts:162` — `doc.extractedData` should be `doc.filledData` (the actual Prisma field name). Will always skip all documents and throw "No extracted document data found."
- **Breaks:** Always throws error — no documents will be processed

### 8. MLS Auto-Upload via Paragon
- **File:** `lib/paragon/mls-upload.ts` (NEW), `app/api/mls/upload/route.ts` (NEW)
- **Env vars:** `PARAGON_RETS_URL`, `PARAGON_RETS_USERNAME`, `PARAGON_RETS_PASSWORD`, `PARAGON_AGENT_ID` — **NOT SET** (need GBRAR RETS agreement)
- **Schema fields used:** `Transaction.id`, `Transaction.mlsNumber`, ~~`Document.extractedData`~~ (same bug as pre-listing)
- **CRITICAL BUG:** Same `extractedData` vs `filledData` issue as pre-listing brief
- **Status:** Returns "not configured" without Paragon credentials. Has fallback that builds from transaction data when doc extraction fails.
- **Breaks:** Graceful failure — returns error message about missing credentials

### 9. Content Scheduling + Performance Tracking
- **File:** `lib/content-scheduler.ts` (NEW), `app/api/content/schedule/route.ts` (NEW)
- **Schema fields used:** `ContentCampaign.userId`, `ContentCampaign.scheduledFor`, `ContentCampaign.status`, `ContentCampaign.propertyAddress`, `ContentCampaign.mlsDescription`, `ContentCampaign.instagramCaption`, `ContentCampaign.facebookPost`, `ContentCampaign.linkedinPost`, `ContentCampaign.emailTemplate`, `ContentCampaign.smsTemplate`
- **Status:** All ContentCampaign fields verified to exist in schema. Code is correct.
- **Breaks:** Nothing — works with existing schema

### Morning Brief Cron Wiring
- **File modified:** `app/api/cron/morning-brief/route.ts`
- **What changed:** Added `researchCalendar(user.id)` and `researchSocial()` to the parallel researcher array (now 7 researchers). Added calendar and social data sections to synthesis prompt.
- **Status:** Imports correct. Calendar researcher will return empty (due to bug #2). Social researcher will return `{ connected: false }` (no Meta keys). Brief synthesis will still work — it handles missing data gracefully.
- **Breaks:** Nothing — degraded but functional

---

## Critical Bugs Summary (5 Total)

| # | File | Line | Bug | Fix |
|---|------|------|-----|-----|
| 1 | `lib/voice-action-executor.ts` | ~1238 | `AirSignSigner.status` doesn't exist | Remove the updateMany call or track status via `signedAt`/`viewedAt` |
| 2 | `lib/voice-action-executor.ts` | ~1253 | `AirSignAuditEvent.detail` doesn't exist | Change to `metadata: { message: "..." }` |
| 3 | `lib/google/calendar.ts` | 62 | `EmailAccount.status` doesn't exist | Change to `isActive: true` |
| 4 | `lib/pre-listing-brief.ts` | 162 | `Document.extractedData` doesn't exist | Change to `filledData` |
| 5 | `app/api/mls/upload/route.ts` | 54 | `Document.extractedData` doesn't exist | Change to `filledData` |

---

## Env Vars Status

| Var | Set? | Needed For |
|-----|------|-----------|
| `TWILIO_ACCOUNT_SID` | YES | SMS notifications |
| `TWILIO_AUTH_TOKEN` | YES | SMS notifications |
| `TWILIO_PHONE_NUMBER` | YES | SMS notifications |
| `GOOGLE_CLIENT_ID` | YES | Google Calendar |
| `GOOGLE_CLIENT_SECRET` | YES | Google Calendar |
| `ANTHROPIC_API_KEY` | YES | Pre-listing brief, CMA |
| `META_ACCESS_TOKEN` | **NO** | Meta Business Suite |
| `META_PAGE_ID` | **NO** | Facebook page data |
| `META_IG_USER_ID` | **NO** | Instagram data |
| `RPR_API_KEY` | **NO** | RPR valuations in CMA (optional) |
| `PARAGON_RETS_URL` | **NO** | MLS auto-upload |
| `PARAGON_RETS_USERNAME` | **NO** | MLS auto-upload |
| `PARAGON_RETS_PASSWORD` | **NO** | MLS auto-upload |
| `PARAGON_AGENT_ID` | **NO** | MLS auto-upload |
| `CLICKUP_API_TOKEN` | YES (.env.local) | Transcript-to-tasks |
| `CLICKUP_LIST_ID` | YES (.env.local) | Transcript-to-tasks |

---

## Integration Test Matrix

| # | Integration | Can Test Now? | Blocker | Expected Result |
|---|---|---|---|---|
| 1 | Twilio SMS | YES (env set) | Standalone only, not wired to existing callers | `sendSms()` returns `{ ok: true }` |
| 2 | Google Calendar | NO | Bug #3 (EmailAccount query wrong) | Fix the query, then need Gmail OAuth connected |
| 3 | Signature Fonts | YES | None | Already working in SignatureModal |
| 4 | Voice → AirSign | NO | Bug #1 + Bug #2 (Prisma field mismatches) | Fix both, then test via voice pipeline |
| 5 | Meta Business | NO | Missing env vars (META_*) | Will return `{ connected: false }` |
| 6 | Multi-Source CMA | PARTIAL | Data tables may be empty | Returns ensemble result with available sources |
| 7 | Pre-Listing Brief | NO | Bug #4 (wrong field name) | Fix field name, then needs uploaded docs |
| 8 | MLS Upload | NO | Bug #5 + missing PARAGON_* env vars | Returns "not configured" |
| 9 | Content Schedule | YES | None | GET returns calendar, POST creates scheduled post |

---

## What Doesn't Break (Safe)

- Morning brief cron — researchers fail gracefully, synthesis still runs
- Content scheduler — all schema fields correct
- Meta Business Suite — returns `{ connected: false }` cleanly
- Multi-source CMA — calls internal APIs, ensemble math is correct
- Twilio client — standalone, doesn't affect existing SMS code
- Voice pipeline fast-path patterns — regex patterns are additive, don't affect existing intents

---

## Recommended Fix Order

1. **Fix 5 critical bugs** (Prisma field mismatches) — 10 min
2. **Test content scheduler** (works now) — verify GET /api/content/schedule
3. **Test CMA auto-fetch** (partially works) — verify POST /api/cma
4. **Test Twilio client** (works standalone) — verify sendSms()
5. **Test Google Calendar** (after bug fix) — need Gmail OAuth token in DB
6. **Test Voice → AirSign** (after bug fix) — need a transaction with documents
7. **Configure Meta env vars** — requires Meta Business account setup
8. **Configure Paragon env vars** — requires GBRAR RETS agreement

---

## Schema Fields Used Across All 9 Integrations

### AirSignEnvelope
`id`, `userId`, `name`, `status`, `documentUrl`, `transactionId`, `sentAt`

### AirSignSigner
`id`, `envelopeId`, `name`, `email`, `role`, `signingOrder`, `token`, `tokenExpiresAt`
**Missing:** `status` (referenced but doesn't exist)

### AirSignField
`id`, `envelopeId`, `signerId`, `type`, `page`, `xPercent`, `yPercent`, `widthPercent`, `heightPercent`, `required`

### AirSignAuditEvent
`id`, `envelopeId`, `action`, `metadata`
**Missing:** `detail` (referenced but doesn't exist — use `metadata`)

### EmailAccount
`id`, `userId`, `provider`, `isActive`, `accessToken`, `refreshToken`, `tokenExpiry`
**Missing:** `status` (referenced but doesn't exist — use `isActive`)

### Document
`id`, `transactionId`, `type`, `fileUrl`, `filledData`, `extractedText`
**Missing:** `extractedData` (referenced but doesn't exist — use `filledData`)

### ContentCampaign
`id`, `userId`, `propertyAddress`, `mlsDescription`, `instagramCaption`, `facebookPost`, `linkedinPost`, `emailTemplate`, `smsTemplate`, `status`, `scheduledFor`
All fields verified.

### Transaction
`id`, `userId`, `propertyAddress`, `buyerName`, `sellerName`, `buyerEmail`, `sellerEmail`, `mlsNumber`, `status`
All fields verified.
