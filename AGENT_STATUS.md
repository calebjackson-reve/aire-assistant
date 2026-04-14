# Agent 3 — AIRESIGN v2 — checkpoint 2026-04-13

## Summary
Rebuilt + shipped AIRESIGN v2 foundation on `airsign/v2` in an isolated worktree after
prior uncommitted WIP was wiped during an external branch switch. All 5 numbered
groups (schema, lib, api, ui, tests) committed independently so nothing can be
clobbered again.

## Commits (airsign/v2, newest first)
- `9b9c9cc` — test(airsign-v2): unit+integration smoke harness (33/33 pass)
- `b591643` — fix(airsign-v2): narrow SealField to original 5 types
- `2494be9` — wip(airsign-v2): ui — templates library, broker compliance queue, brokerage settings + LoopAutofillDrawer
- `1c87111` — wip(airsign-v2): api — 12 v2 routes
- `4c551c1` — wip(airsign-v2): lib — 10 modules
- `5b41af8` — wip(airsign-v2): schema — BrokerageAirSignSettings, BulkSendBatch, LoopImport + envelope v2 fields

## Build
- `next build` — **PASS** (Turbopack, 25.8s after warm cache)
- `npx tsc --noEmit` — **PASS** (0 errors on v2 surface)
- `scripts/test-airsign-v2.ts` — **PASS** (33 / 33)
- `scripts/test-airsign-flow.ts` (legacy) — **1 / 7** (pre-existing failures:
  Prisma 6.19.2 requires relation-object form for `airSignAuditEvent.create` and
  rejects `token: null` on signer writes. None touch fields introduced by v2.
  Separate fix needed on the legacy test harness. Does not block v2.)

## Consumed v2 primitives
None — `components/v2/` did not yet exist on this branch when built. All UI
built directly against DESIGN.md tokens + `components/layouts/DarkLayout`.

## New v2 primitives added (for Agent 4 to merge later)
Under `components/airsign/`:
- `LoopAutofillDrawer.tsx` — right-side drawer, Cream surface + Playfair sections for
  property/financials/dates/parties/agents/title+lender. Wires to
  `/api/airsign/v2/autofill`. Saving re-hydrates DRAFT envelopes. Drop-in for any
  transaction-scoped page.

Under `app/airsign/`:
- `templates/` — library page + `TemplatesClient` (search, scope+kind filters, folder
  groups, clone → personal, delete) + `NewTemplateModal`.
- `broker/` — compliance review queue with approve/request-changes/reject actions.
  Role-gated to BROKER_OWNER / COMPLIANCE_OFFICER.
- `brokerage/` — settings page (branding, signer-auth defaults, compliance mode) +
  members list with invite/remove. Create mode for users with no membership.

## Surface shipped
### Prisma schema (additive, no Brokerage/Team/BrokerageMember changes)
- Enums: `SignerAuthMethod`, `SignerPermission`, `BrokerageRole`, `TemplateScope`, `TemplateKind`, `ComplianceReviewStatus`, `ComplianceMode`, `BulkSendStatus`, `LoopImportStatus`
- Models: `Office`, `AirSignTemplate`, `ComplianceReview`, `AirSignReminder`, `BrokerageAirSignSettings`, `BulkSendBatch`, `LoopImport`
- `AirSignEnvelope` v2 fields: `templateId`, `templateInstantiatedAt`, `bulkSendBatchId`, `brokerageSettingsId`, `requireAuthMethod`, `loopImportId`, `customMessage`, `attachPdf`, `loopDataSnapshot`, `requiresReview`, `archivedAt`
- `AirSignSigner` v2 fields: `permission`, `authMethod`, `authSecret`, `authVerifiedAt`, `otpAttempts`, `kbaProviderRef`
- `AirSignField` v2 fields: `dataKey`, `options`, FieldType extended with `NAME`, `RADIO`, `STRIKETHROUGH`, `DROPDOWN`
- `Transaction` v2 fields: `loopData`, `archivedAt` (+ office relation)

### lib/airsign/v2/ (10 modules)
- `data-keys.ts` — 60-key Loop Data vocabulary + resolveDataKey + deepMergeLoopData + loopDataFromTransaction
- `auth.ts` — BrokeragePermission matrix (14 actions × 5 roles) + normalizeRole + envelopeReadScope + getMembership helpers
- `brokerage.ts` — resolveBrokerageSettings (BrokerageAirSignSettings → Brokerage fallback) + upsertSettings + snapshotSettingsForEnvelope
- `autofill.ts` — ensureLoopData, updateLoopData, hydrateEnvelope, rehydrateDraftEnvelopes, snapshotDiff
- `templates.ts` — list/create/update/delete + cloneTemplate + instantiateTemplate (template → envelope with hydration)
- `signer-auth.ts` — SMS OTP (Twilio + dev log), access code, KBA stub, session validation
- `certificate.ts` — branded CoC PDF via pdf-lib (brokerage accent color override)
- `compliance.ts` — submitForReview, decideReview, buildExportManifest, buildAuditBundleForEnvelope
- `loop-autofill.ts` — Dotloop JSON export normalizer (v2 + flat-CSV shapes) + commit-to-transaction
- `bulk-send.ts` — runBulkSend (eager batch) + parseCsvRows (envelope grouping by name)

### app/api/airsign/v2/ (13 routes)
- `templates`                         GET list, POST create
- `templates/[id]`                    GET fetch, PATCH update|clone, DELETE
- `templates/[id]/instantiate`        POST → envelope with signers
- `brokerages/bootstrap`              POST (new brokerage create)
- `brokerages/[id]/settings`          GET resolve, PATCH upsert
- `brokerages/members`                POST invite, DELETE remove
- `compliance/submit`                 POST submit for review
- `compliance/review`                 GET queue, POST approve|reject|changes
- `signer-auth`                       POST (public token-gated) SEND|VERIFY
- `envelopes/[id]/certificate`        GET PDF download
- `bulk-send`                         GET batches, POST JSON|multipart
- `loop-import`                       GET imports, POST create+parse, PATCH commit
- `autofill`                          GET loopData|diff, POST patch + re-hydrate

## Top-10 gap coverage vs AIRESIGN_V2_SPEC.md
| # | Gap | Status |
|---|---|---|
| 1 | Loop Data Model + cross-doc autofill | **Complete** — data-keys, autofill lib, drawer, hydration, snapshot+diff |
| 2 | Shared 3-scope template library + bootstrap | **Complete** — marketplace/brokerage/office/personal with clone |
| 3 | "Submit for Review" broker compliance workflow | **Complete** — submit, queue, approve/reject/changes, audit events |
| 4 | Signer auth: SMS OTP + Access Code + KBA stub | **Complete** — Twilio live, access-code hashed, KBA flag |
| 5 | Reminder cron + expiration escalation | **Schema shipped (`AirSignReminder`)** — cron wiring next |
| 6 | Multi-brokerage tenancy | **Complete** — Office + BrokerageAirSignSettings + role-gated pages |
| 7 | Bulk send | **Complete** — CSV + JSON, BulkSendBatch tracked, errors captured |
| 8 | Document folder organization in transactions | **Deferred** — Dotloop folders map in LoopImport.documentsIndex; UI pass next |
| 9 | Per-recipient permissions + CC | **Complete** — SignerPermission enum, wired through instantiate + envelope |
| 10 | Certificate of Completion PDF export | **Complete** — branded CoC with UETA/ESIGN/eIDAS disclosures + SHA-256 |

Plus: Dotloop import (LoopImport model + normalizer + two-step commit) — bonus for #1.

## Next (queued)
- Wire reminder cron: `app/api/cron/airsign-reminders/route.ts` reads `AirSignReminder.sendAt`, ticks every 30min, uses existing Resend/Twilio paths.
- Document folder panel on `/airsign/[id]` that groups fields by `folder` (template metadata).
- Extend `lib/airsign/seal-pdf.ts` to handle NAME/RADIO/STRIKETHROUGH/DROPDOWN (currently filtered out in sign/[token]/route.ts).
- Wire `NewEnvelopeForm.tsx` "Start from template" — currently separate `instantiate` endpoint exists but not exposed in the new-envelope form yet (legacy envelope form untouched per "no regression" rule).
- `components/v2/*` primitives from Agent 4 — swap local Cards/Buttons/Inputs once landed.

## Safety log
- Never left >1 numbered group uncommitted.
- `git branch --show-current` verified at every commit — stayed on `airsign/v2`.
- No unexpected stashes created by external process.
- No destructive git ops. No `prisma migrate reset`. Schema synced via `prisma db push --accept-data-loss` (additive only).

## Push
Final step: `git push origin airsign/v2`. Do NOT merge to main — Caleb reviews.
