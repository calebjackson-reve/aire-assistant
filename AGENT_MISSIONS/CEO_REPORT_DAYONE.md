# Day One (Agent 2) — CEO Report

**Mission:** Build the onboarding experience. One screen, four sections, new user → `/aire` with contacts, profile, brokerage, and signature already populated.

**Status:** Complete pending one manual step (schema push — see Known Gaps).

---

## What shipped

### 1. Onboarding screen — `/onboarding`
Single page, four sections, warm editorial style (sage/olive/cream/linen palette, serif italic headlines, Space Grotesk body). Matches the style of `/aire/settings` and `/billing`.

- **Section 1 — Connect Your Accounts**
  - **Gmail**: Button kicks off a full Google OAuth round-trip at `/api/oauth/gmail/start` → `/api/oauth/gmail/callback`. Scopes: `gmail.readonly`, `gmail.send`, `userinfo.profile`, `userinfo.email`. Refresh tokens are upserted into the existing `EmailAccount` table. After the callback stores tokens, it fires a background Gmail contact scan (non-blocking) that pulls the last 90 days of message metadata, extracts unique From/To addresses, and creates `Contact` rows. The onboarding UI shows a "Scanning your inbox…" indicator when the user returns.
  - **MLS**: Inline form (provider dropdown + username/password). Credentials are saved into `User.onboardingData.mls` as JSON. Shows "Connected — import scheduled" after save. Real RETS/RESO integration is a future mission.
  - **LinkedIn**: Button opens a "Coming soon" modal. Counts as a section as required.
  - **Phone contacts (.vcf)**: Native file picker, multiple-file support. Parsed by a hand-written vCard parser (`lib/onboarding/vcard-parser.ts`, ~75 lines, handles vCard 2.1/3.0/4.0 line folding, FN/N/EMAIL/TEL/ORG). Dedupe on email or name. Contact count updates live.

- **Section 2 — Profile (5 fields)**
  - Headshot upload → Vercel Blob → `User.avatarUrl`
  - Brokerage name → `User.brokerageName`
  - License number → `User.licenseNumber`
  - Default commission split % → `User.defaultCommissionSplit` (Decimal)
  - Preferred title company → `User.preferredTitleCompany`
  - All saved via a single multipart POST to `/api/onboarding/profile`.

- **Section 3 — Signature**
  - HTML5 canvas with mouse + touch handlers and DPI-correct coordinate mapping. Clear/Save controls.
  - Stored as base64 data URL in `User.signatureData` (Text column).

- **Section 4 — Finish**
  - Saves profile + signature (last-write wins), marks `User.onboarded = true`, stamps `User.onboardedAt`, redirects to `/aire`.

### 2. API routes — `/api/onboarding/**` and `/api/oauth/gmail/**`
| Route | Method | Purpose |
|---|---|---|
| `/api/onboarding/profile` | POST | Multipart — save 5 profile fields + headshot to Blob |
| `/api/onboarding/signature` | POST | JSON — save signature as data URL |
| `/api/onboarding/vcard` | POST | Multipart — parse .vcf files, create `Contact` rows |
| `/api/onboarding/mls` | POST | JSON — stub, writes creds to `User.onboardingData.mls` |
| `/api/onboarding/complete` | POST | Set `onboarded=true`, stamp `onboardedAt` |
| `/api/oauth/gmail/start` | GET | Build Google OAuth URL with onboarding scopes + state |
| `/api/oauth/gmail/callback` | GET | Exchange code, upsert `EmailAccount`, fire-and-forget contact scan, redirect to `/onboarding?gmail=connected&email=…` |

All routes are Clerk-guarded, look up the User by `clerkId`, and return `NextResponse.json()`.

### 3. Redirect logic — `app/aire/layout.tsx`
Added a migration-safe redirect: if `user.onboarded === false` **and** the user has zero transactions, redirect to `/onboarding`. The "zero transactions" guard prevents existing active users with `onboarded=false` (the new column default) from being trapped on the setup page when they already have data in the system. New users hit the onboarding flow; existing users skip it cleanly.

### 4. Schema changes — `prisma/schema.prisma`
Added to `User`:
```
onboarded               Boolean   @default(false)
onboardedAt             DateTime?
onboardingData          Json?
avatarUrl               String?
brokerageName           String?
licenseNumber           String?
defaultCommissionSplit  Decimal?
preferredTitleCompany   String?
signatureData           String?   @db.Text
```
None of these existed previously — verified by grep and schema read.

### 5. Test script — `scripts/test-onboarding.ts`
Three-part smoke test:
1. **vCard parser** — unit-test the pure function with a two-contact sample.
2. **Schema columns** — Prisma round-trip confirms all new columns compile and query.
3. **Route registration** — fetches each onboarding/oauth route against localhost and asserts 401/405/400 (not 404), proving routes are registered and Clerk-guarded.

Run: `set -a && source .env.local && set +a && npx tsx scripts/test-onboarding.ts`

---

## Files created / modified

**Created:**
- `app/onboarding/page.tsx`
- `app/onboarding/OnboardingClient.tsx`
- `app/api/onboarding/profile/route.ts`
- `app/api/onboarding/signature/route.ts`
- `app/api/onboarding/vcard/route.ts`
- `app/api/onboarding/mls/route.ts`
- `app/api/onboarding/complete/route.ts`
- `app/api/oauth/gmail/start/route.ts`
- `app/api/oauth/gmail/callback/route.ts`
- `lib/onboarding/vcard-parser.ts`
- `lib/onboarding/gmail-contact-scan.ts`
- `scripts/test-onboarding.ts`
- `AGENT_MISSIONS/CEO_REPORT_DAYONE.md`

**Modified:**
- `prisma/schema.prisma` — 9 new User columns
- `app/aire/layout.tsx` — onboarding redirect only

**Not touched:** Everything outside territory, including `scripts/**` except for the single mission-mandated file, `lib/voice-*.ts`, `components/VoiceCommandBar.tsx`, `lib/comms/email-classifier.ts`, `lib/agents/email-scanner.ts`, `lib/comms/gmail-scanner.ts`.

---

## Known gaps / what Caleb must do

1. **`npx prisma db push` has not been executed in this session.** Bash commands were blocked in this agent sandbox, so the schema changes have been written to `prisma/schema.prisma` but not yet applied to Neon. Run from the project root:
   ```
   taskkill //F //IM node.exe
   npx prisma db push --skip-generate
   npx prisma generate
   ```
   Then restart the dev server. Until this runs, `/onboarding` will 500 at the first DB write because the new columns do not exist on the Neon side.

2. **No live screenshots were captured.** Same sandbox limitation — no ability to hit the dev server or spawn puppeteer from the agent. The page is built against the existing `/aire/settings` and `/billing` style patterns and will render on the locked sage/olive/cream palette. Recommend opening `http://localhost:3000/onboarding` after the db push and running the project's `screenshot.mjs` if you want a pixel review.

3. **MLS integration is a true stub.** Creds are stored in plaintext inside `User.onboardingData.mls` — fine for the "save for later" semantics of this milestone, but should be encrypted (or offloaded to a secret store) before real MLS credentials touch production. The UI message says "Import scheduled" — no actual import runs.

4. **Gmail contact scan is real but metadata-only.** It calls the Gmail v1 API directly (no SDK), lists up to 200 messages from the last 90 days, pulls From/To headers, de-dupes by email, and creates `Contact` rows with `source: "gmail_onboarding_scan"`. If the Google project's OAuth consent screen does not yet include `gmail.readonly` for the signed-in user, the scan will no-op and log the failure — the user still gets onboarded cleanly. For production, the consent screen and test-user list need to include the scopes listed above.

5. **LinkedIn** is intentionally a stub modal — required section presence, no real integration yet.

6. **Territory note:** The mission explicitly required `scripts/test-onboarding.ts`, which conflicts with the stated "scripts/** is Agent 1" territory rule. I followed the explicit mission deliverable over the general territory rule. If this is wrong, move the file to `lib/onboarding/test-onboarding.ts` — no other code imports it.

---

## How to verify end-to-end

1. Apply the schema: `npx prisma db push --skip-generate`
2. Restart dev server on `localhost:3000`
3. Sign in as a fresh test user (one with no transactions)
4. You should be auto-redirected from `/aire` to `/onboarding`
5. Click **Connect Gmail** → complete Google OAuth → land back on `/onboarding?gmail=connected&email=…` with the "Scanning your inbox…" indicator
6. Fill MLS form → Save
7. Upload any `.vcf` (export from iPhone Contacts app, or use the sample inside `scripts/test-onboarding.ts`)
8. Fill the 5 profile fields, upload a headshot
9. Draw a signature → Save signature
10. Click **Finish & enter AIRE** → redirected to `/aire`, `User.onboarded = true`, dashboard loads normally

Happy path is built. Ball is in your court for the schema push and the first real login.
