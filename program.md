# AIRE Intelligence Optimization Program

**Research Type:** Skill Optimization  
**Session Started:** 2026-04-04  
**Iteration:** 0 (baseline)  
**Mode:** Autonomous overnight research

═══════════════════════════════════════════════════════════════════════════════

## 🎯 RESEARCH OBJECTIVE

Improve the AIRE Intelligence Agent's CMA (Comparative Market Analysis) accuracy for Baton Rouge residential properties from 6.8% MAPE to <5% MAPE.

═══════════════════════════════════════════════════════════════════════════════

## 📊 SUCCESS METRIC

**Primary Metric:** MAPE (Mean Absolute Percentage Error)  
**Current Baseline:** 6.8%  
**Target:** <5.0%  
**Secondary Constraint:** Generation time must stay <10 seconds

**How MAPE is calculated:**
```
MAPE = (1/n) × Σ|actual_price - predicted_price| / actual_price × 100
```

Lower is better. 5% MAPE means predictions are within 5% of actual sale prices on average.

═══════════════════════════════════════════════════════════════════════════════

## 🔬 RESEARCH BUDGET

**Session Constraints:**
- Max 10 iterations per overnight session
- Each iteration tests on full 50-property dataset
- Max 30 seconds compute time per iteration
- Total session time: ~5-10 minutes

**Stop Conditions:**
- Target achieved (MAPE <5%)
- 10 iterations complete
- 3 consecutive iterations with no improvement
- Generation time exceeds 10 seconds

═══════════════════════════════════════════════════════════════════════════════

## 📁 TEST DATASET

**Location:** `/tests/fixtures/closed-sales-march-2026.json`

**Properties:** 50 verified closed sales from March 2026  
**Geographic Coverage:** Baton Rouge metro (East Baton Rouge, Zachary, Baker)  
**Price Range:** $180K - $650K  
**Property Types:** Single family residential  

**Data Fields:**
- Actual sale price (ground truth)
- Sale date
- Property address
- Square footage
- Beds / baths
- Year built
- Lot size
- Flood zone
- Parish
- School district

═══════════════════════════════════════════════════════════════════════════════

## 🧪 VARIABLES TO OPTIMIZE

**Priority 1: Comparable Selection Weights** (try these first)
- `distance_weight` (current: 0.45)
- `sqft_similarity_weight` (current: 0.30)
- `age_similarity_weight` (current: 0.20)

**Priority 2: Louisiana-Specific Adjustment Factors**
- `flood_zone_adjustment` (current: -5% if in flood zone)
- `parish_tax_rate_impact` (current: not considered)
- `school_district_premium` (current: not considered)

**Priority 3: Market Velocity Factors**
- `days_on_market_velocity` (current: not considered)
- `listing_to_sale_ratio` (current: not considered)
- `seasonal_adjustment` (current: not considered)

**Priority 4: Comp Pool Parameters**
- `num_comps` (current: 6)
- `distance_radius_miles` (current: 3)
- `age_cutoff_years` (current: 1)

═══════════════════════════════════════════════════════════════════════════════

## 🔄 RESEARCH STRATEGY

**Iteration Sequence (recommended order):**

1. **Baseline** — Run test with current parameters (establish 6.8% baseline)

2. **Flood Zone Refinement** — Louisiana-specific high impact
   - Try: -3%, -7%, -10% adjustments
   - Flood zone is critical in BR market

3. **Parish Tax Integration** — New variable
   - Calculate effective tax rate per parish
   - Apply as percentage adjustment to value
   - EBR: 0.72%, Zachary: 0.68%

4. **School District Premium** — High-value factor
   - Parkview: +8%
   - Zachary: +12%
   - Central: +6%

5. **Distance Weight Refinement** — Fine-tune existing
   - Try: 0.40, 0.50, 0.55
   - Balance with other weights

6. **Days on Market Velocity** — Market temperature
   - Fast market (<30 DOM): +2%
   - Slow market (>90 DOM): -3%

7. **Comp Pool Expansion** — If accuracy still not at target
   - Try: 8 comps, 10 comps
   - Try: 5 mile radius

8. **Age Similarity Weight** — Fine-tune
   - Try: 0.15, 0.25

9. **Combined Optimization** — Best performers from above
   - Combine top 3 improvements
   - Test interaction effects

10. **Final Validation** — Run best config on full dataset

═══════════════════════════════════════════════════════════════════════════════

## 📋 ITERATION PROTOCOL

**For Each Iteration:**

1. **Modify Code**
   - Edit `/lib/intelligence/cma-engine.ts`
   - Change ONE variable (or planned combination)
   - Document change in iteration log below

2. **Run Test**
   - Execute: `npm run test:intelligence`
   - Capture MAPE output
   - Capture average generation time

3. **Evaluate**
   - Compare to previous best MAPE
   - Verify generation time <10s
   - Check for any edge case failures

4. **Decision**
   - If MAPE improved AND time <10s → **KEEP** change
   - If MAPE same or worse → **REVERT** change
   - If time >10s → **REVERT** even if MAPE improved

5. **Log Result**
   - Append to iteration log below
   - Update SKILLSPEC.md with new best
   - Commit to git if keeping change

═══════════════════════════════════════════════════════════════════════════════

## 📝 ITERATION LOG

**Format:**
```
Iteration N | YYYY-MM-DD HH:MM:SS
Variable Changed: [name] [old_value] → [new_value]
MAPE: X.X% (Δ±X.X% vs previous best)
Avg Time: X.Xs
Decision: KEEP | REVERT
Reasoning: [why]
```

---

### Iteration 0 (Baseline)
**Date:** 2026-04-04 00:00:00  
**Variable Changed:** None (baseline measurement)  
**MAPE:** 6.8%  
**Avg Time:** 8.2s  
**Decision:** BASELINE  
**Reasoning:** Establishing starting point

---

### Iteration 1
**Date:** [Agent will populate]  
**Variable Changed:** [Agent will populate]  
**MAPE:** [Agent will populate]  
**Avg Time:** [Agent will populate]  
**Decision:** [Agent will populate]  
**Reasoning:** [Agent will populate]

---

[Agent appends additional iterations here]

═══════════════════════════════════════════════════════════════════════════════

## 🎓 AGENT INSTRUCTIONS

**READ THIS ENTIRE FILE before starting research.**

**Your Mission:**
1. Run Iteration 1 using the recommended strategy above
2. Test the result
3. Keep or revert based on evaluation criteria
4. Log the result to this file
5. Update SKILLSPEC.md with new best MAPE
6. Repeat for Iterations 2-10
7. Stop when target achieved or 10 iterations complete

**Rules:**
- NEVER skip logging an iteration
- ALWAYS test before committing a change
- ALWAYS revert if generation time >10s
- ALWAYS update SKILLSPEC.md when MAPE improves
- NEVER modify more than ONE variable per iteration (except planned combinations)

**When Complete:**
- Update SKILLSPEC.md with final best MAPE
- Create summary in `.claude/memory/iteration-summary.json`
- Propose next research direction

═══════════════════════════════════════════════════════════════════════════════

**END OF program.md**
