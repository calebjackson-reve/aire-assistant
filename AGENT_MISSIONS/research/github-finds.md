# GitHub Skill Mining — Libraries & Tools for AIRE
*Agent 4 Research — 2026-04-04*

## Evaluated Libraries (35 total)

### PDF & Signature Libraries

| # | Library | Stars | License | Last Updated | Problem It Solves | Effort | Replaces/Enhances |
|---|---------|-------|---------|-------------|-------------------|--------|-------------------|
| 1 | **signature_pad** | 10K+ | MIT | Active 2026 | Smoother signature drawing with Bezier curves | 2 | Enhances SignatureModal canvas |
| 2 | **react-signature-canvas** | 2K+ | MIT | Active | React wrapper for signature_pad | 1 | Drop-in for our canvas |
| 3 | **perfect-freehand** | 4K+ | MIT | Active | Pressure-sensitive, natural-looking strokes | 2 | Enhances signature quality |
| 4 | **pdf-lib** | 5K+ | MIT | Active | PDF creation, form filling, signature embedding | — | Already using ✓ |
| 5 | **react-pdf** | 8K+ | MIT | Active | PDF viewer component for React | 3 | Enhances PDF viewing in field placer + signing |
| 6 | **pdfjs-dist** | 45K+ | Apache 2.0 | Active | Mozilla's PDF renderer (powers react-pdf) | — | Dependency of react-pdf |
| 7 | **pdf-parse** | 2K+ | MIT | Maintained | Better text extraction from PDFs | 2 | Enhances Stage 2 extraction |
| 8 | **pdf2json** | 1.5K+ | MIT | Active | PDF to JSON with position data | 3 | Field position detection |

### Document Intelligence

| # | Library | Stars | License | Last Updated | Problem It Solves | Effort | Replaces/Enhances |
|---|---------|-------|---------|-------------|-------------------|--------|-------------------|
| 9 | **Tesseract.js** | 35K+ | Apache 2.0 | Active | Client-side OCR for scanned PDFs | 3 | Fallback when Vision API unavailable |
| 10 | **sharp** | 28K+ | Apache 2.0 | Active | Image preprocessing (rotate, enhance, resize) | 2 | Pre-process scanned pages |
| 11 | **compromise** | 11K+ | MIT | Active | NLP for text analysis | 3 | Enhance text-based classification |
| 12 | **natural** | 10K+ | MIT | Active | Node NLP: tokenization, classification | 3 | Naive Bayes document classifier |
| 13 | **unstructured** | 25K+ | MIT | Active | Multi-format document parsing | 5 | Python — would need Node equivalent |

### Real Estate & Property Data

| # | Library | Stars | License | Last Updated | Problem It Solves | Effort |
|---|---------|-------|---------|-------------|-------------------|--------|
| 14 | **rets-client** | 200+ | MIT | Maintained | RETS protocol for MLS data access | 4 |
| 15 | **node-geocoder** | 4K+ | MIT | Active | Address geocoding (multiple providers) | 2 |
| 16 | **turf.js** | 9K+ | MIT | Active | Geospatial calculations (distance, area, bounds) | 2 |

### State Machine & Workflow

| # | Library | Stars | License | Last Updated | Problem It Solves | Effort |
|---|---------|-------|---------|-------------|-------------------|--------|
| 17 | **xstate** | 27K+ | MIT | Active | Advanced state machines with visualization | 4 |
| 18 | **robot** | 2K+ | MIT | Maintained | Lightweight state machine | 2 |
| 19 | **inngest** | 5K+ | Apache 2.0 | Active | Event-driven serverless workflows | 4 |
| 20 | **BullMQ** | 6K+ | MIT | Active | Redis-backed job queue with scheduling | 4 |

### Email & Notifications

| # | Library | Stars | License | Last Updated | Problem It Solves | Effort |
|---|---------|-------|---------|-------------|-------------------|--------|
| 21 | **react-email** | 14K+ | MIT | Active | Beautiful email templates in React/TSX | 3 |
| 22 | **@react-email/components** | Part of above | MIT | Active | Pre-built email components | 2 |
| 23 | **mjml** | 16K+ | MIT | Active | Email framework → responsive HTML | 3 |
| 24 | **novu** | 35K+ | MIT | Active | Full notification infrastructure | 5 |
| 25 | **nodemailer** | 16K+ | MIT | Active | SMTP email sending | 2 |

### AI & Intelligence

| # | Library | Stars | License | Last Updated | Problem It Solves | Effort |
|---|---------|-------|---------|-------------|-------------------|--------|
| 26 | **ai (Vercel AI SDK)** | 10K+ | Apache 2.0 | Active | Streaming AI, tool calling, agents | 3 |
| 27 | **langchain** | 95K+ | MIT | Active | LLM chains, RAG, agents | 5 |
| 28 | **llamaindex** | 35K+ | MIT | Active | Document indexing, RAG | 5 |
| 29 | **zod** | 33K+ | MIT | Active | Schema validation for AI structured output | — | Already using ✓ |

### UI Components

| # | Library | Stars | License | Last Updated | Problem It Solves | Effort |
|---|---------|-------|---------|-------------|-------------------|--------|
| 30 | **dnd-kit** | 12K+ | MIT | Active | Drag-and-drop (document upload, field placement) | 3 |
| 31 | **react-dropzone** | 10K+ | MIT | Active | File upload dropzone | 1 |
| 32 | **recharts** | 23K+ | MIT | Active | Charts for analytics dashboards | 2 |
| 33 | **date-fns** | 34K+ | MIT | Active | Date manipulation for deadlines | 1 |
| 34 | **react-hot-toast** | 9K+ | MIT | Active | Toast notifications | 1 |
| 35 | **cmdk** | 9K+ | MIT | Active | Command palette (⌘K) for quick actions | 2 |

---

## TOP 10 PRIORITY LIST

Ranked by: (impact on user experience) × (ease of integration)

| Rank | Library | Score | What To Do | Benefits |
|------|---------|-------|-----------|----------|
| **1** | **react-dropzone** | 10 | Add drag-and-drop upload to Documents tab | Unblocks document upload UX |
| **2** | **react-signature-canvas** | 9 | Replace custom canvas in SignatureModal | Smoother signatures, less code |
| **3** | **react-email** | 9 | Create branded email templates for AirSign, TC notifications | Professional emails instead of plain text |
| **4** | **react-hot-toast** | 8 | Add toast notifications across the app | User feedback for actions |
| **5** | **date-fns** | 8 | Better deadline calculations and display | More reliable date handling |
| **6** | **recharts** | 8 | Charts for voice analytics, deal intelligence, market data | Visual intelligence dashboards |
| **7** | **react-pdf** | 7 | Better PDF rendering in field placer + signing page | Higher quality PDF display |
| **8** | **pdf-parse** | 7 | Better text extraction in Stage 2 | Higher extraction accuracy |
| **9** | **sharp** | 7 | Pre-process scanned PDFs before Vision | Better OCR on poor quality scans |
| **10** | **cmdk** | 6 | Command palette for power users | Fast navigation + voice command alternative |

---

## Libraries NOT Recommended

| Library | Why Not |
|---------|---------|
| xstate | Our state machine is simple enough — xstate adds complexity without benefit |
| langchain | Overkill for our use case — Claude API direct calls are cleaner |
| llamaindex | Python-focused, we're Node/TypeScript |
| novu | Too heavy for our notification needs — react-email + Resend is sufficient |
| BullMQ | Requires Redis — Vercel crons handle our scheduling |
