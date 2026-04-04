/**
 * AIRE Document Extraction Engine
 * Extracts structured data from Louisiana real estate PDFs using Claude AI.
 *
 * Supports: Purchase Agreements, Property Disclosures, Agency Disclosures,
 * Lead-Based Paint, Inspection Responses, and all LREC standard forms.
 */

import Anthropic from "@anthropic-ai/sdk";

export interface ExtractionResult {
  fields: Record<string, string | number | boolean | null>;
  rawText: string;
  pageCount: number;
  confidence: number;
  documentType: string;
  warnings: string[];
}

// Extraction schemas for each document type — defines what fields Claude should pull
const EXTRACTION_SCHEMAS: Record<string, { fields: string[]; prompt: string }> = {
  purchase_agreement: {
    fields: [
      "propertyAddress", "propertyCity", "propertyZip", "parishName",
      "buyerName", "buyerEmail", "buyerPhone",
      "sellerName", "sellerEmail", "sellerPhone",
      "listPrice", "offerPrice", "acceptedPrice",
      "earnestMoneyAmount", "earnestMoneyHolder",
      "contractDate", "closingDate",
      "inspectionDays", "appraisalDays", "financingDays",
      "lenderName", "titleCompany",
      "mlsNumber", "propertyType",
      "mineralRightsIncluded", "floodZone",
      "specialStipulations",
    ],
    prompt: `Extract all fields from this Louisiana Residential Agreement to Buy or Sell.
Pay special attention to:
- Louisiana-specific fields: parish name, mineral rights, flood zone
- All deadline periods (inspection, appraisal, financing) in calendar days
- Earnest money amount and holder
- All party names, emails, and phone numbers
- MLS number if present`,
  },
  property_disclosure: {
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
    prompt: `Extract all disclosed property conditions from this Louisiana Property Disclosure Document.
Flag any "yes" answers to defect questions as warnings.
Note Louisiana-specific items: mineral rights, servitudes, flood history, termite damage.`,
  },
  agency_disclosure: {
    fields: [
      "agentName", "agentLicense", "brokerageName",
      "representationType", "clientName",
      "dualAgencyConsent", "disclosureDate",
    ],
    prompt: `Extract agency relationship details from this LREC Agency Disclosure Form.
Identify: agent name, license number, brokerage, representation type (buyer/seller/dual), and whether dual agency consent was given.`,
  },
  lead_paint: {
    fields: [
      "propertyAddress", "sellerName", "buyerName",
      "leadPaintKnown", "leadPaintRecords",
      "buyerAcknowledged", "inspectionWaived",
      "disclosureDate",
    ],
    prompt: `Extract lead-based paint disclosure details. Note whether seller disclosed known lead paint, whether records were provided, and whether buyer waived inspection rights.`,
  },
  inspection_response: {
    fields: [
      "propertyAddress", "inspectionDate",
      "repairItems", "repairEstimate",
      "buyerRequests", "sellerResponse",
      "responseDeadline",
    ],
    prompt: `Extract inspection response details including repair items requested, estimated costs, and seller's response.`,
  },
};

// extractWithVision was removed — replaced by multiPassExtract in multi-pass-extractor.ts

/**
 * Extract structured fields from a PDF's text content using Claude AI.
 */
export async function extractDocumentFields(
  rawText: string,
  documentType: string,
  filename: string
): Promise<ExtractionResult> {
  const schema = EXTRACTION_SCHEMAS[documentType] ?? {
    fields: ["propertyAddress", "partyNames", "dates", "amounts", "specialTerms"],
    prompt: "Extract all key fields from this real estate document.",
  };

  const client = new Anthropic();
  console.log(`🔍 [Text] Extracting fields from "${filename}" (${rawText.length} chars, type: ${documentType})`);

  const extractPrompt = `You are an expert Louisiana real estate document parser for AIRE Intelligence.

${schema.prompt}

Fields to extract: ${schema.fields.join(", ")}

Document filename: ${filename}
Document content:
${rawText.slice(0, 8000)}

Return a JSON object with:
1. "fields" — object with extracted field values (use null for missing fields)
2. "confidence" — 0.0 to 1.0 overall extraction confidence
3. "warnings" — array of strings for any issues found (missing signatures, blank required fields, disclosure red flags)
4. "documentType" — confirmed document type

Return JSON only, no markdown.`;

  let response;
  try {
    response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [{ role: "user", content: extractPrompt }],
    });
  } catch (apiError: unknown) {
    console.error(`❌ [Text] API call failed with claude-sonnet-4-20250514:`, apiError);
    console.log(`🔄 [Text] Retrying with claude-3-5-sonnet-20241022...`);
    try {
      response = await client.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 2000,
        messages: [{ role: "user", content: extractPrompt }],
      });
    } catch (fallbackError: unknown) {
      console.error(`❌ [Text] Fallback model also failed:`, fallbackError);
      return {
        fields: {},
        rawText,
        pageCount: Math.ceil(rawText.length / 3000),
        confidence: 0,
        documentType,
        warnings: [`Claude API failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`],
      };
    }
  }

  const rawResponse = response.content[0].type === "text" ? response.content[0].text : "";
  console.log(`📄 [Text] Raw Claude response (first 500 chars):\n${rawResponse.slice(0, 500)}`);

  try {
    const cleaned = rawResponse.replace(/^```json?\n?/m, "").replace(/\n?```$/m, "").trim();
    const parsed = JSON.parse(cleaned);
    console.log(`✅ [Text] Parsed successfully — confidence: ${parsed.confidence}, fields: ${Object.keys(parsed.fields ?? {}).length}`);

    return {
      fields: parsed.fields ?? {},
      rawText,
      pageCount: Math.ceil(rawText.length / 3000),
      confidence: parsed.confidence ?? 0.5,
      documentType: parsed.documentType ?? documentType,
      warnings: parsed.warnings ?? [],
    };
  } catch (parseError: unknown) {
    console.error(`❌ [Text] JSON parse failed:`, parseError);
    console.error(`❌ [Text] Full raw response:\n${rawResponse}`);
    return {
      fields: {},
      rawText,
      pageCount: Math.ceil(rawText.length / 3000),
      confidence: 0,
      documentType,
      warnings: [`AI returned unparseable response: ${rawResponse.slice(0, 200)}`],
    };
  }
}
