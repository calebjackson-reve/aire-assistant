import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Voice Command Pipeline (Enhanced):
 * 1. Receive raw transcript
 * 2. Normalize text (fix common typos, expand synonyms)
 * 3. Load conversation context (last transaction, last action)
 * 4. Claude AI classification with synonym-aware, typo-tolerant prompt
 * 5. Ambiguity detection → ask clarification instead of failing
 * 6. Entity extraction (address, dates, amounts, pronouns resolved)
 * 7. Execute action or return clarification request
 * 8. Update context for next command
 */

// ─── Synonym Map ───────────────────────────────────────────
// Maps casual/alternate terms to canonical terms Claude can recognize
// Phrase-level synonyms: only multi-word phrases that won't corrupt other sentences.
// Single-word action synonyms (make, draft, send) are handled by Claude's prompt,
// NOT by string replacement — replacing "make" globally corrupts "make sure", etc.
const PHRASE_SYNONYMS: Record<string, string> = {
  // Multi-word phrases (safe to replace — unlikely to appear as substrings)
  "the contract": "the purchase agreement",
  "the agreement": "the purchase agreement",
  "that thing": "that document",
  "the thing": "the document",
  "the docs": "the documents",
  "write up": "create",
  "put together": "create",
  "draw up": "create",
  "fire off": "send",
  "where are we": "what is the status",
  "what's going on": "what is the status",
  "what's the deal": "what is the status",
  "how's it going": "what is the status",
  "update me": "what is the status",
  "the other side": "the other party",
  "my deals": "my pipeline",
  "all deals": "my pipeline",
  "active deals": "my pipeline",
  "what's on my plate": "show my pipeline",
  "remind me": "check deadlines",
  "what's due": "check deadlines",
  "what's next": "check deadlines",
  "set closing": "schedule closing",
  "book closing": "schedule closing",
};

// ─── Typo Correction ──────────────────────────────────────
// Common voice-to-text and typing errors
const TYPO_CORRECTIONS: Record<string, string> = {
  "creat": "create",
  "crate": "create",
  "craete": "create",
  "addendm": "addendum",
  "adendum": "addendum",
  "addndum": "addendum",
  "addnedum": "addendum",
  "puchase": "purchase",
  "purchse": "purchase",
  "purhcase": "purchase",
  "agreemnt": "agreement",
  "agrement": "agreement",
  "agreemen": "agreement",
  "transction": "transaction",
  "transation": "transaction",
  "trasaction": "transaction",
  "deadlin": "deadline",
  "deadlne": "deadline",
  "stauts": "status",
  "staus": "status",
  "satuts": "status",
  "statue": "status",
  "insepction": "inspection",
  "inpsection": "inspection",
  "inspction": "inspection",
  "closng": "closing",
  "closeing": "closing",
  "appraisl": "appraisal",
  "appraisla": "appraisal",
  "appraial": "appraisal",
  "fianncing": "financing",
  "financng": "financing",
  "finacing": "financing",
  "complinace": "compliance",
  "compliane": "compliance",
  "pipline": "pipeline",
  "pipleine": "pipeline",
  "analsysis": "analysis",
  "anaylsis": "analysis",
  "analsis": "analysis",
  "schedul": "schedule",
  "schdule": "schedule",
  "scheduel": "schedule",
};

// ─── Levenshtein Distance ─────────────────────────────────
function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

// Build a reverse map: correct word → all known typos for it
const CORRECT_WORDS = [...new Set(Object.values(TYPO_CORRECTIONS))];

/**
 * Normalize transcript: fix typos, expand phrase synonyms, clean up.
 * Single-word action synonyms (make, draft, send, etc.) are NOT replaced here —
 * they're handled by Claude's system prompt to avoid corrupting sentences.
 */
export function normalizeTranscript(raw: string): string {
  let text = raw.toLowerCase().trim();

  // Fix individual word typos
  const words = text.split(/\s+/);
  const corrected = words.map((word) => {
    // Strip trailing punctuation for matching, preserve it after
    const match = word.match(/^([a-z']+)([^a-z']*)$/);
    if (!match) return word;
    const [, clean, punct] = match;

    // Exact typo match
    if (TYPO_CORRECTIONS[clean]) return TYPO_CORRECTIONS[clean] + punct;

    // Fuzzy match against CORRECT words (not typo keys) — Levenshtein ≤ 2
    if (clean.length > 4) {
      let bestWord = "";
      let bestDist = 3; // threshold
      for (const correct of CORRECT_WORDS) {
        const dist = levenshtein(clean, correct);
        if (dist < bestDist && dist <= 2) {
          bestDist = dist;
          bestWord = correct;
        }
      }
      if (bestWord) return bestWord + punct;
    }
    return word;
  });
  text = corrected.join(" ");

  // Expand phrase synonyms (longest match first — safe multi-word replacements only)
  const sortedPhrases = Object.entries(PHRASE_SYNONYMS).sort(
    (a, b) => b[0].length - a[0].length
  );
  for (const [phrase, canonical] of sortedPhrases) {
    if (text.includes(phrase)) {
      text = text.replace(phrase, canonical);
    }
  }

  return text;
}

/**
 * Load recent context for pronoun resolution and ambiguity handling.
 * Returns the user's last 3 voice commands + last active transaction.
 */
async function loadContext(userId: string): Promise<{
  lastTransaction: { id: string; address: string; status: string } | null;
  lastIntent: string | null;
  recentCommands: string[];
}> {
  const [recentCommands, lastActiveTransaction] = await Promise.all([
    prisma.voiceCommand.findMany({
      where: { userId, status: { in: ["completed", "executed"] } },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        rawTranscript: true,
        parsedIntent: true,
        parsedEntities: true,
        transactionId: true,
      },
    }),
    prisma.transaction.findFirst({
      where: { userId, status: { notIn: ["CLOSED", "CANCELLED"] } },
      orderBy: { updatedAt: "desc" },
      select: { id: true, propertyAddress: true, status: true },
    }),
  ]);

  // Find last referenced transaction from voice commands
  const lastCommandWithTxn = recentCommands.find((c) => c.transactionId);
  let lastTransaction = null;

  if (lastCommandWithTxn?.transactionId) {
    const txn = await prisma.transaction.findUnique({
      where: { id: lastCommandWithTxn.transactionId },
      select: { id: true, propertyAddress: true, status: true },
    });
    if (txn) lastTransaction = { id: txn.id, address: txn.propertyAddress, status: txn.status };
  } else if (lastActiveTransaction) {
    lastTransaction = {
      id: lastActiveTransaction.id,
      address: lastActiveTransaction.propertyAddress,
      status: lastActiveTransaction.status,
    };
  }

  return {
    lastTransaction,
    lastIntent: recentCommands[0]?.parsedIntent || null,
    recentCommands: recentCommands.map((c) => c.rawTranscript),
  };
}

// ─── AI Classification System Prompt ──────────────────────
const CLASSIFICATION_SYSTEM_PROMPT = `You are AIRE, an AI real estate assistant for Baton Rouge, Louisiana.
You understand both formal commands AND casual human language. Users talk to you like Siri — short, informal, sometimes vague.

INTENTS (pick one):
- create_transaction — user wants to start a new deal/transaction
- create_addendum — user wants to create/draft an addendum, amendment, counter offer, or repair request
- check_deadlines — user asks about deadlines, due dates, what's coming up, reminders
- update_status — user wants to change a transaction's status
- show_pipeline — user wants to see their deals, pipeline, workload
- calculate_roi — user asks about ROI, cash flow, yield, investment numbers
- send_alert — user wants to send a message/alert/notification to someone
- market_analysis — user asks about market data, comps, neighborhood info
- add_party — user wants to add buyer/seller/lender/title company to a transaction
- schedule_closing — user wants to set or change a closing date
- send_document — user wants to send a document for signatures or review
- run_compliance — user wants a compliance check on a transaction
- needs_clarification — the command is too vague to act on (see rules below)

CLARIFICATION RULES (critical):
Return "needs_clarification" when:
- Pronouns with no context: "send it", "check on that", "call them" (unless context resolves them)
- Missing critical info: "what's the status" with no property mentioned and no context
- Ambiguous action: could map to 2+ very different intents equally

When asking for clarification, your "response" should be a natural, helpful question — not an error.
Example: "Which transaction are you asking about?" or "Send which document, and to whom?"

TYPO/CASUAL HANDLING:
- "creat addendm for hvac" → create_addendum (ignore typos, focus on intent)
- "what's the deal with Jackson" → check related to Jackson property
- "make that thing for the roof" → create_addendum with repair context
- "send the contract to the buyers" → send_document

PRONOUN RESOLUTION:
When context is provided, resolve pronouns:
- "it" → last document or transaction discussed
- "them" → last mentioned party (buyer/seller)
- "that property" → last mentioned address

Return ONLY valid JSON:
{
  "intent": "one_of_the_intents_above",
  "entities": { "address": "...", "city": "...", "price": "...", "date": "...", "buyer_name": "...", "seller_name": "...", "document_type": "...", "status": "...", "description": "..." },
  "response": "natural language response to show the user",
  "action": "short action label for confirm button (null if needs_clarification)",
  "confidence": 0.0-1.0,
  "clarification_options": ["option1", "option2"] // only if needs_clarification
}`;

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { clerkId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { transcript } = await req.json();

    if (!transcript || typeof transcript !== "string") {
      return NextResponse.json(
        { error: "Transcript required" },
        { status: 400 }
      );
    }

    // Step 1: Log the voice command
    const voiceCommand = await prisma.voiceCommand.create({
      data: {
        userId: user.id,
        rawTranscript: transcript,
        status: "processing",
      },
    });

    // Step 2: Normalize (fix typos + expand synonyms)
    const normalized = normalizeTranscript(transcript);

    // Step 3: Load conversation context
    const context = await loadContext(user.id);

    // Step 4: Build context string for Claude
    let contextHint = "";
    if (context.lastTransaction) {
      contextHint += `\nLast discussed transaction: ${context.lastTransaction.address} (status: ${context.lastTransaction.status})`;
    }
    if (context.lastIntent) {
      contextHint += `\nLast action: ${context.lastIntent}`;
    }
    if (context.recentCommands.length > 0) {
      contextHint += `\nRecent commands: ${context.recentCommands.map((c) => `"${c}"`).join(", ")}`;
    }

    // Step 5: Claude AI classification + entity extraction
    const aiResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: CLASSIFICATION_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Voice command: "${transcript}"${
            normalized !== transcript.toLowerCase().trim()
              ? `\nNormalized: "${normalized}"`
              : ""
          }${contextHint}`,
        },
      ],
    });

    // Parse AI response
    const aiText =
      aiResponse.content[0].type === "text" ? aiResponse.content[0].text : "";

    let parsed;
    try {
      // Strip markdown code fences if present
      const cleaned = aiText.replace(/^```json?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = {
        intent: "needs_clarification",
        entities: {},
        response: "I heard you but couldn't quite understand. Could you rephrase that?",
        action: null,
        confidence: 0,
        clarification_options: [
          "Try: 'Create addendum for 123 Main St'",
          "Try: 'Check deadlines'",
          "Try: 'Show my pipeline'",
        ],
      };
    }

    // Step 6: Update voice command record
    await prisma.voiceCommand.update({
      where: { id: voiceCommand.id },
      data: {
        parsedIntent: parsed.intent,
        parsedEntities: parsed.entities,
        confidence: parsed.confidence,
        result: parsed,
        status: parsed.intent === "needs_clarification" ? "clarification_needed" : "completed",
      },
    });

    console.log(
      `🎙️ Voice: "${transcript}" → ${parsed.intent} (${parsed.confidence})${
        normalized !== transcript.toLowerCase().trim() ? ` [normalized: "${normalized}"]` : ""
      }`
    );

    return NextResponse.json({
      id: voiceCommand.id,
      intent: parsed.intent,
      entities: parsed.entities,
      response: parsed.response,
      action: parsed.action,
      confidence: parsed.confidence,
      clarification_options: parsed.clarification_options || null,
      needsClarification: parsed.intent === "needs_clarification",
    });
  } catch (error) {
    console.error("Voice command error:", error);
    return NextResponse.json(
      { error: "Failed to process voice command" },
      { status: 500 }
    );
  }
}
