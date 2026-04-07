# CEO Report — Agent 4: Email Triage Classifier

**Date:** 2026-04-04
**Agent:** Agent 4 — Email Triage
**Status:** Shipped. 15/15 tests pass. Wired into 2 scanners.

## Mission
Build a 3-tier email classifier that routes inbound emails into `deal_related`,
`work_related`, or `personal`, so downstream systems (draft reply, morning brief,
notifications) can act on only what matters.

## Architecture

### Tier 1 — Regex + DB context (free, synchronous)
Pure function, no network calls. Evaluates signals in order of specificity:

1. **Known party email** → sender address matches buyer/seller on an active
   transaction → `deal_related` @ 0.95
2. **MLS number** present in subject or body → `deal_related` @ 0.95
3. **Property address fuzzy match** (street number + street-name token) →
   `deal_related` @ 0.90
4. **Party last name + RE keyword** (name alone is too weak) →
   `deal_related` @ 0.85
5. **Known vendor sender** (inspector, title, appraiser) → `work_related` @ 0.85
6. **Work-domain TLD** (seed list of ~20 brokerage/title/lender/MLS domains,
   extensible via `ctx.workDomains`) → `work_related` @ 0.80
7. **RE keyword density** (>=2 keywords, 0 personal hints) → `work_related` @ 0.80
8. **Personal signals** (unsubscribe / amazon / receipt / newsletter / 2-factor)
   with 0 RE keywords → `personal` @ 0.80

If none of the above match → return `null` → cascade to Tier 2.

### Tier 2 — Claude Haiku (~$0.0005/email)
Model: `claude-haiku-4-5-20251001`
Input budget: subject + first 500 chars body (~300 tokens in).
Output budget: strict JSON `{category, confidence, reason}` (100 tokens out).
On parse failure, safe default = `personal` @ 0.3 (low confidence flag).

### Tier 3 — NOT PART OF THIS CLASSIFIER
Explicitly documented at the top of `email-classifier.ts`: Sonnet draft-reply
generation is a separate downstream layer triggered only when the user clicks
"Draft Reply" on a `deal_related` email. The classifier never invokes Sonnet.

## Deliverables

| File | Purpose |
|---|---|
| `lib/comms/email-classifier.ts` | Primary deliverable. `classifyEmail(email, ctx)` pure function + `classifyTier1` + `classifyTier2`. |
| `scripts/test-email-classifier.ts` | 15 test cases, deterministic runner (Tier 2 tests skip gracefully without API key). |
| `lib/comms/scanner.ts` | Modified: after `ingestMessages`, classifies every inbound email and persists `classification` onto `CommunicationLog.metadata` JSON. |
| `lib/agents/email-scanner.ts` | Modified: classifies each scanned Gmail message, logs the verdict, and returns tallies on `ScanResult.classifications`. |

**Schema:** untouched. Persistence uses the existing `CommunicationLog.metadata Json?` field. `EmailAttachment` has no JSON field, so the agent-1 email scanner only logs+tallies (does not persist per-attachment classification).

## Test Results — 15/15 PASS

```
Tier 1 (deterministic, 12 cases):
  PASS  address in subject → deal_related (90%, matched txn_guice)
  PASS  MLS number in body → deal_related (95%, matched txn_guice)
  PASS  known buyer email → deal_related (95%, matched txn_guice)
  PASS  known seller email → deal_related (95%, matched txn_guice)
  PASS  party last name + RE keyword → deal_related (85%, matched txn_magnolia)
  PASS  MLS keyword, no specific deal → work_related (80%)
  PASS  known vendor sender → work_related (85%)
  PASS  work domain (firstam.com) → work_related (80%)
  PASS  multi-keyword RE content (LREC/commission) → work_related (80%)
  PASS  Amazon receipt → personal (80%)
  PASS  newsletter → personal (80%)
  PASS  password reset → personal (80%)

Tier 2 (Haiku live, 3 cases):
  PASS  vague family note → personal (99%)
  PASS  generic buyer inquiry, no address → work_related (85%)
  PASS  ambiguous "closing thoughts" → personal (85%)
```

Full suite: `npx tsx --env-file=.env.local scripts/test-email-classifier.ts`

## Token Cost at Scale

Assumption: 100 inbound emails/day for a typical agent.

| Metric | Value |
|---|---|
| Tier 1 hit rate (empirical on test corpus) | ~80% (12/15 classified in Tier 1) |
| Tier 2 calls/day | ~20 |
| Haiku input/call | ~300 tokens |
| Haiku output/call | ~60 tokens (compact JSON) |
| Cost per Tier 2 call | ~$0.0005 |
| **Cost/agent/day** | **~$0.01** |
| **Cost/agent/month** | **~$0.30** |
| Cost for 1,000 agents/month | ~$300 |

Tier 1 is free. Tier 3 (Sonnet) is never triggered by classification — only by explicit user action, so it's not in this budget.

## Wired-In Locations

1. **`lib/comms/scanner.ts` → `runCommsScan`** — every comms scan now:
   - ingests messages
   - loads active transactions as classifier context
   - classifies inbound emails
   - writes `{category, confidence, tier, reason, matchedTransactionId, matchedSignals, classifiedAt}` to `CommunicationLog.metadata.classification`
   - failures are logged per-email; do not block the scan

2. **`lib/agents/email-scanner.ts` → `scanEmailAccount`** — the attachment-focused
   scanner now classifies each message once, logs the verdict, and returns
   per-bucket tallies in `ScanResult.classifications`. This gives Caleb visibility
   in the monitoring dashboard without a schema change.

## Known Edge Cases / Backlog

1. **Vendor emails not yet real.** `ctx.vendorEmails` is currently an empty array
   in both call sites. `lib/tc/vendor-scheduler.ts` has `PREFERRED_VENDORS` but all
   email fields are blank seed data. When Caleb populates real vendor emails (or
   Agent 2 ships a `Vendor` model), wire them into the ctx.
2. **Work-domain seed list is small (~20).** Extensible via `ctx.workDomains`.
   Recommend logging Tier 2 classifications of sender domains that hit
   `work_related` ≥10 times and auto-promoting them to the Tier 1 domain list.
3. **Party last name false positives.** E.g. seller "John Smith" + unrelated
   "Smith Corp" email. Mitigated by requiring an RE keyword alongside the name,
   but not perfect. Could tighten by requiring both first AND last name tokens.
4. **Address tokenizer is US-style only.** Strips "baton", "rouge", "la", "usa"
   as stopwords. Will need a rethink when AIRE expands beyond Louisiana.
5. **EmailAttachment has no metadata field.** Classification for the
   attachment-level scanner is logged + tallied only, not persisted per-row.
   If we want historical attachment-level classification, Agent 2 should add a
   `metadata Json?` column to `EmailAttachment`.
6. **Deterministic body exclusion of HTML.** Classifier takes plain body text;
   gmail-scanner currently passes `snippet` (Gmail's preview), which is usually
   plain. If we later pass raw HTML, strip tags before classifying.

## Strict Territory Compliance

Touched (permitted):
- `lib/comms/email-classifier.ts` (new)
- `scripts/test-email-classifier.ts` (new)
- `lib/comms/scanner.ts` (additive wiring)
- `lib/agents/email-scanner.ts` (additive wiring)
- `AGENT_MISSIONS/CEO_REPORT_EMAIL.md` (this file)

Not touched:
- `prisma/schema.prisma` (Agent 2 territory)
- `app/onboarding/**` (Agent 2 territory)
- `lib/voice-*` (Agent 3 territory)
- No commits made.

## Ready to Ship
Type-check clean on all touched files. Tests green (15/15). Classifier is live in
both scanner paths. Safe to deploy — cost impact negligible, no schema changes,
failures are caught per-email so classification errors never break scanning.
