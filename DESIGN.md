# AIRE Intelligence — DESIGN.md

> AI agent design system for AIRE Intelligence platform.
> Read this file before generating any UI. All color, type, and component decisions flow from here.

---

## 1. Visual Theme & Atmosphere

**Mood:** Warm organic luxury editorial. Feels like Kinfolk magazine meets a serious intelligence platform.
**Density:** Moderate. Data-rich but never cluttered. Generous whitespace around key metrics.
**Philosophy:** Every surface earns its place. No decoration for decoration's sake. Warmth through color, not through illustration or gradients.
**Voice:** Authoritative but approachable. This is a tool for professionals who trust it.

**Anti-patterns (never do these):**
- Cold tech / blue SaaS aesthetic
- Bright colors or neon accents
- Pure white backgrounds or pure black text
- Flat, uniform surfaces with no depth
- Generic real estate orange/gold
- Corporate forest green

---

## 2. Color Palette & Roles

| Token | Hex | Name | Role |
|-------|-----|------|------|
| `--color-primary` | `#9aab7e` | Sage | Primary backgrounds, hero surfaces, dominant UI surfaces |
| `--color-secondary` | `#6b7d52` | Olive | Headings, borders, secondary buttons, active states |
| `--color-bg-light` | `#f5f2ea` | Cream | Light backgrounds, cards, text-heavy sections |
| `--color-text-body` | `#e8e4d8` | Linen | Body text on dark/sage surfaces |
| `--color-contrast` | `#1e2416` | Deep Forest | Sparingly — dark surfaces, high-contrast text, footers |
| `--color-text-dark` | `#2c3520` | Forest Text | Body text on light/cream surfaces |
| `--color-border` | `#c5c9b8` | Sage Border | Subtle borders, dividers on light surfaces |
| `--color-border-dark` | `#4a5638` | Olive Border | Borders on dark/sage surfaces |
| `--color-surface-elevated` | `#f0ece2` | Warm White | Elevated cards on cream background |
| `--color-muted` | `#8a9070` | Muted Sage | Placeholder text, disabled states, secondary labels |

### Semantic Colors
| Token | Hex | Usage |
|-------|-----|-------|
| `--color-success` | `#6b7d52` | Olive — success states, completed items |
| `--color-warning` | `#b5956a` | Warm amber — warnings, deadlines approaching |
| `--color-error` | `#8b4a4a` | Muted red — errors, overdue items |
| `--color-info` | `#7a8e9e` | Slate — informational, neutral alerts |

### NEVER USE
`#131314`, `#FFD700`, `#1B3A2D`, `#A67C52`, `#C4775A`, `#919E78`, `#C8CEBC`, any blue, cold gray, `#ffffff`, `#000000`, forest green, copper, terracotta coral.

---

## 3. Typography Rules

### Font Stack
```css
--font-display: 'Playfair Display', Georgia, serif;
--font-body: 'Space Grotesk', system-ui, sans-serif;
--font-mono: 'IBM Plex Mono', 'Courier New', monospace;
```

### Type Hierarchy
| Element | Font | Weight | Size | Line Height | Tracking |
|---------|------|--------|------|-------------|---------|
| Hero headline | Playfair Display | 700 | 56–72px | 1.1 | -0.03em |
| Section heading (h1) | Playfair Display | 700 | 36–48px | 1.15 | -0.02em |
| Page heading (h2) | Playfair Display | 600 | 28–32px | 1.2 | -0.01em |
| Sub-heading (h3) | Space Grotesk | 600 | 20–24px | 1.3 | 0 |
| Body large | Space Grotesk | 400 | 18px | 1.7 | 0 |
| Body default | Space Grotesk | 400 | 16px | 1.6 | 0 |
| Body small | Space Grotesk | 400 | 14px | 1.5 | 0.01em |
| Label / caption | Space Grotesk | 500 | 12px | 1.4 | 0.05em uppercase |
| Data / stats | IBM Plex Mono | 500 | 14–16px | 1.4 | 0 |
| Large stat | IBM Plex Mono | 600 | 32–48px | 1.1 | -0.02em |

### Typography Rules
- Editorial headings (Playfair Display) use italic for emphasis on editorial contexts
- Data values always use IBM Plex Mono — never Playfair or Space Grotesk for numbers
- Never use Playfair Display for body text
- Uppercase labels always use Space Grotesk 500 with letter-spacing: 0.05–0.08em

---

## 4. Component Styles

### Buttons

**Primary Button**
```
Background: #6b7d52 (Olive)
Text: #f5f2ea (Cream)
Border: none
Border-radius: 6px
Padding: 12px 24px
Font: Space Grotesk 500 15px
Hover: background #5a6b43, slight translateY(-1px), shadow
Active: background #4a5a35, translateY(0)
Focus: outline 2px #9aab7e offset 2px
```

**Secondary Button**
```
Background: transparent
Text: #6b7d52 (Olive)
Border: 1.5px solid #6b7d52
Border-radius: 6px
Padding: 11px 23px
Hover: background rgba(106,125,82,0.08)
```

**Ghost Button (on dark surfaces)**
```
Background: transparent
Text: #e8e4d8 (Linen)
Border: 1px solid rgba(232,228,216,0.3)
Hover: background rgba(232,228,216,0.08)
```

**Destructive Button**
```
Background: #8b4a4a
Text: #f5f2ea
Hover: background #7a3d3d
```

### Cards

**Default Card (on Cream bg)**
```
Background: #f0ece2 (Warm White)
Border: 1px solid #c5c9b8
Border-radius: 10px
Padding: 24px
Shadow: 0 1px 3px rgba(30,36,22,0.06), 0 4px 12px rgba(30,36,22,0.04)
```

**Elevated Card**
```
Background: #ffffff (only use inside cards, not as page bg)
Border: 1px solid #d8d4c8
Border-radius: 10px
Shadow: 0 2px 8px rgba(30,36,22,0.08), 0 8px 24px rgba(30,36,22,0.06)
```

**Dark Card (on Sage or Forest bg)**
```
Background: rgba(30,36,22,0.4)
Border: 1px solid rgba(74,86,56,0.5)
Border-radius: 10px
Backdrop-filter: blur(8px)
```

**Stat Card**
```
Background: #f5f2ea
Border-left: 3px solid #6b7d52
Padding: 20px 24px
Value font: IBM Plex Mono 600 32px #1e2416
Label font: Space Grotesk 500 12px uppercase #8a9070
```

### Inputs & Forms

```
Background: #ffffff
Border: 1.5px solid #c5c9b8
Border-radius: 6px
Padding: 10px 14px
Font: Space Grotesk 400 15px #2c3520
Placeholder: #8a9070

Focus:
  border-color: #6b7d52
  outline: none
  box-shadow: 0 0 0 3px rgba(154,171,126,0.2)

Error:
  border-color: #8b4a4a
  box-shadow: 0 0 0 3px rgba(139,74,74,0.15)
```

**Select / Dropdown**
```
Same as input + chevron icon in #8a9070
Background-image: custom SVG chevron (never browser default)
```

### Navigation / Sidebar

```
Background: #1e2416 (Deep Forest)
Width: 240px
Item padding: 10px 16px
Item font: Space Grotesk 500 14px
Item color (default): #8a9070
Item color (hover): #e8e4d8
Item color (active): #9aab7e
Active indicator: 2px left border #9aab7e
Badge: background #6b7d52, text #f5f2ea, border-radius 10px, font IBM Plex Mono 11px
```

### Tables

```
Header: Space Grotesk 500 12px uppercase #8a9070, letter-spacing 0.06em
Header bg: #f5f2ea
Border-bottom: 1px solid #c5c9b8
Row bg (default): #ffffff
Row bg (hover): #f8f6f0
Row border: 1px solid #ede9e0
Cell font: Space Grotesk 400 14px #2c3520
Cell padding: 12px 16px
```

### Status Badges

```
Active / Complete: bg #e8f0e0, text #4a5638, border 1px solid #9aab7e
Pending: bg #f0ece2, text #6b5a3a, border 1px solid #c5a96a
Overdue / Error: bg #f5e8e8, text #5a2a2a, border 1px solid #c4a0a0
Info / Draft: bg #eaecf0, text #3a4550, border 1px solid #a0aab8
```

### Modals / Dialogs

```
Overlay: rgba(30,36,22,0.6) backdrop-blur(4px)
Modal bg: #f5f2ea
Border: 1px solid #c5c9b8
Border-radius: 12px
Shadow: 0 20px 60px rgba(30,36,22,0.2)
Max-width: 560px (default), 800px (large)
Header border-bottom: 1px solid #e0dbd0
```

### Alerts / Toasts

```
Success: bg #eaf2e4, border-left 3px solid #6b7d52, icon #6b7d52
Warning: bg #f5eedd, border-left 3px solid #b5956a, icon #b5956a
Error: bg #f5e8e8, border-left 3px solid #8b4a4a, icon #8b4a4a
Info: bg #eaecf0, border-left 3px solid #7a8e9e, icon #7a8e9e
Font: Space Grotesk 400 14px
```

---

## 5. Layout Principles

### Spacing Scale (8px base)
```
xs:  4px
sm:  8px
md:  16px
lg:  24px
xl:  32px
2xl: 48px
3xl: 64px
4xl: 96px
```

### Grid
- Desktop: 12-column, 24px gutters, 1280px max content width
- Dashboard: Fixed 240px sidebar + fluid content area
- Cards: 3-column grid (desktop), 2-column (tablet), 1-column (mobile)
- Page padding: 32px horizontal on desktop, 16px on mobile

### Whitespace Philosophy
- Section headers get at least 48px breathing room above
- Cards in a grid have 16px gap minimum
- Never stack two headings without body text or a divider between them
- Data tables have 12px cell padding minimum — never compress below this

---

## 6. Depth & Elevation System

| Level | Usage | Shadow |
|-------|-------|--------|
| 0 — Flat | Page background | none |
| 1 — Raised | Default cards | `0 1px 3px rgba(30,36,22,0.06)` |
| 2 — Elevated | Hover cards, dropdowns | `0 4px 16px rgba(30,36,22,0.10)` |
| 3 — Floating | Modals, popovers | `0 12px 40px rgba(30,36,22,0.15)` |
| 4 — Overlay | Drawers, full overlays | `0 24px 64px rgba(30,36,22,0.20)` |

- Shadows always use Deep Forest (`#1e2416`) as shadow color, never black
- Never use `box-shadow: none` to override — use Level 0 intentionally
- Sidebar is Level 1. Modals are Level 3. Dropdowns are Level 2.

---

## 7. Do's and Don'ts

### DO
- Use Playfair Display for all marketing/hero headings
- Use IBM Plex Mono for ALL numeric data — prices, counts, percentages
- Use Sage (#9aab7e) as the dominant surface color for hero sections
- Use Olive (#6b7d52) for interactive elements and emphasis
- Use Cream (#f5f2ea) for content-heavy pages and forms
- Animate only `transform` and `opacity` — never `height`, `width`, or `all`
- Give every clickable element hover + focus-visible + active states
- Keep the sidebar always Deep Forest (#1e2416)

### DON'T
- Don't use blue for anything — not links, not buttons, not highlights
- Don't use pure white (#ffffff) as a page background — use Cream
- Don't use gradients as primary design elements (subtle overlays on photos only)
- Don't use script fonts or decorative fonts beyond Playfair Display
- Don't mix warm and cold color temperatures
- Don't use `transition: all` — always specify the property
- Don't use default Tailwind colors (indigo, sky, violet, etc.)
- Don't put two Playfair Display elements adjacent without a Space Grotesk element between

---

## 8. Responsive Behavior

| Breakpoint | Width | Key changes |
|------------|-------|-------------|
| Mobile | < 768px | Sidebar collapses to bottom nav, single column, 16px padding |
| Tablet | 768–1024px | Sidebar hidden (hamburger), 2-col cards, 24px padding |
| Desktop | 1024–1280px | Full sidebar, 3-col cards, 32px padding |
| Wide | > 1280px | Content capped at 1280px, extra whitespace on sides |

- Minimum tap target: 44px × 44px
- Form inputs minimum height: 44px on mobile
- Tables: horizontal scroll on mobile, never collapse columns by hiding data

---

## 9. Agent Prompt Guide

### Quick color reference for prompts
- Primary surface: `#9aab7e` (Sage)
- Heading color on dark: `#e8e4d8` (Linen)
- Heading color on light: `#1e2416` (Deep Forest)
- Interactive / CTA: `#6b7d52` (Olive)
- Background (light pages): `#f5f2ea` (Cream)
- Sidebar: `#1e2416` (Deep Forest)

### Ready-to-use agent prompts
```
"Build this using the AIRE DESIGN.md. Sage sidebar, Cream content area,
Olive CTAs, Playfair Display headings, Space Grotesk body, IBM Plex Mono
for all numbers."

"This is a dashboard card. Use the Stat Card pattern from DESIGN.md —
IBM Plex Mono value, Space Grotesk label, Cream background, Olive left border."

"Style this table using DESIGN.md table spec — Space Grotesk 12px uppercase
headers, #f5f2ea header background, hover rows #f8f6f0."
```

---

## 10. AIRE-Specific Patterns

### Morning Brief
- Full-width Sage hero with Playfair Display headline in Linen
- Cards in Cream with Olive left-border accents for priority items
- Deadline items use Status Badge system (overdue = muted red, today = warning amber)

### Transaction Pipeline
- Stat bar at top: 4 IBM Plex Mono stat cards on Cream
- Status column uses Badge system
- Overdue rows get subtle `#f5e8e8` row tint

### AirSign Envelopes
- Document preview on Cream background with Deep Forest border
- Signature fields: dashed Olive border, Cream fill
- Completed signature: solid Olive border, Sage fill at 20% opacity

### Voice Command Overlay
- Deep Forest background at 95% opacity, blur(12px)
- Linen text, IBM Plex Mono for transcript
- Pulsing Sage ring animation on microphone icon

### Agent Status Indicators
- Running: Sage dot with pulse animation
- Complete: Olive checkmark
- Error: Muted red dot
- Idle: Sage/20% opacity dot
