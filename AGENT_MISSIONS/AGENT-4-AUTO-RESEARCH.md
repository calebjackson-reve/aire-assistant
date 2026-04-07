# AGENT 4 MISSION: Auto-Research & Self-Improvement Engine
**Priority:** STRATEGIC — Makes every other tool best-in-class over time.
**Goal:** Autonomous research agent that continuously scans the web, GitHub, documentation, and public data to find skills, patterns, datasets, and techniques that make AirSign, TC Assistant, and Document Pipeline smarter, faster, and more accurate than any competitor.

---

## CONTEXT — READ BEFORE DOING ANYTHING

You are working in: `c:\Users\cjjfr\OneDrive\AIRE ALL FILES\aire-assistant\`
Stack: Next.js 14, Prisma, Neon PostgreSQL, Clerk auth, Vercel, Claude API

### The Product We're Building
AIRE is a real estate intelligence OS for Louisiana agents. It has:
- **AirSign** — electronic signatures (like DocuSign but simpler)
- **TC Assistant** — transaction coordinator (manages deals, deadlines, documents)
- **Document Pipeline** — upload PDF → auto-classify → extract all fields → auto-file
- **Morning Brief** — daily AI-generated summary of what needs attention
- **Compliance Scanner** — checks deals against Louisiana real estate law
- **Voice Commands** — speak to execute actions
- **Market Intelligence** — property scoring, CMA, deal analysis

### What Already Exists
- `lib/data/` — 6 data engines, scoring, backtesting
- `lib/document-memory.ts` — Learning system for document classification
- `lib/louisiana-rules-engine.ts` — Compliance rules
- `.claude/skills/` — 15 custom skills for Claude Code
- `lib/agents/morning-brief/researchers/` — 5 researcher agents
- Intelligence tables in Neon DB

### Your Role
You are the LEARNING LAYER. You don't build features — you find knowledge, patterns, and data that make the features built by Agents 1-3 dramatically better. You are the competitive moat.

---

## YOUR MISSION — 5 PHASES

### PHASE 1: COMPETITIVE INTELLIGENCE — WHAT ARE THE BEST DOING?
**Time estimate: 2 hours**

Research every major competitor and document exactly what they do better than us, so we can close the gap.

1. **E-Signature Platforms (for AirSign):**
   
   Research and document in `AGENT_MISSIONS/research/esign-intelligence.md`:
   
   - **DocuSign** — What makes their signing UX best-in-class? Specific features:
     - How do they handle multi-party signing order (sequential vs parallel)?
     - How do they do mobile signing? What's their mobile UX?
     - What accessibility features do they have?
     - How do they handle declined signatures?
     - What does their audit certificate look like?
     - API documentation patterns
   
   - **DotLoop** (used heavily in real estate) — What real estate-specific features do they have?
     - Transaction room concept
     - How they integrate with MLS
     - Document template library
     - How agents share with clients
   
   - **Authentisign** — What do they do differently?
   
   - **Open source signing tools on GitHub:**
     - Search: "electronic signature open source" "pdf signing" "document signing react"
     - Find: signature capture libraries, PDF annotation tools, audit trail implementations
     - Log the best repos with star counts and what we could learn from them

   Output: A ranked list of features we should steal/improve, with links to implementations.

2. **Transaction Management Platforms (for TC Assistant):**
   
   Research and document in `AGENT_MISSIONS/research/tc-intelligence.md`:
   
   - **Dotloop** — transaction management features
   - **SkySlope** — how they handle document management + compliance
   - **Brokermint** — back-office automation
   - **Open source project management tools** — what UX patterns work for task/deadline management?
     - Search GitHub: "real estate transaction management" "deal pipeline" "deadline tracker react"
   
   Output: UX patterns, workflow automations, and features our TC should have.

3. **Document Extraction (for Document Pipeline):**
   
   Research and document in `AGENT_MISSIONS/research/extraction-intelligence.md`:
   
   - **How do the best PDF extraction tools work?**
     - Search GitHub: "pdf extraction ai" "document intelligence" "form extraction llm"
     - Look at: LlamaIndex document parsing, Unstructured.io, AWS Textract patterns
     - What accuracy rates do they achieve?
   
   - **LREC form specifications:**
     - Search for official LREC form PDFs, field specifications
     - Document the exact structure of each form type
     - Find any publicly available LREC form samples for testing
   
   Output: Extraction techniques, accuracy benchmarks, and form specs we can use.

**DONE WHEN:** 3 research documents created with actionable intelligence. Each has specific things we should implement.

### PHASE 2: GITHUB SKILL MINING — FIND CODE THAT MAKES US BETTER
**Time estimate: 2 hours**

Systematically search GitHub for libraries, patterns, and code that would level up each tool.

1. **Create `AGENT_MISSIONS/research/github-finds.md`:**

   For each category, search GitHub and npm, evaluate, and document:

   **PDF & Signature Libraries:**
   ```
   Search terms:
   - "pdf-lib signature" — advanced pdf-lib patterns
   - "react pdf annotation" — PDF annotation components
   - "signature pad react" — better signature capture
   - "pdf form filler" — filling official forms programmatically
   - "pdf template engine" — generating PDFs from templates
   ```
   For each find: repo URL, stars, last updated, what we'd use it for, effort to integrate.

   **Document Intelligence:**
   ```
   Search terms:
   - "document classification llm" — AI classification patterns
   - "ocr react" — client-side OCR for scanned documents
   - "pdf text extraction javascript" — better text extraction
   - "form recognition ai" — form field detection
   - "document memory" OR "few-shot document" — learning from corrections
   ```

   **Real Estate Specific:**
   ```
   Search terms:
   - "real estate api" — any public real estate data APIs
   - "mls integration" — MLS data access patterns
   - "property data api" — property information services
   - "louisiana real estate" — LA-specific tools
   - "flood zone api" OR "fema flood" — flood zone lookup
   - "parish assessor api" — tax/assessment data
   ```

   **Transaction & Workflow:**
   ```
   Search terms:
   - "state machine typescript" — better workflow patterns
   - "deadline scheduler" — deadline/reminder systems
   - "notification system react" — in-app notification patterns
   - "email template react" — beautiful transactional emails
   ```

   **AI & Intelligence:**
   ```
   Search terms:
   - "claude api patterns" — advanced Claude usage
   - "ai agent patterns typescript" — agent architectures
   - "retrieval augmented generation" — RAG for our knowledge base
   - "cma real estate ai" — AI-powered comparative market analysis
   ```

2. **For each promising find, evaluate:**
   - Does it solve a real problem we have? (reference the specific tool)
   - How hard to integrate? (1=drop-in, 5=major refactor)
   - Is it maintained? (last commit, open issues)
   - License compatible? (MIT/Apache = yes, GPL = careful)
   - Would it replace something we built or enhance it?

3. **Create a PRIORITY LIST:**
   Rank finds by: (impact on user experience) × (ease of integration)
   Top 10 should be things we can integrate in 1-2 sessions each.

**DONE WHEN:** github-finds.md has 30+ evaluated repos/libraries with top 10 prioritized for integration.

### PHASE 3: DATA SOURCES — WHAT REAL DATA CAN WE FEED THE SYSTEM?
**Time estimate: 1.5 hours**

Find every source of real data we can plug into AIRE to make it smarter.

1. **Create `AGENT_MISSIONS/research/data-sources.md`:**

   **Public Real Estate Data APIs:**
   - ATTOM Data API — property data, AVM, flood, schools
   - Zillow API (or alternatives after deprecation)
   - Realtor.com API
   - Redfin data downloads
   - Census Bureau (demographics, housing stats)
   - FEMA flood map API (National Flood Hazard Layer)
   - Google Maps/Places API (school ratings, commute times, walkability)
   
   For each: URL, pricing (free tier?), what data we get, how to integrate.

   **Louisiana-Specific Data:**
   - GBRAR MLS (Greater Baton Rouge Association of Realtors) — how to access
   - Louisiana Tax Commission — parish assessment data
   - Louisiana Secretary of State — entity lookup
   - Parish assessor websites:
     - ebrpa.org (East Baton Rouge)
     - ascensionassessor.com
     - livingstonassessor.com
   - Louisiana DOTD — flood zone maps
   - LREC website — rule updates, form updates, license verification
   
   For each: what data is available, how to access it (API, scrape, manual), update frequency.

   **Document Intelligence Data:**
   - Where to find sample LREC forms for testing extraction
   - Where to find real estate document templates
   - Where to find Louisiana-specific legal clause libraries
   - How other platforms structure their form field definitions

2. **Create `lib/research/data-registry.ts`:**
   
   A structured registry of all data sources:
   ```typescript
   interface DataSource {
     id: string
     name: string
     type: 'api' | 'scrape' | 'manual' | 'file'
     url: string
     dataProvided: string[]  // e.g., ['property_value', 'tax_assessment', 'flood_zone']
     updateFrequency: 'realtime' | 'daily' | 'weekly' | 'monthly' | 'manual'
     cost: 'free' | 'freemium' | 'paid'
     integrated: boolean  // are we using this yet?
     priority: number     // 1-5, how valuable for our users
     notes: string
   }
   ```

3. **For the TOP 5 free data sources, write integration specs:**
   - What endpoint to call
   - What data comes back
   - How to transform it for our DB
   - Which tool benefits (AirSign, TC, Documents, Intelligence)

**DONE WHEN:** Data sources documented with top 5 free sources spec'd for integration.

### PHASE 4: SKILL ENGINEERING — BUILD KNOWLEDGE INTO CLAUDE CODE
**Time estimate: 1.5 hours**

Everything you've learned in Phases 1-3 should be captured as skills that make Claude Code (us) permanently smarter when working on this project.

1. **Review existing skills at `.claude/skills/`:**
   - Read each skill file
   - Identify gaps: what knowledge is missing?
   - What do Agents 1-3 keep needing that isn't in a skill?

2. **Create or update skills based on research findings:**

   **`aire-esign-patterns.md`** (New)
   - Best practices from DocuSign/DotLoop research
   - Mobile signing UX patterns
   - Audit trail requirements
   - Multi-party signing workflows
   - Accessibility requirements for signing

   **`aire-extraction-patterns.md`** (New)
   - Best extraction techniques found
   - LREC form field maps (from research)
   - Accuracy improvement strategies
   - How to handle scanned/rotated/low-quality PDFs

   **`aire-louisiana-data.md`** (New)
   - Every Louisiana-specific data source documented
   - Parish assessor URL patterns
   - LREC rule citations with statute numbers
   - Parish-specific rules and exceptions
   - Flood zone interpretation guide

   **`aire-market-intelligence.md`** (New)
   - How to structure market snapshots
   - CMA calculation methodology (from research)
   - Pricing advisor logic
   - Data source integration patterns

3. **Update `SKILLSPEC.md`** with new skills and their quality scores.

**DONE WHEN:** 4+ new skill files created. Claude Code has permanently upgraded knowledge for all tools.

### PHASE 5: LEARNING ENGINE — CONTINUOUS IMPROVEMENT SYSTEM
**Time estimate: 1.5 hours**

Build the infrastructure so the system keeps learning after this agent session ends.

1. **Create `lib/research/document-learner.ts`:**
   
   After every document extraction:
   - Log extraction quality (confidence, fields found vs expected, misses)
   - If confidence < 0.7, flag for review
   - Store correction patterns for `document-memory.ts`
   - Track per-form-type accuracy over time

2. **Create `lib/research/deal-analyzer.ts`:**
   
   After every transaction reaches CLOSED:
   - Calculate deal metrics (list-to-sale ratio, DOM, negotiation delta)
   - Compare to market norms for that parish
   - Generate AI takeaways ("FHA deals in EBR average 8 days longer")
   - Feed insights to morning brief and TC smart suggestions

3. **Create `lib/research/form-tracker.ts`:**
   
   On every document upload:
   - Compare document structure to known LREC form versions
   - Detect when forms change (new fields, layout shifts)
   - Alert when extraction rules may be outdated

4. **Create `app/api/research/stats/route.ts`:**
   - Aggregated stats from all learning subsystems
   - Extraction accuracy trends
   - Deal intelligence summary
   - Form version tracking

5. **Create `app/aire/research/page.tsx`:**
   
   Research dashboard:
   ```
   DOCUMENT INTELLIGENCE
   47 docs processed | 94% accuracy | 3 flagged for review
   Top miss: seller phone (38% extraction rate)
   
   DEAL INTELLIGENCE
   18 deals analyzed | Avg 97.2% list-to-sale | Avg 38 days to close
   Insight: "FHA deals take 8 days longer than conventional"
   
   COMPETITIVE GAPS
   3 high-priority features identified from research
   7 GitHub libraries ready for integration
   
   DATA SOURCES
   5 free APIs identified | 2 integrated | 3 ready to connect
   ```

**DONE WHEN:** Learning engine logs real metrics. Dashboard shows intelligence. System improves with every transaction and document.

---

## SUCCESS CRITERIA — HOW CALEB WILL TEST

1. Open `AGENT_MISSIONS/research/` — 3+ detailed research documents with actionable findings
2. Open `AGENT_MISSIONS/research/github-finds.md` — 30+ evaluated repos with top 10 ranked
3. Open `AGENT_MISSIONS/research/data-sources.md` — all data sources cataloged with integration specs
4. Check `.claude/skills/` — 4+ new skill files with real knowledge
5. Open `/aire/research` dashboard — shows real system metrics
6. Upload a document → learning engine logs extraction quality
7. Morning brief includes research insights

If Caleb reads the research and says "I didn't know that — that's going to make us better" → Agent 4 is DONE.

---

## TOOLS YOU SHOULD USE HEAVILY

- **WebSearch** — search for competitors, GitHub repos, APIs, documentation
- **WebFetch** — read documentation pages, GitHub READMEs, API specs
- **Read/Glob/Grep** — understand existing codebase before proposing additions
- **Write** — create research documents and skill files

## RULES
- DO NOT modify code that Agents 1-3 own. Write research + specs, not implementations.
- The EXCEPTION: you CAN create new files in `lib/research/`, `app/api/research/`, `app/aire/research/`, and `.claude/skills/`.
- DO NOT install npm packages. Document what should be installed and why.
- Every claim must have a source URL. No making up data.
- If you find something that would change how another agent should work, write it to `AGENT_MISSIONS/RECOMMENDATIONS.md` with the agent number and what they should change.
- Research documents should be SPECIFIC and ACTIONABLE — not vague summaries. Include URLs, code examples, exact feature descriptions.
- If you hit a blocker, write it to `AGENT_MISSIONS/BLOCKERS.md`.
