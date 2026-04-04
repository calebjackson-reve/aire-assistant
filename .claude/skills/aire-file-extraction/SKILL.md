---
name: aire-file-extraction
description: >
  Master knowledge base for AIRE's document extraction engine. Contains the complete
  LREC form catalog, field dictionaries, page-level extraction maps, Louisiana-specific
  validation rules, and multi-pass extraction strategies. Use this skill whenever building,
  debugging, or extending document extraction, classification, or checklist features.
  Triggers on: document extraction, PDF parsing, LREC forms, field mapping, classification,
  checklist, AcroForm, Vision extraction, or any file in lib/document-*.ts or api/documents/.
---

# AIRE Document Extraction Engine — Knowledge Base

## Architecture Overview

AIRE uses a 3-stage extraction pipeline with multi-pass field extraction:

```
Upload PDF
  ├── Stage 1: AcroForm (pdf-lib) — reads DocuSign/Dotloop form fields
  ├── Stage 2: Text Stream — regex extraction of text from PDF streams
  └── Stage 3: Claude Vision — sends PDF pages as images (fallback)
        │
        ▼
  Multi-Pass Field Extraction (5 focused passes)
  ├── Pass 1: Parties (pages 1) — names, emails, phones, agents
  ├── Pass 2: Deal Terms (pages 1-2) — price, earnest money, MLS#
  ├── Pass 3: Dates & Deadlines (pages 2-3) — all date fields
  ├── Pass 4: Louisiana Specifics (pages 3-5) — parish, mineral rights, flood
  └── Pass 5: Signatures & Status (last 2 pages) — who signed, what's missing
        │
        ▼
  Classification + Validation + DB Save
```

## LREC Form Catalog (2026 Edition)

### Mandatory Forms (required for every transaction)

| Form | Type ID | Pages | Key Fields | Prisma Mapping |
|------|---------|-------|------------|----------------|
| Residential Agreement to Buy or Sell | `purchase_agreement` | 10-12 | All deal terms, parties, dates, LA-specific | Transaction + Document |
| Property Disclosure Document | `property_disclosure` | 4-6 | Property conditions, defects, history | Document.filledData |
| Agency Disclosure Form | `agency_disclosure` | 1-2 | Agent, broker, representation type | Document.filledData |
| Dual Agency Consent | `dual_agency_consent` | 1 | Both parties' consent | Document.filledData |

### Federal Disclosures

| Form | Type ID | Pages | When Required |
|------|---------|-------|---------------|
| Lead-Based Paint Disclosure | `lead_paint` | 2-3 | Homes built before 1978 |

### Addenda (conditional)

| Form | Type ID | Pages | When Required |
|------|---------|-------|---------------|
| Inspection Response Addendum | `inspection_response` | 1-2 | After inspection findings |
| Deposit Addendum | `deposit_addendum` | 1 | Additional earnest money |
| Condominium Addendum | `condominium_addendum` | 2-3 | Condo sales |
| New Construction Addendum | `new_construction_addendum` | 2-3 | New builds |
| Historic District Addendum | `historic_district_addendum` | 1-2 | Historic properties |
| Private Sewerage/Water Well | `private_sewerage_addendum` | 1-2 | Properties w/o public utilities |
| Sewer Treatment Systems | `sewer_treatment_addendum` | 1 | Alternative sewer systems |
| Buyer Option Flowchart (DDI) | `buyer_option_flowchart` | 1 | Reference for DDI period |

### Additional Real Estate Forms

| Form | Type ID | Pages |
|------|---------|-------|
| Home Warranty Disclosure | `home_warranty` | 1-2 |
| Property Management Agreement | `property_management` | 3-5 |
| Vacant Land Purchase Agreement | `vacant_land` | 6-8 |
| Waiver of Warranty | `waiver_warranty` | 1 |

## Field Dictionary

### Purchase Agreement Fields

Each field maps to a Prisma model column. Fields marked with (LA) are Louisiana-specific.

#### Pass 1: Parties (Page 1)
| Field | Prisma Column | Type | Validation |
|-------|---------------|------|------------|
| buyerName | Transaction.buyerName | string | Required |
| buyerEmail | Transaction.buyerEmail | string | Email format |
| buyerPhone | Transaction.buyerPhone | string | Phone format |
| sellerName | Transaction.sellerName | string | Required |
| sellerEmail | Transaction.sellerEmail | string | Email format |
| sellerPhone | Transaction.sellerPhone | string | Phone format |
| listingAgent | Document.filledData | string | - |
| sellingAgent | Document.filledData | string | - |
| listingBrokerage | Document.filledData | string | - |
| sellingBrokerage | Document.filledData | string | - |

#### Pass 2: Deal Terms (Pages 1-2)
| Field | Prisma Column | Type | Validation |
|-------|---------------|------|------------|
| propertyAddress | Transaction.propertyAddress | string | Required |
| propertyCity | Transaction.propertyCity | string | Default "Baton Rouge" |
| propertyZip | Transaction.propertyZip | string | 5 digits |
| parishName | Document.filledData | string | (LA) Must be valid LA parish |
| listPrice | Transaction.listPrice | float | > 0 |
| offerPrice | Transaction.offerPrice | float | > 0 |
| acceptedPrice | Transaction.acceptedPrice | float | > 0 |
| earnestMoneyAmount | Document.filledData | float | Typically 1-3% of price |
| earnestMoneyHolder | Document.filledData | string | Title company or broker |
| mlsNumber | Transaction.mlsNumber | string | Format varies by MLS |
| propertyType | Transaction.propertyType | string | residential/commercial/land |

#### Pass 3: Dates & Deadlines (Pages 2-3)
| Field | Prisma Column | Type | Validation |
|-------|---------------|------|------------|
| contractDate | Transaction.contractDate | date | Required for ACTIVE status |
| closingDate | Transaction.closingDate | date | Must be after contract date |
| inspectionDays | Used by rules engine | int | Default 14 in LA |
| appraisalDays | Used by rules engine | int | Default 14 in LA |
| financingDays | Used by rules engine | int | Default 25 in LA |
| ddiPeriodDays | Document.filledData | int | (LA) Due diligence inspection period |
| occupancyDate | Document.filledData | date | - |

#### Pass 4: Louisiana Specifics (Pages 3-5)
| Field | Prisma Column | Type | Validation |
|-------|---------------|------|------------|
| mineralRightsIncluded | Document.filledData | boolean | (LA) Critical — affects value |
| mineralRightsExceptions | Document.filledData | string | (LA) What's excluded |
| floodZone | Document.filledData | string | (LA) A, AE, X, etc. |
| floodInsuranceRequired | Document.filledData | boolean | (LA) Required in A/AE zones |
| servitudes | Document.filledData | string | (LA) Right-of-way/easements |
| titleCompany | Transaction.titleCompany | string | - |
| lenderName | Transaction.lenderName | string | - |
| terminationRights | Document.filledData | string | Conditions for contract termination |
| specialStipulations | Document.filledData | string | Free-text additions |

#### Pass 5: Signatures & Status (Last 2 Pages)
| Field | Prisma Column | Type | Warning If |
|-------|---------------|------|------------|
| buyerSigned | Document.filledData | boolean | Missing = not executed |
| buyerSignDate | Document.filledData | date | - |
| sellerSigned | Document.filledData | boolean | Missing = not executed |
| sellerSignDate | Document.filledData | date | - |
| agentSigned | Document.filledData | boolean | - |
| witnessPresent | Document.filledData | boolean | (LA) Required for Act of Sale |

### Property Disclosure Fields (Single Pass)
| Field | Type | Red Flag If |
|-------|------|-------------|
| roofAge / roofCondition | int / string | Age > 20 years |
| hvacAge / hvacCondition | int / string | Age > 15 years |
| foundationIssues | boolean | true |
| waterDamage | boolean | true |
| mold | boolean | true |
| termiteHistory | boolean | (LA) Very common — flag but not dealbreaker |
| floodHistory | boolean | (LA) Check FEMA maps |
| leadPaint | boolean | Required disclosure pre-1978 |
| asbestos | boolean | true |
| knownDefects | string | Any non-empty value |
| mineralRights | string | (LA) Check if retained by seller |
| servitudes | string | (LA) Check for utility/pipeline easements |

## Louisiana-Specific Rules

### Parish Validation
Valid Louisiana parishes (partial list — the 9 most common in Baton Rouge metro):
East Baton Rouge, West Baton Rouge, Ascension, Livingston, East Feliciana,
West Feliciana, Iberville, Pointe Coupee, St. Helena

### Deadline Defaults (LREC Standard)
- Inspection period: 14 calendar days
- Appraisal contingency: 14 calendar days
- Financing contingency: 25 calendar days
- Title examination: 20 days before closing
- Earnest money deposit: 2 business days after acceptance
- Calendar days count weekends; if deadline falls on weekend/holiday → next business day

### Red Flags to Always Check
1. Missing signatures on any party
2. Mineral rights excluded without buyer acknowledgment
3. Property in flood zone A/AE without flood insurance discussion
4. Inspection period < 10 days (unusually short)
5. No earnest money amount specified
6. Closing date < 30 days from contract (rushed)
7. Termite history without treatment documentation

## Multi-Pass Prompt Templates

### Vision Pass Template
When sending pages to Claude Vision, use this structure:
```
You are an AIRE document extraction agent analyzing a Louisiana real estate document.

PASS: {pass_name}
FOCUS: {specific_fields}
PAGES: You are seeing pages {page_range} of a {doc_type}.

Extract ONLY these fields: {field_list}

For each field, return:
- The exact value as written in the document
- null if the field is blank or not found on these pages

Return JSON only: {"fields": {...}, "confidence": 0.0-1.0}
```

### Validation Pass (runs after all extraction passes)
After all 5 passes complete, run a validation pass that:
1. Checks all required fields are non-null
2. Validates LA parish names
3. Flags red-flag conditions
4. Calculates deadlines using the louisiana-rules-engine
5. Returns a completeness score (0-100%)

## Reference Templates Location

Blank 2026 LREC forms are stored at:
```
baton-rouge-real-estate/public/forms/
├── 01_Purchase_Agreement/   ← 2026 Residential Agreement (FILLABLE, PRINTABLE, REDLINE)
├── 02_Property_Disclosure/  ← 2026 Property Disclosure (FILLABLE, PRINTABLE, REDLINE)
├── 03_Agency_Disclosure/    ← Agency Disclosure, Pamphlet, Dual Agency
├── 04_Listing_Agreement/    ← Warranty, Mgmt, Vacant Land, Waiver
├── 06_Addenda/              ← 8 addendum forms
├── 07_Disclosures_Federal/  ← Lead-Based Paint
└── 08_Broker_License/       ← 9 licensing forms
```

These can be loaded as reference when comparing against uploaded filled versions.

## Error Handling

### Common Failure Modes
| Symptom | Cause | Fix |
|---------|-------|-----|
| All fields null, confidence 0 | Binary garbage sent to AI | Check `countRealWords()` — should trigger Vision |
| pageCount 258 for 10-page doc | Stream objects counted as pages | Use `pdf-lib` `getPageCount()` |
| "User not found" on test page | Auth required but test has no user | Make auth optional for `/test/*` routes |
| AcroForm returns 0 fields | DocuSign flattened the form | Normal — fall through to Vision |
| Vision returns garbled text | Model doesn't support document type | Try `claude-3-5-sonnet` fallback |

### Extraction Method Priority
1. **AcroForm** (pdf-lib) — fastest, most accurate for form-filled PDFs
2. **Text stream** — works for native-text PDFs (not scanned/flattened)
3. **Claude Vision** — universal fallback, works on any readable PDF
4. **AI from filename only** — last resort, classifies but can't extract fields
