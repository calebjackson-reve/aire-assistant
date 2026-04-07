# AIRE Data Architecture

## Overview

The AIRE platform uses a **dual database layer** on a single Neon PostgreSQL instance:

1. **Prisma ORM** — manages application models (User, Transaction, Deadline, Document, etc.)
2. **Raw SQL via `@neondatabase/serverless` Pool** — manages intelligence tables (properties_clean, market_snapshots, aire_scores, etc.)

This separation exists because the intelligence tables are populated by external MCP ingestion servers (MLS, PropStream, Zillow, Redfin) that run independently and don't need ORM overhead.

## Database Tables

### Prisma-Managed (14 models)
```
User, Transaction, Deadline, Document, DocumentMemory,
VoiceCommand, ConsensusLog, Contact, RelationshipIntelLog,
MorningBrief, WorkflowEvent, EmailAccount, EmailScan, EmailAttachment,
AirSignEnvelope, AirSignSigner, AirSignField, AirSignAuditEvent
```

### Intelligence Tables (raw SQL — managed by MCP servers)
```
properties_clean     — canonical property records, deduplicated
market_snapshots     — time-series pricing data per property per source
aire_scores          — append-only AIRE scoring history
job_runs             — ingestion job tracking
error_logs           — per-record error logging
raw_imports          — raw CSV data before processing
backtest_results     — accuracy validation results
```

## Scoring Engines

All engines are **pure functions** with zero database dependency. Located in `lib/data/engines/`.

| Engine | File | Input | Output | Speed |
|--------|------|-------|--------|-------|
| **Ensemble AVM** | `ensemble.ts` | 4 source valuations | Weighted AIRE Estimate | <0.5ms |
| **PPS** (Pricing Position Score) | `pps.ts` | List price, AIRE estimate, market data | 0-100 score + 6 factor breakdown | <0.5ms |
| **BPS** (Buyer Perception Score) | `bps.ts` | 7 admin-reviewed sub-scores | 0-100 score + partial flag | <0.3ms |
| **URI** (Upgrade ROI Index) | `uri.ts` | Upgrade costs, expected lift | ROI score + rating | <0.3ms |
| **Disagreement** | `disagreement.ts` | 4 source valuations | Confidence tier (HIGH/MEDIUM/LOW) | <0.3ms |
| **Normalize** | `normalize.ts` | Raw address string | Canonical property_id + parish | <1.5ms |

### Ensemble AVM Weights
```
MLS CMA:        40% — agent-priced comps, most reliable
PropStream AVM: 25% — automated model with local data
Zillow:         20% — broad market signal
Redfin:         15% — conservative downside anchor
```
Missing sources have weights redistributed proportionally.

## API Endpoints

### Data APIs (`/api/data/`)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/data/health` | GET | Public | DB connectivity + data freshness |
| `/api/data/market` | GET | Yes | Metro/neighborhood market stats |
| `/api/data/property` | GET | Yes | Property lookup by ID or address |
| `/api/data/estimate` | POST | Yes | Calculate AIRE Estimate |
| `/api/data/scores` | GET/POST | Yes | Retrieve or calculate scores |
| `/api/data/paragon/listings` | GET | Yes | Active MLS listings |
| `/api/data/paragon/sales` | GET | Yes | Sold comps |
| `/api/data/propstream/property` | GET | Yes | PropStream enrichment data |
| `/api/data/health/tables` | GET | Public | Row counts for all intelligence tables |
| `/api/data/backtest` | GET/POST | Yes | Retrieve or run accuracy backtest |
| `/api/data/import` | POST | Yes | Import MLS/PropStream records via JSON |

### Intelligence APIs (`/api/intelligence/`)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/intelligence/cma` | POST | Yes | Full CMA: ensemble + disagreement + PPS + neighborhood |
| `/api/intelligence/estimate` | POST | Yes | Proxy to aireintel.org AVM service |

## Data Flow

```
MLS CSV → POST /api/data/import (source: "mls") → properties_clean + market_snapshots
PropStream CSV → POST /api/data/import (source: "propstream") → properties_clean + market_snapshots
Zillow/Redfin fetchers → market_snapshots (update existing snapshots)
Scheduler → ensemble.ts → aire_scores
Scheduler → disagreement.ts → aire_scores (confidence_tier update)

User request → /api/intelligence/cma → ensemble + disagreement + PPS → JSON response
User request → /api/data/property → properties_clean + market_snapshots + aire_scores → JSON
```

## Static Market Data

`lib/data/market-data.ts` contains hardcoded Baton Rouge market data:
- 8 neighborhood heat scores (Zachary, Prairieville, University Lakes, etc.)
- Metro-level stats (median price, DOM, inventory, list/sale ratio)
- State and national comparisons
- Rental data (HUD FMR 2025)
- Commercial market data (CREXi)
- PropStream lead counts
- Foreclosure stats

Updated quarterly from GBRAR MLS, Redfin, NAR, PropStream.

## Integration Points

| Agent | Uses |
|-------|------|
| Morning Brief | `AIRE_DATA` for market context in daily briefs |
| Voice Command | `findByPropertyId()` for property lookups, `AIRE_DATA` for market analysis |
| Document Extract | `onDocumentUploaded()` triggers workflow auto-advance |
| Intelligence | Full scoring engine (ensemble, PPS, BPS, URI, disagreement) |
| Transaction | Address normalization for new deals |

## Performance

- Engine computation: <1.5ms per call
- DB query (localhost→Neon): ~200ms
- DB query (Vercel→Neon, same region): <50ms
- Static data lookup: <0.1ms
- Target API response time: <200ms (met on Vercel)
