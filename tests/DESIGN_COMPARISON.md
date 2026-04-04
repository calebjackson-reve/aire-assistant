# AIRE Design Comparison — Morning Brief & Dashboard

## Palette & Typography (Locked)
All variations use: Sage #9aab7e · Olive #6b7d52 · Cream #f5f2ea · Linen #e8e4d8 · Deep Forest #1e2416
Fonts: Playfair Display (headlines via --font-newsreader) · Space Grotesk (body) · IBM Plex Mono (data)

---

## Morning Brief Variations

### V1: Minimalist
**File:** `tests/design-variations/MorningBriefV1Minimalist.tsx`

| Metric | Score |
|--------|-------|
| Readability | 10/10 |
| Information density | 4/10 |
| Professional appearance | 9/10 |
| Mobile usability | 9/10 |

**Pros:**
- Maximum breathing room — feels editorial and premium
- Numbered action items with monospace counters add subtle sophistication
- Fastest to scan; nothing competes for attention
- Simple status indicator (pulsing dot) is elegant

**Cons:**
- Wastes vertical space — users must scroll more
- No structured data (deadlines, pipeline) visible — only summary + actions
- Could feel "empty" for power users who want density

**Best for:** Users who want a calm, focused morning read. Mobile-first use cases.

---

### V2: Card-Based
**File:** `tests/design-variations/MorningBriefV2Cards.tsx`

| Metric | Score |
|--------|-------|
| Readability | 8/10 |
| Information density | 7/10 |
| Professional appearance | 8/10 |
| Mobile usability | 8/10 |

**Pros:**
- Clear visual separation between summary, actions, and approval
- Priority badges on action items (high/medium/low) add useful context
- Glass card system matches existing AIRE design language
- Item count in header helps scan volume at a glance

**Cons:**
- Multiple card layers can feel "boxy" on smaller screens
- Doesn't surface structured researcher data (deadlines, pipeline, contacts)
- Priority badges may be noisy if all items are the same priority

**Best for:** Balanced approach — enough structure without overwhelming. Good default.

---

### V3: Executive Summary
**File:** `tests/design-variations/MorningBriefV3Executive.tsx`

| Metric | Score |
|--------|-------|
| Readability | 7/10 |
| Information density | 10/10 |
| Professional appearance | 10/10 |
| Mobile usability | 5/10 |

**Pros:**
- Surfaces ALL researcher data: deadlines table, pipeline deals, contacts, action items
- Numbered sections (01-05) with ruled headers feel like a real intelligence report
- Deadline urgency dots (red/amber/green) give instant visual priority
- Contact scores + pipeline prices in monospace feel data-driven and serious
- Report ID in header adds authenticity

**Cons:**
- Dense — requires more cognitive effort to read
- Deadline table grid doesn't collapse well on narrow screens
- Contact grid (2-col) needs responsive handling below 480px
- May overwhelm users who just want a quick summary

**Best for:** Power users, desktop-first. The "Wall Street" feel. Best for printing/PDF export.

---

## Dashboard Variations

### V1: Single Column Mobile
**File:** `tests/design-variations/DashboardV1Mobile.tsx`

| Metric | Score |
|--------|-------|
| Readability | 9/10 |
| Information density | 6/10 |
| Professional appearance | 7/10 |
| Mobile usability | 10/10 |

**Pros:**
- Horizontally scrollable stat pills — space-efficient on mobile
- Touch-friendly card targets with active:scale feedback
- "Tap to review →" CTA on brief is clear and mobile-native
- Transaction cards show status + urgency + days-to-close compactly

**Cons:**
- Wastes space on desktop (single column on a wide screen)
- No deadline sidebar — urgent items only shown as badge counts
- Stat pills require horizontal scroll which can be missed

**Best for:** Mobile-first agents checking dashboard on phone between showings.

---

### V2: Two Column Desktop
**File:** `tests/design-variations/DashboardV2Desktop.tsx`

| Metric | Score |
|--------|-------|
| Readability | 8/10 |
| Information density | 9/10 |
| Professional appearance | 9/10 |
| Mobile usability | 7/10 |

**Pros:**
- Left sidebar (brief + stats + deadlines) vs right main (transactions) — clear information hierarchy
- Urgent deadlines get their own dedicated section with color-coded dots
- Shows up to 8 transactions (vs 5 in current) with price + closing countdown
- Collapses to single column on mobile via `lg:grid-cols` breakpoint
- Hover-reveal "View full brief →" adds polish without clutter

**Cons:**
- Fixed 380px left column may not suit all content volumes
- Deadline sidebar duplicates some info from transaction urgency badges
- More complex layout = more testing across breakpoints

**Best for:** Desktop-first power users. The recommended default for AIRE dashboard.

---

## Recommendation

### Morning Brief: **V3 Executive Summary** (desktop) + **V1 Minimalist** (mobile)

The Executive Summary is the highest-impact option — it actually surfaces the deadline, pipeline, and contact data that the Morning Brief researchers generate. The current design and V1/V2 only show `summary` and `actionItems`, wasting the structured research data.

For mobile, V1 Minimalist works as a fallback — show just summary + actions, with a "View full report" link to the executive layout.

**Implementation strategy:** Use V3 as the default, with responsive breakpoints that simplify to V1-style on screens below 640px.

### Dashboard: **V2 Two Column Desktop**

The two-column layout is the clear winner for AIRE's use case:
- Agents work on desktop when managing transactions
- Left sidebar creates a "command center" feel with brief + deadlines always visible
- More transactions visible without scrolling
- Collapses gracefully on mobile

**Implementation strategy:** Replace the current `app/aire/page.tsx` with V2. The existing data queries already support all the fields needed.

---

## Implementation Priority

1. **Morning Brief V3** → Replace `app/aire/morning-brief/page.tsx` — highest ROI, surfaces unused data
2. **Dashboard V2** → Replace `app/aire/page.tsx` — better layout, more info density
3. **Mobile refinement** — Add responsive breakpoints to V3 that simplify to V1-style below 640px
