/**
 * AIRE Document Classifier Test Suite
 * Tests classifyByPatterns() against synthetic filenames and text snippets.
 * Run: npx tsx scripts/test-classifier.ts
 */

import { classifyByPatterns } from "../lib/document-classifier";

interface TestCase {
  filename: string;
  text?: string;
  expectedType: string;
  expectedCategory: string;
  description: string;
}

// ─── Test Cases ─────────────────────────────────────────────────

const TEST_CASES: TestCase[] = [
  // Purchase Agreements
  {
    filename: "Residential Agreement to Buy or Sell - 336 Seyburn Dr.pdf",
    expectedType: "purchase_agreement",
    expectedCategory: "mandatory",
    description: "Standard LREC purchase agreement filename",
  },
  {
    filename: "PA (1).pdf",
    expectedType: "purchase_agreement",
    expectedCategory: "mandatory",
    description: "Common agent abbreviation PA (1)",
  },
  {
    filename: "Burkhart - PA (signed).pdf",
    expectedType: "purchase_agreement",
    expectedCategory: "mandatory",
    description: "Agent naming convention: Name - PA",
  },
  {
    filename: "Purchase Agreement.pdf",
    expectedType: "purchase_agreement",
    expectedCategory: "mandatory",
    description: "Simple purchase agreement name",
  },
  {
    filename: "Agreement to Purchase and Sell.pdf",
    expectedType: "purchase_agreement",
    expectedCategory: "mandatory",
    description: "Alternate wording",
  },
  {
    filename: "LREC Residential Agreement Rev 218.pdf",
    expectedType: "purchase_agreement",
    expectedCategory: "mandatory",
    description: "LREC revision number pattern",
  },
  {
    filename: "unimproved lot agreement.pdf",
    expectedType: "purchase_agreement",
    expectedCategory: "mandatory",
    description: "Unimproved lot variant",
  },
  {
    filename: "unknown_doc.pdf",
    text: "This is a residential agreement to buy or sell property located at 123 Main St in East Baton Rouge Parish",
    expectedType: "purchase_agreement",
    expectedCategory: "mandatory",
    description: "Unknown filename but text contains purchase agreement language",
  },

  // Property Disclosures
  {
    filename: "Property Disclosure Document.pdf",
    expectedType: "property_disclosure",
    expectedCategory: "mandatory",
    description: "Standard property disclosure",
  },
  {
    filename: "Seller Disclosure.pdf",
    expectedType: "property_disclosure",
    expectedCategory: "mandatory",
    description: "Seller disclosure variant",
  },
  {
    filename: "Roark - PD (1).pdf",
    expectedType: "property_disclosure",
    expectedCategory: "mandatory",
    description: "Agent abbreviation PD",
  },
  {
    filename: "Property Condition Disclosure Statement.pdf",
    expectedType: "property_disclosure",
    expectedCategory: "mandatory",
    description: "Full formal name",
  },

  // Agency Disclosures
  {
    filename: "Agency Disclosure Form.pdf",
    expectedType: "agency_disclosure",
    expectedCategory: "mandatory",
    description: "Standard agency disclosure",
  },
  {
    filename: "Disclosure and Consent to Dual Agency.pdf",
    expectedType: "agency_disclosure",
    expectedCategory: "mandatory",
    description: "Dual agency consent",
  },
  {
    filename: "Agency Disclosure Pamphlet.pdf",
    expectedType: "agency_disclosure",
    expectedCategory: "mandatory",
    description: "Agency pamphlet variant",
  },

  // Lead Paint
  {
    filename: "Lead-Based Paint Disclosure.pdf",
    expectedType: "lead_paint",
    expectedCategory: "federal",
    description: "Standard lead paint disclosure",
  },
  {
    filename: "LBP Disclosure.pdf",
    expectedType: "lead_paint",
    expectedCategory: "federal",
    description: "LBP abbreviation",
  },
  {
    filename: "Lead Paint Hazard Disclosure Form.pdf",
    expectedType: "lead_paint",
    expectedCategory: "federal",
    description: "Lead hazard variant",
  },

  // Inspection Response
  {
    filename: "Inspection Response - 336 Seyburn.pdf",
    expectedType: "inspection_response",
    expectedCategory: "addendum",
    description: "Standard inspection response",
  },
  {
    filename: "Property Inspection Response Form.pdf",
    expectedType: "inspection_response",
    expectedCategory: "addendum",
    description: "Full form name",
  },
  {
    filename: "Repair Request.pdf",
    expectedType: "inspection_response",
    expectedCategory: "addendum",
    description: "Repair request alias",
  },

  // Addendum Types
  {
    filename: "Condominium Addendum.pdf",
    expectedType: "condominium_addendum",
    expectedCategory: "addendum",
    description: "Condo addendum",
  },
  {
    filename: "Deposit Addendum.pdf",
    expectedType: "deposit_addendum",
    expectedCategory: "addendum",
    description: "Deposit/earnest money addendum",
  },
  {
    filename: "Earnest Money Addendum.pdf",
    expectedType: "deposit_addendum",
    expectedCategory: "addendum",
    description: "Earnest money variant",
  },
  {
    filename: "New Construction Addendum.pdf",
    expectedType: "new_construction_addendum",
    expectedCategory: "addendum",
    description: "New construction",
  },
  {
    filename: "Historic District Addendum.pdf",
    expectedType: "historic_district_addendum",
    expectedCategory: "addendum",
    description: "Historic district",
  },
  {
    filename: "Private Sewerage Addendum.pdf",
    expectedType: "private_sewerage_addendum",
    expectedCategory: "addendum",
    description: "Private sewerage",
  },
  {
    filename: "Private Water Well Addendum.pdf",
    expectedType: "private_sewerage_addendum",
    expectedCategory: "addendum",
    description: "Private water well (maps to sewerage addendum)",
  },
  {
    filename: "Buyer Option Flowchart DDI Period.pdf",
    expectedType: "buyer_option_flowchart",
    expectedCategory: "addendum",
    description: "DDI period flowchart",
  },

  // Additional types
  {
    filename: "Home Warranty Disclosure.pdf",
    expectedType: "home_warranty",
    expectedCategory: "additional",
    description: "Home warranty",
  },
  {
    filename: "Property Management Agreement.pdf",
    expectedType: "property_management",
    expectedCategory: "additional",
    description: "Property management",
  },
  {
    filename: "Vacant Land Purchase Agreement.pdf",
    expectedType: "vacant_land",
    expectedCategory: "additional",
    description: "Vacant land",
  },
  {
    filename: "Waiver of Warranty Form.pdf",
    expectedType: "waiver_warranty",
    expectedCategory: "additional",
    description: "Waiver of warranty",
  },

  // Edge cases — unknown
  {
    filename: "scan001.pdf",
    expectedType: "unknown",
    expectedCategory: "unclassified",
    description: "Generic scan filename — should be unknown",
  },
  {
    filename: "document.pdf",
    expectedType: "unknown",
    expectedCategory: "unclassified",
    description: "Generic document filename — should be unknown",
  },

  // Edge case — false positive prevention
  {
    filename: "Papa Johns receipt.pdf",
    expectedType: "unknown",
    expectedCategory: "unclassified",
    description: "Should NOT match PA pattern (Papa contains pa)",
  },
];

// ─── Runner ─────────────────────────────────────────────────────

function runTests(): void {
  let passed = 0;
  let failed = 0;
  const errors: string[] = [];

  console.log(`\n🧪 AIRE Document Classifier Test Suite`);
  console.log(`${"=".repeat(60)}`);
  console.log(`Testing ${TEST_CASES.length} cases...\n`);

  for (const tc of TEST_CASES) {
    const result = classifyByPatterns(tc.filename, tc.text);
    const typeMatch = result.type === tc.expectedType;
    const catMatch = result.category === tc.expectedCategory;
    const ok = typeMatch && catMatch;

    if (ok) {
      passed++;
      console.log(`  ✅ ${tc.description}`);
    } else {
      failed++;
      const msg = `  ❌ ${tc.description}\n` +
        `     File: "${tc.filename}"\n` +
        `     Expected: ${tc.expectedType} (${tc.expectedCategory})\n` +
        `     Got:      ${result.type} (${result.category}) — confidence: ${(result.confidence * 100).toFixed(0)}%\n` +
        `     Patterns: [${result.matchedPatterns.join(", ")}]`;
      console.log(msg);
      errors.push(msg);
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Results: ${passed}/${TEST_CASES.length} passed (${((passed / TEST_CASES.length) * 100).toFixed(1)}%)`);
  if (failed > 0) {
    console.log(`\n❌ ${failed} FAILURES:`);
    errors.forEach((e) => console.log(e));
  } else {
    console.log(`\n🎉 ALL TESTS PASSED`);
  }

  // Category breakdown
  const categories = new Map<string, { total: number; passed: number }>();
  for (const tc of TEST_CASES) {
    const cat = tc.expectedCategory;
    if (!categories.has(cat)) categories.set(cat, { total: 0, passed: 0 });
    const entry = categories.get(cat)!;
    entry.total++;
    const result = classifyByPatterns(tc.filename, tc.text);
    if (result.type === tc.expectedType) entry.passed++;
  }

  console.log(`\nCategory Breakdown:`);
  for (const [cat, stats] of categories) {
    console.log(`  ${cat}: ${stats.passed}/${stats.total} (${((stats.passed / stats.total) * 100).toFixed(0)}%)`);
  }

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
