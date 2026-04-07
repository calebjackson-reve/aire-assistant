# AIRE Current Platform State
*Update this file after every deploy*

## LIVE ✅
- aireintel.org/ — V2 dark homepage with video hero, tool showcase, founder bio
- aireintel.org/sign-in and /sign-up — Clerk auth working
- aireintel.org/billing — Stripe price IDs set, checkout page deployed
- aireintel.org/aire — Dashboard (pipeline value, stats, morning brief, quick actions)
- aireintel.org/aire/transactions — Transaction list (search, filter, sort)
- aireintel.org/aire/transactions/new — Create transaction form
- aireintel.org/aire/transactions/[id] — Transaction detail (5 tabs: Overview, Deadlines, Documents, Comms, Contracts)
- aireintel.org/aire/contracts — Contract list + `/contracts/new` writer
- aireintel.org/aire/morning-brief — Daily brief viewer with approval gate
- aireintel.org/aire/compliance — Compliance scanner
- aireintel.org/aire/relationships — Relationship intelligence
- aireintel.org/aire/communications — Communications hub
- aireintel.org/aire/email — Email triage dashboard (missed calls, needs response, draft reply)
- aireintel.org/aire/intelligence — Market intelligence + scored properties admin table
- aireintel.org/aire/monitoring — Agent monitoring (real-time, auto-refresh)
- aireintel.org/aire/monitoring/history — Build history timeline
- aireintel.org/aire/data-health — Data health monitor (table counts, cache stats)
- aireintel.org/aire/voice-analytics — Voice pipeline analytics (timing, intents, fast-path)
- aireintel.org/airsign — Envelope dashboard
- aireintel.org/airsign/new — Create envelope
- aireintel.org/airsign/[id] — Envelope detail (signers, fields, audit log)
- aireintel.org/sign/[token] — Public signing portal (signature modal, draw/type)
- aireintel.org/aire/onboarding — 7-step onboarding checklist
- aireintel.org/aire/settings/email — Email settings (connected accounts)
- /api/voice-command/v2 — Optimized voice pipeline (classify + execute)
- /api/voice-command/v2/stream — SSE streaming voice responses
- /api/voice-command/execute — Voice action execution
- /api/contracts/write — NL + structured → PDF generation
- /api/documents/extract — Full extraction pipeline
- /api/compliance/scan — Louisiana rules engine
- /api/cron/morning-brief — Daily 6:30 AM (5 researchers + QA + Claude synthesis)
- /api/cron/deadline-alerts, tc-reminders, email-scan, data-sync, comms-scan, relationship-intelligence — 8 crons total
- AirSign Prisma schema — AirSignEnvelope, AirSignSigner, AirSignField, AirSignAuditEvent
- Stripe Subscription Gates — 13 features, 3 tiers (FREE/PRO/INVESTOR), 10 gated API routes
- LREC form classification — 95% accuracy
- VoiceCommand, MorningBrief, Contact, Transaction tables confirmed in Neon

## VERIFIED WORKING ✅ (2026-04-06)
- AirSign email delivery — Resend sends branded "Signature Requested" emails to signers
- AirSign signing flow — upload, place fields, send, sign on mobile, audit trail
- Neon DB connected (ep-muddy-cherry-am44pnvo-pooler), Prisma synced, user seeded
- All env vars configured in .env.local (Anthropic, Stripe, Resend, Blob, Twilio, Google OAuth, Clerk)
- Sign-in page branded, OAuth reduced to 6 providers
- Voice command overlay wired to /api/voice-command/v2 with browser TTS

## NEEDS ATTENTION 🟡
- Brief page design quality doesn't match AirSign — needs full redesign
- Document classifier returns "unknown" for some LREC filenames — fallback added, needs testing
- Duplicate document detection added but not yet shown in UI (warnings in API response only)
- Address mismatch warning added but not yet shown in UI
- /billing checkout — Stripe keys set but end-to-end checkout not browser-tested
- Gmail OAuth — stubs exist, full token flow incomplete
- Signing page UX — signer sees agent's field placer UI, needs simplified "fill and sign" view

## NOT BUILT YET 🔲
- Document folder system (Dotloop-style categories per transaction)
- TC checklist UI (task list with completion tracking)
- Brief page redesign (match AirSign quality)
- Calendar integration (Google Calendar API)
- Content Agent (autonomous scheduling + publishing)
- Google Contacts import (vCard route exists, needs UI)
- Whisper integration (route built, needs OPENAI_API_KEY)
- MLS address autocomplete (routes built, needs MLS API key from broker)

## NEXT PRIORITY
1. Wire MLS API key from broker meeting (2026-04-07)
2. Redesign Brief page to match AirSign quality
3. Build document folder system with TC checklist per transaction
4. Test billing checkout end-to-end
5. Complete Gmail OAuth flow

## ENV VARS (All Set)
All configured in .env.local — DATABASE_URL, ANTHROPIC_API_KEY, CLERK_SECRET_KEY, STRIPE_SECRET_KEY, RESEND_API_KEY, BLOB_READ_WRITE_TOKEN, TWILIO_*, GOOGLE_CLIENT_ID/SECRET, AIRSIGN_INTERNAL_SECRET, AIRE_WEBHOOK_SECRET

## UI Audit (2026-04-06)
Automated screenshots taken at 1440px (desktop) and 375px (mobile) across 14 routes. Screenshots saved to `ui-audit-screenshots/`.

### Critical Issues

1. **"Development mode" badge on sign-in page** — Clerk is still in dev mode. The red "Development mode" label appears at the bottom of the sign-in card on both desktop and mobile. Clerk needs to be switched to production instance before any real user sees this.

2. **12 of 14 routes redirect to sign-in** — Every `/aire/*` route (dashboard, morning-brief, email, transactions, contacts, intelligence, settings, compliance, contracts, monitoring, voice-analytics) redirects to the Clerk sign-in page. This is expected auth behavior, but it means **zero app pages are auditable without a logged-in session**. The only renderable pages for an unauthenticated visitor are:
   - `/` (homepage)
   - `/sign-in`
   - `/airsign` (public landing)

3. **Sign-in page uses wrong brand name** — Header reads "AIRE Intelligence" with "AIRE *Intel*" below it. The italic gold "Intel" is inconsistent — should either be "AIRE Intelligence" or the full product name. The gold color on "Intel" doesn't match the locked brand palette (not sage, olive, cream, linen, or deep forest).

### Homepage (`/`)

| Issue | Severity | Detail |
|-------|----------|--------|
| Mostly black void | High | Below the hero (top ~20%), the page is 80% near-black with barely visible dark gradient hills. No sections, no features, no CTAs visible. Looks broken or unfinished. |
| Footer barely visible | Medium | Footer text is nearly invisible against the dark background. Links are unreadable. |
| No brand palette | Medium | Page uses blacks/dark browns. None of the locked palette colors (sage, olive, cream, linen) appear anywhere. |
| Nav bar sparse | Low | Only "AIRE" logo left + "Log in / Sign Up" right. No product links, no pricing link, no feature showcase nav. |
| Mobile: same issues | High | Same empty dark void on 375px. Footer links wrap into illegible rows at the bottom. |

### Sign-In Page (`/sign-in`)

| Issue | Severity | Detail |
|-------|----------|--------|
| Dark gray background, not brand colors | Medium | Background is `#2a2a2a`-ish dark gray. The branded sign-in from commit 8b8c3a8 (forest deep bg, cream card, sage accents) is NOT rendering — possibly the Clerk theme override isn't applied in production. |
| Clerk card has light cream footer | Low | The bottom "Don't have an account? Sign up" area has a light pinkish-cream background that clashes with the dark page. |
| 7 OAuth providers shown | Low | Apple, Facebook, Google, LinkedIn, Microsoft, X, and a blue square (Notion?). That's a lot — consider reducing to Google + Apple + email only for cleaner UX. |
| Mobile: renders well | OK | Card is centered and readable at 375px. No overflow issues. |

### AirSign Landing (`/airsign`)

| Issue | Severity | Detail |
|-------|----------|--------|
| Uses blue/tech SaaS palette | **Critical** | Entire page is dark navy blue (#0a1628-ish) with bright blue (#3b82f6) accent buttons and card borders. This directly violates the locked brand palette. No sage, olive, or cream anywhere. |
| Generic tech startup feel | High | The design reads "cold tech SaaS" — the exact aesthetic explicitly forbidden in CLAUDE.md. Geometric node/line graphics in the hero, blue gradient, blue icon badges. |
| "Start Free" + "see a live demo" CTAs | Medium | "see a live demo" is an outlined button that links nowhere visible. |
| Feature cards have huge empty space below | Medium | 3 feature cards at top, then ~60% of the page is empty dark space before the footer. |
| Footer says "AIRE Intelligence" not AirSign | Low | Mismatch between the AirSign branding in the nav and AIRE Intelligence in the footer. |
| Mobile: readable but still wrong palette | High | Layout stacks fine at 375px but the blue palette problem persists. |

### Sign-In Page (all auth-gated routes)

Every `/aire/*` route shows the identical Clerk sign-in page. No custom 401/403 page, no "you need to sign in" messaging, no redirect-back-after-login behavior is visible. The sign-in page itself has:
- No loading spinner or skeleton — just renders the Clerk widget
- "Development mode" badge (red text, bottom of card)
- Inconsistent card styling: dark card body with light cream footer section

### Mobile Viewport Summary (375px)

| Page | Mobile Status |
|------|---------------|
| Homepage | Functional but empty — same dark void problem as desktop |
| Sign-in | Good — card fits, readable, no overflow |
| AirSign | Layout stacks correctly but wrong palette |
| All /aire/* | Redirect to sign-in (identical to desktop) |

### Brand Compliance Summary

| Check | Pass? | Notes |
|-------|-------|-------|
| Sage (#9aab7e) used as primary | NO | Not visible on any public page |
| Olive (#6b7d52) used for headings | NO | Not visible on any public page |
| Cream (#f5f2ea) used for light BGs | NO | Not visible (sign-in has a similar cream in Clerk footer only) |
| No blue allowed | **FAIL** | AirSign landing is entirely blue |
| No pure black (#000000) | **FAIL** | Homepage is near-black throughout |
| Playfair Display for headlines | Unclear | Can't verify font from screenshots but no serif headlines visible |
| Space Grotesk for body | Unclear | Body text appears to be a sans-serif but unverifiable |

### Recommendations (Priority Order)

1. **Switch Clerk to production** — Remove "Development mode" badge immediately
2. **Rebuild AirSign landing with brand palette** — Replace all blue with sage/olive/cream/deep forest
3. **Finish the homepage** — The dark void below the hero needs real content sections (features, pricing preview, testimonials, CTA)
4. **Apply branded Clerk theme** — The sign-in page should use the forest deep bg + cream card from commit 8b8c3a8
5. **Reduce OAuth providers** — 7 is overwhelming; Google + email is sufficient for real estate agents
6. **Add authenticated page screenshots** — This audit only covers 3 public pages. Need to re-run with auth cookies to audit all 14 app pages.

## BUILD HISTORY
- 2026-03-29: Initial deploy — homepage, auth, billing, AirSign dashboard, Morning Brief
- 2026-04-04 (multi-agent): Document pipeline, TC CRUD, AirSign Layer 1-3, Voice pipeline, Compliance, Contracts, Data layer, Monitoring, Comms monitor, Onboarding, Subscription gates
- 2026-04-04 (continued): Morning Brief intelligence wiring, Intelligence admin table, Voice SSE streaming, Voice analytics dashboard
- 2026-04-06: Full audit + voice command system + AirSign upgrades + transaction wizard + contract auto-fill + document intelligence + deploy to aireintel.org
