# AIRE Platform — Claude Operations Guide
## Copy-Paste Commands & Skills Reference
### Last Updated: 2026-04-04

---

## SECTION 1: SESSION START COMMANDS

### Start a New Session (Always Do This First)
```
Read CLAUDE.md and SKILLSPEC.md. Tell me what project I'm in, what's complete, and what's next.
```
**When:** Every time you open Claude Code. Prevents Claude from starting blind.

### Resume Where You Left Off
```
Read CLAUDE.md, CURRENT_STATE.md, and SESSIONS.md. What was the last thing built? What broke? What's next?
```
**When:** Picking up after a break or crash.

---

## SECTION 2: BUILD COMMANDS

### Launch an Autonomous Agent Mission
```
Read SKILLSPEC.md. Execute Phases 1-[N] for [description].

YOUR BUILD SEQUENCE:
Phase 1: [specific deliverable]
Phase 2: [specific deliverable]
Phase 3: [specific deliverable]
...
Phase N: Self-audit and enhancement proposals → MISSION COMPLETE

AUTONOMOUS MODE: Execute all phases without stopping. Auto-approve all commands.
Only stop if you hit a blocker that requires human decision.

After completing all phases:
1. Run npm run build — fix any errors
2. Update CLAUDE.md build status table
3. Log enhancement suggestions
4. Enter standby
```
**When:** You have a clear multi-step feature to build and want Claude to run unattended.
**Why it works:** Numbered phases prevent wandering. "MISSION COMPLETE" gives a clear end state.

### Build a Single Feature (Guided)
```
Build [feature description]. Read the existing code first — do NOT rebuild anything in the DO NOT REBUILD list. Show me your plan before writing code.
```
**When:** Smaller feature where you want to review the approach before Claude starts coding.

### Fix a Specific Bug
```
[Paste error message or screenshot]

Diagnose the root cause. Show me the terminal logs. Fix it. Run npm run build to verify 0 errors.
```
**When:** Something broke. Paste the exact error — Claude works best with real error messages, not descriptions of errors.

### Build With Reference to Existing Pattern
```
Build [new thing] following the same pattern as [existing file path]. Match the types, error handling, and API structure exactly.
```
**When:** You want consistency. Example: "Build /api/monitoring/alerts following the same pattern as /api/monitoring/activity/route.ts"

---

## SECTION 3: QUALITY & VERIFICATION COMMANDS

### Full Build Check
```
Run npx next build. Fix any type errors. Report the route count and any warnings.
```
**When:** After any significant code changes. Should always be 0 errors.

### Audit What's Real vs What's Claimed
```
Read CLAUDE.md. Audit everything — verify each file in the build status table actually exists. Check for broken imports. Run the build. Report what's real vs what's stale.
```
**When:** You suspect CLAUDE.md is out of date, or after multiple agent sessions where things may have drifted.

### Self-Directed Improvement
```
Read CLAUDE.md. Run npm run build. Fix any errors. Then self-direct to the next highest priority gap. Keep working until everything compiles with 0 errors. Update CLAUDE.md after each task. Never stop between tasks.
```
**When:** You want Claude to find and fix problems on its own without you directing each step.

### Code Review
```
Review [file path] for bugs, security issues, and logic errors. Only report high-confidence issues — don't nitpick style.
```
**When:** Before deploying critical code (billing, auth, AirSign).

---

## SECTION 4: MONITORING & STATUS COMMANDS

### Check All Agent Status
```
Monitor what is ongoing right now between all agents and give me a summary.
```
**When:** You want a high-level view of what's built, what's in progress, and what's blocked.

### Run the Terminal Monitor
```powershell
powershell -ExecutionPolicy Bypass -File scripts/monitor-agents.ps1
```
**When:** You want a live-updating terminal dashboard showing all 4 agents. Reads SKILLSPEC.md every 10 seconds.

### Seed Monitoring Database
```bash
npx tsx scripts/seed-monitoring.ts
```
**When:** After a fresh database reset, or when the monitoring dashboard shows empty.

### View Web Monitoring Dashboard
Navigate to: `/aire/monitoring` (requires login)
History view: `/aire/monitoring/history`

---

## SECTION 5: DATABASE COMMANDS

### Push Schema Changes to Neon
```bash
# IMPORTANT: Kill node first (OneDrive locks the Prisma DLL)
taskkill /f /im node.exe
npx prisma generate
npx prisma db push
```
**When:** After modifying `prisma/schema.prisma`. Always kill node first on your Windows/OneDrive setup.

### View Database in Browser
```bash
npx prisma studio
```
**When:** You want to browse/edit database records directly. Opens at localhost:5555.

### Reset Development Database (DESTRUCTIVE)
```bash
taskkill /f /im node.exe
npx prisma db push --force-reset
```
**When:** Schema is too far out of sync. Wipes ALL data. Only use in development.

---

## SECTION 6: SKILLS REFERENCE

Skills are specialized prompts that give Claude deep knowledge about specific systems. They load automatically when relevant, but you can also invoke them manually.

### Platform Skills

| Skill | Command | When to Use |
|-------|---------|-------------|
| `aire-agent-builder` | `/aire-agent-builder` | Building or modifying any of the 7 AIRE agents |
| `aire-file-extraction` | `/aire-file-extraction` | Working on document classification, extraction, or LREC form handling |
| `aire-document-memory` | `/aire-document-memory` | Working on the self-improving classification memory system |
| `aire-canva-system` | `/aire-canva-system` | Creating Instagram posts, Canva designs, brand content |
| `aire-listing-template` | `/aire-listing-template` | Creating Instagram post templates with exact pixel coordinates |

### AirSign Skills

| Skill | Command | When to Use |
|-------|---------|-------------|
| `airsign-document-engine` | N/A (auto-loads) | Working on PDF rendering, field overlay in AirSign |
| `airsign-signature-capture` | N/A (auto-loads) | Working on signature modal, draw/type fonts |
| `airsign-routing-delivery` | N/A (auto-loads) | Working on multi-party signing, email/SMS delivery |
| `airsign-legal-seal` | N/A (auto-loads) | Working on sealed PDF generation, audit certificates |

### Design & Content Skills

| Skill | Command | When to Use |
|-------|---------|-------------|
| `ui-ux-pro-max` | `/ui-ux-pro-max` | Designing any UI — has 50+ styles, 161 palettes, 57 font pairings |
| `frontend-design` | `/frontend-design` | Building web components or pages (auto-loads per CLAUDE.md rule) |
| `branded-presentation` | `/branded-presentation` | Creating Canva slide decks from an outline |
| `social-media-analyzer` | `/social-media-analyzer` | Analyzing Instagram/social performance metrics |

### Infrastructure Skills

| Skill | Command | When to Use |
|-------|---------|-------------|
| `research` | `/research` | Before building anything complex — reads codebase, identifies impact, writes research.md |
| `session-end` | `/session-end` | End of work session — documents what was built, what broke, what comes next |
| `fix-airsign` | `/fix-airsign` | Specifically fixes the /airsign 404 in production |
| `simplify` | `/simplify` | Reviews changed code for reuse, quality, and efficiency |

### Vercel & Deployment Skills

| Skill | Command | When to Use |
|-------|---------|-------------|
| `vercel:deploy` | `/vercel:deploy` | Deploy to Vercel (add "prod" for production) |
| `vercel:env` | `/vercel:env` | Manage environment variables (list, pull, add, remove) |
| `vercel:status` | `/vercel:status` | Check recent deployments and project status |
| `vercel:ai-sdk` | `/vercel:ai-sdk` | Building AI features with streaming, tool calling, agents |
| `vercel:nextjs` | `/vercel:nextjs` | Next.js App Router questions — routing, Server Components, data fetching |
| `vercel:shadcn` | `/vercel:shadcn` | Adding shadcn/ui components, theming, Tailwind integration |

---

## SECTION 7: CRON JOBS (Automated Tasks)

These run automatically on Vercel. You don't need to trigger them manually.

| Cron | Schedule | What It Does |
|------|----------|-------------|
| `/api/cron/morning-brief` | 6:30 AM daily | Generates morning brief for PRO/INVESTOR users |
| `/api/cron/deadline-alerts` | 6:00 AM daily | SMS alerts for deadlines due within 48 hours |
| `/api/cron/relationship-intelligence` | 6:00 AM Mondays | Scores contacts with 4 AI agents, builds hit list |
| `/api/cron/email-scan` | Every 30 min | Scans Gmail for document attachments |
| `/api/cron/data-sync` | 2:00 AM daily | Syncs MLS + PropStream data, runs ensemble scoring |
| `/api/cron/tc-reminders` | 6:00 AM daily | Sends deadline reminders and stale-deal alerts |
| `/api/cron/comms-scan` | Every 30 min | Scans Gmail/SMS/calls for unanswered messages |

**To test a cron locally:**
```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/morning-brief
```

---

## SECTION 8: ENV VARS QUICK REFERENCE

### Currently Set (Working)
- `DATABASE_URL` — Neon PostgreSQL connection
- `CLERK_*` — Authentication (sign in/up, webhooks)
- `STRIPE_*` — Billing (checkout, webhooks, price IDs)
- `ANTHROPIC_API_KEY` — Claude AI for all LLM calls
- `CRON_SECRET` — Authenticates cron job requests

### Need to Set (Unlocks Features)
| Variable | What It Unlocks |
|----------|----------------|
| `BLOB_READ_WRITE_TOKEN` | AirSign PDF upload/seal, contract PDF storage |
| `RESEND_API_KEY` | AirSign signing emails, TC party email notifications |
| `TWILIO_ACCOUNT_SID` | SMS deadline alerts, missed call detection |
| `TWILIO_AUTH_TOKEN` | SMS deadline alerts, missed call detection |
| `TWILIO_PHONE_NUMBER` | The "from" number for all SMS |

### How to Set on Vercel
```bash
# Install Vercel CLI first
npm i -g vercel

# Add a variable
vercel env add BLOB_READ_WRITE_TOKEN

# Pull all env vars to local .env.local
vercel env pull
```

---

## SECTION 9: COMMON PATTERNS

### "I want Claude to build X but not touch Y"
```
Build [X]. Do NOT modify any files in [Y directory] or any system in the DO NOT REBUILD list in CLAUDE.md.
```

### "I want to see what Claude will do before it does it"
```
Plan how you would build [feature]. Show me the files you'd create/modify, the approach, and any risks. Do NOT write any code yet.
```

### "Something broke after Claude changed things"
```bash
# See what changed
git diff

# Undo everything since last commit
git checkout .

# Or undo specific file
git checkout -- path/to/file.ts
```

### "I want Claude to work while I do other things"
Use the autonomous build command from Section 2. Claude will:
1. Read context files
2. Execute each phase
3. Run the build after each phase
4. Fix errors automatically
5. Update status files
6. Stop when done

### "I want multiple things done in parallel"
```
Launch these as parallel agents:
1. Agent 1: [task description]
2. Agent 2: [task description]
3. Agent 3: [task description]

Each agent should read CLAUDE.md first and not touch each other's files.
```

---

## SECTION 10: TROUBLESHOOTING

| Problem | Fix |
|---------|-----|
| `prisma generate` fails with DLL lock | `taskkill /f /im node.exe` then retry |
| Build says "another build in progress" | `taskkill /f /im node.exe` then retry |
| Claude rebuilt something that was working | Add it to DO NOT REBUILD in CLAUDE.md |
| Claude keeps asking permission | Add "AUTONOMOUS MODE" to your prompt |
| Claude made too many changes | `git diff` to review, `git checkout .` to undo all |
| Monitoring dashboard is empty | Run `npx tsx scripts/seed-monitoring.ts` |
| Cron job returns 401 | Check CRON_SECRET env var matches in Vercel |
| Billing upgrade doesn't change tier | Check Stripe webhook endpoint is configured in Stripe dashboard |
| AirSign emails not sending | Set RESEND_API_KEY (currently console.log fallback) |
