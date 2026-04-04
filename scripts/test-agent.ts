#!/usr/bin/env npx tsx
/**
 * AIRE Agent Test Harness
 *
 * Test any AIRE agent with fixture data — no auth, no server, no database.
 *
 * Usage:
 *   npx tsx scripts/test-agent.ts --agent voice --input "Schedule inspection for Seyburn"
 *   npx tsx scripts/test-agent.ts --agent email --fixture counter-offer
 *   npx tsx scripts/test-agent.ts --agent email --fixture inspection
 *   npx tsx scripts/test-agent.ts --agent email --fixture lender-update
 *   npx tsx scripts/test-agent.ts --agent morning-brief --date today
 *   npx tsx scripts/test-agent.ts --agent transaction --id fixture-txn-seyburn
 *   npx tsx scripts/test-agent.ts --agent compliance --id fixture-txn-antonio
 *   npx tsx scripts/test-agent.ts --all
 */

import { transactions } from "./fixtures/transactions";
import { emails } from "./fixtures/emails";
import { printResult, printHeader, printSummary } from "./harness-output";
// No zod import needed — using simple key validation

// ── Schemas for output validation ──

const SCHEMAS: Record<string, string[]> = {
  voice: ["intent", "entities", "action", "response", "confidence"],
  email: ["classification", "priority", "actionItems", "matchedTransaction"],
  brief: ["date", "urgentItems", "deadlines", "summary"],
  compliance: ["transactionId", "issues", "score", "missingDocuments"],
};

// ── Agent Simulators (replace with real agent logic as agents are built) ──

async function runVoiceAgent(input: string) {
  // Simulate voice intent classification
  const lowerInput = input.toLowerCase();

  let intent = "unknown";
  let action = "none";
  const entities: Record<string, string> = {};
  let confidence = 0.5;

  if (lowerInput.includes("schedule") && lowerInput.includes("inspection")) {
    intent = "schedule_inspection";
    action = "create_deadline";
    confidence = 0.92;
    // Try to match a property
    for (const txn of transactions) {
      const addr = txn.propertyAddress.toLowerCase();
      if (lowerInput.includes(addr.split(" ")[1]?.toLowerCase() || "___")) {
        entities.transactionId = txn.id;
        entities.propertyAddress = txn.propertyAddress;
        break;
      }
    }
  } else if (lowerInput.includes("counter") || lowerInput.includes("offer")) {
    intent = "respond_to_offer";
    action = "draft_counter";
    confidence = 0.88;
  } else if (lowerInput.includes("closing") || lowerInput.includes("close")) {
    intent = "check_closing_status";
    action = "query_transaction";
    confidence = 0.85;
  } else if (lowerInput.includes("deadline")) {
    intent = "check_deadlines";
    action = "query_deadlines";
    confidence = 0.90;
  }

  return {
    intent,
    entities,
    action,
    response: `Understood: "${input}" → ${intent} (${(confidence * 100).toFixed(0)}% confidence)`,
    confidence,
  };
}

async function runEmailAgent(fixtureKey: string) {
  const fixtureMap: Record<string, number> = {
    "counter-offer": 0,
    "inspection": 1,
    "lender-update": 2,
  };

  const idx = fixtureMap[fixtureKey];
  if (idx === undefined) {
    throw new Error(`Unknown fixture: ${fixtureKey}. Use: counter-offer, inspection, lender-update`);
  }

  const email = emails[idx];
  const body = email.bodySnippet.toLowerCase();

  // Simulate email classification
  let classification = "general";
  let priority: "urgent" | "high" | "normal" | "low" = "normal";
  const actionItems: string[] = [];

  if (body.includes("counter") || body.includes("offer")) {
    classification = "counter_offer";
    priority = "urgent";
    actionItems.push("Review counter offer terms");
    actionItems.push("Discuss with buyer before responding");
    actionItems.push("Check mineral rights exclusion language");
    actionItems.push("Respond by end of business Friday");
  } else if (body.includes("inspection") || body.includes("report")) {
    classification = "inspection_report";
    priority = "high";
    actionItems.push("Review inspection findings with buyer");
    actionItems.push("Prepare repair request list");
    actionItems.push("Note: HVAC is 12 years old — negotiate replacement or credit");
    actionItems.push("Deadline: respond within inspection period");
  } else if (body.includes("clear to close") || body.includes("funding")) {
    classification = "clear_to_close";
    priority = "high";
    actionItems.push("Coordinate with Pelican Title for Act of Sale scheduling");
    actionItems.push("Send closing disclosure to all parties");
    actionItems.push("Confirm funding date: April 14, 2026");
    actionItems.push("Remind buyer about final walkthrough");
  }

  return {
    classification,
    priority,
    actionItems,
    matchedTransaction: email._matchesTransaction,
    suggestedResponse: `Acknowledged ${classification} for ${email.subject.split("—")[1]?.trim() || email.subject}`,
  };
}

async function runMorningBrief(dateStr: string) {
  const today = dateStr === "today" ? new Date() : new Date(Date.now() - 24 * 60 * 60 * 1000);
  const dateLabel = today.toISOString().split("T")[0];

  // Build brief from fixture data
  const urgentItems: { label: string; detail: string }[] = [];
  const deadlines: { name: string; date: string; transaction: string }[] = [];

  for (const txn of transactions) {
    // Check financing deadline (Antonio Rd is tomorrow)
    if (txn.financingDeadline) {
      const daysUntil = Math.ceil(
        (txn.financingDeadline.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
      );
      if (daysUntil <= 2) {
        urgentItems.push({
          label: `Financing deadline ${daysUntil === 0 ? "TODAY" : daysUntil === 1 ? "TOMORROW" : `in ${daysUntil} days`}`,
          detail: `${txn.propertyAddress} — ${txn.buyerName || "No buyer"} — ${txn.lenderName || "No lender"}`,
        });
      }
      deadlines.push({
        name: "Financing Contingency",
        date: txn.financingDeadline.toISOString().split("T")[0],
        transaction: txn.propertyAddress,
      });
    }

    // Check inspection deadline (Seyburn is in 3 days)
    if (txn.inspectionDeadline) {
      const daysUntil = Math.ceil(
        (txn.inspectionDeadline.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
      );
      if (daysUntil <= 5) {
        urgentItems.push({
          label: `Inspection deadline in ${daysUntil} days`,
          detail: `${txn.propertyAddress} — review inspection report and prepare repair request`,
        });
      }
      deadlines.push({
        name: "Inspection Period",
        date: txn.inspectionDeadline.toISOString().split("T")[0],
        transaction: txn.propertyAddress,
      });
    }
  }

  // Sort deadlines by date
  deadlines.sort((a, b) => a.date.localeCompare(b.date));

  return {
    date: dateLabel,
    urgentItems,
    deadlines,
    summary: `${urgentItems.length} urgent items, ${deadlines.length} upcoming deadlines across ${transactions.length} active transactions. Priority: ${urgentItems[0]?.label || "No urgent items"}.`,
  };
}

async function runComplianceAgent(transactionId: string) {
  const txn = transactions.find((t) => t.id === transactionId);
  if (!txn) {
    throw new Error(`Transaction not found: ${transactionId}`);
  }

  const issues: { severity: string; message: string }[] = [];
  const missingDocuments: string[] = [];
  let score = 100;

  // Check required documents (simulated — all missing since no DB)
  missingDocuments.push("Purchase Agreement (signed)");
  missingDocuments.push("Property Disclosure Document");
  missingDocuments.push("Agency Disclosure Form");
  score -= missingDocuments.length * 10;

  // Louisiana-specific checks
  if (txn._la.mineralRightsExcluded) {
    issues.push({
      severity: "warning",
      message: `Mineral rights excluded on ${txn.propertyAddress} — ensure buyer has acknowledged in writing`,
    });
    score -= 5;
  }

  if (txn._la.floodZone.startsWith("A")) {
    issues.push({
      severity: "warning",
      message: `Property in flood zone ${txn._la.floodZone} — flood insurance discussion required before closing`,
    });
    score -= 5;
  }

  // Check deadline proximity
  if (txn.financingDeadline) {
    const daysUntil = Math.ceil(
      (txn.financingDeadline.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
    );
    if (daysUntil <= 1) {
      issues.push({
        severity: "critical",
        message: `Financing deadline is ${daysUntil === 0 ? "TODAY" : "TOMORROW"} — confirm lender status immediately`,
      });
      score -= 15;
    }
  }

  if (!txn.buyerName && txn.status !== "ACTIVE") {
    issues.push({
      severity: "error",
      message: "No buyer on record for a transaction past ACTIVE status",
    });
    score -= 10;
  }

  return {
    transactionId: txn.id,
    issues,
    score: Math.max(0, score),
    missingDocuments,
  };
}

// ── CLI Argument Parsing ──

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed: Record<string, string> = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      parsed[key] = args[i + 1] || "true";
      i++;
    }
  }

  return parsed;
}

// ── Main ──

async function main() {
  const args = parseArgs();

  if (args.all !== undefined) {
    printHeader("Running ALL agents");
    const results: { agent: string; passed: boolean; time: number }[] = [];

    // Voice
    let start = Date.now();
    const voiceOut = await runVoiceAgent("Schedule inspection for Seyburn property");
    let elapsed = Date.now() - start;
    const voicePassed = printResult("Voice Command Agent", voiceOut, SCHEMAS.voice, start);
    results.push({ agent: "Voice", passed: !!voicePassed, time: elapsed });

    // Email (all 3)
    for (const fixture of ["counter-offer", "inspection", "lender-update"]) {
      start = Date.now();
      const emailOut = await runEmailAgent(fixture);
      elapsed = Date.now() - start;
      const emailPassed = printResult(`Email Agent (${fixture})`, emailOut, SCHEMAS.email, start);
      results.push({ agent: `Email:${fixture}`, passed: !!emailPassed, time: elapsed });
    }

    // Morning Brief
    start = Date.now();
    const briefOut = await runMorningBrief("today");
    elapsed = Date.now() - start;
    const briefPassed = printResult("Morning Brief Agent", briefOut, SCHEMAS.brief, start);
    results.push({ agent: "Morning Brief", passed: !!briefPassed, time: elapsed });

    // Compliance (all 3 transactions)
    for (const txn of transactions) {
      start = Date.now();
      const compOut = await runComplianceAgent(txn.id);
      elapsed = Date.now() - start;
      const compPassed = printResult(`Compliance Agent (${txn.propertyAddress})`, compOut, SCHEMAS.compliance, start);
      results.push({ agent: `Compliance:${txn.propertyAddress}`, passed: !!compPassed, time: elapsed });
    }

    printSummary(results);
    return;
  }

  const agent = args.agent;
  if (!agent) {
    console.log("Usage:");
    console.log('  npx tsx scripts/test-agent.ts --agent voice --input "Schedule inspection for Seyburn"');
    console.log("  npx tsx scripts/test-agent.ts --agent email --fixture counter-offer");
    console.log("  npx tsx scripts/test-agent.ts --agent morning-brief --date today");
    console.log("  npx tsx scripts/test-agent.ts --agent compliance --id fixture-txn-antonio");
    console.log("  npx tsx scripts/test-agent.ts --all");
    process.exit(1);
  }

  const start = Date.now();

  switch (agent) {
    case "voice": {
      const input = args.input || "What are my deadlines this week?";
      printHeader(`Voice Agent: "${input}"`);
      const out = await runVoiceAgent(input);
      printResult("Voice Command Agent", out, SCHEMAS.voice, start);
      break;
    }
    case "email": {
      const fixture = args.fixture || "counter-offer";
      printHeader(`Email Agent: fixture=${fixture}`);
      const out = await runEmailAgent(fixture);
      printResult("Email Scan Agent", out, SCHEMAS.email, start);
      break;
    }
    case "morning-brief": {
      const date = args.date || "today";
      printHeader(`Morning Brief: ${date}`);
      const out = await runMorningBrief(date);
      printResult("Morning Brief Agent", out, SCHEMAS.brief, start);
      break;
    }
    case "transaction": {
      const id = args.id || "fixture-txn-seyburn";
      printHeader(`Transaction Agent: ${id}`);
      const txn = transactions.find((t) => t.id === id);
      printResult("Transaction Agent", txn, undefined, start);
      break;
    }
    case "compliance": {
      const id = args.id || "fixture-txn-antonio";
      printHeader(`Compliance Agent: ${id}`);
      const out = await runComplianceAgent(id);
      printResult("Compliance Agent", out, SCHEMAS.compliance, start);
      break;
    }
    default:
      console.error(`Unknown agent: ${agent}`);
      console.error("Available: voice, email, morning-brief, transaction, compliance");
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("Test harness error:", err);
  process.exit(1);
});
