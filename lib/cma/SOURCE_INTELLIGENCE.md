# CMA Source Intelligence — Data Dictionary & Ensemble Design

**Created:** 2026-04-13 (Day 3)
**Owner:** `lib/cma/` scraper + `lib/data/engines/` ensemble
**Ground truth subject:** 5834 Guice Dr, Baton Rouge LA — sold Q1 2026, $160,000, 3 DOM.

This document answers three questions for every future CMA feature:

1. **What does each source uniquely expose?** (the data dictionary)
2. **How do we combine them?** (the weighted ensemble)
3. **What signals do we now have that we didn't have before?** (the "new intelligence" delta)

---

## 1. Data Dictionary — Per Source

Columns mark whether a source is **(P)rimary** (authoritative), **(S)econdary** (useful corroborator), or **(—)** not available.

### 1a. ROAM MLS (Paragon, GBRAR tenant)

Behind ROAM SSO (`roam.clareityiam.net` → `roam.clareity.net/layouts`) → Paragon app at `mlsbox.paragonrels.com/ParagonLS/Default.mvc`. Agent-entered, locally priced, authoritative for sold comps in East Baton Rouge / Ascension / Livingston / West Baton Rouge.

| Field                         | Availability | Notes                                                     |
| ----------------------------- | ------------ | --------------------------------------------------------- |
| Street address + unit         | P            | Normalized in GBRAR style                                 |
| MLS #                         | P            | Stable identifier for the listing                         |
| List price / sold price       | P            | Sold price is the ground truth for comp analysis          |
| Days on market (DOM)          | P            | List → pending + list → close                             |
| Status                        | P            | Active / Pending / Closed / Expired / Withdrawn           |
| Close date + contract date    | P            | Exact dates                                               |
| Heated sqft / total sqft      | P            | Agent-entered; occasional data-entry errors               |
| Beds / full baths / half baths | P            | Agent-entered                                             |
| Year built                    | P            | From parish records, verified                             |
| Lot size (sqft or acreage)    | P            | Parish-verified                                           |
| Stories                       | P            |                                                           |
| Garage (attached, # of cars)  | P            |                                                           |
| Pool / waterfront             | P            |                                                           |
| Construction / roof / hvac    | P            | Granular property characteristics                         |
| Flood zone (X / A / AE / VE)  | P            | Agent-marked; parish FEMA map is authoritative fallback   |
| Subdivision / neighborhood    | P            |                                                           |
| Parish                        | P            |                                                           |
| Zip code + census tract       | S            | Derivable from address                                    |
| Public remarks (narrative)    | P            | Marketing copy — useful for condition cues                |
| Agent remarks (private)       | P            | "Needs TLC", "As-is" — condition hints invisible elsewhere |
| Photos (25–50 typical)        | P            | Primary visual condition signal                           |
| Listing agent + brokerage     | P            | Co-op commission (%), agent ID                            |
| HOA fee + frequency           | P            |                                                           |
| Taxes (annual)                | P            | Sometimes blank; parish assessor is authoritative         |
| Tax ID / APN                  | P            | Links to parish records                                   |
| Open houses                   | S            | Rare in market-study context                              |
| School district               | P            | Not scored; just labeled                                  |

**ROAM unique value:** sold-price ground truth + agent-verified property characteristics + agent narrative remarks. **Nothing else in this list produces the actual sold price.**

### 1b. RPR (Realtors Property Resource)

Realtor.com's data product for NAR members. Available via NARRPR API (key required) or the RPR Homepage link already surfaced in the ROAM Paragon menu.

| Field                         | Availability | Notes                                                       |
| ----------------------------- | ------------ | ----------------------------------------------------------- |
| RPR AVM (Automated Valuation) | P            | Property-level estimate with confidence band                |
| AVM confidence range (±%)     | P            | RPR's own uncertainty band — use to weight the AVM          |
| Distressed indicators         | P            | REO, pre-foreclosure, auction, short-sale flags             |
| School ratings + attendance zones | P        | GreatSchools scores + boundary data                         |
| Neighborhood demographics     | P            | Median income, age, household composition, commute patterns |
| Flood / earthquake / wildfire | S            | Louisiana: flood dominates; EQ/wildfire not applicable      |
| Ownership history             | P            | Transfers, deeds, dates                                     |
| Mortgage history              | P            | Loan amounts + dates + lender                               |
| Tax history (multi-year)      | P            | Trend data — parish assessor only gives current year        |
| Property taxes + assessments  | P            |                                                             |
| Flood insurance estimate      | S            |                                                             |
| Property photos + street view | S            | Fewer than MLS; non-agent sourced                           |
| Public record legal desc.     | P            | Lot / block / subdivision / metes & bounds                  |
| Comparable properties         | S            | RPR's own comp set — usable as a corroboration signal       |
| Market trends at zip level    | P            | Median price trajectory, months of inventory                |

**RPR unique value:** confidence-banded AVM + school attendance zones + multi-year tax trajectory + ownership & loan history.

### 1c. PropStream

Investor-focused off-market data. Tax assessor, lien, and owner-contact layers that MLS does not expose.

| Field                         | Availability | Notes                                                       |
| ----------------------------- | ------------ | ----------------------------------------------------------- |
| PropStream AVM                | P            | Second AVM model — useful for triangulation                 |
| Equity estimate               | P            | AVM − all liens = equity snapshot                           |
| All open liens (count + $)    | P            | Mortgages, HELOC, tax liens, judgments, mechanic's liens    |
| Foreclosure status            | P            | Pre-foreclosure / auction / REO / none                      |
| Ownership type                | P            | Owner-occupied / absentee / LLC / trust                     |
| Owner contact info            | P            | Phone, email, mailing address (outreach-ready)              |
| Years owned                   | P            |                                                             |
| Cash buyer history            | P            | How often owner buys all-cash (investor signal)             |
| Total portfolio (per owner)   | P            | Count of properties owned by same entity                    |
| Free & clear status           | P            |                                                             |
| Public MLS history            | S            | Prior listings on this property, even if withdrawn/expired  |
| Tax delinquency status        | P            | Current vs. delinquent                                      |
| HOA fee + liens               | S            |                                                             |
| Occupancy signal              | S            | Via utility / mail-return heuristics                        |
| Estimated rent                | P            | Rent AVM — useful for investor pricing                      |
| Cap rate estimate             | P            | If rented, gross yield                                      |

**PropStream unique value:** lien stack + owner contact + foreclosure flags + cash-buyer / portfolio signals + rental AVM. **This is the only source that tells us whether a seller is distressed, over-leveraged, or easy to reach directly.**

### 1d. Zillow

Consumer-facing. Useful as a demand-side / psychological signal, not as ground truth.

| Field                         | Availability | Notes                                                       |
| ----------------------------- | ------------ | ----------------------------------------------------------- |
| Zestimate                     | S            | Low-confidence in Louisiana; known to over-predict          |
| Zestimate range (low / high)  | S            | Zillow's own uncertainty band                               |
| Zestimate history             | P            | 12+ months of Zestimate trajectory — not available elsewhere |
| Rent Zestimate                | S            | Corroborates PropStream's rent AVM                          |
| Days on Zillow                | P            | Often diverges from MLS DOM (Zillow keeps clock running after relist) |
| Price cuts (count + $)        | P            | Unique to Zillow — MLS hides cuts after relist              |
| Page views / saves            | P            | Proxy for consumer demand                                   |
| Contact-for-info requests     | P            | Demand signal (aggregate)                                   |
| Walk / transit / bike score   | S            |                                                             |
| Zillow-provided photos        | S            | Usually MLS photos; sometimes stale                         |
| "Hot home" flag               | S            | Zillow's own popularity score                               |
| Comparable sales (Zillow picks) | S         | Zillow's comp algorithm picks — rarely match MLS agent's picks |

**Zillow unique value:** Zestimate *trajectory* + price-cut history + consumer engagement signals (views, saves, tour requests). **This is the only source that tells us what buyers are feeling.**

---

## 2. Source Coverage Matrix

What each source gives you that no other source does:

| Signal                        | ROAM | RPR | PropStream | Zillow |
| ----------------------------- | :--: | :-: | :--------: | :----: |
| Sold price (ground truth)     |  P   | —   | —          | —      |
| Agent narrative / remarks     |  P   | —   | —          | —      |
| Property photos (current)     |  P   | S   | —          | S      |
| AVM with confidence band      |  —   | P   | P          | S      |
| School attendance zone        |  —   | P   | —          | —      |
| Multi-year tax trajectory     |  —   | P   | S          | —      |
| Lien stack + foreclosure      |  —   | S   | P          | —      |
| Owner contact info            |  —   | —   | P          | —      |
| Cash-buyer / portfolio signal |  —   | —   | P          | —      |
| Zestimate history             |  —   | —   | —          | P      |
| Price-cut history             |  S   | —   | —          | P      |
| Consumer demand (views, saves) | —   | —   | —          | P      |

**Takeaway:** no pair covers the matrix. A full CMA needs at least three sources, preferably all four.

---

## 3. Ensemble Algorithm

Existing engine: [`lib/data/engines/ensemble.ts`](data/engines/ensemble.ts). Default weights: MLS 40 / PropStream 25 / Zillow 20 / Redfin 15. This document proposes a refined four-source weighting (RPR replaces Redfin) and a confidence-adjusted override.

### 3.1 Base weights (Louisiana-tuned)

```
ROAM MLS     0.45   — highest: local, agent-verified, sold-price ground truth
PropStream   0.25   — strong AVM + distressed signals
RPR          0.20   — confidence-banded AVM + neighborhood context
Zillow       0.10   — consumer-facing anchor; weakest in LA (flood-zone blindness)
```

Rationale: ROAM is the only source that sees the actual sold price on recent comps in this market. PropStream's AVM is trained on nationwide tax-roll data but factors LA parish patterns reasonably well. RPR's AVM confidence band is worth more than its point estimate (we use the band to modulate weight, see below). Zillow consistently over-predicts in flood-prone zip codes (70808, 70809, 70817) — keep it in the ensemble for comparison signal, not as a primary weight.

### 3.2 Confidence-adjusted weights

Each source returns a confidence tier. Multiply its base weight by the confidence factor before ensembling:

```
high   → 1.00
medium → 0.70
low    → 0.35
missing / error → 0.00 (redistribute per existing ensemble.ts logic)
```

RPR's native confidence band (±% on AVM) overrides the tier: if the band is wider than ±10%, cap RPR's effective weight at `base × 0.70`.

### 3.3 Disagreement penalty

If any two sources disagree by more than 15%, flag the CMA for human review and reduce the lowest-confidence source's weight by 50% before finalizing. This is already partly handled by `lib/data/engines/disagreement.ts`; document the policy here so behavior is traceable.

### 3.4 Outlier protection (for ROAM comps)

When ROAM returns ≥ 5 comps, compute comp-level price-per-sqft. Trim comps more than 2 standard deviations from the median before averaging. Document the trim in the snapshot for drift detection.

---

## 4. "New Intelligence" Delta — What We Didn't Have Before Day 3

Before Day 3, the platform had:

- ROAM MLS login + session reuse
- Snapshot writer (`lib/cma/self-learning.ts`)
- Ensemble engine with hard-coded 4-source weights (Redfin placeholder for RPR)
- Multi-source fetcher (`lib/data/engines/multi-source-cma.ts`) that calls per-source API routes

What Day 3 unlocks:

1. **Agent-authoritative sold comps** — the ROAM comp-search pipeline turns the login session into actual sold comparable data. Until Day 3, the platform relied on API endpoints (`/api/data/paragon/sales`) that require populated Neon tables. The scraper is the *source of truth ingestion*.
2. **Agent remarks as a condition signal** — remarks like "needs TLC" or "as-is" are invisible to every other source. Routing them into the extraction pipeline is Day 3.5+.
3. **Photo count + agent-verified sqft** — cross-check against PropStream's tax-roll sqft to catch outliers.
4. **Source-weighted ensemble with Louisiana tuning** — the new `SOURCE_WEIGHTS` block in `adjuster-constants.ts` makes this tunable per market without editing `ensemble.ts`.
5. **Disagreement and outlier policies** documented here so the self-learning engine can enforce them.

---

## 5. How SOURCE_WEIGHTS Feeds the Engine

[`lib/cma/adjuster-constants.ts`](adjuster-constants.ts) will export a new `SOURCE_WEIGHTS` block. `ensemble.ts` continues to use its own `DEFAULT_WEIGHTS` for backward compatibility; callers that want the Louisiana-tuned set pass `SOURCE_WEIGHTS` as the second argument to `calculateEnsemble`. The recalibration job (`scripts/recalibrate-cma.ts`) rewrites the `SOURCE_WEIGHTS` block only — it never touches `ensemble.ts` logic.

---

## 6. Open Questions (for Day 3.5+)

1. Is the GBRAR Paragon CSV export reliable for bulk comp pulls, or must we screen-scrape the results grid?
2. RPR API key: do we apply for one directly, or route through the existing Paragon "RPR Homepage" deep link?
3. PropStream: screen-scrape (session-based) vs. reseller API (costs real money, needs procurement).
4. Zillow: official API requires partnership; unofficial endpoints are fragile. Is a once-daily polite scrape enough for the demand signals we need, or do we need realtime?
