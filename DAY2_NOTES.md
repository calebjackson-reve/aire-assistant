# Day 2 — Paragon MLS Bring-Up Notes

**Account:** B24140 (sole access — never lock)
**Target address for smoke test:** 5834 Guice Dr, Baton Rouge LA
**Ground truth:** Sold Q1 2026, $160,000, 3 DOM
**Pass criteria:** ≥ 5 comps within 1.5mi, sold within 180 days, parsed successfully

---

## Operational Rules (locked 2026-04-12)

1. **Human-paced login.** 50–150ms per character on every field. Small pauses between fields (400–900ms). Never instant-submit.
2. **Session reuse 7 days.** storageState saved after first success. Skip login entirely if state file is < 7 days old and probe passes.
3. **Single-shot validation only.** No batch runs, no loops, no "let me try a few addresses." One address, one scrape, inspect the result.
4. **Two failures = stop.** Two consecutive login failures → halt, capture full-page screenshot, alert in console, wait for human intervention. Do NOT auto-retry.
5. **Captcha = full stop.** If any captcha (reCAPTCHA, hCaptcha, Cloudflare challenge, custom) appears on the login page, STOP everything. Do not attempt to solve or bypass. Alert and wait.
6. **Document every defense** observed in the sections below.

---

## Observed Paragon Defenses

> Fill this in during Day 2 run. Every quirk we see goes here. This file IS our long-term intel for keeping the account safe.

### Login page
- URL:
- Form selectors used:
- User-Agent sniffing observed:
- Cookies required pre-submit:
- Iframe nesting:
- JS bot detection signals:
- Post-login redirect behavior:

### Session / authenticated pages
- URL patterns:
- Cookie TTL:
- Idle-timeout behavior:
- Concurrent-session rules:
- "You are logged in elsewhere" warnings:

### Comp search
- Search endpoint / form URL:
- Required search params (polygon, radius, MLS class, etc.):
- Rate-limit headers observed:
- Pagination behavior:
- Result-row DOM structure:
- CSV export availability:

### Anti-bot / defensive JS
- Window fingerprints checked:
- Network calls to fraud-detection vendors:
- Mouse-movement requirements:
- Behavioral biometrics signals:

---

## Smoke Test Result

**Run timestamp:**
**Login path:** fresh | reused
**Comps returned:**
**Distance range:**
**Date range:**
**Parse success %:**
**Result:** PASS | FAIL
**Screenshot paths:**

---

## Fixes Applied / Deviations From Plan

> Any change to the base scraper or selectors that happened during Day 2 — log here so the Day 3 PropStream/RPR work doesn't re-learn the lessons.
