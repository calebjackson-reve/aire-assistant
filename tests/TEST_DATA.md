# AIRE Test Data Reference

Generated: 2026-04-04
Seed script: `npx tsx tests/fixtures/transactions/seed-data.ts`

## Test User
| Field | Value |
|-------|-------|
| Name | Caleb Jackson |
| Email | caleb@aireintel.org |
| Clerk ID | test_clerk_qa_001 |
| Tier | PRO |

## 10 Transactions

| # | Address | City | Price | Status | Buyer | Seller |
|---|---------|------|-------|--------|-------|--------|
| 1 | 1532 Walnut Street | Jackson | $168K | ACTIVE | Haley & Michael Courtney | Estate of Margaret Henderson |
| 2 | 8421 Highland Road | Baton Rouge | $282K | PENDING_INSPECTION | David Tran | Patricia & Robert Fontenot |
| 3 | 2200 Perkins Road | Baton Rouge | $420K | PENDING_APPRAISAL | Jennifer Arceneaux | Thomas & Linda Boudreaux |
| 4 | 5834 Guice Drive | Baton Rouge | $160K | CLOSED | Marcus Williams | Cynthia Mays |
| 5 | 1010 Convention Street | Baton Rouge | $535K | PENDING_FINANCING | Bayou Capital Partners | DG Commercial Holdings |
| 6 | 4715 Bluebonnet Boulevard | Baton Rouge | $312K | DRAFT | Ashley & Ryan Guidry | Jerome Landry |
| 7 | 742 Steele Boulevard | Baton Rouge | $193.5K | CLOSING | Natasha Pierre | William & Donna Hebert |
| 8 | 15620 Old Hammond Highway | Baton Rouge | $227.5K | ACTIVE | Christopher & Amanda Dugas | Estate of Roland Comeaux |
| 9 | 3344 Dalrymple Drive | Baton Rouge | $468K | PENDING_INSPECTION | Dr. Simone Baptiste | Katherine & Paul Mouton |
| 10 | 901 Lobdell Avenue | Baton Rouge | $139K | CANCELLED | Derek Johnson | Angela & Charles Broussard |

## TX #1 Documents (1532 Walnut St)
- LREC 101 - Purchase Agreement
- LREC 102 - Addendum (Repair Request)
- Inspection Report (5 deficiencies)
- Appraisal Report ($168K)
- Clear to Close letter
- Act of Sale
- Property Disclosure
- Agency Disclosure
- Lead Paint Disclosure
- Home Warranty Disclosure

## 40 Deadlines
4 per transaction: Inspection, Appraisal, Financing, Closing

## 30 Contacts
| Type | Count |
|------|-------|
| BUYER | 9 |
| SELLER | 6 |
| LEAD | 5 |
| PAST_CLIENT | 2 |
| REFERRAL_SOURCE | 2 |
| VENDOR | 5 |
| Total | 30 (with 1 extra from dual-named contacts) |

Parishes: East Baton Rouge, East Feliciana, Ascension, Livingston
Lenders: GMFS Mortgage, Assurance Financial, Origin Bank, Red River Bank, b1BANK
Title Companies: Ironclad Title, First American Title, Stewart Title Guaranty, Fidelity National Title

## Re-seeding
To reset and re-seed: `npx prisma db push --force-reset && npx tsx tests/fixtures/transactions/seed-data.ts`
