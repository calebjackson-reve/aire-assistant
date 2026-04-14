# A11 — Voice + Settings + Transcript cluster baseline (2026-04-14)

Routes: `/aire/voice-analytics` (B−), `/aire/settings` (B+), `/aire/settings/email` (B), `/aire/settings/vendors` (B), `/aire/transcript-tasks` (C+).

## Current state
All auth-gated. Voice-analytics 1280 screenshot errored (Playwright timeout during compile); 375/768 captured sign-in. Transcript-tasks uses banned default-Tailwind color families.

## A-grade criteria (from brief)
- F1 token sweep across all five pages.
- Voice analytics: intent donut in sage/olive/brass/linen; LA place-name accuracy panel.
- Settings sectioned cards (Account / Integrations / Brokerage / Billing).
- Transcript tasks: status badges from F4 instead of default red/orange/blue.
- All metrics in IBM Plex Mono.

## Violations observed
- `app/aire/transcript-tasks/page.tsx:27,28,29` — `bg-red-100 text-red-700 border-red-200`, `bg-orange-100 text-orange-700 border-orange-200`, `bg-blue-100 text-blue-700 border-blue-200` (blue is BANNED globally; default Tailwind palette banned by frontend rules).
- `app/aire/transcript-tasks/page.tsx:4` — `transition-all`.
- `app/aire/settings/vendors/VendorManager.tsx:11` + `page.tsx` — `transition-all` and `bg-zinc`/`text-zinc` tokens.
- `app/aire/settings/email/page.tsx` — `transition-all`.
- `app/aire/voice-analytics/VoiceAnalyticsDashboard.tsx` — `transition-all`; hard-coded palette tokens.
- No LA place-name accuracy panel component.

## Surprises
- Transcript-tasks is the only page currently shipping banned-blue Tailwind classes that directly violate the global "no blue, no default Tailwind palette" rule.
- Voice analytics 1280 screenshot errored on capture — dev compile probably timed out; screenshot helper wrote `.note.txt` sibling.

## Severity
High. Transcript-tasks has the most explicit rule violations in the repo (banned-blue hard-coded). Settings pages contaminated with Tailwind defaults; voice-analytics needs full donut redesign.
