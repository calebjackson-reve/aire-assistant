# A10 — Intelligence + Data Health cluster baseline (2026-04-14)

Routes: `/aire/intelligence` (B), `/aire/data-health` (**D — worst in blueprint**).

## Current state
Both auth-gated. Data Health grep shows `bg-zinc-950`, `text-zinc-*` everywhere — a grayscale design existing outside brand palette.

## A-grade criteria (from brief)
- Intelligence: Playfair → Cormorant sweep; market pulse as 5 mono-stat sparkline cards; inline CMA (paste address → full CMA <5s); deal alert rail; zip heatmap.
- Data Health: nuke zinc; rebuild in Nocturne (Deep Forest / Linen / sage-olive); stat cards per table with freshness, live ingestion sparkline, anomaly alerts.
- IBM Plex Mono all numerics; heatmap cells sage alpha 10→90%.

## Violations observed
- `app/aire/intelligence/page.tsx:45` — `fontFamily: "'Playfair Display', Georgia, serif"` + `color: "#1e2416"` (F3 Playfair + F2 hard-coded color).
- `app/aire/intelligence/MarketSnapshotPanel.tsx:53` — same Playfair + #1e2416 pattern.
- `app/aire/intelligence/page.tsx` — contains `bg-white` (count grep).
- `app/aire/intelligence/ScoredPropertiesTable.tsx` — `transition-all` + gray/zinc tokens.
- `app/aire/data-health/page.tsx:14` — `bg-zinc-950 text-white` (full grayscale canvas).
- `app/aire/data-health/DataHealthDashboard.tsx:66,78,84,99,100,106,107,108,119,120,123,124,126,142,146` — 15+ `text-zinc-*` / `bg-zinc-*` / `text-green-400` / `text-yellow-400` classes. Entirely off-palette.
- No `CmaInline.tsx`, `DealAlertRail.tsx`, `ZipHeatmap.tsx`.

## Surprises
- Data Health page was built as a one-off admin tool with a totally different design system. Looks like an unrelated app.

## Severity
Critical. Data Health is the worst-rated surface in the entire blueprint (D). Intelligence has the highest Playfair/hard-hex hit rate (F3 epicenter).
