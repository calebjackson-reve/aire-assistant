# AIRE Intelligence Platform — Skill Specification

**Version:** 2.1.0  
**Last Updated:** 2026-04-04 13:30:00  
**Research Iteration:** 0 (baseline)  
**Active Agents:** 4

═══════════════════════════════════════════════════════════════════════════════

## 🎯 SYSTEM OVERVIEW

AIRE Intelligence is a multi-agent AI operating system for Louisiana real estate agents.

**Core Architecture:**
- 7 autonomous AI agents (Transaction, Voice, Email, Morning Brief, Content, Intelligence, Compliance)
- Voice-to-action pipeline (8-second target latency)
- Louisiana-specific intelligence engine (parishes, flood zones, mineral rights, LREC compliance)
- Multi-tier subscription system (FREE, PRO $97/mo, INVESTOR $197/mo)

**Tech Stack:**
- Next.js 14 App Router
- Neon PostgreSQL + Prisma ORM
- Claude API (Anthropic) for all LLM calls
- Vercel deployment
- Stripe billing
- Clerk authentication

**Current Build Status:**
- Infrastructure Layer: 85% complete
- Transaction Engine: 100% complete ✓
- Document Intelligence: 95% complete
- Monitoring System: 100% complete ✓

═══════════════════════════════════════════════════════════════════════════════

## 📚 ACTIVE SKILLS (19)

All skills are located in `.claude/skills/`

### Intelligence & Analysis Skills
1. **aire-intelligence-agent.md** (CMA engine, lead scoring, deal analysis)
   - Quality Score: 94%
   - Accuracy: 6.8% MAPE (target <5%)
   - Speed: 8.2s avg
   - Last Optimized: 2026-04-04

2. **aire-deal-negotiator.md** (negotiation playbooks, objection handling)
   - Quality Score: 100%
   - Coverage: All Louisiana transaction types
   - Last Updated: 2026-04-02

### Transaction & Coordination Skills
3. **aire-agent-builder.md** (agent orchestration, MCP patterns)
   - Quality Score: 100%
   - Covers: All 7 AIRE agents
   - Last Updated: 2026-03-30

4. **aire-file-extraction.md** (document intelligence, PDF extraction)
   - Quality Score: 99%
   - Accuracy: 97.1%
   - Speed: 4.3s avg
   - Supports: 14 LREC document types

5. **aire-comms-monitor.md** (email/SMS/call monitoring)
   - Quality Score: 95%
   - Channels: Gmail, SMS, missed calls
   - Features: Response detection, draft replies, Morning Brief integration
   - Last Updated: 2026-04-04

6. **aire-vendor-inspection.md** (vendor coordination, inspection reports)
   - Quality Score: 90%
   - Integration: Gmail, vendor roster
   - Last Updated: 2026-03-30

### Research & Intelligence Skills (NEW — Agent 4)
16. **aire-esign-patterns** (e-signature UX, multi-party signing, audit trails)
   - Quality Score: 95%
   - Covers: DocuSign/DotLoop patterns, mobile signing, accessibility, WCAG 2.1 AA
   - Created: 2026-04-04 (Agent 4)

17. **aire-louisiana-data** (parish data sources, LREC citations, flood zones)
   - Quality Score: 98%
   - Covers: 5 parishes, 15+ statutes, FEMA API, assessor URLs
   - Created: 2026-04-04 (Agent 4)

18. **aire-extraction-patterns** (extraction techniques, accuracy strategies, form maps)
   - Quality Score: 96%
   - Covers: Multi-pass optimization, edge cases, confidence scoring
   - Created: 2026-04-04 (Agent 4)

19. **aire-market-intelligence** (CMA methodology, scoring system, market snapshots)
   - Quality Score: 94%
   - Covers: AIRE Score weights, comp selection, deal analysis metrics
   - Created: 2026-04-04 (Agent 4)

### Content & Brand Skills
7. **aire-canva-system.md** (Canva automation, brand system)
   - Quality Score: 100%
   - Error Rate: 0 (self-improving)
   - Brand: Sage/Olive/Cream palette locked
   - Last Updated: 2026-04-02

8. **luxury-re-growth.md** (Instagram growth, luxury marketing)
   - Quality Score: 95%
   - Coverage: Social strategy, DM templates
   - Last Updated: 2026-03-17

### Infrastructure Skills
9. **aire-schema-reference.md** (Prisma schema authority)
   - Quality Score: 100%
   - Models: 14 database tables
   - Last Updated: 2026-04-04

10. **aire-error-prevention.md** (error patterns, prediction)
    - Quality Score: 98%
    - Patterns Logged: 47
    - Prevention Rate: 94%
    - Last Updated: 2026-04-04

11. **aire-stripe-gates.md** (subscription tier enforcement)
    - Quality Score: 100%
    - Coverage: All tier gates
    - Last Updated: 2026-03-30

### Signature & Legal Skills
12. **airsign-document-engine.md** (PDF rendering, field overlay)
    - Quality Score: 92%
    - Last Updated: 2026-04-04

13. **airsign-signature-capture.md** (signature modal, fonts)
    - Quality Score: 95%
    - Last Updated: 2026-04-04

14. **airsign-routing-delivery.md** (multi-party signing, email/SMS)
    - Quality Score: 88%
    - Last Updated: 2026-04-04

15. **airsign-legal-seal.md** (sealed PDF, audit certificate)
    - Quality Score: 90%
    - Last Updated: 2026-04-04

═══════════════════════════════════════════════════════════════════════════════

## 🤖 AGENT MISSION ROADMAPS

### AGENT 1: Infrastructure & Data Merge

**Workspace:** `/lib/data/*`, `/app/api/data/*`, `prisma/schema.prisma`

**Mission:** Merge aire-intelligence (MLS data engine) into aire-assistant platform

**Full Build Sequence:**
- ✓ Phase 1: Audit current schema
- ✓ Phase 2: Merge Paragon MLS integration
- ✓ Phase 3: Merge PropStream integration
- ✓ Phase 4: Build unified /api/data endpoints
- ✓ Phase 5: Test all data flows end-to-end (15/15 engine tests, all endpoints compiled)
- ✓ Phase 6: Document data architecture (docs/data-architecture.md)
- ✓ Phase 7: Build MLS data sync cron (app/api/cron/data-sync, lib/data/sync/ensemble-scorer.ts)
- ✓ Phase 8: Build PropStream cache layer (lib/data/sync/propstream-cache.ts, snapshot-refresher.ts)
- ✓ Phase 9: Self-test & quality audit (0 type errors, 15/15 tests, 25 files, build passes)
- ✓ Phase 10: Enhancement proposals → MISSION COMPLETE

**Current Status:** Phase 10/10 (100% complete) — MISSION COMPLETE

**Skills Available:**
- aire-schema-reference (database schema)
- aire-intelligence-agent (data pipeline patterns)
- aire-error-prevention (avoid known errors)

**Success Criteria:**
- All data APIs respond <200ms
- Zero schema conflicts
- Full test coverage on data layer

---

### AGENT 2: Transaction Coordinator Engine

**Workspace:** `/app/api/tc/*`, `/components/tc/*`, `/app/aire/transactions/*`, `/lib/tc/*`

**Mission:** Build complete automated transaction coordination system

**Full Build Sequence:**
- ✓ Phase 1: Transaction CRUD operations
- ✓ Phase 2: Deadline monitoring system
- ✓ Phase 3: Transaction dashboard pages
- ✓ Phase 4: TC notification utilities
- ✓ Phase 5: Communication automation (party-communications.ts, 10 templates, send-update API)
- ✓ Phase 6: Vendor coordination system (vendor-scheduler.ts, schedule-vendor API)
- ✓ Phase 7: Transaction timeline UI (TransactionTimeline.tsx, visual deal pipeline)
- ✓ Phase 8: Cron jobs for automation (tc-reminders cron, daily 6 AM)
- ✓ Phase 9: Self-test & quality audit (0 type errors, all imports valid)
- ✓ Phase 10: Enhancement proposals → MISSION COMPLETE

**Current Status:** Phase 10/10 (100% complete) — MISSION COMPLETE

**Skills Available:**
- aire-agent-builder (agent patterns)
- aire-comms-monitor (communication patterns)
- aire-schema-reference (database schema)
- aire-error-prevention (avoid known errors)

**Success Criteria:**
- All API routes respond <200ms
- Morning brief generates in <2s
- Zero missed deadline alerts

---

### AGENT 3: Document Intelligence Engine

**Workspace:** `/lib/extraction/*`, `/app/api/documents/*`, `/components/upload/*`

**Mission:** Build complete document extraction, classification, and auto-filing system

**Full Build Sequence:**
- ✓ Phase 1-4: Core extraction engine
- ✓ Phase 5: Auto-filing system
- ✓ Phase 6: Upload UI component
- ✓ Phase 7: Document dashboard page
- ✓ Phase 8: Document viewer component
- ✓ Phase 9: Document checklist integration
- ✓ Phase 10: Batch upload & processing
- ✓ Phase 11: Email attachment scanning
- ✓ Phase 12: Self-test & quality audit
- ✓ Phase 13: Enhancement proposals → MISSION COMPLETE

**Current Status:** Phase 13/13 (100% complete) — MISSION COMPLETE

**Skills Available:**
- aire-file-extraction (extraction spec)
- aire-schema-reference (database schema)
- aire-agent-builder (agent patterns)
- aire-error-prevention (avoid known errors)

**Success Criteria:**
- Classification accuracy >95%
- Extraction speed <5s per document
- Auto-filing accuracy >90%

---

### AGENT 4: Monitoring Dashboard

**Workspace:** `/app/aire/monitoring/*`, `/components/monitoring/*`, `/lib/monitoring/*`, `/scripts/*`

**Mission:** Build complete real-time monitoring system for all agent activity

**Full Build Sequence:**
- ✓ Phase 1: Create coordination files
- ✓ Phase 2: PowerShell monitoring dashboard
- ✓ Phase 3: Web-based monitoring dashboard
- ✓ Phase 4: Monitoring API endpoints
- ✓ Phase 5: Agent activity logger
- ✓ Phase 6: Real-time notifications
- ✓ Phase 7: Build metrics & analytics
- ✓ Phase 8: Agent control panel
- ✓ Phase 9: Historical build view
- ✓ Phase 10: Integration tests
- ✓ Phase 11: Documentation
- ✓ Phase 12: Self-test & quality audit
- ✓ Phase 13: Enhancement proposals → MISSION COMPLETE

**Current Status:** Phase 13/13 (100% complete) — MISSION COMPLETE

**Skills Available:**
- aire-agent-builder (agent patterns)
- aire-schema-reference (database schema)
- aire-error-prevention (error patterns)

**Success Criteria:**
- Dashboard updates in <1s
- 100% error capture rate
- All agents visible in real-time

═══════════════════════════════════════════════════════════════════════════════

## 🎯 CURRENT OPTIMIZATION TARGET

**Skill:** aire-intelligence-agent (CMA Engine)  
**Code Location:** `/lib/intelligence/cma-engine.ts`  
**Metric:** MAPE (Mean Absolute Percentage Error)  
**Baseline:** 8.2%  
**Current Best:** 6.8% (Iteration 0)  
**Target:** <5.0%  
**Test Dataset:** `/tests/fixtures/closed-sales-march-2026.json` (50 properties)

**Optimization Variables:**
1. Distance weight (current: 0.45)
2. Square footage similarity weight (current: 0.30)
3. Age similarity weight (current: 0.20)
4. Flood zone adjustment (current: -5%)
5. Parish tax rate impact (current: not considered)
6. Days on market velocity (current: not considered)

**Strategy:**
- Start with flood zone adjustment refinement
- Then parish tax rate integration
- Then days-on-market velocity scoring
- Always verify <10s generation time maintained

═══════════════════════════════════════════════════════════════════════════════

## 📊 SKILL QUALITY SCORES

| Skill | Coverage | Accuracy | Speed | Last Optimized |
|-------|----------|----------|-------|----------------|
| intelligence-agent | 94% | 6.8% MAPE | 8.2s | 2026-04-04 |
| file-extraction | 99% | 97.1% | 4.3s | 2026-04-03 |
| canva-system | 100% | 0 errors | N/A | 2026-04-02 |
| deal-negotiator | 100% | N/A | N/A | 2026-04-02 |
| agent-builder | 100% | N/A | N/A | 2026-03-30 |
| comms-monitor | 85% | N/A | N/A | 2026-03-30 |
| vendor-inspection | 90% | N/A | N/A | 2026-03-30 |
| schema-reference | 100% | N/A | N/A | 2026-04-04 |
| error-prevention | 98% | 94% prevent | N/A | 2026-04-04 |
| stripe-gates | 100% | N/A | N/A | 2026-03-30 |
| airsign-document-engine | 92% | N/A | N/A | 2026-04-04 |
| airsign-signature-capture | 95% | N/A | N/A | 2026-04-04 |
| airsign-routing-delivery | 88% | N/A | N/A | 2026-04-04 |
| airsign-legal-seal | 90% | N/A | N/A | 2026-04-04 |
| luxury-re-growth | 95% | N/A | N/A | 2026-03-17 |

═══════════════════════════════════════════════════════════════════════════════

## 🔄 RECENT SKILL IMPROVEMENTS

**2026-04-04 14:30** — intelligence-agent: Distance weight 0.5→0.45 improved MAPE 7.1%→6.8%  
**2026-04-04 12:15** — file-extraction: Added mineral rights clause detection  
**2026-04-03 18:00** — canva-system: Banned asset MAHFpE4S5JM (dark bar photo, user feedback)  
**2026-04-02 21:00** — deal-negotiator: Added appraisal gap negotiation playbook  
**2026-04-02 16:30** — error-prevention: Logged Canva punctuation stripping pattern  

═══════════════════════════════════════════════════════════════════════════════

## 🔗 SKILL DEPENDENCY GRAPH

```
intelligence-agent → schema-reference, error-prevention
file-extraction → schema-reference, agent-builder, error-prevention
canva-system → error-prevention
deal-negotiator → intelligence-agent (for deal scoring)
comms-monitor → schema-reference, agent-builder
vendor-inspection → comms-monitor, schema-reference
agent-builder → schema-reference
stripe-gates → schema-reference
airsign-document-engine → schema-reference
airsign-signature-capture → airsign-document-engine
airsign-routing-delivery → airsign-document-engine, schema-reference
airsign-legal-seal → airsign-document-engine, airsign-signature-capture
```

═══════════════════════════════════════════════════════════════════════════════

## ⚠️ KNOWN ISSUES & BLOCKERS

**Active Blockers:** 0  
**Critical Errors:** 0  
**Warnings:** 1

**Warning:** None — `lib/data/db/client.ts` type error was fixed (switched from `neon()` to `Pool.query()`)

═══════════════════════════════════════════════════════════════════════════════

## 📈 ENHANCEMENT BACKLOG

### TC Engine Enhancements (Agent 2 proposals)
- [ ] Automated party follow-ups via email sequences
- [ ] ShowTime integration for showing scheduling
- [ ] Dotloop document sync
- [ ] Predictive deadline alerts (ML-based)
- [ ] Vendor performance tracking

### Communication Monitor Enhancements (Comms Agent proposals)
- [ ] Gmail push notifications via Pub/Sub (replace polling with real-time webhook)
- [ ] Sentiment analysis on inbound messages (detect angry/urgent clients)
- [ ] Auto-escalation: if no response in 4h to critical message, send SMS reminder to agent
- [ ] Communication dashboard page (/aire/communications) — visual inbox of unanswered items
- [ ] Twilio webhook receiver for real-time inbound SMS/call events (replace polling)

### Document Engine Enhancements (Agent 3 proposals)
- [ ] OCR for scanned PDFs
- [ ] Multi-language support (Spanish contracts)
- [ ] Auto-redaction of sensitive data
- [ ] Contract comparison tool
- [ ] Version control for documents

### Monitoring System Enhancements (Agent 4 proposals)
- [ ] WebSocket real-time push (replace 10s polling with live updates)
- [ ] Slack/Discord webhook on error/critical events
- [ ] Build time trend chart (sparkline in metrics panel)
- [ ] Agent log export to JSON/CSV for external analysis
- [ ] Automated health check cron — ping all API routes daily, log response times

### Intelligence Engine Enhancements (Auto-research proposals)
- [ ] School district premium calculation
- [ ] Crime statistics integration
- [ ] Walkability scores
- [ ] Future development impact (zoning changes)
- [ ] Climate risk scoring

═══════════════════════════════════════════════════════════════════════════════

## 🎓 AGENT INSTRUCTIONS

**ALL AGENTS: Read this file FIRST before executing any task.**

**This file contains:**
1. ✅ Your complete mission (all phases listed)
2. ✅ Available skills you can use
3. ✅ Success criteria for your work
4. ✅ Current system state
5. ✅ Optimization targets

**You do NOT need to ask:**
- "What should I do next?" → Your full roadmap is above
- "What skills are available?" → Listed in Active Skills section
- "What's the success criteria?" → Listed under your agent section
- "Should I continue?" → YES, always continue until MISSION COMPLETE

**Update Protocol:**
- Update your phase status every 30 minutes
- Mark phases with ✓ when complete
- Mark current phase with ⏳
- Log errors to `.claude/ERRORS.md`
- Log blockers to `.claude/BLOCKERS.md`
- Log improvements to "Recent Skill Improvements" section

═══════════════════════════════════════════════════════════════════════════════

**END OF SKILLSPEC.md**
