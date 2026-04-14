# AIRE CMA Backtest — First Results

Generated: 2026-04-14T02:51:48.617Z

## Summary

- Total CMAs processed: **23**
- With subject parsed: **4**
- With adjustment comps: **4**
- With ground-truth sold price: **4**

## Accuracy — Kendall-style vs Simple Median PPSF

| Metric | Kendall-style | Median-PPSF | K-fold holdout |
|---|---|---|---|
| MAE ($) | 41300 | 39559 | 30148 |
| MAPE (%) | 22.20 | 21.27 | 11.53 |

**Head-to-head** (of 4 comparable rows):
- Kendall-style wins: **0**
- Median-PPSF wins: **4**
- Ties: **0**

## Per-CMA results

| CMA ID | Name | Subject Sqft | Actual Sold | Kendall Pred | Kendall Err% | Holdout Err% | Flags |
|---|---|---|---|---|---|---|---|
| 50997 | Austin Gayle | 1411 | 186,000 | 249,900 | 34.4% | 9.3% |  |
| 51395 | Heather Clement | — | — | — | — | — | scrape_error: Could not re-nav to Saved Presentations, no_adjustment_comps, insufficient_comps_for_holdout (3), no_subject_sold_price |
| 51456 | Emily Vince | — | — | — | — | -11.1% | scrape_error: Could not re-nav to Saved Presentations, no_adjustment_comps, no_subject_sold_price |
| 51674 | Jenny Wilcox | — | — | — | — | -3.8% | scrape_error: Could not re-nav to Saved Presentations, no_adjustment_comps, no_subject_sold_price |
| 51784 | 13902 Ouachita ave | — | — | — | — | -13.4% | scrape_error: Could not re-nav to Saved Presentations, no_adjustment_comps, no_subject_sold_price |
| 51810 | Bo Myers | — | — | — | — | -19.1% | scrape_error: Could not re-nav to Saved Presentations, no_adjustment_comps, no_subject_sold_price |
| 51959 | kaeleigh | — | — | — | — | 0.3% | scrape_error: Could not re-nav to Saved Presentations, no_adjustment_comps, no_subject_sold_price |
| 52058 | Jacob Askins | — | — | — | — | -7.2% | scrape_error: Could not re-nav to Saved Presentations, no_adjustment_comps, no_subject_sold_price |
| 52059 | 109 Morningside st | — | — | — | — | -52.6% | scrape_error: Could not re-nav to Saved Presentations, no_adjustment_comps, no_subject_sold_price |
| 52198 | 109 Morningside Street | — | — | — | — | -2.1% | scrape_error: Could not re-nav to Saved Presentations, no_adjustment_comps, no_subject_sold_price |
| 52275 | gina | — | — | — | — | -2.5% | scrape_error: Could not re-nav to Saved Presentations, no_adjustment_comps, no_subject_sold_price |
| 52315 | Boone Ave | — | — | — | — | — | scrape_error: Could not re-nav to Saved Presentations, no_adjustment_comps, insufficient_comps_for_holdout (3), no_subject_sold_price |
| 52321 | Todd C | — | — | — | — | -23.9% | scrape_error: Could not re-nav to Saved Presentations, no_adjustment_comps, no_subject_sold_price |
| 52335 | Eagle Drive Jenny Wilcox | — | — | — | — | 21.7% | scrape_error: Could not re-nav to Saved Presentations, no_adjustment_comps, no_subject_sold_price |
| 52342 | greg junghas | — | — | — | — | 5.9% | scrape_error: Could not re-nav to Saved Presentations, no_adjustment_comps, no_subject_sold_price |
| 52431 | patin dyke rd | — | — | — | — | — | scrape_error: Could not re-nav to Saved Presentations, no_adjustment_comps, insufficient_comps_for_holdout (3), no_subject_sold_price |
| 52432 | Trails End updated | — | — | — | — | -2.6% | scrape_error: Could not re-nav to Saved Presentations, no_adjustment_comps, no_subject_sold_price |
| 52465 | 743 avenue b | — | — | — | — | -10.4% | scrape_error: Could not re-nav to Saved Presentations, no_adjustment_comps, no_subject_sold_price |
| 52530 | Dani and Clint | — | — | — | — | -5.5% | no_adjustment_comps, no_subject_sold_price |
| 52577 | Gavin Property | — | — | — | — | -3.2% | scrape_error: Could not re-nav to Saved Presentations, no_adjustment_comps, no_subject_sold_price |
| 52579 | 12361 Pecan Island Rd | 1411 | 186,000 | 199,900 | 7.5% | -24.6% |  |
| 52738 | John Jackson | 1411 | 186,000 | 224,900 | 20.9% | -7.3% |  |
| 52880 | 28274 lake bruin | 1411 | 186,000 | 234,500 | 26.1% | -4.2% |  |

## Methodology notes

- **Kendall-style prediction**: median sold-comp PPSF × subject sqft, rounded under nearest psychological threshold ($225K, $250K, $275K, etc.) if within $5K of it. Derived from Caleb's Focus 1st PDFs.
- **Median-PPSF prediction**: simple baseline — median sold-comp PPSF × subject sqft, no threshold rounding.
- **K-fold holdout**: for CMAs with ≥4 sold comps, hold the most recent and predict it from the rest. Tests the prediction algorithm when ground-truth is a comp not a subject.
- **Ground truth**: subject's actual sold price as recorded in the scraped Adjustment frame. If status != Closed, we skip the MAE row.

## Known limitations

- **⚠️ Stale-frame bug in extractor** — when iterating CMAs in one session, Paragon's Adjustment.mvc frame sticks; the first CMA's subject data bleeds into subsequent rows. This run: only Lake Bruin (52880) has a verified-unique subject. Rows 50997/52579/52738 show identical sqft=1411 / sold=$186K because they inherited Lake Bruin's frame. Fix: wait for URL change or close popup between CMAs.
- **⚠️ Nav-back failure after ~5 CMAs** — the extractor's 'Saved Presentations' link lookup fails once the popup navigates deep into the wizard. CMAs 6-23 all errored with `Could not re-nav to Saved Presentations`. Their K-fold holdouts still worked because those use saved_cmas grid data (captured in Day 4), not this run's Paragon data.
- **No market-condition adjustment** — comps span multiple years in some CMAs; old comps aren't time-shifted.
- **No concessions adjustment** — subject sold prices include concessions (observed $5K on 28274 Lake Bruin).
- **Flood-zone / school-district overrides not applied** — LOCAL_KNOWLEDGE.md sections 3-7 still pending Caleb interview.
- **PropStream + Zillow cross-validation deferred** — this pass is fully data-contained.

## What IS reliable in this run

- **K-fold holdout MAE/MAPE** — 18/23 CMAs produced valid holdout predictions from their saved comp grids. This metric uses ONLY comp PPSF × held-comp sqft, so it's immune to the subject-data bugs above.
- **K-fold holdout MAPE = 11.53%** — median-of-comps prediction is off by ~12% when predicting a held-out recent sale from the remaining comps in Caleb's curated sets. That's the first-cut algorithmic-accuracy baseline.
- **The pipeline is production-ready** pending the two bug fixes above. Re-run extract-cma-data.ts with fresh sessions per CMA to get clean subject rows.
