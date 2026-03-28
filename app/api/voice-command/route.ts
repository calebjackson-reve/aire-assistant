import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Voice Command Pipeline (6 steps):
 * 1. Receive raw transcript
 * 2. Normalize + fuzzy match (Levenshtein)
 * 3. Claude AI intent classification
 * 4. Entity extraction (address, dates, amounts)
 * 5. Execute action (create transaction, fill addendum, etc.)
 * 6. Return structured result + push MCP event
 */

// Step 2: Levenshtein distance for fuzzy matching
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

// Known intents for fuzzy matching
const KNOWN_INTENTS = [
  "create transaction",
  "create addendum",
  "check deadlines",
  "update status",
  "show pipeline",
  "calculate roi",
  "send alert",
  "market analysis",
  "add buyer",
  "add seller",
  "schedule closing",
];

function fuzzyMatchIntent(input: string): string | null {
  const normalized = input.toLowerCase().trim();
  let bestMatch = "";
  let bestScore = Infinity;

  for (const intent of KNOWN_INTENTS) {
    const score = levenshtein(normalized.slice(0, intent.length + 5), intent);
    if (score < bestScore && score <= intent.length * 0.4) {
      bestScore = score;
      bestMatch = intent;
    }
  }

  return bestMatch || null;
}

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

    // Step 2: Fuzzy match
    const fuzzyIntent = fuzzyMatchIntent(transcript);

    // Step 3 + 4: Claude AI classification + entity extraction
    const aiResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: `You are AIRE, an AI real estate assistant for Baton Rouge, Louisiana.
Parse the user's voice command and return a JSON response with:
- intent: one of [create_transaction, create_addendum, check_deadlines, update_status, show_pipeline, calculate_roi, send_alert, market_analysis, add_party, schedule_closing, unknown]
- entities: extracted data like {address, city, price, date, buyer_name, seller_name, document_type, status}
- response: a natural language response to show the user
- action: a short action label if confirmation is needed (e.g., "Create transaction at 123 Main St")
- confidence: 0-1 score

Respond ONLY with valid JSON.`,
      messages: [
        {
          role: "user",
          content: `Voice command: "${transcript}"${fuzzyIntent ? `\nFuzzy match hint: "${fuzzyIntent}"` : ""}`,
        },
      ],
    });

    // Parse AI response
    const aiText =
      aiResponse.content[0].type === "text" ? aiResponse.content[0].text : "";

    let parsed;
    try {
      parsed = JSON.parse(aiText);
    } catch {
      parsed = {
        intent: "unknown",
        entities: {},
        response: "I heard you but couldn't understand the command. Could you try again?",
        confidence: 0,
      };
    }

    // Step 5: Update voice command record
    await prisma.voiceCommand.update({
      where: { id: voiceCommand.id },
      data: {
        parsedIntent: parsed.intent,
        parsedEntities: parsed.entities,
        confidence: parsed.confidence,
        result: parsed,
        status: "completed",
      },
    });

    // Step 6: Return result (MCP Push would fire here in production)
    console.log(`🎙️ Voice command processed: "${transcript}" → ${parsed.intent} (${parsed.confidence})`);

    return NextResponse.json({
      id: voiceCommand.id,
      intent: parsed.intent,
      entities: parsed.entities,
      response: parsed.response,
      action: parsed.action,
      confidence: parsed.confidence,
    });
  } catch (error) {
    console.error("Voice command error:", error);
    return NextResponse.json(
      { error: "Failed to process voice command" },
      { status: 500 }
    );
  }
}
