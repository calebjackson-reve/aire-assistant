# Voice Infrastructure Inventory — What's Already Built

**Purpose:** Before designing the next voice-prompt layer, check here first so we extend existing surfaces instead of rebuilding them.

**Last verified:** 2026-04-13 on `main` @ `c83a381` (tag `v1.0-consolidation`)

---

## 1. Transcription Layer ✅ COMPLETE

**Endpoint:** `POST /api/voice/transcribe` — [`app/api/voice/transcribe/route.ts`](app/api/voice/transcribe/route.ts)
- Uses **OpenAI Whisper** (`whisper-1` model), not browser Web Speech
- Primed with a Louisiana glossary prompt: Tchoupitoulas, Thibodaux, Natchitoches, Ascension Parish, LREC, Act of Sale, Reve Realtors, GBRAR MLS, etc.
- Requires `OPENAI_API_KEY`
- Auth via Clerk, returns `{ text: string }`

**Note:** `aire-assistant/CLAUDE.md` still lists Whisper as a backlog item ("Voice Pipeline Enhancement Backlog #2"). That's stale — Whisper is live.

---

## 2. Pipeline Orchestrator ✅ COMPLETE

**Entry:** `runVoicePipeline({ userId, transcript })` — [`lib/voice-pipeline.ts`](lib/voice-pipeline.ts) (744 lines)

**5-phase architecture:**
1. `normalize` (<1ms) — cleans transcript
2. `fast-path` (<1ms) — 28 regex matchers skip Claude for common intents
3. `classify` (~3s) — Claude Sonnet intent + entity extraction with conversation history
4. `execute` (~1-2s) — invokes `executeAction()` in voice-action-executor
5. `log` — timing + audit trail for patent claim

**Target latency:** 8 seconds voice → action → result.

**Returns** `PipelineResult` with `englishPreview`, `requiresConfirmation`, `executionResult`, and `timing` breakdown.

---

## 3. Intent Catalog (18 intents) ✅ COMPLETE

All wired in fast-path + Claude classifier + action executor:

| # | Intent | Fast-path patterns | Executor |
|---|---|---|---|
| 1 | `show_pipeline` | 4 | `showPipeline()` |
| 2 | `check_deadlines` | 4 | `checkDeadlines()` |
| 3 | `create_transaction` | 3 | `createTransaction()` |
| 4 | `write_contract` | 4 | `writeContractFromVoice()` |
| 5 | `run_compliance` | 3 | `runComplianceScan()` |
| 6 | `update_status` | 3 | `updateTransactionStatus()` |
| 7 | `market_analysis` | 2 | `marketAnalysis()` |
| 8 | `add_party` | 2 | `addParty()` |
| 9 | `calculate_roi` | 2 | (executor TBD) |
| 10 | `send_alert` | 2 | `sendAlert()` |
| 11 | `schedule_closing` | 2 | `scheduleClosing()` |
| 12 | `send_document` | 2 | `sendDocument()` |
| 13 | `send_document_for_signature` | 3 | `sendDocumentForSignature()` |
| 14 | `create_addendum` | 2 | `createAddendum()` |
| 15 | `start_file` | 2 | `startFile()` |
| 16 | `check_docs` | 2 | `checkMissingDocs()` |
| 17 | `fill_mls` | 2 | `fillMLS()` |
| 18 | `needs_clarification` | — | falls through to UI |

**Total fast-path patterns:** 28 (6 → 28 was the v2 expansion, documented in CLAUDE.md).

---

## 4. API Endpoints ✅ COMPLETE

| Endpoint | Purpose | Status |
|---|---|---|
| `POST /api/voice/transcribe` | Whisper STT | ✅ |
| `POST /api/voice-command/route.ts` | v1 (legacy, still live for compat) | ✅ |
| `POST /api/voice-command/v2/route.ts` | v2 synchronous endpoint | ✅ |
| `POST /api/voice-command/v2/stream/route.ts` | **v2 SSE streaming** — phase/intent/response/complete events | ✅ |
| `POST /api/voice-command/execute/route.ts` | Standalone action executor | ✅ |
| `GET /api/voice-command/analytics/route.ts` | Pipeline timing + intent distribution + fast-path rate | ✅ |

**Feature gate:** v2 streaming enforces `user.tier !== "FREE"` — voice is a Pro feature ($97/mo).

**SSE event contract:**
```
event: phase     data: { phase: "processing" | ..., message: string }
event: intent    data: { intent: string, entities: {...}, confidence: number }
event: response  data: { response: string, englishPreview: string | null }
event: complete  data: { ...full PipelineResult }
```

---

## 5. UI Layer ✅ COMPLETE

- **[`components/VoiceOverlay.tsx`](components/VoiceOverlay.tsx)** — full-screen Deep Forest 95% + blur(12px) overlay with pulsing sage ring (Voice pattern from DESIGN.md § 10)
- **[`components/voice/VoicePreview.tsx`](components/voice/VoicePreview.tsx)** — English preview playback UI (Accept / Edit / Cancel)
- **[`lib/voice/english-preview.ts`](lib/voice/english-preview.ts)** — generates the plain-English playback of what AIRE heard for every mutating intent
- **Command bar** (⌘K) — prototype at `app/aire/ui-lab/experiments/command-bar-opening/`, not yet wired to live voice

---

## 6. Analytics ✅ COMPLETE

- Page: `/aire/voice-analytics` — timing, intent distribution, fast-path hit rate
- Every command logged to `VoiceCommand` Prisma model with timing breakdown
- Circuit breaker (`lib/learning/circuit-breaker.ts`) wraps Claude calls for graceful failure
- Errors captured to `error-memory` for learning engine

---

## 7. Known Gaps / Open Work

1. **`calculate_roi` executor** — intent + fast-path exist, action executor function not yet written (grepped the file)
2. **⌘K → live voice** — command bar prototype exists but not wired into `runVoicePipeline`
3. **Multi-turn context depth** — implicit entity resolution works for last-transaction reference; multi-turn BEYOND one turn not tested
4. **Offline queue** — if network drops mid-command, no retry/queue logic
5. **Voice-triggered AirSign with template selection** — "Send the purchase agreement for 123 Main to John Smith" works; picking from the new v2 templates library isn't wired yet

---

## 8. What the Next Blueprint Should Decide

When the voice-prompt blueprint arrives, it should answer:
- **New intents to add?** (each = 1 regex pattern + Claude prompt line + executor function)
- **New consumer surfaces?** (e.g. ⌘K, mobile sticky mic, car-hands-free mode)
- **Whisper upgrade to real-time streaming STT?** (currently file-based)
- **Voice-first TCS flow?** (Day 9 TCS UC flow has a walkthrough; voice could replace taps)
- **Voice → AirSign template pick?** (v2 templates library is the missing bridge)
- **Conversational memory persistence?** (e.g. "send that one too" referencing last envelope)

---

## 9. Files to Touch Next (in priority order)

If the new blueprint extends intents:
1. `lib/voice-pipeline.ts` — add fast-path pattern + Claude prompt
2. `lib/voice-action-executor.ts` — add executor function + wire switch
3. `lib/voice/english-preview.ts` — add preview template
4. `prisma/schema.prisma` — if new logging fields needed
5. `app/aire/voice-analytics/page.tsx` — add new intent to chart buckets

If the new blueprint adds a consumer surface:
1. Create component under `components/voice/`
2. Consume `/api/voice-command/v2/stream` via EventSource
3. Mount into `app/aire/layout.tsx` for global reach

---

*This inventory is live state, not plans. Anything marked ✅ already ships on `main`. When in doubt, grep the code — don't rebuild.*
