# Day 3 — ROAM Comp Search Bring-Up Notes

**Account:** B24140 (sole access — never lock)
**Subject:** 5834 Guice Dr, Baton Rouge LA
**Pass criteria:** ≥ 5 comps within 1.5mi, sold within 180 days, parsed into RawComp shape
**Ground truth:** sold Q1 2026, $160,000, 3 DOM

---

## Day 3 Result: **FAIL (partial progress)**

Reached `stepReached=search_tab` before running out of selector restart budget.
The full comp search and results parse are queued for Day 3.5 — walkthrough
needed from Caleb on the exact Paragon Search → Sold Status → Date Range →
Polygon path.

No captcha. No lockout. Account safe. Session reuse working (7-day TTL).

---

## What PASSED on Day 3

1. **Session reuse:** loginPath = `reused`, no login page visited. storageState
   from Day 2 (`lib/cma/scrapers/sessions/mls_paragon.json`) carries through
   to the ROAM dashboard at `https://roam.clareity.net/layouts`.
2. **Dashboard modal dismissal:** `button:has-text("Close")` works reliably
   on the "Coming Soon Listings Expanding to IDX Websites" modal.
3. **Paragon tile → popup:** clicking ~50px above the "Paragon" favorites
   label opens the Paragon MLS popup at
   `https://mlsbox.paragonrels.com/ParagonLS/Default.mvc`. Tracked via
   `context.waitForEvent("page")` with a 15s budget.
4. **User Preferences Wizard dismissal:** `button:has-text("Close")` inside
   the popup closes the first-run wizard.
5. **SEARCH tab click:** the nav-bar "SEARCH" label (uppercase, no `<a>`, no
   `[role=tab]`) is clickable via `text=/^SEARCH$/` with a mouse click at
   icon-position (~15px above the label text). Paragon binds onclick to
   the icon `<img>`, not the label span.

---

## Observed Paragon UI Structure

### ROAM dashboard (`roam.clareity.net/layouts`)
- **Nav:** Angular Material shell. "Home" anchor, bell/notification buttons, "CJ" profile avatar.
- **Modal:** `button:has-text("Close")` dismisses the "Coming Soon Listings" announcement.
- **Favorites tiles:** `<div>` containers with icon + text label below. Text label for the Paragon tile is exactly `"Paragon"`. Clicking the label itself does nothing — Angular's `(click)` is bound to the icon `<img>` ~50px above the label's top edge.
- **Popup trigger:** clicking the tile opens a new browser tab (tracked via `browserContext.waitForEvent("page")`).

### Paragon app popup (`mlsbox.paragonrels.com/ParagonLS/Default.mvc`)
- Classic ASP.NET MVC — nested panels, no `<a>`/`[role=tab]` for the top nav, text labels are UPPERCASE.
- **Top nav tabs (observed):** HOME | SEARCH | LISTINGS | CMA | CONTACTS | FINANCIALS | TAX | ROSTER | RESOURCES | PREFERENCES CONNECT
- **SEARCH nav behavior:** opens an **address autocomplete overlay** (orange banner at top: "PARAGON SEARCH | Please enter 3 or more characters"), NOT a full search builder. This is a quick-lookup widget for a specific property.
- **Left sidebar (QUICK SEARCH panel):** property type dropdown (e.g., "RE1 RES"), status dropdown ("Equals" + value), MLS# field, Address Number field with "Single" / "Contains" dropdowns, "Dir Pre" field, "On / Street Name", map-search link ("Click to add map search…"), "Load Saved Quick Search" button.
- **Footer quick links:** "Hotsheet", "Saved Property Searches"
- **Session:** "Session Time Remaining: 2:58:31" counter in footer (3-hour idle timeout)

### Wizards / overlays
- **User Preferences Wizard:** first-run modal, dismissed via `button:has-text("Close")` in the header.
- **"Don't show this wizard again":** checkbox labeled `Do not show this wizard again the next time I login`. Setting it would remove the wizard on subsequent runs — recommend adding in Day 3.5.

---

## Selector Paths That Worked

```
// Dashboard → Paragon popup
page.getByText("Paragon", { exact: true }).first().boundingBox()
  → click at (box.x + box.width/2, box.y - 50)
context.waitForEvent("page", { timeout: 15000 })

// Modal dismiss (both dashboard and Paragon wizard)
button:has-text("Close")

// SEARCH tab (uppercase)
text=/^SEARCH$/
  → mouse.click(box.x + box.width/2, box.y - 15)   // click icon above label
```

## Selector Paths That Did NOT Work

```
a:has-text("Search")                  // nav tabs are not anchors
[role="tab"]:has-text("Search")        // no ARIA roles on legacy nav
text="Search"                          // case-sensitive; labels are uppercase
label.click()                          // Angular (click) binds to icon, not label
```

---

## Observed Data Fields on Homepage (before search)

None — the homepage shows "LATEST" news cards (ROAM announcements), a Message
Center, a Paragon Info panel, and a Listing Monitor widget. No property data
is rendered before a search is executed.

## Result Grid / Field Map — NOT YET OBSERVED

`parseCompResults()` in `lib/cma/scrapers/mls.ts` has two DOM strategies
queued (`<table><tbody><tr>` and `[role=grid]`) but no grid was rendered in
Day 3's run because the full search form was never submitted.

Day 3.5 work: submit a Sold search with date range 2025-10-13 to 2026-04-13
and radius 1.5mi around 5834 Guice Dr; screenshot the results grid;
document the exact column headers and DOM shape; then refine `parseCompResults`.

---

## Screenshots (key frames from the Day 3 run)

1. `lib/cma/scrapers/debug/mls_paragon_2026-04-13T17-21-10-936Z_day3_01_dashboard.png` — ROAM dashboard with modal.
2. `lib/cma/scrapers/debug/mls_paragon_2026-04-13T17-21-20-993Z_day3_02_popup_opened.png` — Paragon app popup with User Preferences Wizard open.
3. `lib/cma/scrapers/debug/mls_paragon_2026-04-13T17-21-23-698Z_day3_03_post_wizard.png` — Paragon homepage clear of wizard.
4. `lib/cma/scrapers/debug/mls_paragon_2026-04-13T17-21-26-827Z_day3_04_search_tab.png` — address autocomplete overlay after SEARCH click.
5. Recon screenshots in `lib/cma/scrapers/debug/recon_day3/` — full popup DOM map (preserved for reference).

---

## Day 3.5 Handoff — What Caleb Needs to Show

To finish the comp search, a 60-second walkthrough from Caleb of the exact path he takes in Paragon to get a Sold-within-180-days-within-1.5mi comp set. Specifically:

1. Does he use the **CMA** tab (full CMA builder), the **SEARCH** tab (advanced search with polygon), or **Saved Property Searches** with a pre-built template?
2. Where is the status filter set to "Sold" / "Closed"?
3. Is the radius set by drawing a polygon, entering a radius in miles, or picking a subdivision?
4. Are results shown in a grid, a list, or a map?
5. Is there a CSV/Excel export button we can use instead of DOM scraping?

A one-shot screen recording of that flow (even a phone video pointed at the screen) would let Day 3.5 ship the parser with zero selector thrashing.

---

## Halt Posture

Selector restart budget for Day 3 consumed (1 restart, commit `853b886`).
Second failure at `step=search_tab` → stop per rules. No further scraper
runs until Caleb's walkthrough or explicit re-authorization. Account B24140
remains safe, session persists with 7-day TTL, dashboards + popup navigation
are reliable.

## Commits

- `42539a1` — Day 3 scaffold: paragonCompSearch, SOURCE_INTELLIGENCE.md, Day 3 smoke script
- `853b886` — SEARCH tab selector fix (frame-aware, icon-click)
