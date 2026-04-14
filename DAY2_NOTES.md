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
- URL: `https://roam.clareityiam.net/idp/login` (Clareity IAM by CoreLogic)
- Form selectors used: `#username` / `#password` (first-hit of probe chain), submit = `button:has-text("Password Login")` (no `type="submit"` attr)
- User-Agent sniffing observed: none evident (our Chrome 130 UA accepted)
- Cookies required pre-submit: not observed — login succeeded with fresh context + automation-mask init script
- Iframe nesting: none on login form
- JS bot detection signals: no captcha, no visible challenge
- Post-login redirect behavior: `clareityiam.net/idp/login` → `clareity.net/layouts` (SSO hand-off takes ~3–8s; `domcontentloaded` fires on interstitial and is insufficient — must wait for URL host change + networkidle)

### Session / authenticated pages
- URL patterns: `https://roam.clareity.net/layouts` (dashboard shell)
- Cookie TTL: TBD (tested reuse window = 7 days; storageState persisted at `lib/cma/scrapers/sessions/mls_paragon.json`)
- Idle-timeout behavior: TBD (Day 3)
- Concurrent-session rules: TBD (Day 3)
- "You are logged in elsewhere" warnings: not observed on first login

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

**Run timestamp:** 2026-04-13T17:00:13Z (after 4 earlier attempts — see deviations log)
**Login path:** fresh (first successful run; storageState now persisted 7 days)
**Comps returned:** 0 (Day 2 scope is login + landing only — search lands Day 3)
**Distance range:** n/a
**Date range:** n/a
**Parse success %:** n/a
**Result:** **PASS**
**Landing URL:** `https://roam.clareity.net/layouts`
**Landing title:** `roam.clareity.net`
**Duration:** 18.8s (fresh login)
**Screenshot paths:**
- `lib/cma/scrapers/debug/mls_paragon_2026-04-13T17-00-13-002Z_landing_post_login.png` (PASS)
- `lib/cma/scrapers/debug/mls_paragon_2026-04-13T16-55-33-850Z_login_exception_903b339a/screenshot.png` (early "Password Login" selector miss)
- `lib/cma/scrapers/debug/mls_paragon_2026-04-13T16-56-36-977Z_login_failed_no_marker_1ca7dbc0/screenshot.png` (pre-timing-fix blank-page capture)
**Snapshot:** `lib/cma/scrapers/snapshots/mls_paragon/5834_guice_dr_baton_rouge_la.json`

**Failure detail:** `page.goto` → `net::ERR_NAME_NOT_RESOLVED` on
`https://gbrar.paragonrels.com/ParagonLS/Default.mvc/Login`. Confirmed via
`nslookup` — host does not exist in DNS. The `MLS_LOGIN_URL` configured in
`.env.agents.local` is stale or wrong. Paragon's tenanted URLs typically live
under `*.paragonrels.com`, `*.connectmls.com`, or a GBRAR-specific subdomain;
Caleb must confirm the correct URL from his current Paragon login bookmark.

**Not a selector issue** → no auto-restart. Build halted per Day 2 rules.
**Commit:** 02b6ab4 `feat(cma): Day 2 Paragon scraper (login + landing reconnaissance)`

---

## Fixes Applied / Deviations From Plan

> Any change to the base scraper or selectors that happened during Day 2 — log here so the Day 3 PropStream/RPR work doesn't re-learn the lessons.

- 2026-04-13 — `lib/cma/scrapers/mls.ts` rebuilt to extend the function-based
  helpers in `lib/cma/scrapers/base.ts` (there is no `BaseScraper` class).
  Exposes `paragonSmokeTest(subject)` returning `{ status: PASS|FAIL|HALT,
  reason, screenshotPath, ... }`. Captcha detection runs pre- and
  post-submit; captcha → `ScraperHaltError` with no bypass attempt.
- 2026-04-13 — Smoke harness blocked at DNS resolution, not at login. No
  selector restart consumed. Day 2 resumes as soon as a working
  `MLS_LOGIN_URL` lands in `.env.agents.local`.
- 2026-04-13 (second attempt) — Updated `MLS_LOGIN_URL` to
  `https://roam.claritylem.net/idp/login` per "GBRAR moved to ROAM MLS".
  Re-ran smoke → same `ERR_NAME_NOT_RESOLVED`. `nslookup roam.claritylem.net`
  and `nslookup claritylem.net` both return "Non-existent domain" (google.com
  resolves — local DNS healthy). Hostname is wrong. Must copy exact host
  from the working browser tab.
- 2026-04-13 (third attempt) — Correct URL `https://roam.clareityiam.net/idp/login`
  (note: `clareity`, not `claritylem`). Page loads. Username/password filled
  via `humanType`. Submit FAIL on first run: button text is **"Password Login"**,
  not "Log In" / "Sign In". Screenshot:
  `lib/cma/scrapers/debug/mls_paragon_2026-04-13T16-55-33-850Z_login_exception_903b339a/screenshot.png`
- 2026-04-13 (fourth attempt, selector restart used) — Commit `fbcfae0`
  expanded submit-selector chain to prioritize `button:has-text("Password Login")`.
  Click succeeded; redirected from `clareityiam.net` → `clareity.net` (IAM →
  MLS SSO hand-off). Marker check still FAILs, but the post-submit screenshot
  at `lib/cma/scrapers/debug/mls_paragon_2026-04-13T16-56-36-977Z_login_failed_no_marker_1ca7dbc0/screenshot.png`
  is blank/white — the ROAM dashboard hadn't rendered yet when the check
  fired. This is a post-login **timing** issue (the ~1.2–2.4s humanPause
  after submit is too short for the SSO redirect chain to settle), NOT a
  credentials failure.

**Halt posture (superseded):** restart budget exhausted on selector. Caleb
explicitly authorized a timing fix (separate concern from selectors) → commit
`d299bba`.

- 2026-04-13 (fifth attempt, timing fix, user-authorized) — Commit `d299bba`
  replaced fixed post-submit `humanPause` with `waitForURL(/clareity\.net/ &&
  !clareityiam.net)` + `networkidle` + 10s marker poll. `isParagonLoggedIn`
  now treats any non-IAM `clareity.net` host as a strong positive signal.
  Smoke re-run → **PASS**. Landing URL `https://roam.clareity.net/layouts`,
  title "roam.clareity.net", duration 18.8s, snapshot +
  `storageState` saved for 7-day reuse.

**Observed ROAM defenses (partial):**
- IAM host: `roam.clareityiam.net` (Clareity IAM by CoreLogic)
- Post-login redirect: `clareityiam.net` → `clareity.net/` (at minimum)
- No visible captcha on login or after submit
- Login button: `<button>Password Login</button>` (no `type="submit"`)
- No evident bot-detection UI
