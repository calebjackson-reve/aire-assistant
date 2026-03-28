# AIRE Voice-to-Action Pipeline — Technical Spec

The voice pipeline is AIRE's defining feature and core patent claim. This document
covers the complete technical implementation.

---

## Architecture Overview

```
User speaks → Web Speech API (browser) → Raw transcript
→ POST /api/voice-command → Claude intent classification
→ Entity extraction → Transaction matching → Action routing
→ Human approval (if required) → Execution → Response to UI
```

**Target**: Spoken command → completed action in under 8 seconds.

---

## Frontend — VoiceCommandBar Component

A single React component that lives at the bottom of every AIRE page. Works on
iPhone Safari, Android Chrome, and all desktop browsers.

```typescript
// VoiceCommandBar.tsx — Core structure
'use client';

import { useState, useRef, useCallback } from 'react';

interface VoiceCommandBarProps {
  onCommandProcessed?: (result: CommandResult) => void;
}

export default function VoiceCommandBar({ onCommandProcessed }: VoiceCommandBarProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<CommandResult | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const startListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      // Fallback to text input
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      const current = event.results[event.results.length - 1];
      setTranscript(current[0].transcript);

      if (current.isFinal) {
        processCommand(current[0].transcript);
      }
    };

    recognition.start();
    recognitionRef.current = recognition;
    setIsListening(true);
  }, []);

  const processCommand = async (text: string) => {
    setProcessing(true);
    const startTime = Date.now();

    const response = await fetch('/api/voice-command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript: text }),
    });

    const result = await response.json();
    const processingTime = Date.now() - startTime;

    setResult({ ...result, processingTimeMs: processingTime });
    setProcessing(false);
    onCommandProcessed?.(result);
  };

  // Render: mic button, transcript display, processing state, result/approval UI
}
```

---

## API Route — /api/voice-command

The most critical route in the AIRE application. Handles the full intent-to-action pipeline.

```typescript
// app/api/voice-command/route.ts — Core structure
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

export async function POST(req: NextRequest) {
  const { transcript } = await req.json();
  const userId = /* get from auth session */;
  const startTime = Date.now();

  // Step 1: Classify intent
  const classification = await classifyIntent(transcript, userId);

  // Step 2: Extract entities
  const entities = await extractEntities(transcript, classification.intent);

  // Step 3: Match to transaction
  const transaction = await matchTransaction(userId, entities, classification);

  // Step 4: Log the command
  const command = await prisma.voiceCommand.create({
    data: {
      userId,
      transactionId: transaction?.id,
      rawTranscript: transcript,
      classifiedIntent: classification.intent,
      confidence: classification.confidence,
      entities: entities,
      status: 'PROCESSING',
    },
  });

  // Step 5: Route to action
  const result = await routeAction(classification.intent, entities, transaction, command.id);

  // Step 6: Update command with result
  await prisma.voiceCommand.update({
    where: { id: command.id },
    data: {
      status: result.requiresApproval ? 'AWAITING_APPROVAL' : 'EXECUTED',
      actionTaken: result.actionDescription,
      processingTimeMs: Date.now() - startTime,
    },
  });

  return NextResponse.json(result);
}
```

---

## Intent Classification Prompt

This is a trade secret. The system prompt for voice intent classification:

```
You are a real estate voice command classifier for the AIRE platform.
You operate in the Louisiana real estate market.

Given a spoken command from a real estate agent, classify it into exactly one intent:
- draft_addendum: Agent wants to create a contract addendum
- generate_cma: Agent wants a comparative market analysis
- transaction_summary: Agent wants a deal status update
- schedule_action: Agent wants to schedule something
- send_update: Agent wants to draft a communication
- document_status: Agent wants to check document/signature status
- general_query: General real estate question

Also extract:
- confidence (0-1)
- referenced_property: address or client name if mentioned
- referenced_document: document type if mentioned
- date_reference: any dates or deadlines mentioned

Respond in JSON only. No explanation.
```

---

## Transaction Matching Logic

When a voice command references a transaction ambiguously ("the Seyburn file",
"that property on Highland"), resolve using this priority:

1. **Exact match**: Client name, address, or MLS number in the transcript
2. **Active context**: The transaction currently displayed in the UI (passed as context)
3. **Recency**: Most recently modified transaction matching any partial reference
4. **Conversation history**: Match against entities from the last 5 voice commands

```typescript
async function matchTransaction(
  userId: string,
  entities: ExtractedEntities,
  classification: IntentClassification
): Promise<Transaction | null> {
  // Try exact match first
  if (entities.referenced_property) {
    const exact = await prisma.transaction.findFirst({
      where: {
        userId,
        OR: [
          { propertyAddress: { contains: entities.referenced_property, mode: 'insensitive' } },
          { clientName: { contains: entities.referenced_property, mode: 'insensitive' } },
          { mlsNumber: entities.referenced_property },
        ],
      },
    });
    if (exact) return exact;
  }

  // Fall back to most recent active transaction
  return prisma.transaction.findFirst({
    where: {
      userId,
      status: { notIn: ['CLOSED', 'CANCELLED', 'EXPIRED'] },
    },
    orderBy: { updatedAt: 'desc' },
  });
}
```

---

## Action Routing

Each intent maps to a specific handler:

| Intent | Handler | Approval Required |
|--------|---------|-------------------|
| `draft_addendum` | Generate addendum via Claude → save to documents | Yes |
| `generate_cma` | Pull comps from MLS → calculate adjustments → generate PDF | Yes |
| `transaction_summary` | Pull transaction + documents + timeline → summarize | No |
| `schedule_action` | Create calendar event or update transaction dates | Yes |
| `send_update` | Draft email/text to client or other agent | Yes |
| `document_status` | Query Dotloop API + documents table | No |
| `general_query` | Claude response with real estate context | No |

Read-only operations (summary, status, query) execute immediately.
Write operations always require approval before execution.
