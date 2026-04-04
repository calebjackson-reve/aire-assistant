/**
 * Fixture email payloads for agent testing.
 * Matches the expected EmailLog input shape.
 */

export const emails = [
  {
    id: "fixture-email-counter",
    fromEmail: "amyphillips@burnsco.com",
    fromName: "Amy Phillips",
    subject: "Counter Offer — 336 Seyburn Dr, Zachary",
    bodySnippet: `Hi Caleb,

My clients (the Roarks) have reviewed the offer from Thomas Burkhart on 336 Seyburn Dr.
They are countering at $185,000 with the following conditions:
- Seller to pay up to $3,000 in closing costs
- Closing date moved to May 15, 2026
- All appliances included except the wine fridge in the kitchen
- Mineral rights are NOT included in the sale

Please have your buyer respond by end of business Friday.

Best,
Amy W. Phillips
Burns & Co., Inc.
LREC# 0995044821`,
    receivedAt: new Date(),
    labels: ["INBOX", "IMPORTANT"],
    threadId: "thread-seyburn-counter",
    _matchesTransaction: "fixture-txn-seyburn",
  },
  {
    id: "fixture-email-inspection",
    fromEmail: "reports@millerhomeinspections.com",
    fromName: "Miller Home Inspections",
    subject: "Inspection Report Ready — 336 Seyburn Dr",
    bodySnippet: `Dear Caleb Jackson,

The inspection report for 336 Seyburn Dr, Zachary, LA 70791 is now available.

Summary of findings:
- Roof: Good condition, ~5 years old, no leaks detected
- HVAC: Unit is 12 years old, functioning but nearing end of life
- Foundation: Minor hairline crack on east wall, non-structural
- Plumbing: Slow drain in master bath, possible partial blockage
- Electrical: Two outlets in garage not grounded (safety concern)
- Termite: No active infestation, previous treatment noted (2023)
- Water heater: 8 years old, some sediment buildup

Recommended repairs estimated at $2,800 - $4,200.

Full report with photos attached.

Miller Home Inspections
Baton Rouge, LA | LHIC# 10847`,
    receivedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    labels: ["INBOX"],
    threadId: "thread-seyburn-inspection",
    _matchesTransaction: "fixture-txn-seyburn",
  },
  {
    id: "fixture-email-ctc",
    fromEmail: "loans@gulfcoastmortgage.com",
    fromName: "Jennifer Martinez — Gulf Coast Mortgage",
    subject: "Clear to Close — 1928 Antonio Rd, Baton Rouge",
    bodySnippet: `Hi Caleb,

Great news! We have received clear to close on the Williams loan for
1928 Antonio Rd, Baton Rouge, LA 70816.

Loan details:
- Borrower: Marcus Williams
- Loan amount: $243,000 (90% LTV)
- Rate: 6.25% fixed 30-year
- Monthly P&I: $1,496
- Closing costs: $8,420 (buyer responsibility)
- Funding date: Ready to fund by April 14, 2026

Please coordinate with Pelican Title to schedule the Act of Sale.
We'll need the final closing disclosure 3 business days prior.

Jennifer Martinez
Senior Loan Officer | NMLS# 445928
Gulf Coast Mortgage | Baton Rouge, LA`,
    receivedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 min ago
    labels: ["INBOX", "IMPORTANT", "STARRED"],
    threadId: "thread-antonio-ctc",
    _matchesTransaction: "fixture-txn-antonio",
  },
];

export type FixtureEmail = (typeof emails)[number];
