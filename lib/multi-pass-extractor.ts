/**
 * AIRE Multi-Pass Document Extraction Engine
 *
 * Instead of one monolithic prompt, breaks extraction into 5 focused passes.
 * Each pass targets specific pages and fields for higher accuracy.
 * Uses Claude Vision (PDF document input) for each pass.
 */

import Anthropic from "@anthropic-ai/sdk";
import { PDFDocument } from "pdf-lib";

export interface MultiPassResult {
  fields: Record<string, string | number | boolean | null>;
  confidence: number;
  warnings: string[];
  pageCount: number;
  passResults: PassResult[];
  extractionMethod: string;
}

interface PassResult {
  name: string;
  fields: Record<string, string | number | boolean | null>;
  confidence: number;
  pagesUsed: number[];
  duration: number;
}

interface PassConfig {
  name: string;
  pageSelector: (totalPages: number) => number[];
  fields: string[];
  prompt: string;
}

// ── Pass Configurations ──

const PURCHASE_AGREEMENT_PASSES: PassConfig[] = [
  {
    name: "Parties",
    pageSelector: (total) => [0, Math.min(1, total - 1)],
    fields: [
      "buyerName", "buyerEmail", "buyerPhone",
      "sellerName", "sellerEmail", "sellerPhone",
      "listingAgent", "listingAgentLicense", "listingBrokerage",
      "sellingAgent", "sellingAgentLicense", "sellingBrokerage",
    ],
    prompt: `Extract all party information from this Louisiana purchase agreement.
Look for: buyer name/email/phone, seller name/email/phone, listing agent, selling agent, brokerages.
Names are typically on page 1 near the top. Agent info may be at bottom of page 1 or page 2.`,
  },
  {
    name: "Deal Terms",
    pageSelector: (total) => [0, Math.min(1, total - 1)],
    fields: [
      "propertyAddress", "propertyCity", "propertyZip", "parishName",
      "listPrice", "offerPrice", "acceptedPrice",
      "earnestMoneyAmount", "earnestMoneyHolder",
      "mlsNumber", "propertyType",
    ],
    prompt: `Extract property and deal term details from this Louisiana purchase agreement.
Look for: full property address (street, city, zip, parish), list price, offer price, accepted/sale price,
earnest money amount and who holds it, MLS number, and property type (residential/commercial/land).
Parish is Louisiana-specific — look for "Parish of ___" or "_____ Parish".`,
  },
  {
    name: "Dates & Deadlines",
    pageSelector: (total) => {
      const pages = [1, 2];
      if (total > 3) pages.push(3);
      return pages.filter((p) => p < total);
    },
    fields: [
      "contractDate", "closingDate",
      "inspectionDays", "appraisalDays", "financingDays",
      "ddiPeriodDays", "occupancyDate",
    ],
    prompt: `Extract all dates and deadline periods from this Louisiana purchase agreement.
Look for: contract/acceptance date, closing/act-of-sale date, inspection period (in days),
appraisal contingency (in days), financing contingency (in days), DDI (due diligence inspection) period.
Louisiana defaults: inspection 14 days, appraisal 14 days, financing 25 days.
Return dates in YYYY-MM-DD format. Return periods as integers (number of days).`,
  },
  {
    name: "Louisiana Specifics",
    pageSelector: (total) => {
      const pages = [2, 3, 4];
      return pages.filter((p) => p < total);
    },
    fields: [
      "mineralRightsIncluded", "mineralRightsExceptions",
      "floodZone", "floodInsuranceRequired",
      "servitudes", "titleCompany", "lenderName",
      "terminationRights", "specialStipulations",
    ],
    prompt: `Extract Louisiana-specific terms from this purchase agreement.
CRITICAL fields for Louisiana:
- Mineral rights: Are they included or excluded? Any exceptions noted?
- Flood zone: What zone (A, AE, X, etc.)? Is flood insurance required?
- Servitudes: Any right-of-way, pipeline, or utility easements?
- Title company name
- Lender/mortgage company name
- Special stipulations or addenda referenced
- Termination/cancellation conditions`,
  },
  {
    name: "Signatures & Status",
    pageSelector: (total) => {
      const pages: number[] = [];
      if (total >= 2) pages.push(total - 2);
      pages.push(total - 1);
      return pages.filter((p) => p >= 0);
    },
    fields: [
      "buyerSigned", "buyerSignDate",
      "sellerSigned", "sellerSignDate",
      "agentSigned", "witnessPresent",
    ],
    prompt: `Check the signature pages of this Louisiana purchase agreement.
For each party (buyer, seller, agents), determine:
- Did they sign? (true/false)
- What date did they sign? (YYYY-MM-DD format)
- Is a witness signature present? (required for Louisiana Act of Sale)
If a signature line is blank/unsigned, return false for that party.`,
  },
];

const PROPERTY_DISCLOSURE_PASSES: PassConfig[] = [
  {
    name: "Property Conditions",
    pageSelector: (total) => Array.from({ length: Math.min(total, 5) }, (_, i) => i),
    fields: [
      "propertyAddress", "sellerName",
      "roofAge", "roofCondition", "hvacAge", "hvacCondition",
      "foundationIssues", "waterDamage", "mold",
      "termiteHistory", "floodHistory", "floodZone",
      "leadPaint", "asbestos",
      "electricalIssues", "plumbingIssues",
      "poolSpa", "septicSystem", "wellWater",
      "knownDefects", "priorRepairs",
      "mineralRights", "servitudes",
    ],
    prompt: `Extract ALL property condition disclosures from this Louisiana Property Disclosure Document.
For each condition question, note whether the seller answered Yes, No, or Unknown.
Flag any "Yes" answers as warnings — these are disclosed defects.
Louisiana-specific items to watch for: termite history (very common in LA),
flood history, mineral rights status, and servitudes/easements.`,
  },
];

const AGENCY_DISCLOSURE_PASSES: PassConfig[] = [
  {
    name: "Agency Details",
    pageSelector: (total) => Array.from({ length: Math.min(total, 2) }, (_, i) => i),
    fields: [
      "agentName", "agentLicense", "brokerageName",
      "representationType", "clientName",
      "dualAgencyConsent", "disclosureDate",
    ],
    prompt: `Extract agency relationship details from this LREC Agency Disclosure Form.
Identify: agent name, license number, brokerage name, representation type
(buyer's agent, seller's agent, dual agent), client name, and whether
dual agency consent was given. Also get the disclosure date.`,
  },
];

const LEAD_PAINT_PASSES: PassConfig[] = [
  {
    name: "Lead Paint Details",
    pageSelector: (total) => Array.from({ length: Math.min(total, 3) }, (_, i) => i),
    fields: [
      "propertyAddress", "sellerName", "buyerName",
      "leadPaintKnown", "leadPaintRecords",
      "buyerAcknowledged", "inspectionWaived",
      "disclosureDate",
    ],
    prompt: `Extract lead-based paint disclosure details from this federal disclosure form.
Key questions: Does seller know of lead paint? Were records provided?
Did buyer acknowledge receipt? Did buyer waive the right to inspect?
Get the disclosure date and all party names.`,
  },
];

const GENERIC_PASSES: PassConfig[] = [
  {
    name: "General Extraction",
    pageSelector: (total) => Array.from({ length: Math.min(total, 5) }, (_, i) => i),
    fields: [
      "propertyAddress", "partyNames", "dates", "amounts",
      "specialTerms", "signatures",
    ],
    prompt: `Extract all key information from this Louisiana real estate document.
Look for: property address, all party names, important dates,
monetary amounts, special terms or conditions, and signature status.`,
  },
];

// Map document types to their pass configs
const PASS_CONFIGS: Record<string, PassConfig[]> = {
  purchase_agreement: PURCHASE_AGREEMENT_PASSES,
  property_disclosure: PROPERTY_DISCLOSURE_PASSES,
  agency_disclosure: AGENCY_DISCLOSURE_PASSES,
  dual_agency_consent: AGENCY_DISCLOSURE_PASSES,
  lead_paint: LEAD_PAINT_PASSES,
};

/**
 * Extract specific pages from a PDF as a new PDF buffer.
 */
async function extractPages(
  pdfBuffer: Buffer,
  pageIndices: number[]
): Promise<Buffer> {
  const srcDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const newDoc = await PDFDocument.create();
  const validIndices = pageIndices.filter((i) => i < srcDoc.getPageCount());

  if (validIndices.length === 0) return pdfBuffer;

  const copiedPages = await newDoc.copyPages(srcDoc, validIndices);
  for (const page of copiedPages) {
    newDoc.addPage(page);
  }
  const bytes = await newDoc.save();
  return Buffer.from(bytes);
}

/**
 * Run a single extraction pass using Claude Vision.
 */
async function runPass(
  client: Anthropic,
  pdfBuffer: Buffer,
  pass: PassConfig,
  totalPages: number,
  modelId: string
): Promise<PassResult> {
  const start = Date.now();
  const pageIndices = pass.pageSelector(totalPages);

  console.log(`  🔍 [Pass: ${pass.name}] Pages: [${pageIndices.join(",")}] | Fields: ${pass.fields.length} | Model: ${modelId}`);

  // Extract only the relevant pages
  const pagePdf = await extractPages(pdfBuffer, pageIndices);
  const base64Pdf = pagePdf.toString("base64");

  const fieldTemplate = pass.fields.map((f) => `"${f}": null`).join(", ");
  const prompt = `IMPORTANT: You MUST respond with ONLY a JSON object. No explanations, no prose, no markdown.

You are extracting data from a Louisiana real estate document.
Pages shown: ${pageIndices.map((i) => i + 1).join(", ")} of ${totalPages} total.

${pass.prompt}

Extract these fields: ${pass.fields.join(", ")}

Rules:
- Return exact values from the document
- null for missing/blank fields
- Dates: YYYY-MM-DD
- Numbers: plain digits only (no $ or ,)
- Booleans: true or false

Your ENTIRE response must be this JSON structure and nothing else:
{"fields": {${fieldTemplate}}, "confidence": 0.8}`;

  try {
    const response = await client.messages.create({
      model: modelId,
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: base64Pdf,
              },
            },
            { type: "text", text: prompt },
          ],
        },
      ],
    });

    const rawText =
      response.content[0].type === "text" ? response.content[0].text : "";
    console.log(`  📄 [Pass: ${pass.name}] Raw response (first 300): ${rawText.slice(0, 300)}`);

    // Try to parse JSON — handle prose responses that contain embedded JSON
    let parsed: { fields?: Record<string, unknown>; confidence?: number };
    const cleaned = rawText
      .replace(/^```json?\n?/m, "")
      .replace(/\n?```$/m, "")
      .trim();

    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // Claude returned prose — try to extract JSON from it
      const jsonMatch = rawText.match(/\{[\s\S]*"fields"[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
          console.log(`  🔧 [Pass: ${pass.name}] Extracted JSON from prose response`);
        } catch {
          console.error(`  ❌ [Pass: ${pass.name}] Could not extract JSON from prose`);
          const duration = Date.now() - start;
          return { name: pass.name, fields: {}, confidence: 0, pagesUsed: pageIndices, duration };
        }
      } else {
        console.error(`  ❌ [Pass: ${pass.name}] No JSON found in response`);
        const duration = Date.now() - start;
        return { name: pass.name, fields: {}, confidence: 0, pagesUsed: pageIndices, duration };
      }
    }

    const duration = Date.now() - start;
    console.log(`  ✅ [Pass: ${pass.name}] Done in ${duration}ms — confidence: ${parsed.confidence}`);

    return {
      name: pass.name,
      fields: (parsed.fields ?? {}) as Record<string, string | number | boolean | null>,
      confidence: (parsed.confidence as number) ?? 0.5,
      pagesUsed: pageIndices,
      duration,
    };
  } catch (error: unknown) {
    const duration = Date.now() - start;
    console.error(`  ❌ [Pass: ${pass.name}] Failed in ${duration}ms:`, error);
    return {
      name: pass.name,
      fields: {},
      confidence: 0,
      pagesUsed: pageIndices,
      duration,
    };
  }
}

/**
 * Run multi-pass extraction on a PDF document.
 */
export async function multiPassExtract(
  pdfBuffer: Buffer,
  documentType: string,
  filename: string
): Promise<MultiPassResult> {
  const startTotal = Date.now();
  const client = new Anthropic();

  // Get page count
  let totalPages = 1;
  try {
    const doc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
    totalPages = doc.getPageCount();
  } catch {
    console.error(`⚠️ [MultiPass] Could not determine page count`);
  }

  const passes = PASS_CONFIGS[documentType] ?? GENERIC_PASSES;
  console.log(`🚀 [MultiPass] Starting ${passes.length}-pass extraction for "${filename}" (${totalPages} pages, type: ${documentType})`);

  const modelId = "claude-sonnet-4-20250514";

  // Run all passes sequentially (to avoid rate limits)
  const passResults: PassResult[] = [];
  const allFields: Record<string, string | number | boolean | null> = {};
  const warnings: string[] = [];
  let totalConfidence = 0;

  for (const passConfig of passes) {
    const result = await runPass(client, pdfBuffer, passConfig, totalPages, modelId);
    passResults.push(result);

    // Merge fields (later passes don't overwrite earlier non-null values)
    for (const [key, value] of Object.entries(result.fields)) {
      if (value !== null && value !== undefined && allFields[key] === undefined) {
        allFields[key] = value;
      }
    }

    totalConfidence += result.confidence;
  }

  // ── Validation Pass ──
  const avgConfidence = passes.length > 0 ? totalConfidence / passes.length : 0;

  // Check for red flags
  if (documentType === "purchase_agreement") {
    if (!allFields.buyerSigned) warnings.push("Buyer signature missing — contract may not be executed");
    if (!allFields.sellerSigned) warnings.push("Seller signature missing — contract may not be executed");
    if (allFields.mineralRightsIncluded === false) warnings.push("Mineral rights EXCLUDED — buyer should be aware");
    if (allFields.floodZone && /^A/i.test(String(allFields.floodZone))) {
      warnings.push(`Property in flood zone ${allFields.floodZone} — flood insurance likely required`);
    }
    if (!allFields.earnestMoneyAmount) warnings.push("No earnest money amount specified");
    if (!allFields.contractDate) warnings.push("Contract date missing — cannot calculate deadlines");

    const inspDays = Number(allFields.inspectionDays);
    if (inspDays > 0 && inspDays < 10) warnings.push(`Inspection period unusually short (${inspDays} days)`);
  }

  if (documentType === "property_disclosure") {
    const defectFields = ["foundationIssues", "waterDamage", "mold", "termiteHistory",
      "floodHistory", "leadPaint", "asbestos", "electricalIssues", "plumbingIssues"];
    for (const field of defectFields) {
      if (allFields[field] === true || allFields[field] === "Yes") {
        warnings.push(`Disclosed defect: ${field}`);
      }
    }
  }

  const totalDuration = Date.now() - startTotal;
  const filledCount = Object.values(allFields).filter((v) => v !== null).length;
  console.log(`🏁 [MultiPass] Complete in ${(totalDuration / 1000).toFixed(1)}s — ${filledCount} fields extracted, ${warnings.length} warnings, avg confidence: ${(avgConfidence * 100).toFixed(0)}%`);

  return {
    fields: allFields,
    confidence: avgConfidence,
    warnings,
    pageCount: totalPages,
    passResults,
    extractionMethod: "multi-pass-vision",
  };
}
