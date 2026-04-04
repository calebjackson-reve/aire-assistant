/**
 * AIRE Document Classification Engine
 * Classifies Louisiana real estate documents by type and category
 * using pattern matching + Claude AI for ambiguous cases.
 */

import Anthropic from "@anthropic-ai/sdk";
import { getLearningExamples } from "@/lib/document-memory";

export interface ClassificationResult {
  type: string;
  category: string;
  confidence: number;
  matchedPatterns: string[];
  lrecFormNumber?: string;
}

// Pattern-based classification rules for known LREC forms
const DOCUMENT_PATTERNS: {
  type: string;
  category: string;
  patterns: RegExp[];
  lrecFormNumber?: string;
}[] = [
  {
    type: "purchase_agreement",
    category: "mandatory",
    patterns: [
      /residential\s+agreement\s+to\s+buy\s+or\s+sell/i,
      /agreement\s+to\s+buy\s+or\s+sell/i,
      /agreement\s+to\s+purchase/i,
      /purchase\s+agreement/i,
      /purchase.*sell/i,
      /buy.*sell/i,
      /LREC.*residential.*agreement/i,
      /unimproved\s+lot/i,
      /\brev\s*2\d{2}\b/i, // Rev 218, Rev 201, etc. — LREC revision numbers
      /\bPA\b/, // Common abbreviation: "PA" = Purchase Agreement (case-sensitive — avoids "pa" in words)
      /\b-\s*PA\s/i, // "Name - PA (1).pdf" pattern used by agents
      /\bPA\s*\(/i, // "PA (1)" or "PA(1)" patterns
    ],
    lrecFormNumber: "LREC-001",
  },
  {
    type: "property_disclosure",
    category: "mandatory",
    patterns: [
      /property\s+disclosure\s+document/i,
      /property\s+disclosure/i,
      /seller.*disclosure/i,
      /property\s+condition\s+disclosure/i,
      /disclosure\s+document/i,
      /\bPD\b/, // PD = Property Disclosure
      /\b-\s*PD\s/i,
    ],
    lrecFormNumber: "LREC-002",
  },
  {
    type: "agency_disclosure",
    category: "mandatory",
    patterns: [
      /agency\s+disclosure\s+form/i,
      /agency\s+disclosure\s+pamphlet/i,
      /disclosure\s+and\s+consent\s+to\s+dual\s+agency/i,
      /dual\s+agency/i,
    ],
    lrecFormNumber: "LREC-003",
  },
  {
    type: "lead_paint",
    category: "federal",
    patterns: [
      /lead.?based\s+paint/i,
      /lead\s+paint\s+disclosure/i,
      /lead\s+paint\s+hazard/i,
      /lead\s+hazard/i,
      /\bLBP\b/, // LBP = Lead-Based Paint
    ],
  },
  {
    type: "inspection_response",
    category: "addendum",
    patterns: [
      /inspection\s+response/i,
      /property\s+inspection\s+response/i,
      /repair\s+request/i,
    ],
  },
  {
    type: "condominium_addendum",
    category: "addendum",
    patterns: [/condominium\s+addendum/i, /condo\s+addendum/i],
  },
  {
    type: "deposit_addendum",
    category: "addendum",
    patterns: [/deposit\s+addendum/i, /earnest\s+money\s+addendum/i],
  },
  {
    type: "new_construction_addendum",
    category: "addendum",
    patterns: [/new\s+construction\s+addendum/i],
  },
  {
    type: "historic_district_addendum",
    category: "addendum",
    patterns: [/historic\s+district/i],
  },
  {
    type: "private_sewerage_addendum",
    category: "addendum",
    patterns: [/private\s+sewerage/i, /private\s+water\s+well/i, /sewer\s+treatment/i],
  },
  {
    type: "buyer_option_flowchart",
    category: "addendum",
    patterns: [/buyer\s+option\s+flowchart/i, /ddi\s+period/i],
  },
  {
    type: "home_warranty",
    category: "additional",
    patterns: [/home\s+warranty\s+disclosure/i],
  },
  {
    type: "property_management",
    category: "additional",
    patterns: [/property\s+management\s+agreement/i],
  },
  {
    type: "vacant_land",
    category: "additional",
    patterns: [/vacant\s+land/i, /purchase.*sale.*vacant/i, /vacant\s+land\s+purchase/i],
  },
  {
    type: "waiver_warranty",
    category: "additional",
    patterns: [/waiver\s+of\s+warranty/i],
  },
];

/**
 * Classify a document using pattern matching.
 * Checks filename FIRST (higher confidence) then falls back to extracted text.
 */
export function classifyByPatterns(
  filename: string,
  extractedText?: string
): ClassificationResult {
  // Step 1: Try filename alone — high confidence if matched
  const filenameResult = matchPatterns(filename, DOCUMENT_PATTERNS, 0.7);
  if (filenameResult && filenameResult.confidence >= 0.7) {
    return filenameResult;
  }

  // Step 2: Try extracted text — lower base confidence
  if (extractedText && extractedText.length > 50) {
    const textResult = matchPatterns(
      extractedText.slice(0, 3000),
      DOCUMENT_PATTERNS,
      0.4
    );
    if (textResult) {
      // If filename also partially matched, boost confidence
      if (filenameResult) {
        textResult.confidence = Math.min(0.95, textResult.confidence + 0.15);
        textResult.matchedPatterns.push(...filenameResult.matchedPatterns);
      }
      return textResult;
    }
  }

  // Step 3: Return filename result if we got a partial match
  if (filenameResult) return filenameResult;

  return {
    type: "unknown",
    category: "unclassified",
    confidence: 0,
    matchedPatterns: [],
  };
}

function matchPatterns(
  text: string,
  rules: typeof DOCUMENT_PATTERNS,
  baseConfidence: number
): ClassificationResult | null {
  let bestMatch: ClassificationResult | null = null;

  for (const rule of rules) {
    const matchedPatterns: string[] = [];
    for (const pattern of rule.patterns) {
      if (pattern.test(text)) {
        matchedPatterns.push(pattern.source);
      }
    }
    if (matchedPatterns.length > 0) {
      const confidence = Math.min(
        0.95,
        baseConfidence + matchedPatterns.length * 0.15
      );
      if (!bestMatch || confidence > bestMatch.confidence) {
        bestMatch = {
          type: rule.type,
          category: rule.category,
          confidence,
          matchedPatterns,
          lrecFormNumber: rule.lrecFormNumber,
        };
      }
    }
  }

  return bestMatch;
}

/**
 * AI-powered classification for documents that pattern matching can't confidently identify.
 */
export async function classifyWithAI(
  filename: string,
  extractedText: string,
  userId?: string
): Promise<ClassificationResult> {
  // Try pattern matching first
  const patternResult = classifyByPatterns(filename, extractedText);
  if (patternResult.confidence >= 0.7) {
    return patternResult;
  }

  // Retrieve few-shot learning examples from document memory
  let learningSection = "";
  if (userId) {
    try {
      const examples = await getLearningExamples(userId, patternResult.type !== "unknown" ? patternResult.type : undefined);
      if (examples.length > 0) {
        learningSection = "\nHere are examples of documents this user has previously classified and verified:\n" +
          examples.map((ex) => {
            let line = `- "${ex.fileName}" → ${ex.finalType} (confidence: ${(ex.confidence * 100).toFixed(0)}%)`;
            if (ex.correctedType) {
              line += ` [originally misclassified as ${ex.classifiedType}]`;
            }
            return line;
          }).join("\n") +
          "\n\nPay special attention to corrections — they show past mistakes to avoid.\n";
      }
    } catch {
      // Memory lookup failed — continue without examples
    }
  }

  const client = new Anthropic();

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 500,
    messages: [
      {
        role: "user",
        content: `Classify this Louisiana real estate document. Return JSON only.
${learningSection}
Filename: ${filename}
First 3000 chars of content:
${extractedText.slice(0, 3000)}

Valid types: purchase_agreement, property_disclosure, agency_disclosure, lead_paint, inspection_response, condominium_addendum, deposit_addendum, new_construction_addendum, historic_district_addendum, private_sewerage_addendum, buyer_option_flowchart, home_warranty, property_management, vacant_land, waiver_warranty, amendment, addendum, contract, other

Valid categories: mandatory, addendum, federal, additional, broker

Return: {"type": "...", "category": "...", "confidence": 0.0-1.0}`,
      },
    ],
  });

  try {
    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const parsed = JSON.parse(text);
    return {
      type: parsed.type || "unknown",
      category: parsed.category || "unclassified",
      confidence: parsed.confidence || 0.5,
      matchedPatterns: ["ai_classification"],
      lrecFormNumber: patternResult.lrecFormNumber,
    };
  } catch {
    return patternResult;
  }
}
