# Reference Product Pattern Harvest — 2026-04-14

Goal: harvest specific, portable interaction mechanics from five reference products and reframe them in AIRE vocabulary (sage #9aab7e / olive #6b7d52 / cream #f5f2ea / linen #e8e4d8 / deep forest #1e2416, Cormorant Garamond italic + Space Grotesk + IBM Plex Mono). We steal mechanics, not chrome.

Target surface: the Concept B AIRE workspace — 64w icon rail + Cmd-K bar + Attio-dense typed table of transactions + pinned morning brief — across `/aire`, `/aire/transactions`, `/aire/contracts`, `/airsign`, `/aire/intelligence`.

Sources scraped today: linear.app, linear.app/docs, attio.com, stripe.com/payments, docs.stripe.com/dashboard, notion.com/product, perplexity.ai. Marketing pages were thin on mechanics, so the deeper details below are drawn from each product's documented feature set cross-referenced with the marketing screenshots we pulled.

---

## 1. Linear — keyboard-first, density-first, status-centric

Linear's method is: make the happy path be a keyboard action, make state visible without leaving the list, and let the ID (ENG-2703) do the work of titles. Observed on linear.app: sidebar organized as *Workspace → Inbox / My issues / Reviews / Pulse → Initiatives / Projects / Favorites*, issue lists grouped by status count ("Backlog 8, Todo 71, In Progress 3, Done 53"), issue rows with ID + emoji icon + truncated title + label chip + numerical metrics, activity feed with user avatars and timestamps ("2min ago"), large stat numerals ("25,000") paired with a one-line caption.

### Five patterns to port

1. **ID-as-identity chip (TXN-2703 instead of address strings).** Every transaction gets a short stable ID rendered in IBM Plex Mono, left-aligned, 11px, olive on cream. Used in the table, the command bar, and deep links so Caleb can type or speak "TXN-2703" and land anywhere. Why it fits AIRE: addresses are long and non-unique (3 active deals on "Guice Dr"); IDs are how Linear beat Jira.
2. **Grouped-by-status list with inline counts.** Transaction list groups by pipeline stage (Offer / Under Contract / Clear-to-Close / Closed) with a count pill per group (`Under Contract · 8`) and a disclosure chevron that collapses/expands with keyboard. The count is the value, not decoration — it replaces the "active transactions" nav badge.
3. **Cmd-K as command AND nav AND action.** One palette, three modes auto-detected from input: ">" prefix = run action ("complete deadline"), "#" prefix = jump to entity ("TXN-2703"), plain text = fuzzy search all deals + contacts + docs. Recent actions persist at top. Voice triggers the same palette, so typed and spoken commands share one executor.
4. **Peek without leaving the list (J/K + Space).** Up/down arrows move selection, Space opens a right-side peek drawer with the deal summary; Enter enters full detail; Esc returns. No modal steals the context of the list. Three transactions can be compared in 4 keystrokes.
5. **Status transitions are one keystroke from the row (S then letter).** S opens a mini status picker inline on the selected row — "O" offer, "U" under contract, "C" closed, "X" canceled — and the row animates to its new group with a 160ms translate. No right-click, no modal.

### Anti-pattern to avoid
Linear's dark-by-default surfaces plus cold pastel status dots read like SaaS to non-developers. AIRE keeps the mechanic (inline status picker) but replaces the dot language with sage fill + olive outline + linen text tokens on cream; the dot becomes a small rounded square (4px) tinted from our palette, never a red/yellow/green traffic light.

### Visual class (what to copy literally)
- Command bar: 560px wide, centered, 76vh from top, cream surface, 1px olive outline, 12px radius, single line input 20px Cormorant italic placeholder, results list below capped at 7 rows, each row 36px tall, sage hover fill.
- Dense table row: 36px tall, 12px horizontal padding, 1px hairline divider in linen, no zebra; selected row = 2px left sage border + cream-tinted-olive background (`#f5f2ea` mixed 6% with `#6b7d52`).
- Sidebar nav: 64w collapsed icon rail expands to 232w on hover with spring (stiffness 300 damping 30); icons are 20px line weight, label appears 80ms after width animation starts.
- Stat card: no card. Numerals float on cream with 48px Cormorant italic, caption 11px Space Grotesk olive 70% opacity.
- Page transition: list→detail is a view-transition API crossfade 160ms, not a route reload; the selected row element morphs into the detail header.

---

## 2. Attio — typed cells, record-is-a-page, relational density

Attio's thesis is that every cell has a type (person, company, currency, date, domain) and typed cells open in place — a date cell becomes a calendar, a person cell becomes a contact peek. Observed on attio.com: dual Kanban + table views out of the box, custom objects, bar/line/pie/funnel reports inline, no-code automations, inline notes+tasks+emails on every record. The interaction that matters: columns aren't text — they're primitives.

### Five patterns to port

1. **Typed cells with in-place editors.** A `party` cell renders as a 20px avatar + name chip; click it and a contact peek opens anchored below the cell with email/phone/last-touched, not a separate page. `closing_date` renders as `Apr 22` in IBM Plex Mono and opens a compact 7x6 calendar grid. `price` renders right-aligned, mono, with `$` muted to 50%. Why it fits AIRE: every transaction has ~14 typed fields; current UI renders all as plain text.
2. **Record layout = two columns, left is narrative, right is structured.** The transaction detail becomes a 2/3 + 1/3 split: left column is timeline + notes + comms (scrollable narrative), right column is a sticky typed properties panel (status, parties, price, dates, deadlines) with every field inline-editable. Matches Attio's record page exactly — no tabs needed for properties.
3. **View = (filter + group + sort + visible columns) saved with a name.** "At Risk Deals" is a saved view: filter `status in [Under Contract, Clear-to-Close]` + `days_to_close < 7` + group by buyer agent + show only (ID, property, buyer, closing, status). Views live in the sidebar under each workspace; switching view is instant (no reload), powered by one Prisma query shape.
4. **Kanban is the same data as the table, one toggle.** A single icon in the list toolbar toggles between Table / Kanban / Timeline. Kanban columns = pipeline stages, cards are transactions with the same typed chips as the table row. Drag a card across columns → writes new status + advances workflow state machine + fires notifications.
5. **Relational backlinks on every entity.** Open a contact → see every transaction they're on, every doc they signed, every email thread. Each backlink is a linked chip that peeks on hover, navigates on click. The data already exists in Prisma; the UI just needs the "Related records" sidebar block.

### Anti-pattern to avoid
Attio lets users create unlimited custom objects and fields. That's a power user footgun for AIRE — Caleb's users are realtors, not CRM admins. Ship Attio's *typed cell mechanic* and *saved views*, but keep the schema locked to Transaction / Contact / Document / Vendor / Envelope. No "add custom object" button.

### Visual class (what to copy literally)
- Typed table: columns have icon in header (person icon for party, calendar icon for date, hash icon for numeric), sortable on click, resize handle on hover between headers.
- Inline editor opens anchored below cell, 8px below row, cream surface with 1px olive outline, 220px width for dates, 320px for contacts, 180px for currency. Arrow keys navigate within editor; Enter commits; Esc cancels.
- Record detail 2-col: left 66% padding-right 32px, right 34% sticky top:64px with max-height calc(100vh - 64px) scroll-internal.
- View switcher: icon group in top-right of list toolbar, 32px squares, active = sage fill + cream icon.
- Chips for typed entities: 22px tall, 8px horizontal padding, 6px radius, 11px Space Grotesk, avatar 16px if present.

---

## 3. Stripe Dashboard — stat cards, sparkline rows, filter chips that compose

Stripe's dashboard is a masterclass in "data first, chrome invisible." Observed on stripe.com/payments and docs.stripe.com/dashboard: stat cards with a big numeral + a delta ("+11.9%") + a tiny sparkline, filter chips that stack horizontally, a date range picker anchored top-right of every view, customizable widgets ("Click Add under Your overview"), and transaction rows with inline mini-charts for recurring payments. The sidebar includes a Shortcuts section of pinned + recently visited pages.

### Five patterns to port

1. **Stat cards with numeral + delta + sparkline, nothing else.** The dashboard header row is 4 cards: `Pipeline Value`, `Closing This Week`, `Avg Days to Close`, `Compliance Score`. Each card = 64px Cormorant italic numeral, a 14px Space Grotesk caption above, an 11px IBM Plex Mono delta below (sage for up, terracotta-free-warning for down — we use olive for down since no red), and a 40px-tall sparkline in the card's right third. No borders, just cream surface with 1px linen hairline between cards.
2. **Filter chips that stack and compose.** Above the transaction list: `Status: Under Contract ×` + `Closing: Next 7 days ×` + `Agent: Caleb ×` + `+ Add filter`. Each chip removable with its X; clicking the chip reopens the editor. The filter state is URL-synced (`?status=uc&closing=7d`) so views are shareable. Stripe's killer move: when you add a filter, the chip stays visible so you never forget what's hiding rows.
3. **Date range picker is a single affordance, top-right, global.** One component, used on every list and every chart: `Last 7 days ▾` → opens a split panel with presets (Today / 7d / 30d / QTD / YTD / Custom) on the left and a two-month calendar on the right. The range is remembered per page in URL.
4. **Inline row charts for time-series fields.** In the transaction list, the `price` column's right edge shows a tiny 24px sparkline of Zillow/AVM estimate vs contract price over the last 6 months. One look = "this deal is still priced correctly vs market." Same pattern for `days_in_stage`.
5. **Empty states are workflows, not decoration.** Stripe's empty "No payments yet" shows three next-step cards: *Create a Payment Link*, *Try a test payment*, *Invite your team*. Port exactly: an empty `/aire/transactions` shows three action cards (*Create transaction*, *Import from Dotloop*, *Connect Gmail to auto-scan*) in IBM Plex Mono-numbered steps.

### Anti-pattern to avoid
Stripe's dashboard keeps adding widgets + toggles + mode-switches until the home view is overwhelming. Don't ship "customizable overview" in v1 — give Caleb one opinionated home with the four stat cards and the Morning Brief pinned. Customization is a v2 pressure valve.

### Visual class (what to copy literally)
- Stat card: 180px min-width, 112px height, 24px padding, cream, 1px linen right border (no outer border).
- Filter chip: 28px tall, 10px horizontal padding, olive 1px outline, olive text, 11px Space Grotesk, X icon on right with 6px gap, hover fills sage at 10% opacity.
- Date picker: 360px x 340px panel, cream surface, 1px olive outline, 14px radius, dual month grid right, preset list left, 14px Space Grotesk.
- Sparkline: 24px tall inline, 48px wide, olive stroke 1.5px, no axes, no dots, last point is a 3px sage filled circle.
- Sidebar "Shortcuts" section: bottom of icon rail, 4 recent pages as 20px pinned icons.

---

## 4. Notion — hierarchical sidebar, hover-reveal affordances, slash menu

Notion's defining move is: show nothing until you hover, then show everything. Observed: nested sidebar with toggle triangles, plus button on hover for every block, drag handle on hover, slash menu (/) inside any text field opens a full block picker, breadcrumbs at top of every page, database views switchable inline, favorites at top of sidebar.

### Five patterns to port

1. **Hover-reveal row affordances (plus, drag, more).** In the transaction list, every row shows nothing until hover; on hover, a 3-dot more menu appears on the right and a 6-dot drag handle appears on the left. On row selection, these stay visible. Keeps the list visually calm at rest, discoverable on approach. Critical for Kinfolk warmth — our current UI is too button-heavy.
2. **Slash menu in every free-text field.** In notes, comms composer, and contract clause editor, typing `/` opens a menu of structured inserts: `/deadline` inserts a live-linked deadline chip, `/contact` inserts a party chip, `/doc` inserts a document chip, `/price` inserts a currency input. Turns prose into structured data mid-sentence.
3. **Breadcrumb nav at top of every detail page.** `Transactions / Under Contract / 5834 Guice Dr / Documents / Purchase Agreement.pdf` — each segment is a click-back. Replaces the current "Back to transactions" button pattern. Breadcrumbs render in Space Grotesk 12px olive 60% opacity with a `/` separator, last segment 100% opacity deep forest.
4. **Favorites + Recents pinned at top of sidebar.** Above the normal nav, a Favorites section (user-pinned transactions, saved views, documents) and a Recents section (auto-populated last 5 visited). Caleb works 8 active deals at a time — those become pinned, everything else stays one click deeper.
5. **Toggle-expand sections in the sidebar.** Transactions, Contracts, AirSign, Intelligence each have a disclosure triangle revealing sub-items (saved views for Transactions, form templates for Contracts, envelopes by status for AirSign). Collapsed state is default; expanded state persists in localStorage.

### Anti-pattern to avoid
Notion's infinite flexibility creates "empty page paralysis" — users don't know what to build. AIRE's pages should be pre-structured domain objects; the slash menu is only for *insertion inside existing contexts*, never for "create any page." We ship schemas, not blank canvas.

### Visual class (what to copy literally)
- Sidebar: 232w expanded, 64w collapsed, cream surface, 1px linen right border. Section headers 10px uppercase tracking 0.08em Space Grotesk olive 50% opacity. Item rows 28px tall, 8px horizontal padding, 4px radius, hover sage 8% fill.
- Hover affordance: drag handle is 6 dots in 2x3 grid, 12px tall, olive 40% opacity, fades in 120ms on row hover.
- Slash menu: 320w, cream surface, 1px olive outline, 14px radius, grouped by type with 10px uppercase section headers, arrow-key nav, Enter commits.
- Breadcrumb: 40px tall bar below main header, segments separated by 8px `/` in linen, hover segment underlines.
- Toggle triangle: 10px chevron, rotates 90deg on expand, 160ms ease-out.

---

## 5. Perplexity — input-as-hero, inline citations, follow-up at the answer

Perplexity made the chat input *the product* — the homepage IS a giant input. Observed on perplexity.ai: a centered input box dominating the viewport, focus selector pills below it ("Academic / Writing / Wolfram / YouTube / Reddit"), numbered citation chips [1][2][3] inline with answer text that hover-peek the source, a persistent follow-up input pinned to the bottom of every answer, threads sidebar on the left, Pro toggle top-right.

### Five patterns to port

1. **Cmd-K bar that feels like a question, not a command.** The palette placeholder is Cormorant italic 20px: *"Ask about any deal, draft any contract, schedule anything…"* — warm, inviting, agentic. It accepts natural language (Perplexity mode) AND slash commands AND IDs (Linear mode) AND fuzzy search — one surface, three modes, auto-classified by the voice pipeline we already have.
2. **Inline citation chips for every AI output.** When the Morning Brief says "5834 Guice Dr is behind on inspection", the claim renders with a tiny numbered chip `[1]` that links to the source email/doc/event. On hover, the chip peeks the source inline. Every AI-generated sentence in AIRE (Morning Brief, Compliance scan, Contract writer, Deal Intelligence) gets cited — this is how Caleb trusts the machine.
3. **Follow-up input pinned at the bottom of every AI answer.** The Morning Brief ends with a sticky input: *"Ask a follow-up…"* — Caleb can type "what's the closing schedule for Guice Dr?" and the brief extends inline instead of starting a new conversation. Same pattern on compliance scan results, contract preview, intelligence reports.
4. **Focus pills below the input.** Below the Cmd-K bar, a row of 5 small pills: `All / Transactions / Contracts / Intel / Comms` — scopes the search/command to one agent. Default is All; selecting Contracts scopes to contract writer + form templates only. Same design language as Stripe's filter chips, but selecting replaces context instead of adding filters.
5. **Threads sidebar for past queries.** A left-rail history of past Cmd-K conversations — "Draft counter on Guice", "CMA for Highland", "Compliance scan TXN-2703" — each thread is re-openable, continuable, and shareable. Turns ad-hoc voice commands into a reviewable audit log.

### Anti-pattern to avoid
Perplexity's marketing-spam Pro upsell banners interrupt real work and feel like a free-tier nag. AIRE's upgrade prompts already live in `TrialUpgradeModal` and should stay lazy, not mid-flow. Never interrupt a command with an upgrade prompt.

### Visual class (what to copy literally)
- Hero input (used on `/aire` blank state + Cmd-K): 720w, 64h, cream surface, 1px olive outline, 16px radius, input text 20px Space Grotesk, Cormorant italic placeholder, submit icon 20px sage at right.
- Focus pill row: 5 pills, 28h, 12px radius, 1px linen outline, active = sage fill + cream text, 12px Space Grotesk, 8px gaps.
- Citation chip: 16px square, 10px IBM Plex Mono number, linen background, olive text, 4px radius, hovers 24px peek card.
- Follow-up input: sticky bottom with 16px drop shadow in deep forest 8%, same 64h form as hero input but width 100%.
- Thread sidebar item: 40h, 8px padding, truncate to 1 line, 13px Space Grotesk, timestamp in IBM Plex Mono 10px olive 50% at right.

---

# TOP 15 PATTERNS TO PORT TONIGHT

Ranked by impact × speed-to-build given what's already in `aire-assistant`. Each maps to a blueprint spec item.

1. **Cmd-K omnibar (Linear + Perplexity fusion)** — one input, three auto-classified modes (action / entity / search / ask). Warm Cormorant placeholder. Voice executor wires straight in. [Hero feature, ~4h]
2. **Typed cells in the transaction table (Attio)** — party chips, date chips, currency-right-aligned-mono, inline editors anchored below cell. [Transforms list from read-only to work surface, ~6h]
3. **Grouped-by-status list with inline counts (Linear)** — collapsible groups by pipeline stage, keyboard-navigable. Replaces status filter tabs. [~3h]
4. **Stat cards row on /aire home (Stripe)** — 4 cards: pipeline, closing-this-week, avg-days-to-close, compliance score. Numeral + delta + sparkline. [~2h]
5. **ID-as-identity chip (Linear)** — TXN-xxxx stable IDs rendered in IBM Plex Mono everywhere. Jumpable via Cmd-K `#`. [Schema + render, ~2h]
6. **Saved views in sidebar (Attio)** — "At Risk", "Closing This Week", "Needs Signature" as named (filter + group + sort) combos persisted per user. [~4h]
7. **Filter chip bar with URL sync (Stripe)** — composable chips above list, removable, shareable via URL. [~3h]
8. **Record detail 2-col layout (Attio)** — narrative left, sticky typed properties right. Replaces current tabbed detail on `/aire/transactions/[id]`. [~5h]
9. **Hover-reveal row affordances (Notion)** — drag handle + more menu appear on hover only. Calms the list visually. [~1h]
10. **Breadcrumb nav on every detail page (Notion)** — replaces "back" buttons everywhere. [~2h]
11. **Inline citation chips on AI output (Perplexity)** — every Morning Brief / Compliance / Intelligence sentence gets a `[1]` chip with hover-peek source. Trust multiplier. [~4h]
12. **Follow-up input pinned to every AI result (Perplexity)** — extends briefs inline instead of new threads. [~2h]
13. **Kanban view toggle wired to same data (Attio)** — one icon toggles Table / Kanban; drag card advances workflow state machine. [~4h]
14. **Global date range picker (Stripe)** — single component, URL-synced, on every list and chart. [~3h]
15. **Peek-on-Space row preview (Linear)** — J/K navigate, Space opens right-side peek, Enter = full detail, Esc = close. Keyboard-first flow. [~3h]

Total: ~48h of focused work → a workspace that feels like Linear × Attio × Superhuman with Kinfolk warmth. Blueprint specs flow from this list one-to-one.
