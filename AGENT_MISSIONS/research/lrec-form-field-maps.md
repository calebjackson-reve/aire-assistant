# LREC Form Field Maps — Complete Extraction Reference
*Research compiled 2026-04-04 for AIRE Document Extraction Engine*
*Cross-referenced with: `lib/document-extractor.ts`, `lib/document-classifier.ts`, `lib/contracts/lrec-fields.ts`, `lib/multi-pass-extractor.ts`*

## Purpose

This document maps EVERY field on the 6 major LREC forms used in Louisiana residential transactions. Each field includes: exact label as printed on the form, data type, which party fills it, page location, whether it is compliance-critical, and common OCR/extraction failure modes.

Use this reference to:
1. **Build form-specific extraction prompts** (10-15% accuracy boost vs generic)
2. **Map AcroForm field names** from DocuSign/DotLoop (100% accuracy, zero API cost)
3. **Validate compliance** (flag missing mandatory fields per Louisiana law)
4. **Auto-place AirSign fields** (pre-place signature/date/initial fields by form type)

---

## How LREC Forms Differ from NAR Standard Forms

Louisiana is a civil law state (based on French/Spanish Napoleonic Code, not English common law). This creates unique form fields not found in any other state:

| Louisiana Concept | NAR/Standard Equivalent | Why It Matters |
|---|---|---|
| **Parish** | County | All legal descriptions reference parish, not county |
| **Act of Sale** | Closing | The transfer instrument — must be passed before a notary |
| **Servitudes** | Easements | Civil Code term; includes pipeline, utility, drainage |
| **Mineral Rights** | N/A (most states bundle) | Louisiana separates mineral rights from surface rights — can be sold independently |
| **Community Property** | N/A (common law states use tenancy) | Both spouses must sign to sell community property (La. C.C. Art. 2347) |
| **Redhibition** | Implied warranty / caveat emptor | Seller liable for hidden defects even after sale (La. C.C. Art. 2520-2548) |
| **Termite/WDO Certificate** | Pest inspection (optional in most states) | Mandatory in Louisiana (La. R.S. 9:1131.1) |
| **Usufruct** | Life estate | Common in Louisiana succession — affects who can sell |
| **Lesion Beyond Moiety** | N/A | Seller can void sale if price < 50% of fair value (La. C.C. Art. 2589) |
| **Purchaser / Vendor** | Buyer / Seller | Official Louisiana civil law terms used on all LREC forms |

### Recent LREC Form Updates (2024-2026)
- **January 2026**: Purchase Agreement updated mineral rights clause — now requires explicit buyer acknowledgment checkbox
- **January 2026**: Property Disclosure Document added expanded flood history section (post-2016 Great Flood response)
- **2025**: Buyer Representation Agreement (LREC-002) updated for NAR settlement compliance — mandatory before showing properties
- **2024**: Inspection period language clarified — "calendar days" explicitly defined, weekend/holiday roll rule added
- **2024**: Counter-offer form streamlined — removed redundant signature blocks
- **2024 NAR Settlement Impact**: Buyer agent compensation language updated across all forms to comply with Sitzer/Burnett settlement — compensation must be negotiated in writing before touring

---

## FORM 1: LREC-101 — Residential Agreement to Buy or Sell

**Form Number**: LREC-101 (also called "Purchase Agreement" or "PA")
**Title**: Louisiana Residential Agreement to Buy or Sell
**Current Revision**: Rev. January 2026
**Typical Page Count**: 10-12 pages
**Required Parties**: Buyer(s), Seller(s), Listing Agent, Selling Agent
**Statute**: La. C.C. Art. 2439-2659 (Sale of Immovables)
**Classifier Type ID**: `purchase_agreement`
**Note**: The document classifier currently maps this as `LREC-001` but the industry-standard number is `LREC-101`. Should standardize.

### Page 1: Property Identification & Parties

| Field Label (as printed) | Field ID | Type | Required | Filled By | Compliance Critical | Commonly Missed by OCR |
|---|---|---|---|---|---|---|
| Property Address | property_address | text | YES | Buyer agent | YES | No |
| City | property_city | text | YES | Buyer agent | YES | No |
| State | property_state | text | YES | Buyer agent | NO | Yes (pre-printed "LA") |
| Zip Code | property_zip | text | YES | Buyer agent | NO | No |
| Parish | property_parish | text | YES | Buyer agent | YES | Yes (agents sometimes write "county") |
| Legal Description (Lot, Block, Subdivision) | legal_description | text | NO | Buyer agent | YES (for title) | Yes (often left blank by agents) |
| MLS Number | mls_number | text | NO | Buyer agent | NO | No |
| Property Type | property_type | checkbox group | NO | Buyer agent | NO | No |
| - Residential | property_type_residential | checkbox | - | - | - | - |
| - Condominium | property_type_condo | checkbox | - | - | - | - |
| - Townhouse | property_type_townhouse | checkbox | - | - | - | - |
| - Manufactured/Mobile | property_type_manufactured | checkbox | - | - | - | - |
| Purchaser(s) / Buyer Name(s) | buyer_name | text | YES | Buyer | YES | No |
| Purchaser Address | buyer_address | text | NO | Buyer | NO | Yes |
| Purchaser Phone | buyer_phone | text | NO | Buyer | NO | Yes |
| Purchaser Email | buyer_email | text | NO | Buyer | NO | Yes |
| Vendor(s) / Seller Name(s) | seller_name | text | YES | Seller | YES | No |
| Vendor Address | seller_address | text | NO | Seller | NO | Yes |
| Vendor Phone | seller_phone | text | NO | Seller | NO | Yes |

**Louisiana-specific notes for Page 1:**
- "Purchaser" and "Vendor" are the official Louisiana civil law terms (not "Buyer"/"Seller") — extraction prompts must recognize both
- Parish field: Must be one of 64 Louisiana parishes. Validate against the parish list in `lib/contracts/lrec-fields.ts`
- Legal description format: "Lot [X], Block [Y], [Subdivision Name], [Parish]" — extracted from parish assessor records
- Community property: If buyer or seller is married, BOTH spouse names should appear

### Page 2: Purchase Price & Financing

| Field Label | Field ID | Type | Required | Filled By | Compliance Critical | Commonly Missed |
|---|---|---|---|---|---|---|
| Purchase Price (written) | purchase_price_written | text | YES | Buyer | YES | Yes (handwritten amounts hard to OCR) |
| Purchase Price (numeric) | purchase_price_numeric | currency | YES | Buyer | YES | No |
| Earnest Money Deposit Amount | earnest_money_amount | currency | YES | Buyer | YES | No |
| Earnest Money to be deposited with | earnest_money_holder | text | YES | Buyer | YES | Yes (title company name) |
| Earnest Money due within __ days | earnest_money_days | number | NO | Buyer | NO | Yes (default 2 business days) |
| Financing Type: | financing_type | checkbox group | YES | Buyer | YES | No |
| - Conventional | financing_conventional | checkbox | - | - | - | - |
| - FHA | financing_fha | checkbox | - | - | - | - |
| - VA | financing_va | checkbox | - | - | - | - |
| - USDA/Rural Development | financing_usda | checkbox | - | - | - | - |
| - Cash | financing_cash | checkbox | - | - | - | - |
| - Other: ___ | financing_other | text | - | - | - | - |
| Loan Amount | loan_amount | currency | NO | Buyer | NO | Yes |
| Down Payment Amount | down_payment | currency | NO | Buyer | NO | Yes |
| Interest Rate (if specified) | interest_rate | number | NO | Buyer | NO | Yes (often blank) |
| Seller Concessions (closing costs) | seller_concessions | currency | NO | Buyer | NO | Yes |
| Seller Concession Cap (% or $) | seller_concession_cap | text | NO | Buyer | NO | Yes |

### Page 3: Dates & Deadlines

| Field Label | Field ID | Type | Required | Filled By | Compliance Critical | Commonly Missed |
|---|---|---|---|---|---|---|
| Offer Date | offer_date | date | YES | Buyer | YES | No |
| Offer Expiration Date/Time | offer_expiration | datetime | YES | Buyer | YES | Yes (time component often missed) |
| Inspection Period: __ calendar days | inspection_days | number | YES | Buyer | YES | No |
| Appraisal Contingency: __ calendar days | appraisal_days | number | NO | Buyer | YES | Yes (often pre-printed 14) |
| Financing Contingency: __ calendar days | financing_days | number | NO | Buyer | YES | Yes (often pre-printed 25-30) |
| Closing Date (Act of Sale) | closing_date | date | YES | Both | YES | No |
| Possession: | possession_type | checkbox group | NO | Both | NO | No |
| - At Act of Sale | possession_at_closing | checkbox | - | - | - | - |
| - Other: ___ | possession_other | text | - | - | - | - |
| Occupancy/Possession Date | possession_date | date | NO | Both | NO | Yes |

**Deadline calculation rules (Louisiana-specific):**
- All periods are calendar days from date of acceptance (not offer date)
- If a deadline falls on Saturday, Sunday, or Louisiana state holiday, it rolls to the next business day
- Louisiana state holidays include Mardi Gras (unique to LA) — see `lib/louisiana-rules-engine.ts`
- Defaults: inspection 14 days, financing 25-30 days, appraisal 14 days

### Page 4-5: Inspections & Property Condition

| Field Label | Field ID | Type | Required | Filled By | Compliance Critical | Commonly Missed |
|---|---|---|---|---|---|---|
| Buyer's right to inspect: Yes/No | inspection_right | checkbox | YES | Both | YES | No |
| Termite/WDO Inspection Required | termite_required | checkbox | YES | Both | YES | No |
| Termite/WDO Inspection Paid By | termite_paid_by | checkbox group | NO | Both | NO | Yes |
| - Buyer | termite_buyer_pays | checkbox | - | - | - | - |
| - Seller | termite_seller_pays | checkbox | - | - | - | - |
| Property sold "AS IS" | as_is | checkbox | NO | Both | YES | No |
| Seller to make repairs up to $__ | repair_cap | currency | NO | Both | NO | Yes |
| Home Warranty: Yes/No | home_warranty | checkbox | NO | Both | NO | No |
| Home Warranty Provider | home_warranty_provider | text | NO | Both | NO | Yes |
| Home Warranty Cost | home_warranty_cost | currency | NO | Both | NO | Yes |
| Home Warranty Paid By | home_warranty_paid_by | checkbox group | NO | Both | NO | Yes |
| Survey Required: Yes/No | survey_required | checkbox | NO | Both | NO | No |
| Survey Paid By | survey_paid_by | checkbox group | NO | Both | NO | Yes |

**Louisiana-specific: Termite (WDO/WDI) — La. R.S. 9:1131.1**
- Wood Destroying Insect (WDI) report required for ALL residential sales
- Report must be from a Louisiana-licensed pest control operator
- Report must be dated within 10 days of the Act of Sale
- Covers: subterranean termites, drywood termites, Formosan termites, powderpost beetles, old house borers
- Louisiana has the highest Formosan termite density in the US (New Orleans metro especially)
- Termite bond transferability is a significant negotiation point

### Page 5-6: Louisiana-Specific Terms

| Field Label | Field ID | Type | Required | Filled By | Compliance Critical | Commonly Missed |
|---|---|---|---|---|---|---|
| **Mineral Rights** | | | | | | |
| Mineral rights included with sale: Yes/No | mineral_rights_included | checkbox | YES | Seller | YES | Yes |
| Mineral rights exceptions/reservations | mineral_rights_exceptions | text | NO | Seller | YES | Yes (critical when "No") |
| Buyer acknowledges mineral rights status | mineral_rights_buyer_ack | checkbox | YES (2026) | Buyer | YES | Yes (NEW 2026 field) |
| **Flood Zone** | | | | | | |
| Property is in FEMA flood zone: Yes/No/Unknown | flood_zone_status | checkbox group | YES | Seller | YES | No |
| Flood Zone designation | flood_zone_code | text | NO | Seller | YES | Yes (small field) |
| Flood insurance required: Yes/No | flood_insurance_required | checkbox | NO | Seller | YES | Yes |
| Property has flooded previously: Yes/No | flood_history | checkbox | YES | Seller | YES | No |
| **Servitudes (Easements)** | | | | | | |
| Known servitudes/easements | servitudes | text | NO | Seller | YES (for title) | Yes |
| **Title** | | | | | | |
| Title Company / Closing Attorney | title_company | text | NO | Both | NO | No |
| Title Insurance Paid By | title_insurance_paid_by | checkbox group | NO | Both | NO | Yes |
| Act of Sale Location | act_of_sale_location | text | NO | Both | NO | Yes |

**Mineral Rights (La. R.S. 31:1-214):**
- Louisiana is the ONLY state with a comprehensive Mineral Code
- Mineral rights can be severed from surface rights and sold/leased independently
- In oil-producing parishes (Caddo, Calcasieu, Lafourche, Terrebonne), mineral rights exclusion is common
- The 2026 form update requires explicit buyer acknowledgment checkbox — extraction MUST capture this
- Mineral rights can "prescribe" (be lost) through 10 years of non-use (La. R.S. 31:27)

**Flood Zone (La. R.S. 38:84):**
- Seller MUST disclose known flooding history
- Post-2016 Great Flood: thousands of properties remapped to higher flood zones
- Zone A/AE = mandatory flood insurance for any federally-backed mortgage
- Zone X (shaded) = moderate risk, insurance recommended
- Zone X (unshaded) = minimal risk

### Page 6-7: Additional Terms & Contingencies

| Field Label | Field ID | Type | Required | Filled By | Compliance Critical | Commonly Missed |
|---|---|---|---|---|---|---|
| Appliances/fixtures included | appliances_included | text | NO | Both | NO | Yes (long list) |
| Personal property included | personal_property | text | NO | Both | NO | Yes |
| Exclusions from sale | exclusions | text | NO | Seller | NO | Yes |
| Special stipulations/conditions | special_stipulations | text | NO | Both | YES | Yes (free text, often critical) |
| Addenda attached (checklist) | addenda_checklist | checkbox group | NO | Both | YES | No |
| - Counter-Offer (LREC-006) | addendum_counter | checkbox | - | - | - | - |
| - Lead-Based Paint (LREC-010) | addendum_lead_paint | checkbox | - | - | - | - |
| - Condominium Addendum | addendum_condo | checkbox | - | - | - | - |
| - New Construction Addendum | addendum_new_construction | checkbox | - | - | - | - |
| - Historic District Addendum | addendum_historic | checkbox | - | - | - | - |
| - Private Sewerage/Water Well | addendum_sewerage | checkbox | - | - | - | - |
| - Inspection Response | addendum_inspection | checkbox | - | - | - | - |
| - Other: ___ | addendum_other | text | - | - | - | - |
| Sale contingent on buyer selling property: Yes/No | contingent_sale | checkbox | NO | Buyer | NO | No |
| Contingent property address | contingent_property | text | NO | Buyer | NO | Yes |

### Page 7-8: Agency Disclosure Section

| Field Label | Field ID | Type | Required | Filled By | Compliance Critical | Commonly Missed |
|---|---|---|---|---|---|---|
| Listing Agent Name | listing_agent_name | text | YES | Listing Agent | YES | No |
| Listing Agent License # | listing_agent_license | text | YES | Listing Agent | YES | Yes (small font) |
| Listing Brokerage | listing_brokerage | text | YES | Listing Agent | YES | No |
| Listing Brokerage License # | listing_brokerage_license | text | NO | Listing Agent | NO | Yes |
| Selling/Buyer Agent Name | selling_agent_name | text | YES | Selling Agent | YES | No |
| Selling Agent License # | selling_agent_license | text | YES | Selling Agent | YES | Yes (small font) |
| Selling Brokerage | selling_brokerage | text | YES | Selling Agent | YES | No |
| Selling Brokerage License # | selling_brokerage_license | text | NO | Selling Agent | NO | Yes |
| Agent represents: Buyer / Seller / Dual | agent_representation | checkbox group | YES | Agent | YES | No |
| Buyer Agent Compensation | buyer_agent_compensation | text | YES (post-NAR) | Both | YES | Yes (new requirement) |
| Listing Agent Compensation | listing_agent_compensation | text | NO | Seller | NO | Yes |

### Page 9-10: Buyer Signatures

| Field Label | Field ID | Type | Required | Filled By | Compliance Critical | Commonly Missed |
|---|---|---|---|---|---|---|
| Buyer/Purchaser Signature | buyer_signature_1 | signature | YES | Buyer | YES | No |
| Buyer Print Name | buyer_print_name_1 | text | YES | Buyer | YES | Yes |
| Buyer Date Signed | buyer_sign_date_1 | date | YES | Buyer | YES | Yes (handwritten) |
| Co-Buyer/Spouse Signature | buyer_signature_2 | signature | CONDITIONAL | Co-Buyer/Spouse | YES | Yes (community property!) |
| Co-Buyer Print Name | buyer_print_name_2 | text | CONDITIONAL | Co-Buyer/Spouse | YES | Yes |
| Co-Buyer Date Signed | buyer_sign_date_2 | date | CONDITIONAL | Co-Buyer/Spouse | YES | Yes |

### Page 10-11: Seller Signatures

| Field Label | Field ID | Type | Required | Filled By | Compliance Critical | Commonly Missed |
|---|---|---|---|---|---|---|
| Seller/Vendor Signature | seller_signature_1 | signature | YES | Seller | YES | No |
| Seller Print Name | seller_print_name_1 | text | YES | Seller | YES | Yes |
| Seller Date Signed | seller_sign_date_1 | date | YES | Seller | YES | Yes |
| Co-Seller/Spouse Signature | seller_signature_2 | signature | CONDITIONAL | Co-Seller/Spouse | YES | Yes (community property!) |
| Co-Seller Print Name | seller_print_name_2 | text | CONDITIONAL | Co-Seller/Spouse | YES | Yes |
| Co-Seller Date Signed | seller_sign_date_2 | date | CONDITIONAL | Co-Seller/Spouse | YES | Yes |
| Acceptance Date | acceptance_date | date | YES | Last signing party | YES | Yes (often missed) |
| Acceptance Time | acceptance_time | time | NO | Last signing party | NO | Yes |

### Page 11-12: Agent/Broker Signatures & Addenda

| Field Label | Field ID | Type | Required | Filled By | Compliance Critical | Commonly Missed |
|---|---|---|---|---|---|---|
| Listing Agent Signature | listing_agent_signature | signature | YES | Listing Agent | YES | No |
| Listing Agent Date | listing_agent_sign_date | date | YES | Listing Agent | NO | Yes |
| Selling Agent Signature | selling_agent_signature | signature | YES | Selling Agent | YES | No |
| Selling Agent Date | selling_agent_sign_date | date | YES | Selling Agent | NO | Yes |
| Listing Broker Signature | listing_broker_signature | signature | NO | Broker | NO | Yes |
| Selling Broker Signature | selling_broker_signature | signature | NO | Broker | NO | Yes |

### LREC-101 AcroForm Field Names

```typescript
const LREC_101_ACROFORM = {
  // DocuSign field names -> AIRE field IDs
  docusign: {
    'Text_PropertyAddress': 'property_address',
    'Text_City': 'property_city',
    'Text_Zip': 'property_zip',
    'Text_Parish': 'property_parish',
    'Text_LegalDescription': 'legal_description',
    'Text_MLSNumber': 'mls_number',
    'Signer1_FullName': 'buyer_name',
    'Signer1_Email': 'buyer_email',
    'Signer2_FullName': 'seller_name',
    'Signer2_Email': 'seller_email',
    'Text_PurchasePrice': 'purchase_price_numeric',
    'Text_EarnestMoney': 'earnest_money_amount',
    'Text_EMHolder': 'earnest_money_holder',
    'Text_ClosingDate': 'closing_date',
    'Text_InspectionDays': 'inspection_days',
    'CheckBox_Conventional': 'financing_conventional',
    'CheckBox_FHA': 'financing_fha',
    'CheckBox_VA': 'financing_va',
    'CheckBox_Cash': 'financing_cash',
    'Text_MineralRights': 'mineral_rights_included',
    'DateSigned_1': 'buyer_sign_date_1',
    'DateSigned_2': 'seller_sign_date_1',
    'Signature_1': 'buyer_signature_1',
    'Signature_2': 'seller_signature_1',
  },
  // DotLoop field names -> AIRE field IDs
  dotloop: {
    'buyer_name': 'buyer_name',
    'seller_name': 'seller_name',
    'property_address': 'property_address',
    'purchase_price': 'purchase_price_numeric',
    'earnest_money': 'earnest_money_amount',
    'closing_date': 'closing_date',
    'mls_number': 'mls_number',
    'listing_agent': 'listing_agent_name',
    'selling_agent': 'selling_agent_name',
    'inspection_period': 'inspection_days',
    'financing_type': 'financing_type',
  },
}
```

### LREC-101 AirSign Auto-Field Placement

```typescript
const LREC_101_FIELD_TEMPLATE = [
  // Buyer signatures (page 9-10)
  { type: "SIGNATURE", page: 9, xPercent: 10, yPercent: 75, widthPercent: 35, heightPercent: 5, assignTo: "buyer" },
  { type: "DATE", page: 9, xPercent: 55, yPercent: 75, widthPercent: 15, heightPercent: 4, assignTo: "buyer" },
  { type: "SIGNATURE", page: 9, xPercent: 10, yPercent: 82, widthPercent: 35, heightPercent: 5, assignTo: "buyer_spouse" },
  { type: "DATE", page: 9, xPercent: 55, yPercent: 82, widthPercent: 15, heightPercent: 4, assignTo: "buyer_spouse" },
  // Seller signatures (page 10-11)
  { type: "SIGNATURE", page: 10, xPercent: 10, yPercent: 25, widthPercent: 35, heightPercent: 5, assignTo: "seller" },
  { type: "DATE", page: 10, xPercent: 55, yPercent: 25, widthPercent: 15, heightPercent: 4, assignTo: "seller" },
  { type: "SIGNATURE", page: 10, xPercent: 10, yPercent: 32, widthPercent: 35, heightPercent: 5, assignTo: "seller_spouse" },
  { type: "DATE", page: 10, xPercent: 55, yPercent: 32, widthPercent: 15, heightPercent: 4, assignTo: "seller_spouse" },
  // Agent signatures (page 11-12)
  { type: "SIGNATURE", page: 11, xPercent: 10, yPercent: 60, widthPercent: 35, heightPercent: 5, assignTo: "buyer_agent" },
  { type: "DATE", page: 11, xPercent: 55, yPercent: 60, widthPercent: 15, heightPercent: 4, assignTo: "buyer_agent" },
  { type: "SIGNATURE", page: 11, xPercent: 10, yPercent: 75, widthPercent: 35, heightPercent: 5, assignTo: "seller_agent" },
  { type: "DATE", page: 11, xPercent: 55, yPercent: 75, widthPercent: 15, heightPercent: 4, assignTo: "seller_agent" },
  // Initials on every page (1-8)
  ...Array.from({ length: 8 }, (_, i) => ({
    type: "INITIALS", page: i + 1, xPercent: 85, yPercent: 92, widthPercent: 8, heightPercent: 3, assignTo: "all_signers",
  })),
]
```

### LREC-101 Form-Specific Extraction Prompt

```
You are extracting fields from an LREC-101 Louisiana Residential Agreement to Buy or Sell.

Louisiana uses different terminology than other states:
- "Purchaser" = Buyer
- "Vendor" = Seller
- "Parish" = County (Louisiana has parishes, NOT counties)
- "Act of Sale" = Closing
- "Servitudes" = Easements

CRITICAL Louisiana fields to never miss:
1. Parish name (NOT county — validate against 64 Louisiana parishes)
2. Mineral rights status (included/excluded + buyer acknowledgment checkbox)
3. Flood zone designation and flood history
4. Termite/WDO inspection requirement (mandatory per La. R.S. 9:1131.1)
5. Community property: check if spouse/co-signer signatures are present
6. Act of Sale date (this is the closing date)
7. Acceptance date and time (determines when deadlines start)

COMPLIANCE FLAGS (return as warnings):
- Missing spouse signature when community property is indicated
- Mineral rights excluded without buyer acknowledgment (2026 requirement)
- Property in flood zone A/AE without flood insurance discussion
- Inspection period under 10 days (unusually short)
- No earnest money amount specified
- Pre-1978 property without lead paint disclosure referenced in addenda checklist
- Missing WDO/termite inspection checkbox
```

---

## FORM 2: LREC-002 — Exclusive Right to Represent Buyer

**Form Number**: LREC-002
**Title**: Exclusive Right to Represent Buyer Agreement
**Current Revision**: Rev. 2025 (updated post-NAR settlement)
**Typical Page Count**: 3-4 pages
**Required Parties**: Buyer, Buyer's Agent
**Statute**: La. R.S. 37:1449 (Agency Disclosure), NAR Settlement compliance
**Classifier Type ID**: Needs to be added (currently not in `DOCUMENT_PATTERNS`)

### Page 1: Parties & Term

| Field Label | Field ID | Type | Required | Filled By | Compliance Critical | Commonly Missed |
|---|---|---|---|---|---|---|
| Buyer/Client Name(s) | buyer_name | text | YES | Buyer | YES | No |
| Buyer Address | buyer_address | text | NO | Buyer | NO | Yes |
| Buyer Phone | buyer_phone | text | NO | Buyer | NO | Yes |
| Buyer Email | buyer_email | text | NO | Buyer | NO | Yes |
| Agent Name | agent_name | text | YES | Agent | YES | No |
| Agent License Number | agent_license | text | YES | Agent | YES | Yes (small font) |
| Brokerage Name | brokerage_name | text | YES | Agent | YES | No |
| Brokerage License Number | brokerage_license | text | NO | Agent | NO | Yes |
| Brokerage Address | brokerage_address | text | NO | Agent | NO | Yes |
| Agreement Start Date | start_date | date | YES | Both | YES | No |
| Agreement End Date | end_date | date | YES | Both | YES | Yes |
| Agreement Term (months) | term_months | number | NO | Both | NO | Yes |
| Geographic Area (parishes/cities) | geographic_area | text | NO | Both | NO | Yes |
| Property Types Sought | property_types | text | NO | Buyer | NO | Yes |
| Price Range: Low | price_range_low | currency | NO | Buyer | NO | Yes |
| Price Range: High | price_range_high | currency | NO | Buyer | NO | Yes |

### Page 2: Compensation & Duties

| Field Label | Field ID | Type | Required | Filled By | Compliance Critical | Commonly Missed |
|---|---|---|---|---|---|---|
| **Buyer Agent Compensation** | buyer_agent_compensation | text | YES | Both | YES (post-NAR) | No |
| Compensation Amount (% or $) | compensation_amount | text | YES | Both | YES | No |
| Compensation paid by: | compensation_paid_by | checkbox group | YES | Both | YES | Yes |
| - Buyer | comp_buyer_pays | checkbox | - | - | - | - |
| - Seller (if offered) | comp_seller_pays | checkbox | - | - | - | - |
| - Split | comp_split | checkbox | - | - | - | - |
| If seller offers less than agreed, buyer pays difference: Yes/No | buyer_pays_difference | checkbox | YES | Both | YES | Yes (critical post-NAR) |
| Retainer Fee | retainer_fee | currency | NO | Both | NO | Yes |
| Exclusive representation: Yes/No | exclusive | checkbox | YES | Both | YES | No |
| Buyer may terminate with __ days written notice | termination_notice_days | number | NO | Both | NO | Yes |

### Page 3-4: Disclosures & Signatures

| Field Label | Field ID | Type | Required | Filled By | Compliance Critical | Commonly Missed |
|---|---|---|---|---|---|---|
| Dual agency disclosure acknowledged | dual_agency_acknowledged | checkbox | YES | Buyer | YES | No |
| Fair housing disclosure | fair_housing_acknowledged | checkbox | YES | Buyer | YES | No |
| Buyer Signature | buyer_signature | signature | YES | Buyer | YES | No |
| Buyer Date Signed | buyer_sign_date | date | YES | Buyer | YES | Yes |
| Co-Buyer/Spouse Signature | co_buyer_signature | signature | CONDITIONAL | Co-Buyer | YES | Yes |
| Co-Buyer Date Signed | co_buyer_sign_date | date | CONDITIONAL | Co-Buyer | YES | Yes |
| Agent Signature | agent_signature | signature | YES | Agent | YES | No |
| Agent Date Signed | agent_sign_date | date | YES | Agent | NO | Yes |
| Broker Signature | broker_signature | signature | NO | Broker | NO | Yes |

**Post-NAR Settlement Notes (2024-2025):**
- Buyer agent compensation MUST be explicitly agreed in writing BEFORE showing any property
- This form is now MANDATORY before buyer touring (was optional before 2024)
- Compensation amount must be specific (not "whatever seller offers")
- If seller offers less than agreed compensation, the form must state who pays the difference
- Extracting the compensation terms is now compliance-critical

### Classifier Pattern to Add

```typescript
{
  type: "buyer_representation",
  category: "mandatory",
  patterns: [
    /exclusive\s+right\s+to\s+represent\s+buyer/i,
    /buyer\s+representation\s+agreement/i,
    /buyer\s+agency\s+agreement/i,
    /LREC.*002/i,
    /buyer.*broker.*agreement/i,
  ],
  lrecFormNumber: "LREC-002",
},
```

---

## FORM 3: LREC-001 — Exclusive Listing Agreement

**Form Number**: LREC-001
**Title**: Exclusive Right to Sell / Listing Agreement
**Current Revision**: Rev. 2025
**Typical Page Count**: 4-5 pages
**Required Parties**: Seller(s), Listing Agent
**Statute**: La. R.S. 37:1431 et seq.
**Classifier Type ID**: Needs to be added

### Page 1: Property & Parties

| Field Label | Field ID | Type | Required | Filled By | Compliance Critical | Commonly Missed |
|---|---|---|---|---|---|---|
| Seller/Owner Name(s) | seller_name | text | YES | Seller | YES | No |
| Seller Address (if different from property) | seller_address | text | NO | Seller | NO | Yes |
| Seller Phone | seller_phone | text | NO | Seller | NO | Yes |
| Seller Email | seller_email | text | NO | Seller | NO | Yes |
| Property Address | property_address | text | YES | Agent | YES | No |
| City | property_city | text | YES | Agent | YES | No |
| Parish | property_parish | text | YES | Agent | YES | Yes |
| Zip | property_zip | text | YES | Agent | NO | No |
| Legal Description | legal_description | text | NO | Agent | YES (for MLS) | Yes (often left blank) |
| Property Type | property_type | checkbox group | YES | Agent | NO | No |
| Year Built | year_built | number | NO | Agent | NO | Yes |
| Square Footage | square_footage | number | NO | Agent | NO | No |
| Bedrooms | bedrooms | number | NO | Agent | NO | No |
| Bathrooms | bathrooms | number | NO | Agent | NO | No |
| Lot Size | lot_size | text | NO | Agent | NO | Yes |

### Page 2: Listing Terms

| Field Label | Field ID | Type | Required | Filled By | Compliance Critical | Commonly Missed |
|---|---|---|---|---|---|---|
| List Price | list_price | currency | YES | Both | YES | No |
| Listing Start Date | listing_start_date | date | YES | Both | YES | No |
| Listing Expiration Date | listing_expiration_date | date | YES | Both | YES | Yes |
| Listing Term (months) | listing_term_months | number | NO | Both | NO | Yes |
| Listing Agent Name | listing_agent_name | text | YES | Agent | YES | No |
| Listing Agent License # | listing_agent_license | text | YES | Agent | YES | Yes |
| Brokerage Name | brokerage_name | text | YES | Agent | YES | No |
| Brokerage License # | brokerage_license | text | NO | Agent | NO | Yes |
| Commission Rate (%) | commission_rate | number | YES | Both | YES | No |
| Commission split with cooperating broker | coop_commission | number | NO | Agent | NO | Yes |
| Listing agent compensation | listing_agent_compensation | text | YES | Both | YES | No |
| Cooperating broker compensation offered | coop_broker_compensation | text | YES (post-NAR) | Both | YES | Yes |
| Lockbox authorized: Yes/No | lockbox_authorized | checkbox | NO | Seller | NO | No |
| Sign in yard authorized: Yes/No | sign_authorized | checkbox | NO | Seller | NO | No |
| Open house authorized: Yes/No | open_house_authorized | checkbox | NO | Seller | NO | No |

### Page 3: Seller Obligations & Disclosures

| Field Label | Field ID | Type | Required | Filled By | Compliance Critical | Commonly Missed |
|---|---|---|---|---|---|---|
| Seller warrants clear title | clear_title_warranty | checkbox | YES | Seller | YES | No |
| Known liens/encumbrances | known_liens | text | NO | Seller | YES | Yes |
| Known servitudes/easements | known_servitudes | text | NO | Seller | YES | Yes |
| Mineral rights status | mineral_rights_status | checkbox group | YES | Seller | YES | Yes |
| - All mineral rights included | mineral_all_included | checkbox | - | - | - | - |
| - Mineral rights excluded/reserved | mineral_excluded | checkbox | - | - | - | - |
| - Partial mineral rights | mineral_partial | checkbox | - | - | - | - |
| Mineral rights details | mineral_details | text | NO | Seller | YES | Yes |
| Property in flood zone | flood_zone | checkbox | YES | Seller | YES | No |
| Property has flooded | flood_history | checkbox | YES | Seller | YES | No |
| HOA/POA: Yes/No | hoa_exists | checkbox | NO | Seller | NO | No |
| HOA monthly dues | hoa_dues | currency | NO | Seller | NO | Yes |
| Seller to provide Property Disclosure | pdd_provided | checkbox | YES | Seller | YES | No |

### Page 4-5: Signatures

| Field Label | Field ID | Type | Required | Filled By | Compliance Critical | Commonly Missed |
|---|---|---|---|---|---|---|
| Seller Signature | seller_signature_1 | signature | YES | Seller | YES | No |
| Seller Print Name | seller_print_name_1 | text | YES | Seller | YES | Yes |
| Seller Date | seller_sign_date_1 | date | YES | Seller | YES | Yes |
| Co-Seller/Spouse Signature | seller_signature_2 | signature | CONDITIONAL | Spouse | YES | Yes (community property!) |
| Co-Seller Print Name | seller_print_name_2 | text | CONDITIONAL | Spouse | YES | Yes |
| Co-Seller Date | seller_sign_date_2 | date | CONDITIONAL | Spouse | YES | Yes |
| Agent Signature | agent_signature | signature | YES | Agent | YES | No |
| Agent Date | agent_sign_date | date | YES | Agent | NO | Yes |
| Broker Signature | broker_signature | signature | NO | Broker | NO | Yes |

**Community Property Warning:**
If the property was acquired during marriage, it is presumed community property (La. C.C. Art. 2338). BOTH spouses must sign the listing agreement even if only one spouse's name is on the title. Failure to get both signatures can void the listing.

### Classifier Pattern to Add

```typescript
{
  type: "listing_agreement",
  category: "mandatory",
  patterns: [
    /exclusive\s+right\s+to\s+sell/i,
    /listing\s+agreement/i,
    /exclusive\s+listing/i,
    /LREC.*001/i,
    /right\s+to\s+sell\s+agreement/i,
  ],
  lrecFormNumber: "LREC-001",
},
```

---

## FORM 4: LREC-006 — Counter-Offer

**Form Number**: LREC-006
**Title**: Counter-Offer to Purchase Agreement
**Current Revision**: Rev. 2024
**Typical Page Count**: 2 pages
**Required Parties**: Counter-offering party (Buyer or Seller)
**Statute**: La. C.C. Art. 1943-1947 (Offer and Acceptance)
**Classifier Type ID**: `counter_offer` (needs to be added to classifier)

### Page 1: Counter-Offer Terms

| Field Label | Field ID | Type | Required | Filled By | Compliance Critical | Commonly Missed |
|---|---|---|---|---|---|---|
| **Reference to Original Agreement** | | | | | | |
| Property Address | property_address | text | YES | Agent | YES | No |
| Original Offer Date | original_offer_date | date | YES | Agent | YES | Yes |
| Original Purchase Price | original_price | currency | NO | Agent | NO | No |
| Buyer Name(s) | buyer_name | text | YES | Agent | YES | No |
| Seller Name(s) | seller_name | text | YES | Agent | YES | No |
| Counter-Offer Number (1st, 2nd, etc.) | counter_number | number | NO | Agent | NO | Yes (critical for ordering) |
| **Counter-Offer Terms** | | | | | | |
| Counter Purchase Price | counter_price | currency | YES* | Counter party | YES | No |
| Counter Closing Date | counter_closing_date | date | NO | Counter party | NO | Yes |
| Counter Inspection Period | counter_inspection_days | number | NO | Counter party | NO | Yes |
| Counter Financing Terms | counter_financing | text | NO | Counter party | NO | Yes |
| Counter Earnest Money | counter_earnest_money | currency | NO | Counter party | NO | Yes |
| Counter Seller Concessions | counter_concessions | currency | NO | Counter party | NO | Yes |
| Additional/Modified Terms | counter_additional_terms | text | NO | Counter party | YES | Yes (free text, often handwritten) |
| Counter-Offer Expiration Date | counter_expiration_date | date | YES | Counter party | YES | Yes |
| Counter-Offer Expiration Time | counter_expiration_time | time | YES | Counter party | YES | Yes (time often missed) |

*Counter price required only if price is being changed.

### Page 2: Signatures

| Field Label | Field ID | Type | Required | Filled By | Compliance Critical | Commonly Missed |
|---|---|---|---|---|---|---|
| Counter-offering Party Signature | counter_signature_1 | signature | YES | Counter party | YES | No |
| Counter-offering Party Print Name | counter_print_name_1 | text | YES | Counter party | YES | Yes |
| Counter-offering Party Date | counter_sign_date_1 | date | YES | Counter party | YES | Yes |
| Co-Signer/Spouse Signature | counter_signature_2 | signature | CONDITIONAL | Spouse | YES | Yes |
| Co-Signer Date | counter_sign_date_2 | date | CONDITIONAL | Spouse | YES | Yes |
| **Acceptance Section** | | | | | | |
| Accepted By Signature | acceptance_signature_1 | signature | YES (if accepted) | Other party | YES | No |
| Accepted By Print Name | acceptance_print_name_1 | text | YES (if accepted) | Other party | YES | Yes |
| Acceptance Date | acceptance_date | date | YES (if accepted) | Other party | YES | Yes |
| Acceptance Time | acceptance_time | time | NO | Other party | NO | Yes |
| Co-Acceptance Signature (Spouse) | acceptance_signature_2 | signature | CONDITIONAL | Spouse | YES | Yes |
| **Rejection Section** | | | | | | |
| Rejected checkbox | rejected | checkbox | NO | Other party | YES | No |
| Rejected Date | rejected_date | date | NO | Other party | NO | Yes |

**Extraction notes:**
- Counter-offers frequently have handwritten modifications — lowest extraction accuracy area
- Multiple counter-offers may exist on the same deal — counter_number is critical for ordering
- The acceptance section determines whether this counter is the final binding agreement
- If accepted, the acceptance_date becomes the new contract date for deadline calculations
- Both spouses must sign counter-offers on community property (La. C.C. Art. 2347)

### Classifier Pattern to Add

```typescript
{
  type: "counter_offer",
  category: "mandatory",
  patterns: [
    /counter.?offer/i,
    /counter\s+proposal/i,
    /LREC.*006/i,
    /response\s+to\s+offer/i,
  ],
  lrecFormNumber: "LREC-006",
},
```

---

## FORM 5: LREC-010 — Lead-Based Paint Disclosure

**Form Number**: LREC-010 (federal form adapted for Louisiana)
**Title**: Disclosure of Information on Lead-Based Paint and/or Lead-Based Paint Hazards
**Current Revision**: Federal standard (42 U.S.C. 4852d)
**Typical Page Count**: 2-3 pages
**Required**: Mandatory for ALL residential properties built before 1978
**Statute**: 42 U.S.C. 4852d, 24 CFR Part 35, 40 CFR Part 745
**Classifier Type ID**: `lead_paint` (already mapped)
**Penalty for non-compliance**: Up to $19,507 per violation (2024 adjusted)

### Page 1: Seller Disclosure

| Field Label | Field ID | Type | Required | Filled By | Compliance Critical | Commonly Missed |
|---|---|---|---|---|---|---|
| Property Address | property_address | text | YES | Seller | YES | No |
| **Seller's Disclosure (check one):** | | | | | | |
| (a) Known lead-based paint present | lead_paint_known | checkbox | YES | Seller | YES | No |
| (b) No knowledge of lead-based paint | lead_paint_unknown | checkbox | YES | Seller | YES | No |
| Explain known lead paint (if a) | lead_paint_details | text | CONDITIONAL | Seller | YES | Yes |
| **Records and Reports (check one):** | | | | | | |
| (a) Records/reports available (attached) | records_available | checkbox | YES | Seller | YES | No |
| (b) No records/reports available | records_unavailable | checkbox | YES | Seller | YES | No |
| Description of records | records_description | text | CONDITIONAL | Seller | YES | Yes |
| Seller Name(s) | seller_name | text | YES | Seller | YES | No |
| Seller Signature | seller_signature | signature | YES | Seller | YES | No |
| Seller Date | seller_sign_date | date | YES | Seller | YES | Yes |

### Page 2: Buyer Acknowledgment

| Field Label | Field ID | Type | Required | Filled By | Compliance Critical | Commonly Missed |
|---|---|---|---|---|---|---|
| **Buyer's Acknowledgment (check one each):** | | | | | | |
| (a) Buyer received lead paint pamphlet | pamphlet_received | checkbox | YES | Buyer | YES | No |
| (b) Buyer received disclosure from seller | disclosure_received | checkbox | YES | Buyer | YES | No |
| **Buyer's Inspection Opportunity (check one):** | | | | | | |
| (a) Buyer will conduct inspection within 10 days | inspection_elected | checkbox | YES | Buyer | YES | No |
| (b) Buyer waives right to inspection | inspection_waived | checkbox | YES | Buyer | YES | No |
| Buyer Name(s) | buyer_name | text | YES | Buyer | YES | No |
| Buyer Signature | buyer_signature | signature | YES | Buyer | YES | No |
| Buyer Date | buyer_sign_date | date | YES | Buyer | YES | Yes |

### Page 2-3: Agent Acknowledgment

| Field Label | Field ID | Type | Required | Filled By | Compliance Critical | Commonly Missed |
|---|---|---|---|---|---|---|
| Agent has informed seller of obligations | agent_informed_seller | checkbox | YES | Agent | YES | No |
| Agent is aware of duty to ensure compliance | agent_compliance_duty | checkbox | YES | Agent | YES | No |
| Listing Agent Signature | listing_agent_signature | signature | YES | Listing Agent | YES | No |
| Listing Agent Date | listing_agent_sign_date | date | YES | Listing Agent | YES | Yes |
| Selling Agent Signature | selling_agent_signature | signature | YES | Selling Agent | YES | No |
| Selling Agent Date | selling_agent_sign_date | date | YES | Selling Agent | YES | Yes |

**Compliance notes:**
- ALL three sections (seller, buyer, agent) must be completed — incomplete forms are a federal violation
- The 10-day lead paint inspection period is separate from the LREC-101 general inspection period
- Year built MUST be verified — if uncertain, treat as pre-1978 and require the disclosure
- This form must be completed BEFORE the buyer is obligated under the purchase agreement

### Compliance Rule

```
IF year_built < 1978 AND document_type == "purchase_agreement":
  REQUIRE lead_paint_disclosure in transaction.documents
  CITE: 42 U.S.C. 4852d, La. R.S. 9:3198
  PENALTY: Up to $19,507 per violation
```

---

## FORM 6: Property Disclosure Document (PDD)

**Form Number**: LREC-PDD (no specific LREC number — mandated by statute)
**Title**: Louisiana Property Disclosure Document for Residential Real Property
**Current Revision**: Rev. January 2026 (expanded flood section)
**Typical Page Count**: 4-6 pages
**Required Parties**: Seller (mandatory), Buyer (acknowledgment)
**Statute**: La. R.S. 9:3196-3200
**Classifier Type ID**: `property_disclosure` (already mapped)

### Page 1: Property Identification

| Field Label | Field ID | Type | Required | Filled By | Compliance Critical | Commonly Missed |
|---|---|---|---|---|---|---|
| Property Address | property_address | text | YES | Seller | YES | No |
| City, State, Zip | property_city_state_zip | text | YES | Seller | YES | No |
| Parish | property_parish | text | YES | Seller | YES | Yes |
| Seller Name(s) | seller_name | text | YES | Seller | YES | No |
| Date of Seller's Ownership | ownership_start_date | date | NO | Seller | NO | Yes |
| Year Built (or approximate) | year_built | number | NO | Seller | NO | No |
| Square Footage (approximate) | square_footage | number | NO | Seller | NO | No |

### Page 1-2: Structural & Systems (Yes/No/Unknown format)

| Disclosure Item | Field ID | Type | Red Flag If | Louisiana-Specific |
|---|---|---|---|---|
| **ROOF** | | | | |
| Roof age (years) | roof_age | number | > 20 years | No |
| Any known roof leaks or damage | roof_leaks | yes/no/unknown | Yes | No |
| Roof repairs made during ownership | roof_repairs | yes/no/unknown | - | No |
| Roof repair details | roof_repair_details | text | - | No |
| **FOUNDATION** | | | | |
| Foundation cracks or settling | foundation_cracks | yes/no/unknown | Yes | No |
| Foundation repairs | foundation_repairs | yes/no/unknown | - | No |
| Foundation repair details | foundation_repair_details | text | - | No |
| **PLUMBING** | | | | |
| Plumbing leaks or problems | plumbing_issues | yes/no/unknown | Yes | No |
| Type of water supply (public/well) | water_supply_type | text | Well (triggers addendum) | No |
| Type of sewage system (public/septic) | sewage_type | text | Septic (triggers addendum) | No |
| Polybutylene piping | polybutylene_piping | yes/no/unknown | Yes | No |
| **ELECTRICAL** | | | | |
| Electrical problems | electrical_issues | yes/no/unknown | Yes | No |
| Aluminum wiring | aluminum_wiring | yes/no/unknown | Yes | No |
| **HVAC** | | | | |
| HVAC age (years) | hvac_age | number | > 15 years | No |
| HVAC type | hvac_type | text | - | No |
| HVAC problems | hvac_issues | yes/no/unknown | Yes | No |

### Page 2-3: Environmental & Louisiana-Specific Disclosures

| Disclosure Item | Field ID | Type | Red Flag If | Louisiana-Specific |
|---|---|---|---|---|
| **TERMITE / WOOD DESTROYING ORGANISMS** | | | | |
| Previous termite infestation | termite_history | yes/no/unknown | Yes | YES |
| Termite treatment history | termite_treatment | yes/no/unknown | - | YES |
| Termite treatment company | termite_treatment_company | text | - | YES |
| Termite treatment date | termite_treatment_date | date | - | YES |
| Active termite bond/contract | termite_bond_active | yes/no/unknown | - | YES |
| Termite bond transferable | termite_bond_transferable | yes/no/unknown | - | YES |
| Termite damage repaired | termite_damage_repaired | yes/no/unknown | - | YES |
| **FLOODING (expanded in 2026 revision)** | | | | |
| Property has flooded | flood_history | yes/no/unknown | Yes | YES |
| Number of times flooded | flood_count | number | > 0 | YES |
| Most recent flood date | flood_last_date | date | - | YES |
| Flood water height (approximate) | flood_water_height | text | - | YES |
| Flood damage repaired | flood_repairs_made | yes/no/unknown | - | YES |
| Flood repair details | flood_repair_details | text | - | YES |
| Flood insurance currently active | flood_insurance_active | yes/no/unknown | No = risk | YES |
| FEMA flood zone designation | flood_zone_code | text | A, AE = high risk | YES |
| Elevation certificate available | elevation_cert_available | yes/no/unknown | - | YES |
| Property in NFIP repetitive loss area | nfip_repetitive_loss | yes/no/unknown | Yes = very high risk | YES |
| **MOLD / MOISTURE** | | | | |
| Mold or mildew present or treated | mold_history | yes/no/unknown | Yes | YES (humidity) |
| Water intrusion from walls/windows | water_intrusion | yes/no/unknown | Yes | YES (hurricanes) |
| **ENVIRONMENTAL** | | | | |
| Lead-based paint (pre-1978) | lead_paint | yes/no/unknown | Yes | No |
| Asbestos | asbestos | yes/no/unknown | Yes | No |
| Radon tested | radon_tested | yes/no/unknown | - | No |
| Underground storage tanks | underground_tanks | yes/no/unknown | Yes | No |
| Known environmental hazards | environmental_hazards | yes/no/unknown | Yes | No |
| Environmental hazard details | environmental_details | text | - | No |

### Page 3-4: Property Features & Legal

| Disclosure Item | Field ID | Type | Red Flag If | Louisiana-Specific |
|---|---|---|---|---|
| **MINERAL RIGHTS** | | | | |
| Mineral rights status | mineral_rights_status | text | Excluded | YES |
| Mineral lease exists | mineral_lease_exists | yes/no/unknown | Yes (affects use) | YES |
| Active mineral production | mineral_production_active | yes/no/unknown | Yes (noise, access) | YES |
| **SERVITUDES (EASEMENTS)** | | | | |
| Known servitudes/right-of-way | servitudes_known | yes/no/unknown | Yes | YES |
| Servitude details | servitude_details | text | Pipeline, utility | YES |
| **LEGAL** | | | | |
| Property in HOA/POA | hoa_exists | yes/no/unknown | - | No |
| HOA monthly dues | hoa_dues | currency | - | No |
| Pending litigation involving property | pending_litigation | yes/no/unknown | Yes | No |
| Zoning violations or non-conforming use | zoning_issues | yes/no/unknown | Yes | No |
| Boundary disputes | boundary_disputes | yes/no/unknown | Yes | No |
| Code violations | code_violations | yes/no/unknown | Yes | No |
| **OTHER** | | | | |
| Pool/spa | pool_exists | yes/no/unknown | - | No |
| Pool condition | pool_condition | text | - | No |
| Additions/renovations with permits | additions_permitted | yes/no/unknown | No = unpermitted work | No |
| Addition details | addition_details | text | - | No |
| Chinese drywall | chinese_drywall | yes/no/unknown | Yes | YES (Gulf Coast 2006-2009) |
| Additional disclosures | additional_disclosures | text | Any entry | No |

### Page 5-6: Signatures & Acknowledgment

| Field Label | Field ID | Type | Required | Filled By | Compliance Critical | Commonly Missed |
|---|---|---|---|---|---|---|
| Seller certifies accuracy | seller_certification | checkbox | YES | Seller | YES | No |
| Seller Signature | seller_signature_1 | signature | YES | Seller | YES | No |
| Seller Print Name | seller_print_name_1 | text | YES | Seller | YES | Yes |
| Seller Date | seller_sign_date_1 | date | YES | Seller | YES | Yes |
| Co-Seller/Spouse Signature | seller_signature_2 | signature | CONDITIONAL | Spouse | YES | Yes |
| Co-Seller Date | seller_sign_date_2 | date | CONDITIONAL | Spouse | YES | Yes |
| Buyer acknowledges receipt | buyer_acknowledgment | checkbox | YES | Buyer | YES | No |
| Buyer Signature | buyer_signature_1 | signature | YES | Buyer | YES | No |
| Buyer Date | buyer_sign_date_1 | date | YES | Buyer | YES | Yes |
| Co-Buyer Signature | buyer_signature_2 | signature | CONDITIONAL | Co-Buyer | YES | Yes |

### PDD Form-Specific Extraction Prompt

```
Extract all disclosed property conditions from this Louisiana Property Disclosure Document (PDD).

CRITICAL FIELDS (must extract):
- Property address, owner name(s), year built, parish
- ALL yes/no/unknown answers for EVERY condition question
- Any explanations provided for "yes" answers (verbatim if possible)
- Complete flood history section (count, dates, heights, insurance, zone)
- Complete termite/WDO section (history, treatment, bond, transferability)
- Known defects section (verbatim)
- Mineral rights and servitudes declarations

FLAG AS WARNINGS:
- Any condition question answered "yes" (especially: foundation, water damage, mold, termites, flood)
- Year built before 1978 (triggers lead paint disclosure requirement)
- Missing seller signature or co-seller/spouse signature
- "Unknown" on more than 5 items (suggests seller avoidance — La. C.C. Art. 2520 redhibition risk)
- Flood history "yes" without flood insurance "yes"
- Property in NFIP repetitive loss area

Louisiana-specific: Look for "parish" not "county", "servitude" not "easement", 
mineral rights section, termite bond details, Chinese drywall (Gulf Coast).

The 2026 revision expanded the flood section — look for: flood count, flood water height,
elevation certificate, NFIP repetitive loss status.
```

---

## Louisiana-Specific Legal Requirements

### Community Property — Signature Requirements

**La. C.C. Art. 2338-2369** (Community Property regime)
**La. C.C. Art. 2347**: The concurrence of both spouses is required for the alienation, encumbrance, or lease of community immovables.

**What this means for extraction:**
1. If a seller is married, BOTH spouses must sign the listing agreement AND purchase agreement
2. If a buyer is married, BOTH spouses must sign the purchase agreement
3. Failure to get spousal signature can render the sale VOIDABLE
4. The extraction engine should:
   - Check if two seller signatures exist when only one seller name is listed
   - Flag if only one signature exists and no "separate property" designation is noted
   - Check for "and/or" in name fields (e.g., "John Smith and Jane Smith")
   - Check for "husband and wife" or "married" language

**Exceptions where only one spouse signs:**
- Property is separate property (owned before marriage or inherited) — La. C.C. Art. 2341
- Property was acquired with separate funds and documented as such
- Spouses have a matrimonial agreement (prenup) under La. C.C. Art. 2328
- Spouses are legally separated

### Mineral Rights (La. R.S. 31:1-214)

- Louisiana Mineral Code is unique — no other state has a comparable statutory framework
- Mineral rights can be "prescribed" (lost through non-use) after 10 years of non-use (La. R.S. 31:27)
- Mineral servitude vs mineral royalty: servitude = right to explore/produce; royalty = right to share in production
- Key parishes where mineral rights issues are most common: Caddo, Bossier, Calcasieu, Lafourche, Terrebonne, St. Mary, Iberia, Vermilion, Cameron, Plaquemines
- In Baton Rouge metro, mineral rights are rarely excluded but should still be verified
- 2026 form update: buyer must now explicitly acknowledge mineral rights status via checkbox

### Termite/WDO Requirements (La. R.S. 9:1131.1)

- Wood Destroying Insect (WDI) report required for ALL residential sales
- Report must be from a Louisiana-licensed pest control operator
- Report must be dated within **10 calendar days** of the Act of Sale
- Report covers: subterranean termites, drywood termites, Formosan termites, powderpost beetles, old house borers
- Louisiana has the highest Formosan termite density in the US (New Orleans metro especially)
- Termite bond transferability is a significant negotiation point — extraction should capture this

### Flood Disclosure (La. R.S. 38:84, La. R.S. 9:3198)

- Seller must disclose known flooding history
- FEMA flood zone maps updated periodically — property may have been remapped since purchase
- Post-2016 Great Flood: EBR, Livingston, Ascension, Tangipahoa, St. Helena parishes most affected
- Elevation certificate: document showing property elevation relative to Base Flood Elevation (BFE)
- NFIP repetitive loss properties: 2+ flood insurance claims of $1,000+ in any 10-year period
- FEMA API available for automated zone lookup: `https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHL/MapServer/28/query`

### Redhibition (La. C.C. Art. 2520-2548)

- Unique to Louisiana civil law — seller is liable for hidden defects that make the property unfit for its intended use
- Applies even if seller was unaware of the defect:
  - Good faith seller: limited to return of price
  - Bad faith seller: also liable for damages
- Prescriptive period: 1 year from discovery of the defect (La. C.C. Art. 2534)
- The Property Disclosure Document does NOT waive redhibition — it documents what was known
- "As Is" clauses may limit but do NOT eliminate redhibition claims in Louisiana
- This is why thorough PDD extraction matters — it establishes the baseline of what was disclosed

---

## Extraction Engine Integration — Implementation Guide

### Multi-Pass Configuration by Form Type

| Form | Passes Needed | Estimated Cost | Processing Time |
|------|---------------|----------------|-----------------|
| LREC-101 (Purchase Agreement) | 5 passes | ~$0.15-0.25 | < 15s |
| PDD (Property Disclosure) | 3 passes (conditions, legal, signatures) | ~$0.10 | < 10s |
| LREC-001 (Listing) | 3 passes (property, terms, signatures) | ~$0.10 | < 10s |
| LREC-002 (Buyer Rep) | 2 passes (terms, signatures) | ~$0.06 | < 5s |
| LREC-006 (Counter-Offer) | 2 passes (terms, signatures) | ~$0.06 | < 5s |
| LREC-010 (Lead Paint) | 1 pass (all on 2-3 pages) | ~$0.03 | < 3s |

### Priority Field Map for Pass Allocation

**Pass 1 — CRITICAL (must extract for compliance):**
```
property_address, property_parish, buyer_name, seller_name,
purchase_price, earnest_money_amount, closing_date,
buyer_signature, seller_signature, acceptance_date
```

**Pass 2 — IMPORTANT (needed for deadline management):**
```
contract_date, inspection_days, appraisal_days, financing_days,
financing_type, mls_number, listing_agent_name, selling_agent_name
```

**Pass 3 — LOUISIANA-SPECIFIC (unique compliance fields):**
```
mineral_rights_included, mineral_rights_buyer_ack,
flood_zone_code, flood_history, flood_insurance_required,
termite_required, servitudes,
buyer_signature_2 (spouse), seller_signature_2 (spouse)
```

**Pass 4 — DEAL INTELLIGENCE (business value):**
```
earnest_money_holder, title_company, act_of_sale_location,
seller_concessions, home_warranty, special_stipulations,
appliances_included, exclusions, addenda_checklist
```

**Pass 5 — SIGNATURES & COMPLETION:**
```
all signature fields, all date fields, acceptance_date, acceptance_time
```

### Fields Most Commonly Missed by OCR/Extraction

1. **Spouse/co-signer signatures** — Often on the same line as primary signer
2. **Acceptance date/time** — Small field, often handwritten, different page than signatures
3. **License numbers** — Small font, sometimes partially obscured
4. **Legal description** — Blank on many deals (agents leave for title company)
5. **Counter-offer number** — Not always filled, critical for ordering
6. **Flood zone code** — Small checkbox area, handwritten zone designation
7. **Mineral rights exceptions text** — Free-form, often handwritten
8. **Termite bond details** — Company name and date on separate line
9. **Seller concession amount** — Written in margins or special stipulations
10. **Offer expiration time** — Time component missed when only date captured

### Accuracy Targets by Form

| Form | Target (Critical Fields) | Target (All Fields) | Current Status |
|------|-------------------------|--------------------|----|
| LREC-101 (fillable PDF) | 99%+ | 95%+ | 27 fields mapped (need ~80) |
| LREC-101 (scanned) | 90%+ | 80%+ | Multi-pass active |
| PDD | 95%+ | 90%+ | 21 fields mapped (need ~50) |
| LREC-006 (Counter) | 90%+ | 85%+ | NOT MAPPED — add schema |
| LREC-010 (Lead Paint) | 99%+ | 95%+ | 8 fields mapped (need ~16) |
| LREC-001 (Listing) | 95%+ | 90%+ | NOT MAPPED — add schema |
| LREC-002 (Buyer Rep) | 95%+ | 90%+ | NOT MAPPED — add schema |

---

## Statute Citation Index

| Statute | Topic | Forms Affected |
|---|---|---|
| **La. R.S. 9:3196-3200** | Property Disclosure requirements | PDD |
| **La. R.S. 9:3198** | PDD must be provided before buyer obligation | PDD, LREC-101 |
| **La. R.S. 37:1431-1465** | Real Estate License Law | All |
| **La. R.S. 37:1449** | Agency disclosure requirements | LREC-001, LREC-002, LREC-101 |
| **La. R.S. 9:1131.1** | Termite/WDO inspection requirement | LREC-101, PDD |
| **La. R.S. 38:84** | Flood zone disclosure | LREC-101, PDD |
| **La. R.S. 31:1-214** | Louisiana Mineral Code | LREC-101, LREC-001, PDD |
| **La. R.S. 31:27** | Mineral rights prescription (10-year non-use) | LREC-101 |
| **La. C.C. Art. 2338-2369** | Community property regime | All signature pages |
| **La. C.C. Art. 2341** | Separate property definition | All (exception) |
| **La. C.C. Art. 2347** | Both spouses must sign community property sale | LREC-101, LREC-001 |
| **La. C.C. Art. 2328** | Matrimonial agreements (prenup exception) | LREC-101 |
| **La. C.C. Art. 2439-2659** | Sale of immovables | LREC-101 |
| **La. C.C. Art. 2520-2548** | Redhibition (hidden defects) | PDD |
| **La. C.C. Art. 2534** | Redhibition prescriptive period (1 year) | PDD |
| **La. C.C. Art. 2589-2600** | Lesion beyond moiety | LREC-101 |
| **La. C.C. Art. 1906-2057** | Obligations and contracts | LREC-101, LREC-006 |
| **La. C.C. Art. 1943-1947** | Offer and acceptance | LREC-006 |
| **La. C.C. Art. 462** | Community property definition | All |
| **42 U.S.C. 4852d** | Lead-based paint disclosure (federal) | LREC-010 |
| **24 CFR Part 35** | Lead paint disclosure regulations | LREC-010 |
| **40 CFR Part 745** | Lead paint disclosure regulations | LREC-010 |
| **LAC 46:LXVII** | LREC Administrative Rules | All |

---

## Implementation Priority

| Rank | Action | Impact | Effort | File to Modify |
|------|--------|--------|--------|---------------|
| 1 | Add counter_offer + listing_agreement + buyer_representation to classifier patterns | HIGH | 1 | `lib/document-classifier.ts` |
| 2 | Add LREC-006, LREC-001, LREC-002 extraction schemas | HIGH | 2 | `lib/document-extractor.ts` |
| 3 | Upgrade LREC-101 from 27 to ~80 fields in lrec-fields.ts | HIGH | 3 | `lib/contracts/lrec-fields.ts` |
| 4 | Upgrade PDD extraction prompt with 2026 flood fields | HIGH | 1 | `lib/document-extractor.ts` |
| 5 | Add community property signature validation | HIGH | 2 | `lib/multi-pass-extractor.ts` |
| 6 | Add mineral rights buyer acknowledgment (2026) | HIGH | 1 | `lib/contracts/lrec-fields.ts` |
| 7 | Add AcroForm field mapping for DocuSign/DotLoop | HIGH | 3 | New: `lib/acroform-mapper.ts` |
| 8 | Add multi-pass configs for LREC-001, LREC-002, LREC-006 | MEDIUM | 2 | `lib/multi-pass-extractor.ts` |
| 9 | Build AirSign field templates per form type | MEDIUM | 4 | `lib/airsign/form-templates.ts` |
| 10 | Fix LREC form number (classifier says 001, should be 101) | LOW | 1 | `lib/document-classifier.ts` |
