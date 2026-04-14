# Paragon Recon Script — Screen-Share Walkthrough

**Goal:** Capture every Paragon feature, filter, and workflow Caleb actually uses, so the scraper + skill replicate his thinking — not just his clicks.

**Format:** Caleb shares Paragon screen. Reads each question. Answers verbally OR clicks through. I take notes. Output goes into [SOURCE_INTELLIGENCE.md](SOURCE_INTELLIGENCE.md) + a new `LOCAL_KNOWLEDGE.md` in the MLS skill.

**Time:** ~45 min if Caleb stays focused. Don't go down rabbit holes — capture and move on.

---

## Section 1 — Tab landscape (5 min)

> Capture which top-nav tabs Caleb actually uses vs ignores.

1. Paragon top nav has tabs: SEARCH, CMA, CONTACTS, FINANCIAL, RESOURCES, MARKET MONITOR, ADMIN, ?HELP. **Which do you use weekly? Which monthly? Which never?**
2. Open the **SEARCH** tab dropdown — show every menu item. Which do you click? Which are dead weight?
3. Same exercise for **CMA** dropdown.
4. Where do **Hot Sheets** live? (Sub-menu of SEARCH? Standalone?) Is yours configured? If yes, what's it set to alert on?
5. Where is **Market Monitor** — top nav, sidebar widget, or both? Show what it displays for your area.

---

## Section 2 — How you actually pull comps (10 min)

> Capture the real comp-pull workflow. NOT what Paragon documentation says — what Caleb does.

6. Pretend a seller calls you about **5834 Guice Dr**. Walk me through your first 60 seconds in Paragon. Do you:
   - Open SEARCH and run a fresh query? OR
   - Open CMA tab and start a new CMA wizard? OR
   - Look at saved searches first?
7. When you set up the search, **what radius** do you use as default? Polygon, miles, or subdivision picker?
8. **What sold-date window** do you use as default? 30/60/90/180 days?
9. Do you filter by **status** at search time, or pull all and filter visually in the grid?
10. **Sqft tolerance** — do you use ±%, ± absolute sqft, or eyeball it in results?
11. What's your **first sort** when results load? PPSF, sold date, distance, sqft?
12. **Map view vs grid view** — when do you switch to map, and what do you spot in map view that grid can't show?

---

## Section 3 — Filters that matter (10 min)

> Caleb names every filter he uses. I note which ones the scraper currently respects.

13. Open the **Advanced Search** dialog. Walk down every filter section. For each filter, say one of:
    - **"Always set"** + the value you set
    - **"Sometimes set"** + when
    - **"Never touch"**
14. Specifically call out:
    - Style (Acadian, Ranch, Traditional, etc.) — do you filter by it?
    - Year Built bands — what's your default band?
    - Lot size — when does it matter?
    - Pool — does pool premium hold in BR?
    - Flood Zone — do you filter A/AE out by default?
    - School zone — when do you set this?
    - Subdivision — exact match, contains, or polygon-equivalent?
    - Concessions — do you filter or just inspect?
15. Are there any **custom search templates** you've saved? Show them.

---

## Section 4 — Hidden features (5 min)

> The features 90% of agents never use. These are AIRE's edge.

16. **Reverse Prospecting** — show me where it lives. Have you used it? When? What did it tell you?
17. **Open House Search** — separate tab? Useful?
18. **Showings tracker** (if Paragon has it for your board) — does it show how many showings a listing got before pending?
19. **Listing Activity** (page views, saves, contacts) — accessible per listing? What does it look like?
20. **Comparables Search** (separate tool from CMA) — when do you use this vs the CMA wizard?
21. **Market Stats / Market Trends report** — pre-built reports for an area. Show one. What's useful, what's noise?
22. **Saved searches with email alerts** — do you have any active? What triggers them?

---

## Section 5 — Output formats + export (5 min)

23. From a comp-search result grid: where's the **Export** button? CSV, Excel, PDF?
24. Do you ever **export to a client-facing PDF report** out of Paragon directly, or do you redo it in your own template?
25. **Print preview** for a CMA — show one. Is the layout usable, or do you always export and rebuild?
26. **Email a comp set** to a client from inside Paragon — feature exists?

---

## Section 6 — Local-knowledge mining (10 min)

> The 45-year-realtor questions. Verbal answers — I record them in `LOCAL_KNOWLEDGE.md`.

27. **Subdivision equivalence:** Name 5 pairs of Baton Rouge subdivisions that trade as substitutes (e.g., "Old Goodwood comps work in Southdowns"). And name 3 pairs that look adjacent on a map but don't trade alike.
28. **Zip-code instincts:** Where does Zillow systematically over-price? Under-price? Why?
29. **Flood zone reality, post-2016:** What does AE actually cost in dollars or % discount in BR right now? Does it depend on slab elevation? Year-built?
30. **Agent remarks vocabulary:**
    - Phrases that mean **hidden problem** ("bring all offers", "sold as-is", "estate sale, sold as-is")
    - Phrases that mean **motivated seller** ("price reduced", "seller relocating", "make offer")
    - Phrases that are **pure marketing fluff** to ignore
31. **Local appraiser bias:** Which appraisal companies are conservative? Aggressive? Do certain lenders use certain AMCs?
32. **School zone premium, post-2024 redistricting:** What's the actual $ premium per district right now? Has Central pulled away from EBR? Is Zachary still the top?
33. **DOM + price-cut combo reads:**
    - "DOM 7, no cuts" = ?
    - "DOM 30, one $5K cut" = ?
    - "DOM 60, two cuts totaling 8%" = ?
    - "DOM 90, no cuts" = ?
34. **Investor signals you trust:** Tax-assessed-to-list ratio? Equity %? Lien stack patterns? What threshold makes you call the owner?
35. **MLS photo tells:** What do you spot in a listing's photos that the data doesn't show? (Foundation cracks, neighbor's yard, roof age, "they staged because the floor plan is bad", empty house = motivated, etc.)
36. **Concessions reads:** When you see $5K seller concessions on a sold comp, what does that tell you about (a) the seller, (b) the agent, (c) the actual market value?
37. **Negotiation history:** What's the BR norm for inspection-period asks? Survey paid by? Appraisal contingency standard?

---

## Section 7 — Anything I haven't asked (5 min)

38. What does Paragon do that you wish it didn't?
39. What do you wish Paragon did that it doesn't?
40. What do you do **outside Paragon** to fill the gaps? (RPR, parish assessor, Zillow, calling other agents, driving by?)
41. If AIRE could replace ONE manual Paragon step in your workflow tomorrow, which one?

---

## Output

After this walkthrough I write three artifacts:

| File | Content |
|---|---|
| [SOURCE_INTELLIGENCE.md](SOURCE_INTELLIGENCE.md) (update) | Paragon feature inventory, filter defaults, export paths |
| `lib/cma/LOCAL_KNOWLEDGE.md` (new) | Caleb's tribal knowledge — subdivisions, appraisers, agent-remark vocab, photo-tells |
| `aire-mls-master-operator/SKILL.md` (update) | Add `## Caleb's local judgment` module — loaded automatically when MLS skill fires |

Then Day 5 code work begins on a clean foundation.
