# AIRE — Master Roadmap to $100K/mo MRR

**Owner:** Caleb Jackson · REALTOR at Reve Realtors, Baton Rouge
**Written:** 2026-04-13 · Consolidation Night
**North Star:** One app. Two products. $100,000 MRR inside 12 months.

---

## The Vision (what we're actually building)

AIRE is the **operating system for working real estate agents** — the software Dotloop and DocuSign should have been, plus the intelligence layer none of them have. Two products under one roof, one login, one database:

### Product 1 — TC Assistant
"Does everything." Transaction coordination from offer → close, augmented with intelligence: morning brief, compliance gate, vendor scheduling, auto-messages, earnest money tracking, CMA engine, market intel. The thing that replaces the agent's **assistant, transaction coordinator, and market analyst** with one interface.

### Product 2 — AirSign
Replaces Dotloop + DocuSign. Templates library, broker compliance queue, multi-tenant brokerage settings, LoopAutofillDrawer for migrating existing Dotloop users, bulk send, mobile signing, sealed PDFs with audit trail.

**These are the only two products. Everything else is a feature inside one of them.**

---

## Pricing (locked, per global CLAUDE.md)

| Tier | Price | Unlocks |
|---|---|---|
| AIRE Access | Free | Demo + 1 transaction + 5 AirSign envelopes |
| **AIRE Pro** | **$97/mo** | Full TC Assistant + unlimited AirSign + 7 agents + CMA + voice |
| AIRE Investor | $197/mo | Deal analysis, advanced ROI, cash flow, market pulse, FSBO tools |

---

## The $100K/mo Math

| Path | Users @ $97 Pro | Users @ $197 Investor | Blended MRR |
|---|---|---|---|
| Agent-heavy | 900 | 100 | $106,900 |
| Investor-heavy | 600 | 300 | $117,300 |
| **Target mix** | **750** | **200** | **$112,150** |

**~950 active paid users = $100K/mo.** Realistic in 12 months if CAC stays under $300 and churn under 5%/mo.

### Funnel assumptions
- aireintel.org free AVM + tools → 10% → free AIRE Access account
- Free Access → 30% convert within 30 days → AIRE Pro
- Brokerage partnerships = multiplier (10-agent brokerage = 10 paid seats instantly)

---

## The Four Moats

1. **Louisiana LREC depth** — nobody else has field-level LREC form maps. Parish-specific flood + assessor data. Moat against national SaaS.
2. **AirSign v2 template + broker compliance queue** — Dotloop/DocuSign have signing; neither has a broker compliance queue. Moat against e-sign incumbents.
3. **AIRE Intelligence AVM (11.53% MAPE, backtested)** — we have a working property valuation engine. Moat against realtor.com/Zillow for local accuracy.
4. **One app, one database** — every other player requires 4-6 tools stitched together (Dotloop + DocuSign + KVCore + CallRail + Calendar + Chat). AIRE is the single command center.

---

## The 4-Phase Execution Plan

### Phase A — Consolidation (this week)
**Goal:** One branch (`main`), one codebase, all production work merged.

- [x] Fix 4 TS errors in cma/engine (DONE — commit `9fc8f7a`)
- [x] Commit aire-intelligence final snapshot (DONE)
- [ ] Merge `cma/engine` → `main` (CMA backtest engine)
- [ ] Merge `tcs/flagship` → `main` (TCS Days 1-9)
- [ ] Merge `airsign/v2` → `main` (AirSign v2 full rebuild)
- [ ] Port 6 intel APIs from aire-intelligence repo → `app/api/intel/*`
- [ ] Delete aire-intelligence repo, archive demo 3
- [ ] Run full tsc + build + tests on main, tag `v1.0-consolidation`

**Deliverable:** One repo, one branch, clean baseline, 0 TS errors.

### Phase B — UI Coherence Pass (next week)
**Goal:** Every surface in AIRE reads as one polished product using the locked design system.

- [ ] Apply `aire-frontend-design` skill + Concept B + Nocturne theme to:
  - `/aire` dashboard (morning brief hero + pipeline + quick actions)
  - `/aire/transactions/[id]` (5-tab detail — upgrade pass, not rebuild)
  - `/aire/cma/new` (NEW — CMA Day 6 output UI + market intel)
  - `/aire/intel` (NEW — AVM + flood + neighborhood + insurance hub)
  - `/airsign` (AirSign v2 dashboard, templates library, broker compliance queue)
- [ ] Daylight/Nocturne theme toggle on every `/aire/*` and `/airsign/*` page
- [ ] Responsive (375 + 768 + 1280 + 1920) on every surface
- [ ] Self-eval 8-criteria rubric on each page, revise < 8/10

**Deliverable:** AIRE reads like Linear × Attio × Kinfolk on every surface.

### Phase C — Public Launch + Lead Funnel (2 weeks out)
**Goal:** aireintel.org public tools + landing pages converting to AIRE Pro signups.

- [ ] Port aire-intelligence homepage + tools hub into `app/(marketing)/*`
- [ ] 7 public tools pages live: AVM, Flood, Neighborhood, Insurance, Backtest, Market Pulse, Cash Flow
- [ ] Free AVM → email capture → 7-day nurture sequence → $97 Pro checkout
- [ ] Brokerage-tier landing page (10+ agent discount structure)
- [ ] Instagram Q1 carousel posted (the one already 90% done)
- [ ] 4 blog posts on Baton Rouge market intelligence (SEO moat)

**Deliverable:** 10-20 signups/week from organic + social.

### Phase D — Revenue Levers (month 2-12)
**Goal:** Scale to 950 paid users.

- **Brokerage partnerships** — 3 brokerage deals = 30-60 seats instant
- **FSBO tools** ($197 tier) — fully integrated, voice-driven listing builder
- **Voice Command ⌘K** — production-grade transcription (Whisper), Louisiana place-name accuracy
- **LoopImport migration** — "Switch from Dotloop in 10 minutes" — we already have the autofill drawer
- **Referral program** — agents who refer brokerages get 3 months free
- **Content engine** — 52 Instagram posts/year, 12 Louisiana-market reports, 12 email campaigns
- **Compliance audit cron** — weekly email: "3 of your 12 transactions have compliance gaps" → retention driver

**Revenue ladder:**
| Month | Paid Users | MRR | Notes |
|---|---|---|---|
| M1 | 20 | $1,940 | Caleb's network, beta users |
| M3 | 100 | $9,700 | First brokerage partnership |
| M6 | 350 | $33,950 | Organic + 2 more brokerages |
| M9 | 650 | $63,050 | FSBO investor tier kicks in |
| **M12** | **950** | **$100,250** | **Target hit** |

---

## What We're Explicitly NOT Building

- Generic CRM features (KVCore exists, we integrate not compete)
- Lead generation tools (let KVCore/BoomTown do it)
- Showing/tour scheduling (ShowingTime exists)
- Mortgage calculators as a standalone product (it's a feature of AIRE Investor)
- A mobile app (PWA first, native only if > 2000 users ask)
- Chatbots (voice is our interface)
- Zillow/Realtor.com listings aggregation (scraping is a liability)

---

## Current Production State (2026-04-13)

### Branches in aire-assistant
| Branch | Status | Location | Ships |
|---|---|---|---|
| `main` | stable | repo root | baseline |
| `cma/engine` | current, 0 TS errors | repo root | CMA Day 5 backtest 11.53% MAPE |
| `airsign/v2` | 33/33 tests pass | worktree `aire-assistant-airsign-v2/` | Full AirSign v2 rebuild |
| `tcs/flagship` | Day 9 shipped | worktree `aire-assistant-tcs-flagship/` | TCS offer→UC→close engine |

### Sister repos (to be absorbed/retired)
- `aire-intelligence/` → 6 public APIs to port, then delete
- `Demo 2 AIRE/demo 3/` → shadow AIRE, archive + delete

### Installed infra
- Neon PostgreSQL · Clerk auth · Stripe billing · Vercel hosting · Twilio SMS · Resend email
- 9 cron jobs · 129 API routes · 38 `/aire/*` pages · 3 `/airsign/*` pages
- Self-learning engine · circuit breaker · error memory · monitoring dashboard

---

## The One Thing That Matters

If we only ship ONE thing per week, it must move the needle on **"new Pro signups this month."** Everything else is busy work.

---

*Next session: execute Phase A merges, then tag v1.0-consolidation.*
