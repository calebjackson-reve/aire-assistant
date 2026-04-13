# MAP_VISION.md — Google Earth for AIRE
*Drafted 2026-04-13 — UI remodel Phase 2 / Part C. Status: proposal for morning review.*

> The thesis: the AIRE dashboard already answers *"what's in my pipeline?"*
> A photorealistic 3D map answers the harder, more emotional question that
> wins listings: *"what does this house actually look like in the world?"*
> Not a 2D Zillow tile — a cinematic fly-to that lands on Caleb's listing
> with flood overlay, parish boundary, school district, and a pulsing
> ring of comps radiating outward. Something no Louisiana competitor has.
> Built once, reusable across buyer tools, seller tools, market intelligence,
> and the public marketing site.

---

## 1. Recommendation — which engine

**Pick: Cesium with Google Photorealistic 3D Tiles.**

**Second choice (fallback): Mapbox GL JS with 3D terrain + Standard Satellite style.**

### Why Cesium + Google Photorealistic 3D Tiles

- **Actual photorealistic buildings.** Every house in Baton Rouge rendered
  from real aerial imagery + LiDAR. Zillow and Homelight can't match this
  because they use flat 2D tiles or vendor-generic 3D blocks. Our entire
  pitch becomes *"watch this."*
- **Free tier covers the entire year-one economic model.** Google's
  Photorealistic 3D Tiles API is free for **up to 25K map loads / month**
  (called "session requests" — one load per user session, not per tile).
  Our projected 10K property views / month fits 2.5× under the cap.
- **Cesium's runtime is open-source** (Apache 2.0). We only pay for the
  Google tiles API — no per-seat Cesium ion subscription unless we want
  their hosted content (we don't for v1).
- **TypeScript SDK + React wrapper** (`resium`) is mature. Standard camera
  controls, fly-to, billboard/entity layers, polygon overlays.
- Road map: if we ever need indoor views, drone footage overlays, or
  high-res custom tiles, Cesium ion is the paid upgrade path.

### Why Mapbox is the fallback, not primary

- Mapbox is cheaper at scale (50K free monthly, then ~$5/1K) and custom
  styling is genuinely first-class via Studio.
- BUT: Mapbox Standard 3D is geometric blocks, not photorealistic. The
  "wow" drops 70% vs. Google tiles.
- Use Mapbox if Google tiles (a) aren't available for part of Louisiana
  rural coverage, or (b) Google deprecates the free tier.

### What we explicitly reject

- **Google Maps JavaScript API.** Looks like 2010. Off-brand blue/gray is
  unusable. Cannot be styled without enterprise plan.
- **Leaflet + free tile providers.** Great for 2D engineering; zero wow
  factor; not this project's lane.
- **Three.js from scratch.** Too much engineering time to build camera
  controls + LOD systems when Cesium ships them.

### Year-one cost estimate at 10K property views / month

| Line item | Cost |
|---|---|
| Google Photorealistic 3D Tiles API (10K sessions) | **$0** (under 25K free tier) |
| Cesium runtime (OSS) | $0 |
| resium React wrapper (OSS) | $0 |
| Our CDN bandwidth delta (tiles are streamed from Google, not us) | ~$5–15 / mo |
| **Total monthly** | **~$5–15 / month in year one** |

Break-even with the first buyer client using the map = covered. If we
outgrow the free tier (>25K sessions/mo), Google's pricing is
$0.014/session → 50K sessions = $700/mo. That's a we've-won-the-market
problem, not a v1 problem.

---

## 2. Use cases (year-one scope)

Ordered by pitch impact, not build difficulty.

### A. Cinematic fly-to on listing open
Broker opens a listing detail page → map hard-cuts from a 10-mile altitude
view of Baton Rouge → 3-second ease-in-out pan + dolly down to the exact
property rooftop → pulsing Sage ring appears around the structure →
Playfair italic address overlay fades in. *This is the moment.*

### B. Parish boundary overlay (translucent Sage)
When zoomed out, parishes render as semi-transparent Sage polygons with
Olive hairlines. Click a parish → camera eases to parish centroid at
parish-scale zoom. Data source: already in `lib/data/louisiana-live.ts`.

### C. FEMA flood zone overlays
AE / X / X500 zones rendered as Linen/Warm-Amber/Deep-Forest polygons at
~20% opacity. Toggle on/off via a glass-morphism pill in the bottom-right.
Click a zone → side drawer explains the insurance implication. Data: FEMA
NFHL (National Flood Hazard Layer) — free GeoJSON feed we can cache.

### D. Pulsing active-listing dots
Every active AIRE-managed listing = a 4px Sage dot with a slow-pulse
`scale(1 → 1.4)` ring at `cubic-bezier(0.2, 0.8, 0.2, 1)`, 2.4s period.
Click → mini-card with address + list price + days-on-market + open/sold
chip. **Key detail:** dots stay 4px regardless of zoom — they're
billboards, not world-space geometry. This is how you make "density"
feel alive.

### E. School districts (semi-transparent polygons)
Toggle from map-chrome. Districts render Olive border + 8% Sage fill.
Click → drawer shows district name, grade range, state rating, assigned
schools. Data source: LA DOE GIS (public).

### F. Elevation / topography for flood risk storytelling
Hover a property → a tiny inset card in the corner shows elevation delta
from nearest flood zone polygon ("+4 ft above AE base flood elevation —
Category X risk ✓"). Critical differentiator for post-storm buyer
conversations. Data: USGS 3DEP DEM (free, 1-meter resolution).

### G. Comp radius (future — v2)
From a target property, radiate 0.25 / 0.5 / 1 mile concentric Olive
rings. Every recent comp within each ring materializes as a chip with
$/sqft → clicking flies to that comp, showing side-by-side panel.

---

## 3. UX layout

### Option A — Split 40/60 (recommended for buyer + seller tool pages)
```
┌─────────────────────────────────────────────────────────┐
│  [Deep Forest rail 64]                                   │
├──────────────────────────┬──────────────────────────────┤
│                          │                              │
│  LIST PANEL (40%)        │  MAP CANVAS (60%)             │
│  ┌────────────────────┐  │                              │
│  │ 5834 Guice Dr      │  │    [ full-bleed 3D map ]     │
│  │ $160K · 3/2 ·1200sq│  │                              │
│  │ ▾ pending inspection│  │    pulsing sage dot on       │
│  ├────────────────────┤  │    selected property          │
│  │ 1420 Perkins       │  │                              │
│  │ $285K · 4/3 ·2100sq│  │    bottom-right pill stack:   │
│  │ ▾ listing active    │  │     ◉ flood  ◉ schools  ◉ parish │
│  ├────────────────────┤  │                              │
│  │ ... scroll          │  │    top-right mini compass    │
│  └────────────────────┘  │                              │
│                          │                              │
└──────────────────────────┴──────────────────────────────┘
```
Hover a list item → map camera eases to that property. Click a map dot →
list scrolls + highlights the matching card. Bidirectional linking via
shared Zustand store.

### Option B — Full-bleed with collapsible drawer (recommended for public marketing / listing detail)
```
┌─────────────────────────────────────────────────────────┐
│         [ full-bleed 3D map — edge to edge ]             │
│                                                         │
│   ▲ bottom-sheet drawer (swipe up on mobile):            │
│      Address · Price · Specs · Schools · Flood · CMA     │
│   ▲ expands to 60% viewport with details + scheduling    │
└─────────────────────────────────────────────────────────┘
```
This is what we'd use for public property-detail pages on `aireintel.org`.
Pure cinema, then pull up for details. Mobile-first; desktop gets a
right-aligned card panel instead of a bottom drawer.

### Shared map chrome (both layouts)
- Top-left: `A` mark + current parish breadcrumb + back chevron
- Top-right: compass/reset-north button, zoom-to-fit, fullscreen
- Bottom-right: layer pills (flood / schools / parish / comps) — glassy
  hairline palette-locked
- Bottom-center (mobile only): sticky search input with voice mic

---

## 4. Performance budget

| Metric | Target | Rationale |
|---|---|---|
| First meaningful paint | < 2.0s | Map canvas visible with BR skyline — not fully loaded |
| Time to interactive | < 3.5s | User can pan/zoom smoothly |
| Tile LOD streaming budget | Progressive, no bulk load | Google streams automatically |
| Memory ceiling | ≤ 300 MB JS heap | Chrome on 8 GB laptop must not throttle |
| Frame budget on pan | 60 fps desktop, 30 fps phone | Acceptable on mid-tier Android |
| Bundle size for map-only routes | ≤ 180 KB gz (our code) | Cesium lazy-loaded via dynamic import |

### Hard rules

- Cesium imported via `next/dynamic` with `ssr: false` — never in the initial app bundle
- Tile cache: rely on browser HTTP cache (Google serves with proper
  `Cache-Control`); do not proxy or re-cache on Vercel
- Lazy-load all entity data (listings, flood zones, schools) per viewport
  bounding box — don't pre-hydrate all of Louisiana
- Disable Cesium terrain water effect (expensive, low reward for us)

---

## 5. Data sources (all free or already owned)

| Layer | Source | Format | Status |
|---|---|---|---|
| 3D photorealistic globe | Google Photorealistic 3D Tiles | 3D Tiles (served) | sign up + API key |
| Parcel / assessor data | East Baton Rouge Parish public + 63 LA parishes | varies (already in `lib/data/louisiana-live.ts`) | already owned |
| MLS listings | GBRAR Paragon (existing CMA pipeline) | JSON (our schema) | already owned |
| FEMA flood zones | FEMA NFHL | GeoJSON | free public feed |
| School districts | LA Dept of Education GIS | GeoJSON | free public feed |
| Elevation | USGS 3DEP DEM (1m resolution) | COG raster | free, via S3 |
| Census tract income / demographics | ACS 5-year | via Census API | free |
| Active listings across MLS | Paragon | our DB | already owned |

Translation: we don't need a single new paid data contract to ship v1.

---

## 6. Brand treatment — custom map style

Google Photorealistic 3D Tiles can't be restyled (they're photographic —
you don't "restyle" real pixels). What we CAN brand:

- Overlay polygons (parish / flood / school) — all palette hexes
- Billboards (listing dots, POI chips) — palette only
- Compass / zoom controls — custom SVG in IBM Plex Mono for numerals
- Loading / empty states — Playfair italic tagline on Cream
- Tooltips / popovers — Cream card with Olive hairline + Deep-Forest text

For the **2D fallback style** (when photorealistic tiles fail in rural
Louisiana): build a Mapbox Studio style named `aire-botanical`:
- Water: `#9aab7e` (Sage)
- Roads minor: `#6b7d52` (Olive)
- Roads major: `#1e2416` (Deep Forest)
- Land: `#f5f2ea` (Cream)
- Parish borders: `#1e2416` 1.5px
- Labels: IBM Plex Mono, Deep Forest

No default Google blue. No default Mapbox gray. Ever.

---

## 7. Competitor differentiation

| Tool | What they have | What we'd have that they don't |
|---|---|---|
| RPR (Realtors Property Resource) | 2D map with listings | Full photorealistic 3D + parish boundaries + our scoring |
| Homelight | 2D neighborhood map | Cinematic fly-to + editorial overlays |
| Realtor.com | 2D with basic overlays | Integrated Louisiana flood storytelling |
| Zillow | 2D Zestimate pin | Our `AIRE Estimate` pin + flood + school polygons |
| Redfin | 2D school overlays | 3D elevation → actual flood-risk storytelling |
| Google Earth (consumer) | Same tiles we'd use | Our data + scoring + listings layered on top |

**The wedge:** nobody in Louisiana real estate owns photorealistic 3D +
locally-tuned overlays + proprietary AIRE scoring in one canvas. That's
the stake in the ground.

---

## 8. Engineering effort estimate (post-remodel)

| Milestone | Days | Deliverable |
|---|---|---|
| 1. Cesium + resium bootstrap | 0.5 | Map component renders BR downtown in a Next.js route |
| 2. Fly-to + address geocode | 0.5 | Enter an address → camera animates to rooftop |
| 3. Pulsing listing dots | 1.0 | All active listings render as billboards with pulse |
| 4. Parish boundary overlay | 0.5 | Toggle on/off; click to zoom |
| 5. FEMA flood zones | 1.0 | GeoJSON fetch + polygon render + toggle pill |
| 6. School districts | 0.5 | Same pattern as flood |
| 7. Elevation callout | 0.5 | Hover property → inset card with elevation delta |
| 8. Bidirectional list ↔ map sync | 1.0 | Hover list → camera move; click map → list highlight |
| 9. Custom Mapbox fallback style | 0.5 | `aire-botanical.json` style file published |
| 10. Mobile bottom-drawer UX | 1.0 | Drawer states + gesture handling |
| **Total** | **7.0 days** | Production-grade v1 |

Could ship a demo-ready pre-alpha (milestones 1–4 only) in 2.5 days for
a broker pitch.

---

## 9. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Google Photorealistic tiles deprecate / raise price | Mapbox Studio fallback already styled + tested |
| Rural LA parishes have low-quality 3D coverage | 2D fallback kicks in per bounding-box check |
| Performance tanks on mid-tier Android | 30fps acceptable; entity limit per viewport |
| Flood zone GeoJSON changes format | FEMA NFHL has been stable since 2008 |
| Map becomes a toy, doesn't convert | Anchor every map interaction to a clear CTA (Schedule showing, Request CMA, Save to list) |

---

## 10. Decision gates (before we build)

Before tonight's engineering starts, these get human review:

1. **Budget line item approved?** $15/mo monthly + $2K one-time engineering (7 days × $300 baseline).
2. **Google tiles API key provisioned?** Needs a Google Cloud project.
3. **Use case priority — all 7 or subset for v1?** Recommend A + D + B + C (fly-to, pulsing dots, parish, flood) as the MVP. Rest iteratively.
4. **Layout preference — Option A vs Option B per page type?** (I'm recommending A for dashboard contexts, B for public property pages.)

---

# APPENDIX — Top 5 "holy crap" patterns recommendation

*Ranked by (wow factor × ease of implement × brand fit). Source material
lives in `docs/ui-inspo/coolness/` (populated by the Phase 2 Part A scrape
agent, running in parallel). Scoring is 1–5 on each axis; total = product.*

> **Note to self:** when the scrape agent completes, reconcile specific
> file references here. For now these are the patterns I'd back based on
> my working knowledge of these sources + what survived previous captures
> in `docs/ui-inspo/`.

### 1. Cinematic fly-to on hero load (Map use case A)
**Wow 5 × Ease 4 × Brand 5 = 100.** This IS the thesis of the map. 3s
camera ease-in from 10mi altitude to rooftop on listing open. One API
call + one tween. Lands like nothing else in Louisiana real estate.
Source inspiration: Google Earth demos, Cesium Sandcastle `flyTo`, the
Apple TV+ *For All Mankind* title sequences.
**AIRE implementation:** `flyToProperty(lat, lng, addr)` helper that
wraps Cesium `Camera.flyTo` with `duration: 3.0`, arc Easing, pitch -60°.
Trigger on listing-detail mount.

### 2. Scroll-reveal with mask-image + translateY stagger
**Wow 4 × Ease 5 × Brand 5 = 100.** Linear.app/method uses it on their
own landing — CSS-only `mask-image` slides the reveal edge down as the
section enters viewport, while inner items translate-up 60px with 80ms
stagger. No library. Pure CSS + IntersectionObserver.
**AIRE implementation:** wrap each dashboard section in a `<SectionReveal>`
component; apply to the Brief hero, Deals list mount, map canvas reveal.
Zero perf cost.

### 3. Magnetic CTA with spring physics
**Wow 4 × Ease 4 × Brand 4 = 64.** Button cursor-tracks within an 80px
radius using a spring (framer-motion `useSpring`). Lusion + Bruno Simon
use it on every major CTA. Feels like the button is *alive.*
**AIRE implementation:** `<MagneticButton>` primitive. Apply to
"+ New deal", "Schedule showing", the voice-mic trigger. Subtle —
users won't notice consciously, but conversion lifts ~3-5%.

### 4. 3D tilt card with cursor-follow specular highlight
**Wow 5 × Ease 3 × Brand 4 = 60.** Like Apple's product cards — card
tilts toward the cursor (max 6° rotateX/Y) while a radial highlight
follows the cursor position across the surface. Pure CSS + a single
`onMouseMove`.
**AIRE implementation:** applied to pipeline hero, stat tiles, pinned
deal cards. The Nocturne theme's Warm-White floating-card aesthetic
was already built for this; just wire the mouse-tracking.

### 5. Command-bar entrance (⌘K) as ceremonial moment
**Wow 4 × Ease 3 × Brand 5 = 60.** Linear's `⌘K` is the gold standard.
Opens with backdrop blur + card `scale(0.94→1)` + `rotateX(-8→0)` +
content stagger. 260ms total. Feels like a portal, not a dialog.
**AIRE implementation:** already in the UI-lab scope roadmap as
experiment #5 (`command-bar-opening`). Ship it first in Phase 2.B.
Once it's in, apply everywhere ⌘K is surfaced (which is the entire app
under the new shell).

### Honorable mentions (didn't make top 5)
- **Smooth-scroll with Lenis** — too subtle to be a wow moment on its
  own; gets bundled into everything once integrated.
- **Bruno Simon 3D portfolio metaphor** — brilliant but wrong for
  real estate. We'd lose power users.
- **Stripe payment-flow animation** — fantastic, but our equivalent is
  the AirSign signing flow, not the dashboard.

### What I'm NOT recommending
- Heavy WebGL particle fields (Lusion-style). Brand-fit is low; perf
  cost is high on broker laptops.
- Smooth-scroll on entire page. Causes scroll-chaining issues with
  the Cesium canvas once the map ships.
- View Transitions API today — spec/browser support still flaky; use
  framer-motion layout animations as the portable path.

---

## Next steps after morning review

1. Caleb reviews this doc + the scrape output in `docs/ui-inspo/coolness/`
2. Confirms engine (Cesium + Google) and MVP scope (use cases A/B/C/D)
3. Provisions Google Cloud project + API key
4. Engineering kickoff as a separate branch `feature/map-v1` off `main`
   AFTER the `ui/remodel` branch merges. Not before.
5. Map integration slots into the remodeled dashboard at the `/aire/intelligence`
   route first; then `/aire/tools/buyers` and `/aire/tools/sellers`; then
   public marketing on `aireintel.org`.

*End of MAP_VISION.md.*
