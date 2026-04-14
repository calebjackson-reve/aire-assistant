# CMA_MASTER_PLAN.md

**Mission:** Build a CMA engine that beats MLS, PropStream, and RPR list-price recommendations by comparing each vendor's suggestion to the actual sold price. Kendall-grade precision, mortgage overlay, 15-second delivery.

**Scope anchor:** Extends `lib/data/engines/multi-source-cma.ts` (ensemble + PPS + disagreement already exist). This plan adds real scraped comps, adjustment logic, a feedback loop that trains AIRE's delta over the vendors, and a mortgage-qualification overlay — wrapped in `/aire/cma`.

**Non-negotiables:** DESIGN.md palette (sage/olive/cream/linen/deep forest). IBM Plex Mono for every number. Playfair for headings. Space Grotesk for body. No blue, no gradients, no `transition: all`.

---

## a) Scraper Architecture

**Runtime:** Node.js server-side only. Playwright with `chromium.launch({ headless: true })`. Never expose scrapers to the browser.

**Session persistence**
- One `storageState.json` per vendor: `lib/cma/scrapers/sessions/{mls|propstream|rpr}.json`.
- On cold run: navigate to login URL, fill credentials from `.env.agents.local`, wait for post-login DOM marker, call `context.storageState({ path })`.
- On warm run: `browser.newContext({ storageState: path })`. Probe a known post-login URL — if redirected to login, re-authenticate and re-save.
- Session TTL tracked in a `ScraperSession` row (see data model). Refresh proactively at 80% of observed TTL to avoid mid-run failures.

**Stealth**
- `playwright-extra` + `puppeteer-extra-plugin-stealth` (shared API). Override `navigator.webdriver`, UA, viewport (1440x900), `Accept-Language: en-US`, Louisiana timezone.
- Human-ish jitter: `await page.waitForTimeout(800 + Math.random()*1200)` between actions. No identical timings.
- Never parallel-hit the same vendor. Serial queue per domain.

**Rate limiting**
- `Bottleneck` instance per vendor: `maxConcurrent: 1, minTime: 2000` (≥ 2s between requests, as required).
- Global circuit breaker (reuse `lib/learning/circuit-breaker.ts`): 3 consecutive failures → pause that vendor 15 min.

**Audit trail**
- Every scrape opens a `job_runs` row: `{ vendor, subject_address, started_at, status, comps_returned, error, duration_ms }`. Closed on success or failure.
- Screenshot + HTML snapshot on error → `/tmp/cma-debug/{run_id}/`. Keep last 20, rotate.

**Module layout**
```
lib/cma/
  scrapers/
    base.ts                   // Playwright launcher, session mgmt, rate-limit wrapper
    mls.ts                    // GBRAR Paragon — sold comps by polygon/radius
    propstream.ts             // AVM + suggested list price + comps
    rpr.ts                    // RPR estimate + comp set + suggested range
    sessions/.gitignore       // never commit sessions
  comp-picker.ts
  adjuster.ts
  confidence.ts
  accuracy-tracker.ts
  mortgage-overlay.ts
  index.ts                    // runFullCMA(subject) orchestrator
```

**What each scraper returns (normalized)**
```ts
interface VendorCMAResult {
  vendor: 'mls_paragon' | 'propstream' | 'rpr'
  suggestedListPrice: number | null     // what THEY told the agent to list at
  estimate: number | null               // their AVM/value
  rangeLow: number | null
  rangeHigh: number | null
  comps: RawComp[]                      // up to 20
  scrapedAt: Date
  raw: unknown                          // full payload for audit
}
```

---

## b) Data Model (new Prisma tables)

Additive migration — nothing existing moves. All FKs use `cuid()`. Indexed on `subjectPropertyId` and `createdAt` for dashboard queries.

```prisma
model CompSet {
  id                   String   @id @default(cuid())
  userId               String
  user                 User     @relation(fields: [userId], references: [id])
  subjectAddress       String
  subjectPropertyId    String?  // links to properties_clean.property_id if known
  subjectLat           Float?
  subjectLng           Float?
  subjectSqft          Int?
  subjectBeds          Int?
  subjectBaths         Float?
  subjectYearBuilt     Int?
  subjectLotSize       Int?
  subjectCondition     String?  // 'excellent' | 'good' | 'average' | 'fair'
  subjectFeatures      Json?    // { pool, garage_bays, fireplace, waterfront, ... }

  mlsSuggestedPrice    Float?
  propstreamSuggestedPrice Float?
  rprSuggestedPrice    Float?

  aireEstimate         Float?   // post-adjustment ensemble
  aireRangeLow         Float?
  aireRangeHigh        Float?
  confidenceTier       String?  // HIGH | MEDIUM | LOW
  confidenceScore      Float?   // 0-1
  disagreementPct      Float?

  mortgageContext      Json?    // output of mortgage-overlay.ts
  status               String   @default("active") // active | listed | sold | abandoned

  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  comps                Comp[]
  accuracyLog          AccuracyLog?

  @@index([userId, createdAt])
  @@index([subjectAddress])
  @@index([status])
}

model Comp {
  id                 String   @id @default(cuid())
  compSetId          String
  compSet            CompSet  @relation(fields: [compSetId], references: [id], onDelete: Cascade)
  source             String   // 'mls_paragon' | 'propstream' | 'rpr'
  address            String
  lat                Float?
  lng                Float?

  soldPrice          Float
  soldDate           DateTime
  listPrice          Float?
  daysOnMarket       Int?

  sqft               Int?
  beds               Int?
  baths              Float?
  yearBuilt          Int?
  lotSize            Int?
  garageBays         Int?
  condition          String?
  features           Json?    // { pool, fireplace, ... }
  distanceMiles      Float?

  similarityScore    Float    // 0-1 from comp-picker
  selected           Boolean  @default(false)  // included in final set
  adjustments        Json?    // [{ factor, amount, reason }]
  adjustedValue      Float?   // soldPrice + sum(adjustments)
  weight             Float?   // final weight in the adjusted average

  rawPayload         Json?    // unvarnished vendor row, for audit

  createdAt          DateTime @default(now())

  @@index([compSetId, selected])
  @@index([source])
  @@index([soldDate])
}

model AccuracyLog {
  id                    String   @id @default(cuid())
  compSetId             String   @unique
  compSet               CompSet  @relation(fields: [compSetId], references: [id], onDelete: Cascade)

  actualListPrice       Float?
  actualSoldPrice       Float?
  actualDOM             Int?
  actualSoldDate        DateTime?

  mlsError              Float?   // (mlsSuggested - soldPrice) / soldPrice
  propstreamError       Float?
  rprError              Float?
  aireError             Float?

  winner                String?  // 'mls' | 'propstream' | 'rpr' | 'aire' — smallest |error|
  notes                 String?

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@index([createdAt])
}

model ScraperSession {
  id           String   @id @default(cuid())
  vendor       String   @unique
  storagePath  String
  lastLoginAt  DateTime
  lastProbeAt  DateTime?
  status       String   // 'healthy' | 'expired' | 'locked'
  ttlMinutes   Int      @default(60)
  notes        String?
  updatedAt    DateTime @updatedAt
}
```

The existing `CMAAnalysis` model is kept for legacy/agent code paths; new UI writes `CompSet`.

---

## c) Comp Selection Algorithm

File: `lib/cma/comp-picker.ts`

**Pool:** union of all vendor comps (deduped by address+soldDate), cap ~60 raw → rank → select top N (default 6, user can toggle 3–10).

**Hard filters** (drop before ranking):
- Sold within last 12 months (180 days preferred, fallback to 365 if < 4 candidates).
- Within 1.5 miles (fallback 3.0 mi if sparse).
- Same property type (SFR vs. condo vs. townhouse — never mix).
- Sqft within ±25% of subject.
- Beds within ±1.
- Not a foreclosure / REO / short sale unless subject itself is distressed (flag on subject).

**Similarity score (0–1)** = weighted sum:
| Weight | Dimension | Scoring |
|---|---|---|
| 0.30 | Proximity | `max(0, 1 - distance_miles / 1.5)` |
| 0.25 | Sqft similarity | `1 - |sqftΔ| / subject.sqft`, clamp 0–1 |
| 0.15 | Recency | `1 - months_ago / 12` |
| 0.10 | Beds match | 1.0 exact, 0.6 ±1, 0 else |
| 0.10 | Baths match | `1 - |bathsΔ| * 0.4`, clamp |
| 0.05 | Year built | `1 - |yearΔ| / 40`, clamp |
| 0.05 | Lot size | `1 - |lotΔ| / subject.lot`, clamp |

Select top N by similarity, but enforce **source diversity** — no more than 60% of final set from a single vendor if alternatives exist within 10% similarity of the cutoff.

---

## d) Adjustment Engine

File: `lib/cma/adjuster.ts`. All adjustments applied to **comp's sold price** to bring it onto subject's terms (positive = add to comp to make it worth more; sign flips if subject lacks the feature).

| Factor | Rule | Source |
|---|---|---|
| Sqft | `(subject.sqft - comp.sqft) × $/sqft_submarket` where `$/sqft` comes from `market_snapshots` for the subject zip, fallback parish median | market_snapshots |
| Beds | `±$5,000 per bedroom` below 4; `±$8,000` above (marginal utility drops) | Kendall heuristic, tunable |
| Baths | Full bath ±$7,500; half bath ±$3,500 | tunable |
| Lot size | `(subject.lot - comp.lot) × $1.50/sqft` (urban) or `$0.75/sqft` (rural) | parish rule |
| Age | `-$500 per year older than subject` up to 30 yrs | tunable |
| Garage | `±$6,000 per bay` (1-bay vs 2-bay vs none) | tunable |
| Pool | ±$15,000 (Louisiana summer premium) | tunable |
| Condition | Excellent=+8%, Good=+3%, Average=0, Fair=-5%, Poor=-15% — applied multiplicatively | subject.condition |
| Waterfront | ±$40,000 lumpsum | features |
| Flood zone | If comp in X and subject in AE: -3% on subject value; if both in AE: no adjustment | `louisiana-live.ts` flood lookup |

**Rules:**
- Every adjustment returns `{ factor, amount, reason }` and is persisted on `Comp.adjustments`.
- Total adjustments capped at 15% of sold price (Fannie/Freddie "net" rule). If exceeded, flag `over_adjusted: true` and down-weight comp 50%.
- All constants live in `lib/cma/adjuster-constants.ts` so they can be recalibrated from feedback (see section e).

**Final adjusted value per comp:** `adjustedValue = soldPrice + Σ adjustments`.

**AIRE estimate:** weighted mean of selected comps' adjusted values. Weight = `similarityScore × recencyFactor × (0.5 if over_adjusted else 1)`.

**Range:** 10th–90th percentile of weighted distribution (bootstrap) — published as `aireRangeLow`/`aireRangeHigh`.

---

## e) Accuracy Feedback Loop

File: `lib/cma/accuracy-tracker.ts`

**Capture:** when a subject property actually lists and sells (detected via daily MLS scan matching `CompSet.subjectAddress`), write an `AccuracyLog` row. Each vendor's error = `(suggestion - soldPrice) / soldPrice`.

**Cron:** extend `app/api/cron/data-sync/route.ts` — after nightly MLS sync, call `reconcileOpenCMAs()` which:
1. Finds `CompSet` rows with `status='active'` whose address now has a sold record ≤ 120 days after CompSet creation.
2. Writes `AccuracyLog` with errors + winner.
3. Updates `CompSet.status = 'sold'`.

**Training signal (delta model):**
- Rolling 90-day MAPE per vendor (mean absolute percentage error).
- AIRE's target: **beat the best single vendor's MAPE by ≥ 2 percentage points.**
- When AIRE underperforms a vendor 3 months running, `scripts/recalibrate-cma.ts` runs gradient search over adjuster constants + similarity weights on the last 120 days of logs, minimizing AIRE MAPE on a held-out 20% split. New constants overwrite `adjuster-constants.ts` via PR (not auto-deployed — admin approves).

**Public scoreboard:** `/aire/cma/accuracy` admin page — rolling leaderboard:
```
| Vendor      | 90d MAPE | Bias   | N    | Win rate |
| AIRE        | 2.1%     | -0.3%  | 42   | 54%      |
| MLS         | 3.4%     | +1.1%  | 42   | 21%      |
| PropStream  | 4.8%     | +2.9%  | 42   | 14%      |
| RPR         | 5.2%     | +3.3%  | 42   | 11%      |
```
This is the proof point. Every CMA page links to it.

---

## f) Mortgage Overlay

File: `lib/cma/mortgage-overlay.ts`

**Inputs:** AIRE estimate (or list price), down payment %, loan type, credit tier, tax/insurance estimates from `louisiana-live.ts`.

**Rates source:** MND daily scrape OR FRED weekly series (FRED has no key). Prefer FRED `MORTGAGE30US`, `MORTGAGE15US` cached 6h. Adjust by credit tier (+0 / +0.25 / +0.50 / +0.875 from tier A→D).

**Outputs per price point:**
- Monthly P&I, taxes (parish millage from louisiana-live), insurance estimate (flood overlay if AE/VE — flood insurance estimate by zone), PMI if < 20% down.
- Qualifying income needed for 36% DTI and 43% DTI.
- Buyer pool estimate (pulls median parish household income, computes % of households that qualify at 36% DTI — "your pool is ~28% of Baton Rouge households").

**UI consumption:** rendered as a secondary card beneath the value range on `/aire/cma`, so sellers instantly see "at $315K you have a buyer pool of 22% of the parish; drop to $299K and it widens to 34%."

---

## g) UI — `/aire/cma`

Follows DESIGN.md strictly. Cream page bg. Deep Forest sidebar (existing `DarkLayout`). Frontend-design skill invoked before any TSX.

**Layout (desktop, single page, no routes beyond `/aire/cma`):**

```
┌ Hero (Sage, full-bleed, 240px tall) ─────────────────────────────────────┐
│ eyebrow: "AIRE CMA ENGINE"  (Space Grotesk uppercase, Linen 60% opacity) │
│ headline: "Comparative Market Analysis." (Playfair 56px italic, Linen)   │
│ subhead: "Built to beat MLS, PropStream, and RPR." (Linen 80%)           │
└──────────────────────────────────────────────────────────────────────────┘

┌ Step 1 — Subject Property (Cream card, max-w 880) ──────────────────────┐
│ Address input (autocomplete via Nominatim)                              │
│ Grid of 8 fields: sqft, beds, baths, year built, lot, garage,           │
│   condition (segmented), features (checklist: pool/fireplace/waterfront)│
│ [Run CMA] (Olive primary button)                                         │
└──────────────────────────────────────────────────────────────────────────┘

── loading state: sage skeleton rows + "Scraping MLS… PropStream… RPR…" ──

┌ AIRE Estimate Card (Cream, Olive left border) ───────────────────────────┐
│ label: ESTIMATED VALUE RANGE                                             │
│ value: $298,000 – $316,000   (IBM Plex Mono 48px, Deep Forest)           │
│ point estimate: $307,500     (IBM Plex Mono 24px, Olive)                 │
│ confidence: ●HIGH 92%        (dot+badge, success pill)                   │
└──────────────────────────────────────────────────────────────────────────┘

┌ Vendor Comparison Strip (Cream, 4 stat cards) ───────────────────────────┐
│ AIRE $307,500  |  MLS $315,000  |  PropStream $322k  |  RPR $298k        │
│ (IBM Plex Mono values, each with tiny delta arrow vs AIRE)              │
└──────────────────────────────────────────────────────────────────────────┘

┌ Comp Table (Cream, Warm White rows) ─────────────────────────────────────┐
│ Source | Address | Sold | $/sqft | Sqft | Bd/Ba | Dist | Adj | Adjusted  │
│ MLS    | ...     | ...  | ...    | ...  | ...   | ...  | +$8k| $309,000  │
│ ...                                                                       │
│ (click row → drawer with full adjustment breakdown + raw scraped JSON)   │
└──────────────────────────────────────────────────────────────────────────┘

┌ Mortgage Overlay Card (Cream, Olive border-left) ────────────────────────┐
│ At $307,500 — 20% down, 30yr, 7.12% rate                                 │
│ Monthly: $2,158 P&I | $412 taxes | $178 insurance = $2,748               │
│ Qualifying income: $91,600 (36% DTI)                                      │
│ Parish buyer pool: 28% of households qualify                             │
│ Slider: price → reprices live.                                            │
└──────────────────────────────────────────────────────────────────────────┘

┌ Accuracy Proof Footer (Cream, subtle) ───────────────────────────────────┐
│ "AIRE's 90-day MAPE on Baton Rouge: 2.1%. MLS: 3.4%. PropStream: 4.8%."  │
│ link → /aire/cma/accuracy                                                 │
└──────────────────────────────────────────────────────────────────────────┘
```

**Interactions:**
- Rerun with different comp count (3/6/10 toggle).
- Include/exclude individual comps (checkbox) → recalculates live.
- Export: PDF (listing presentation format) and CSV.

**Route handlers:**
- `POST /api/cma/run` — body `{ subject }` → returns full `MultiSourceCMA` + persisted `CompSet.id`.
- `POST /api/cma/[id]/toggle-comp` — include/exclude, triggers recompute.
- `GET /api/cma/[id]/export?format=pdf|csv`.

---

## h) 10-Day Build Roadmap

**Day 1 — Scaffolding + Prisma**
- Prisma migration: `CompSet`, `Comp`, `AccuracyLog`, `ScraperSession`.
- `lib/cma/scrapers/base.ts`: Playwright launcher, session persistence, rate limiter, job_runs logging.
- `.gitignore` for `lib/cma/scrapers/sessions/`.
- Smoke test: log into each of MLS/PropStream/RPR, save storageState, probe a post-login page.

**Day 2 — MLS Paragon scraper** *(safety-first — account B24140 is sole access)*
- Login flow with **human-paced typing (50–150ms/char)**, pauses between fields.
- **storageState reused 7 days.** Skip login entirely if state < 7 days old.
- Navigate to sold-search, polygon/radius query by subject lat/lng.
- Parse result rows → `VendorCMAResult` (up to 20 comps + Paragon CMA suggestion if offered).
- **Smoke test: single address only — 5834 Guice Dr, Baton Rouge** (known: sold Q1 2026 at $160K, 3 DOM).
  Pass = ≥ 5 comps within 1.5mi, sold within 180 days.
- **Two consecutive login failures → halt**, capture screenshot, alert, wait for human. No auto-retry.
- **Any captcha → STOP entirely.** No bypass attempts. Alert + wait.
- **No batch runs on Day 2.** Single-shot validation only.
- Every Paragon defense observed logged to `DAY2_NOTES.md` (captchas, UA sniffing, rate limits, anti-bot JS, iframe nesting).

**Day 3 — PropStream + RPR scrapers**
- PropStream: address search → AVM + comps tab scrape.
- RPR: address search → RVM + comps.
- Both return the normalized `VendorCMAResult`.
- Persist debug screenshots on failure.

**Day 4 — Comp picker + adjuster**
- `comp-picker.ts` with hard filters + similarity scoring + source diversity rule.
- `adjuster.ts` with all 10 factors, cap at 15%, over_adjusted down-weight.
- `adjuster-constants.ts` broken out for future retraining.
- Unit tests: golden set of 3 subject properties with expected comp counts + adjusted ranges.

**Day 5 — Orchestrator + confidence + API**
- `lib/cma/index.ts::runFullCMA(subject)` — runs scrapers in parallel, dedupes comps, picks, adjusts, computes weighted mean + range, writes CompSet + Comps.
- `confidence.ts` wraps existing `calculateDisagreement` + adds comp-count and adjustment-size penalties.
- `app/api/cma/run/route.ts` with auth, user check, timing metrics (target < 15s total).

**Day 6 — `/aire/cma` page (Part 1 — input + results)**
- Invoke frontend-design skill. Build hero, subject form, results cards (AIRE estimate + vendor strip).
- Playfair/Space Grotesk/IBM Plex Mono wired. Sage/Olive/Cream only.

**Day 7 — `/aire/cma` page (Part 2 — comp table + drawer)**
- Comp table with adjustment drilldown drawer.
- Include/exclude toggles with live recompute via `/api/cma/[id]/toggle-comp`.
- PDF + CSV export endpoints.

**Day 8 — Mortgage overlay**
- `mortgage-overlay.ts` with FRED rates cache, flood-aware insurance, parish millage.
- UI slider card, buyer pool estimate pulling ACS/parish income.

**Day 9 — Accuracy loop + dashboard**
- `accuracy-tracker.ts` + cron extension in `data-sync` route.
- `/aire/cma/accuracy` admin page with leaderboard.
- Seed 30 days of synthetic reconciliation to validate.

**Day 10 — Hardening + launch**
- Circuit breakers, retries, session refresh proactive schedule.
- Error telemetry wired to `AgentActivity` + `ErrorMemory`.
- Load test: 50 sequential CMAs on known addresses — assert p95 < 15s, zero scraper lockouts.
- Add voice intent `run_cma` to voice-action-executor.
- Docs: README in `lib/cma/` explaining retraining, session reset, vendor onboarding.

---

## Locked Decisions (2026-04-12)

1. **Scrape artifacts:** screenshots + normalized JSON only. **No raw HTML persisted.** 30-day rotation.
2. **Recalibration cadence:** **monthly for the first 6 months, then quarterly.** Controlled by `RECALIBRATION_INTERVAL_DAYS` constant in `lib/cma/adjuster-constants.ts` — flip the value, no deploy required beyond code push. Cron reads it each run.
3. **Vendor degradation bands:**
   - 3/3 vendors → green "full" badge, writes to AccuracyLog.
   - 2/3 vendors → **yellow "partial" badge**, writes to AccuracyLog (still valid training signal).
   - 1/3 vendors → **red "degraded" badge**, run returns but **DOES NOT write to AccuracyLog** (protects training data integrity). `CompSet.status = 'degraded'` so retrainer filters it out.
   - 0/3 vendors → hard error, no CompSet written.
4. **Voice trigger:** **deferred.** Day 10 is pure hardening + load test. A Day 11 entry added below for the voice intent build.

## Legal / Relationship Guardrail

**The accuracy leaderboard is internal-only and admin-gated.** Route: `/aire/cma/accuracy`. Middleware check: `user.role === 'admin'` or explicit `ADMIN_EMAILS` allowlist. Never:
- Render vendor names in any public marketing page, og:image, or PDF export seen by a non-admin.
- Include vendor-comparison data in the PDF listing presentation export (show AIRE estimate + comps only).
- Publish MAPE numbers to social, blog, or the public homepage.

Acceptable: private sales pitches, investor decks, internal reporting. Any public benchmark that could be traced back to a named third-party vendor (MLS/PropStream/RPR) is blocked.

## Day 11 — Voice Intent (deferred)

- Add `run_cma` intent to `lib/voice-action-executor.ts` classifier.
- Parse natural-language subject address + optional override fields.
- Call `runFullCMA()` and return spoken summary: "AIRE estimates $307,500, confidence high, MLS suggests $315,000."
- Fast-path regex for "run a CMA on {address}".
- Separate session — not bundled with Day 10 hardening.

---

PLAN LOCKED — Day 1 in progress
