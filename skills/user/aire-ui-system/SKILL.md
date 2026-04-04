---
name: aire-ui-system
description: >
  Production-grade UI/UX design system for AIRE Intelligence and the Caleb Jackson luxury real estate brand.
  Use this skill ALWAYS when building any interface for: the AIRE platform (aireintel.org), the TC AI assistant
  (transaction coordinator product that monitors emails, coordinates vendors, preps paperwork, manages MLS input,
  and runs task/reminder boards), the Caleb Jackson personal brand (luxury real estate marketing, listing pages,
  content), or any shared interface across these two product lines. This skill enforces consistent component
  architecture, real estate UI patterns, and luxury visual language across both the product and the brand.
  Trigger on any request involving: AIRE, TC dashboard, transaction coordinator UI, task board,
  vendor coordination interface, MLS prep screen, reminder board, deal timeline, CMA layout,
  listing page, real estate dashboard, Caleb brand UI, aireintel, or any screen that will live
  inside the AIRE product or the personal brand. Generates production-ready Next.js 14 + Tailwind code.
  NEVER use this skill for generic SaaS or non-real-estate UI. DO use this skill even if the user just
  says build me a screen or make a component if it is clearly in the AIRE or brand context.
---

# AIRE UI System

Builds production-grade, visually exceptional React + Tailwind interfaces for two interconnected product lines:

1. AIRE Intelligence Platform -- The TC AI assistant and agent dashboard (aireintel.org)
2. Caleb Jackson Brand -- Luxury real estate marketing, listing pages, and content surfaces

Both share a luxury real estate visual language. Neither should look like generic SaaS.

---

## Step 1: Context Read

Before writing a single line of code, identify which surface you are building for:

| Surface | Characteristics |
|---|---|
| TC AI Dashboard | Data-dense, task-driven, real-time feel. Think command center, not form. |
| Transaction Timeline | Sequential, status-aware, document-linked. Progress + urgency. |
| Vendor Coordination UI | Communication threads, status chips, contact cards. |
| Task / Reminder Board | Priority-sorted, deadline-aware, action-first layout. |
| MLS Prep / Paperwork Screen | Field-heavy, validation-forward, structured data entry. |
| CMA / Market Analysis | Data visualization, comp cards, adjustment grids. |
| Listing Page (Brand) | Editorial luxury, photography-first, emotional storytelling. |
| Personal Brand Surface | Caleb Jackson identity -- refined, authoritative, client-first. |

Then pick your aesthetic direction based on context (see Step 2).

---

## Step 2: Aesthetic Direction

Context drives the aesthetic. Do NOT default to the same look every time.

### Aesthetic Modes

**Mode A -- Command Center (TC Dashboard, Task Board, Vendor Coordination)**
- Dark background: #0A1628 (deep navy) or near-black variants
- Gold accent: #D4AF72 (champagne) for status, CTAs, highlights
- Typography: DM Sans body, Cormorant Garamond for display/headings
- Feel: Refined intelligence tool. Like Bloomberg Terminal met a luxury watch brand.
- Motion: Subtle data animations, status pulse, skeleton loaders

**Mode B -- Clean Intelligence (CMA, MLS Prep, Analysis Screens)**
- Light background: off-white #F8F6F1 or #FAFAF8
- Navy as primary text and structure color
- Gold used sparingly -- only for key data points or hierarchy signals
- Typography: DM Sans throughout, Cormorant for section headers only
- Feel: Authoritative report. Like a high-end appraisal document.

**Mode C -- Luxury Editorial (Listing Pages, Brand Marketing -- Navy/Gold)**
- Full bleed photography, cinematic aspect ratios
- Deep navy #0A1628 overlays with champagne gold #D4AF72 type
- Cormorant Garamond dominant -- large, tracked, elegant
- DM Sans for supporting data (price, beds/baths, address)
- Feel: Architectural Digest meets real estate. Aspirational, not transactional.

**Mode D -- Warm Editorial (Brand Content, Social, Personal Touch) -- DEFAULT FOR BRAND**
- Background: #3D2314 (deep espresso brown)
- Line art / icon color: #C8A882 (warm tan / kraft)
- Card / panel fill: #F5ECD7 (cream parchment)
- Text on dark bg: #E8D5B0 (warm cream)
- Text on light/card bg: #3D2314 (espresso)
- Accent / CTA: #A0703A (caramel)
- Typography: Cormorant Garamond for ALL display -- large, open tracking, warm weight
- DM Sans for data labels, meta, supporting copy
- Feel: Handcrafted luxury. Like a premium boutique brand, not a tech platform.
- Use for: Social media content, personal brand moments, listing teasers, client gifts, email headers
- Motion: Minimal -- slow fades, no pulse. Let the warmth do the work.

When context is ambiguous: Default to Mode A for anything product/platform, Mode D for anything brand/personal/social/marketing.

---

## Step 3: Brand Tokens

Always use CSS variables or Tailwind config tokens. Never hardcode colors inline.





Typography stack:
- Display / headings: Cormorant Garamond (weights 300, 400, 500, 600)
- Body / UI / data: DM Sans (weights 300, 400, 500)

Google Fonts import URL:
https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600&family=DM+Sans:wght@300;400;500;600&display=swap

---

## Step 4: Real Estate UI Patterns

These are domain-specific patterns. Use them correctly -- do not reinvent.

### Transaction Timeline
- Row format: [Status Chip] [Date] [Party] [Document Link] [Action Button]
- Always show: current stage, days remaining, next required action
- Color-code by urgency: green (on track), amber (due soon), red (overdue)
- Collapsed by default, expandable per stage

### Task / Reminder Board
- Columns: Today | This Week | Upcoming | Waiting On
- Each card: priority dot + task title + deadline + linked transaction + action
- Gold border on high-priority items
- Never use a generic kanban -- always tie tasks to transactions

### Vendor Coordination Panel
- Contact card: name + role (inspector, title, lender) + phone + last contact date
- Status chip: Scheduled | Confirmed | Awaiting Response | Complete
- Quick actions: Send Text | Send Email | View Thread | Add Note

### Document Status Row
- Format: [Doc Name] [Type Badge] [Status: Received/Pending/Missing] [Upload] [Preview]
- Missing docs always surfaced at top
- Color: gold = received, amber = pending, red = missing

### MLS Input / Paperwork Screen
- Group fields by section (Property Info | Listing Terms | Seller Info)
- Inline validation -- never wait for submit
- Auto-populated fields from extracted data shown in gold highlight
- AI Suggested badge on AIRE-populated fields

### CMA / Comp Card
- Format: [Photo] [Address] [$/sqft] [Days on Market] [Adjustment] [Net Comp Value]
- Always show adjustment column -- Louisiana market methodology
- Closed date + sale price prominent
- Price per sqft as primary comparison metric

---

## Step 5: Component Architecture Rules

### File Structure (Next.js 14, no src/ folder)


### Component Rules
1. No inline styles -- Tailwind classes only, CSS variables for brand tokens
2. TypeScript interfaces for all props -- no any
3. Loading states required -- every data-fetching component needs a skeleton
4. Status always typed -- use enums or union types for status fields
5. Mobile-first -- all components responsive by default
6. Accessibility -- aria-labels on all interactive elements

### Standard Status Types


---

## Step 6: Motion and Interaction

- Page load: Staggered fade-up on cards (50ms delay between items)
- Status changes: Color transition 300ms ease
- Skeleton loaders: Shimmer animation on all loading states
- Hover states: Subtle gold border or gold text transition on interactive cards
- Alerts / deadlines: Pulse animation on critical status chips
- No gratuitous animation -- every motion must communicate state or guide attention

Standard stagger CSS:


---

## Step 7: Code Quality Checklist

Before delivering any component, verify:
- Uses correct aesthetic mode for the surface type
- Brand tokens applied via CSS variables or Tailwind config (not hardcoded)
- TypeScript interfaces defined for all props
- Loading / skeleton state included
- Status types use the standard union types above
- Real estate domain patterns used correctly (not generic SaaS equivalents)
- Mobile responsive
- No Inter, Roboto, Arial, or system fonts -- DM Sans + Cormorant only
- Production-ready: no placeholder logic, no TODO comments in delivered code

---

## Anti-Patterns -- Never Do These

- Generic purple gradient SaaS aesthetic
- Inter or Roboto as primary font
- Kanban board without transaction linkage
- Status dots without semantic meaning
- Forms without inline validation
- Dashboard without real estate domain context
- Hardcoded colors -- always use tokens
- Components without TypeScript props interface
- Light mode for TC dashboard (it is a command center, not a form)

---

## Louisiana Market Specifics

When building any data display related to Louisiana real estate:
- Parishes, not counties
- Act of Sale, not closing
- Calendar day deadlines (not business days unless specified)
- Community property rules apply -- always show both spouses on ownership displays
- Servitudes, not easements
- Mardi Gras is a legal holiday -- deadline displays must account for this
