# Caleb's Local Knowledge — Baton Rouge Real Estate

> **Purpose:** codify the judgment a 45-year Baton Rouge realtor uses that pure MLS data alone can't produce. This file is loaded by the `aire-mls-master-operator` skill. Every entry should inform a scoring adjustment, a comp-selection rule, or a confidence penalty in the CMA engine.
>
> **Source hierarchy:** Caleb's direct testimony > Larry Kendall methodology > published appraiser commentary > statistical inference.

---

## 1. Larry Kendall — Ninja Selling / Focus 1st methodology

Extracted from Caleb's own Focus 1st PDFs on 2026-04-13:
`Downloads/Misc/Focus1st_LarryKendall_Report.pdf`, `Focus1st_LarryKendall_Report_Enhanced.pdf`.

### Core principles (encoded as comp-selection rules)

1. **Focus-first comp rules — don't average 20 comps, defend 3–6.**
   - Hard filter: same school zone + ±10% sqft + ±10 years age + sold ≤180 days
   - If <3 survive hard filter: relax sqft to ±15%, then ±20%, document each relaxation
   - If still <3 after ±20%: output "no defensible comps" and halt — never fall back to weak data
   - Rank surviving 3–6 by composite similarity score, give each a 1-line "why this comp" justification

2. **Price under psychological thresholds for buyer urgency.**
   - Example (Caleb's Dunn Rd CMA): recommended $259,900–$264,900 instead of $265K–$270K
   - Rationale: listing under the $265K threshold captures buyer urgency + still supports appraisal
   - Implementation: when median PPSF × sqft produces a price within $5K of a round threshold ($200K, $250K, $300K, etc.), the AIRE "aggressive" price point should round DOWN under the threshold

3. **30-day sell probability target.**
   - Kendall's methodology targets "80%+ chance of selling within 30 days" when priced strategically
   - Probability derived from absorption rate + DOM distribution in the zip code
   - AIRE confidence score should penalize recommended prices where expected DOM > 30 days

4. **15-day price-refresh rule.**
   - If no offers received by day 15, Kendall recommends price repositioning
   - AIRE morning-brief should flag any active listing at day 15+ with zero offers for auto-recommendation of price adjustment

5. **Scattergram visualization is part of the advisory, not a side artifact.**
   - Plot: PPSF (y) vs SqFt (x), overlaid with sold / pending / active / expired as different markers
   - Subject's position on the scatter reveals positioning (aggressive / market / aspirational)
   - Expired listings above the trend line = confirmation that price ceiling exists
   - AIRE should produce this plot as part of any CMA output (PNG or SVG)

6. **Absorption-rate is the market-temperature primitive.**
   - Absorption = sold per month ÷ active listings in zip
   - <1.0 = buyer's market (soft) | 1.0–2.0 = balanced | >2.0 = seller's market (tight)
   - Kendall's "80% probability" language is implicitly absorption-conditioned

### Reference backtest case — 30787 Dunn Rd, Denham Springs

- **Subject:** 1,811 sqft, 3/2, 0.45 ac, built 2002
- **Prior sale:** $208,000 (2020)
- **Caleb's recommended list:** $259,900–$264,900
- **Caleb's projected appraisal:** $262,000–$265,000
- **Comps used (4):**
  - 9095 Willow Bend Dr — 1506 sqft, Sold $265,000 ($176/sqft)
  - 30696 Dunn Rd — 1630 sqft, Sold $255,000 ($156/sqft)
  - 1454 Cottonwood Dr — 1976 sqft, Sold $299,900 ($152/sqft)
  - 1508 Weeping Willow Dr — 1540 sqft, Pending $249,900 ($162/sqft)
- **Market stats:** Low $249,900 | Avg $267,450 | Median $265,000 | High $299,900
- **PPSF range:** $151 – $176 ($162 median)

This is a **confirmed Caleb baseline** for backtest validation. If AIRE's ensemble produces a recommended range of $259K–$265K for this subject with similar comps, the algorithm agrees with Caleb's 45-year judgment. If it diverges, either AIRE has new signal Caleb lacks, or AIRE is wrong — and we need to investigate which.

---

## 2. Baton Rouge Subdivision Equivalence (PENDING — needs Caleb input)

*To be filled during Section 6 of RECON_SCRIPT.md walkthrough.*

Structure:
```
| Subdivision A | Trades-as-substitute for | Notes |
| Old Goodwood  | Southdowns               | similar vintage, age-in-place demographic |
| Shenandoah    | (check Caleb)            | |
```

---

## 3. Zip-Code Instincts (PENDING — needs Caleb input)

*To be filled during Section 6 of RECON_SCRIPT.md.*

Template:
```
Zip 70808 — Zillow systematically OVER-prices (+5-8%) because:
  - flood zone A coverage post-2016 not reflected in Zestimate
  - older housing stock that Zillow weights by sqft without age discount
  - actual market: AIRE should cap Zestimate influence to 0 for this zip
```

---

## 4. Flood Zone Reality (Post-2016 Louisiana)

**Captured from Caleb's CMA practice (needs formal interview for precision):**

- Flood zone **AE** in Baton Rouge imposes a 5–12% price discount vs zone X on same-spec property
- Discount depends on **slab elevation** (not just zone designation) — need base flood elevation (BFE) vs finished floor elevation
- Pre-2016 homes in AE trade at a larger discount than post-2016 (post-flood rebuilds are elevated)
- **Insurance premium at closing** is the realized cost — flood policy quote should accompany any AE-zone CMA
- AIRE's flood-zone penalty (`ADJUSTMENTS.floodZonePenaltyWhenSubjectInAE` in `adjuster-constants.ts`) should be zip-specific — calibrate vs actual Baton Rouge sold data in backtest

---

## 5. Agent Remarks Vocabulary (PENDING — partial)

### Phrases signaling HIDDEN PROBLEM
- "Sold as-is" + "bring all offers" = significant issue, likely structural or water
- "Estate sale, sold as-is" = deferred maintenance expected
- "Cash only" = appraisal-sensitive (bad condition or title issue)
- "Agent related to seller" = reduce trust in condition remarks

### Phrases signaling MOTIVATED SELLER
- "Price reduced" + DOM > 30 = actively negotiable
- "Seller relocating" = urgency, often accepts 3-5% under list
- "Make offer" = seller above-comparable, will negotiate
- "Bring all offers" = see HIDDEN PROBLEM above — these overlap

### Marketing fluff to ignore
- "Must see" / "Won't last" / "Pride of ownership" / "Welcome home"
- "Spacious" / "Charming" / "Move-in ready" with no detail

### Strategic phrases
- "Deal Killer: None" / "No deal killer" = listing agent confirming no hidden issues (trust if repeated)
- "Survey available" / "Termite current" = lower friction transaction
- "New roof [year]" / "HVAC [year]" = legitimate value-add, verify with inspection

---

## 6. Appraiser Bias Map (PENDING — needs Caleb input)

Template:
```
| Appraiser              | Bias tendency | Lenders who order  | Notes |
| RHI (Shayne M Green)   | conservative  | FHA, VA            | seen on Pecan Island appraisal 3/10/2026 |
| [next]                 |               |                    | |
```

---

## 7. School-Zone Premium (Post-2024 redistricting)

**Pending Caleb-verified numbers. Preliminary baseline:**

| District | PPSF premium vs EBR base | Notes |
|---|---|---|
| Baton Rouge Magnet schools | +10-15% | high demand, low inventory |
| Central CSD | +5-8% | recovered post-2016 flood concern |
| Zachary CSD | +8-12% | consistent top performer |
| Livingston (Denham/Walker) | neutral to +3% | growing population |
| EBR (base) | 0 | baseline |
| East Iberville | -5 to -10% | |

*Verify all numbers in backtest — these are educated guesses until confirmed.*

---

## 8. DOM + Price-Cut Reads

### Pattern → Signal

| DOM | Price cuts | Read |
|---|---|---|
| 0–7 | 0 | Hot or underpriced — underwrite lower-than-expected PPSF |
| 7–30 | 0 | Market-rate, normal velocity |
| 30 | 1 small ($2-5K) | Agent testing the market, seller still optimistic |
| 30–60 | 0 | Overpriced, buyer hesitation — expect 3-5% negotiation room |
| 30–60 | 1–2 cuts totaling 3-5% | Seller engaging, motivated — offer at current list - 5% |
| 60–90 | 2+ cuts totaling 8%+ | Highly motivated, likely closing cost concessions |
| 90+ | Any | Stale, re-inspect listing — probably a hidden problem or marketing fail |

---

## 9. Concessions as Signal

- **$5K+ buyer concessions on closed comps** = market softening in that price band, adjust comp down by the concession amount when using as backtest ground truth
- **Seller-paid closing costs (3%)** = standard in BR entry-level ($150K-$220K), not unusual signal
- **Seller-paid rate buydown** = NEW signal post-2023, indicates price-firm seller protecting headline price while absorbing real cost
- **Appraisal contingency waiver** = cash or strong-income buyer, signals deal strength more than price

---

## 10. Louisiana Negotiation Norms

### East Baton Rouge / Ascension / Livingston (primary)

- **Inspection period:** 10–14 days standard, 7 days aggressive, 21 days slow
- **Due diligence period:** distinct from inspection; 14 days typical
- **Survey:** buyer pays, ~$500–$900 for residential
- **Title:** split 50/50 common; seller pays own, buyer pays own — check LREC form used
- **Appraisal contingency:** standard, waive signals strength
- **Financing contingency:** FHA/VA ~30 days, conventional ~21 days

### Specific to Louisiana

- **Community property state** — both spouses must sign sale even if one holds title
- **Homestead exemption** — only on primary residence, check before valuation (affects assessed value reported)
- **LREC required disclosure forms** — Property Disclosure is mandatory for residential resale; New construction uses alternate form

---

## 11. MLS-Photo Tells (PENDING — needs Caleb walkthrough)

Structure Caleb's eye for:
- Foundation cracks / ground settling indicators
- Roof age visible in aerial shots
- Neighbor's yard condition (HOA red flag)
- "Empty photos" vs "staged photos" — empty often = motivated
- Missing rooms (skipped bedrooms/bathrooms = they hid something)
- Poor exterior angles = hiding a side of the property
- Grainy / cell-phone photos = low-budget listing, often distressed

---

## Load order / usage

This file is referenced — not duplicated — by:
- `C:/Users/cjjfr/.claude/skills/aire-mls-master-operator/SKILL.md` (adds `## Caleb's local judgment` module)
- `lib/cma/engines/ensemble.ts` (pending — will pull zip-specific weight overrides from section 3 when populated)
- `lib/agents/morning-brief/researchers/market-researcher.ts` (pending — will use section 8 DOM reads for listing alerts)

**Every empty section is an interview prompt.** Filling sections 2-7 + 11 requires a ~60-min conversation with Caleb (see [RECON_SCRIPT.md](scrapers/RECON_SCRIPT.md) Section 6).

---

## Change log

- 2026-04-13 — initial creation. Larry Kendall methodology captured from Focus 1st PDFs. Dunn Rd baseline established. Sections 2-7 + 11 marked PENDING for interview.
