# Paragon CMA Template — Column Checklist

**Goal:** Reconfigure your default saved-CMA grid in Paragon so every comp surfaces every field AIRE needs. One-time, ~30 min. Pays off forever — every existing CMA inherits when re-opened, every future CMA inherits at save.

---

## How to apply

1. ROAM dashboard → open Paragon
2. CMA tab → open any saved CMA (use `28274 lake bruin` for testing)
3. Right-click the column header row → **Customize Columns** (or gear icon)
4. Check every box below in order
5. Drag into the order shown
6. Click **Save as Default** (NOT just OK — that only applies to current view)

---

## Required (must-have for any valuation)

- [ ] MLS #
- [ ] Status (Active / Pending / Closed / Expired / Withdrawn)
- [ ] Address (Street #, Street Name, Unit)
- [ ] City
- [ ] Zip
- [ ] List Price
- [ ] Sold Price (Closed Price)
- [ ] Original List Price
- [ ] Price Per SqFt (Sold)
- [ ] Beds (Total Bedrooms)
- [ ] Full Baths
- [ ] Half Baths
- [ ] SqFt Living (Heated)
- [ ] SqFt Total (Under Roof)
- [ ] Year Built
- [ ] Days on Market (DOM)
- [ ] Cumulative Days on Market (CDOM)
- [ ] Closed Date
- [ ] Contract Date (Pending Date)
- [ ] List Date

## Investor-grade (lien, equity, motivation signals)

- [ ] Lot Size (Acres)
- [ ] Lot Size (SqFt)
- [ ] Subdivision / Neighborhood
- [ ] Property Sub-Type (Detached, Attached, Townhouse, Condo)
- [ ] Stories
- [ ] Garage Spaces
- [ ] Pool (Yes/No)
- [ ] Year Renovated / Year Updated
- [ ] Concessions to Buyer ($)
- [ ] Seller Concessions Description
- [ ] Number of Price Reductions
- [ ] Last Price Reduction Date
- [ ] Tax Assessed Value
- [ ] Annual Taxes
- [ ] HOA Fee + Frequency

## Strategist-grade (judgment + signal-mining)

- [ ] Agent Remarks (Public)
- [ ] Agent Remarks (Private / Showing Instructions)
- [ ] Listing Office Name
- [ ] Listing Agent Name
- [ ] Selling Office Name
- [ ] Selling Agent Name
- [ ] Flood Zone (X / A / AE / VE)
- [ ] School District
- [ ] Elementary School
- [ ] Middle School
- [ ] High School
- [ ] Photo Count
- [ ] Virtual Tour URL (Y/N indicator)
- [ ] Disclosure Documents Attached (Y/N)

## Optional but useful

- [ ] Parish (Louisiana-specific — should auto-populate)
- [ ] Construction Type (Brick, Vinyl, Hardie, etc.)
- [ ] Roof Material + Age
- [ ] HVAC Age
- [ ] Foundation Type (Slab / Crawl / Pier)
- [ ] Waterfront (Y/N + Body of Water)
- [ ] Showing Service Notes

---

## Recommended column order (left to right)

```
MLS# | Status | Address | City | Zip | Subdivision |
Beds | Full Baths | Half Baths | SqFt Living | Lot (Ac) | Year Built | Year Reno |
List Price | Original List | Sold Price | PPSF | Concessions |
DOM | CDOM | List Date | Contract Date | Closed Date | # Price Reductions |
Flood Zone | Pool | Garage | Stories | Property Sub-Type |
Listing Agent | Listing Office | Agent Remarks (Public) | Photo Count
```

---

## Verify after save

1. Close the CMA, log out of Paragon, log back in
2. Open `28274 lake bruin` again
3. Confirm columns persist (not session-only)
4. Tell me — I'll re-scrape and confirm scraper inherits the new columns

---

## Note for the scraper

Once columns are set, [mls.ts](mls.ts) `extractSavedCMAComps()` will inherit them automatically — the function reads `compTableHeader` from the live DOM and indexes by header label. No code change needed unless Paragon renames a column (unlikely).

If you can't find a checkbox above in Paragon's customize-columns dialog, screenshot the dialog and send it — I'll cross-reference what's actually available in your MLS instance (column inventory varies by board).
