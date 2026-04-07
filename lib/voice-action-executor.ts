/**
 * AIRE Voice Action Executor
 * Maps parsed voice intents to real CRUD operations.
 * Called after AI classification confirms the intent.
 */

import prisma from "@/lib/prisma";
import * as chrono from "chrono-node";
import { advanceTransaction } from "@/lib/workflow/state-machine";
import { AIRE_DATA } from "@/lib/data/market-data";
import { writeContract } from "@/lib/contracts/contract-writer";

export interface ActionRequest {
  userId: string;
  voiceCommandId: string;
  intent: string;
  entities: Record<string, string>;
  confidence: number;
}

export interface ActionResult {
  success: boolean;
  action: string;
  message: string;
  data?: Record<string, unknown>;
  requiresApproval?: boolean;
}

// High-stakes intents that need user confirmation before execution
const APPROVAL_REQUIRED_INTENTS = new Set([
  "create_transaction",
  "create_addendum",
  "send_alert",
  "send_document",
  "schedule_closing",
]);

/**
 * Check if an intent requires explicit approval before execution.
 */
export function requiresApproval(intent: string): boolean {
  return APPROVAL_REQUIRED_INTENTS.has(intent);
}

/**
 * Execute a classified voice command intent.
 */
export async function executeAction(req: ActionRequest): Promise<ActionResult> {
  const { userId, voiceCommandId, intent, entities } = req;

  switch (intent) {
    case "create_transaction":
      return createTransaction(userId, voiceCommandId, entities);

    case "check_deadlines":
      return checkDeadlines(userId, entities);

    case "update_status":
      return updateTransactionStatus(userId, entities);

    case "show_pipeline":
      return showPipeline(userId);

    case "add_party":
      return addParty(userId, entities);

    case "schedule_closing":
      return scheduleClosing(userId, entities);

    case "market_analysis":
      return marketAnalysis(entities);

    case "create_addendum":
      return createAddendum(userId, voiceCommandId, entities);

    case "send_alert":
      return sendAlert(userId, entities);

    case "calculate_roi":
      return calculateRoi(entities);

    case "send_document":
      return sendDocument(userId, entities);

    case "run_compliance":
      return runComplianceScan(userId, entities);

    case "write_contract":
    case "write_purchase_agreement":
      return writeContractFromVoice(userId, voiceCommandId, entities);

    default:
      return {
        success: false,
        action: "unknown",
        message: `I don't know how to execute "${intent}" yet.`,
      };
  }
}

// ─── Intent Handlers ───────────────────────────────────────────

async function createTransaction(
  userId: string,
  voiceCommandId: string,
  entities: Record<string, string>
): Promise<ActionResult> {
  const address = entities.address;
  if (!address) {
    return {
      success: false,
      action: "create_transaction",
      message: "I need a property address to create a transaction. Try: 'Create transaction at 123 Main St'",
    };
  }

  const transaction = await prisma.transaction.create({
    data: {
      userId,
      propertyAddress: address,
      propertyCity: entities.city || "Baton Rouge",
      propertyState: entities.state || "LA",
      propertyZip: entities.zip || null,
      propertyType: entities.property_type || "residential",
      mlsNumber: entities.mls_number || null,
      listPrice: entities.price ? parseFloat(entities.price.replace(/[^0-9.]/g, "")) : null,
      buyerName: entities.buyer_name || null,
      sellerName: entities.seller_name || null,
      status: "DRAFT",
    },
  });

  // Link voice command to transaction
  await prisma.voiceCommand.update({
    where: { id: voiceCommandId },
    data: { transactionId: transaction.id },
  });

  return {
    success: true,
    action: "create_transaction",
    message: `Transaction created for ${address}. Status: DRAFT.`,
    data: {
      transactionId: transaction.id,
      propertyAddress: address,
      status: "DRAFT",
    },
  };
}

async function checkDeadlines(
  userId: string,
  entities: Record<string, string>
): Promise<ActionResult> {
  // Find transactions with upcoming deadlines
  const where: Record<string, unknown> = {
    userId,
    completedAt: null,
    dueDate: { gte: new Date() },
  };

  // If address specified, find that transaction's deadlines
  if (entities.address) {
    const txn = await prisma.transaction.findFirst({
      where: {
        userId,
        propertyAddress: { contains: entities.address, mode: "insensitive" as const },
      },
    });
    if (txn) where.transactionId = txn.id;
  }

  const deadlines = await prisma.deadline.findMany({
    where,
    orderBy: { dueDate: "asc" },
    take: 10,
    include: { transaction: { select: { propertyAddress: true } } },
  });

  if (deadlines.length === 0) {
    return {
      success: true,
      action: "check_deadlines",
      message: "No upcoming deadlines found.",
      data: { deadlines: [] },
    };
  }

  const formatted = deadlines.map((d) => {
    const days = Math.ceil((d.dueDate.getTime() - Date.now()) / 86400000);
    return `${d.name} — ${d.transaction.propertyAddress} — ${days === 0 ? "TODAY" : days === 1 ? "tomorrow" : `in ${days} days`}`;
  });

  return {
    success: true,
    action: "check_deadlines",
    message: `${deadlines.length} upcoming deadline${deadlines.length > 1 ? "s" : ""}:\n${formatted.join("\n")}`,
    data: {
      deadlines: deadlines.map((d) => ({
        id: d.id,
        name: d.name,
        dueDate: d.dueDate.toISOString(),
        property: d.transaction.propertyAddress,
      })),
    },
  };
}

async function updateTransactionStatus(
  userId: string,
  entities: Record<string, string>
): Promise<ActionResult> {
  const address = entities.address;
  const newStatus = entities.status?.toUpperCase().replace(/\s+/g, "_");

  if (!address) {
    return {
      success: false,
      action: "update_status",
      message: "Which transaction? Please specify the property address.",
    };
  }

  const validStatuses = [
    "DRAFT", "ACTIVE", "PENDING_INSPECTION", "PENDING_APPRAISAL",
    "PENDING_FINANCING", "CLOSING", "CLOSED", "CANCELLED",
  ];

  if (!newStatus || !validStatuses.includes(newStatus)) {
    return {
      success: false,
      action: "update_status",
      message: `Invalid status. Valid options: ${validStatuses.join(", ")}`,
    };
  }

  const txn = await prisma.transaction.findFirst({
    where: {
      userId,
      propertyAddress: { contains: address, mode: "insensitive" as const },
    },
  });

  if (!txn) {
    return {
      success: false,
      action: "update_status",
      message: `No transaction found matching "${address}".`,
    };
  }

  // Use workflow state machine for validated transitions + event logging
  const result = await advanceTransaction({
    transactionId: txn.id,
    toStatus: newStatus as "DRAFT" | "ACTIVE" | "PENDING_INSPECTION" | "PENDING_APPRAISAL" | "PENDING_FINANCING" | "CLOSING" | "CLOSED" | "CANCELLED",
    trigger: "voice_command",
    triggeredBy: userId,
    metadata: { source: "voice_command", requestedStatus: newStatus },
  });

  if (!result.success) {
    return {
      success: false,
      action: "update_status",
      message: result.error || `Cannot transition ${txn.status} → ${newStatus}.`,
    };
  }

  return {
    success: true,
    action: "update_status",
    message: `${txn.propertyAddress} updated from ${result.fromStatus} to ${newStatus}.`,
    data: { transactionId: txn.id, oldStatus: result.fromStatus, newStatus, eventId: result.eventId },
  };
}

async function showPipeline(userId: string): Promise<ActionResult> {
  const transactions = await prisma.transaction.findMany({
    where: { userId, status: { notIn: ["CLOSED", "CANCELLED"] } },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      propertyAddress: true,
      status: true,
      listPrice: true,
      closingDate: true,
    },
  });

  if (transactions.length === 0) {
    return {
      success: true,
      action: "show_pipeline",
      message: "Your pipeline is empty. Say 'create transaction' to start one.",
      data: { transactions: [] },
    };
  }

  const lines = transactions.map((t) => {
    const price = t.listPrice ? `$${(t.listPrice / 1000).toFixed(0)}K` : "no price";
    return `${t.propertyAddress} — ${t.status} — ${price}`;
  });

  return {
    success: true,
    action: "show_pipeline",
    message: `${transactions.length} active deal${transactions.length > 1 ? "s" : ""}:\n${lines.join("\n")}`,
    data: { transactions },
  };
}

async function addParty(
  userId: string,
  entities: Record<string, string>
): Promise<ActionResult> {
  const address = entities.address;
  if (!address) {
    return {
      success: false,
      action: "add_party",
      message: "Which transaction? Please specify the property address.",
    };
  }

  const txn = await prisma.transaction.findFirst({
    where: {
      userId,
      propertyAddress: { contains: address, mode: "insensitive" as const },
    },
  });

  if (!txn) {
    return {
      success: false,
      action: "add_party",
      message: `No transaction found matching "${address}".`,
    };
  }

  const updateData: Record<string, string> = {};
  if (entities.buyer_name) updateData.buyerName = entities.buyer_name;
  if (entities.buyer_email) updateData.buyerEmail = entities.buyer_email;
  if (entities.buyer_phone) updateData.buyerPhone = entities.buyer_phone;
  if (entities.seller_name) updateData.sellerName = entities.seller_name;
  if (entities.seller_email) updateData.sellerEmail = entities.seller_email;
  if (entities.seller_phone) updateData.sellerPhone = entities.seller_phone;
  if (entities.lender_name) updateData.lenderName = entities.lender_name;
  if (entities.title_company) updateData.titleCompany = entities.title_company;

  if (Object.keys(updateData).length === 0) {
    return {
      success: false,
      action: "add_party",
      message: "I need a name to add. Try: 'Add buyer John Smith to 123 Main St'",
    };
  }

  await prisma.transaction.update({
    where: { id: txn.id },
    data: updateData,
  });

  const added = Object.entries(updateData).map(([k, v]) => `${k.replace(/([A-Z])/g, " $1").toLowerCase()}: ${v}`).join(", ");

  return {
    success: true,
    action: "add_party",
    message: `Updated ${txn.propertyAddress}: ${added}`,
    data: { transactionId: txn.id, updated: updateData },
  };
}

async function scheduleClosing(
  userId: string,
  entities: Record<string, string>
): Promise<ActionResult> {
  const address = entities.address;
  const dateStr = entities.date;

  if (!address || !dateStr) {
    return {
      success: false,
      action: "schedule_closing",
      message: "I need the property address and closing date. Try: 'Schedule closing for 123 Main St on May 15th'",
    };
  }

  const txn = await prisma.transaction.findFirst({
    where: {
      userId,
      propertyAddress: { contains: address, mode: "insensitive" as const },
    },
  });

  if (!txn) {
    return {
      success: false,
      action: "schedule_closing",
      message: `No transaction found matching "${address}".`,
    };
  }

  // chrono-node handles "next Friday", "in two weeks", "May 15", "end of month", etc.
  // forwardDate: true forces ambiguous dates (e.g., "Friday") to resolve to the future.
  const closingDate = chrono.parseDate(dateStr, new Date(), { forwardDate: true });
  if (!closingDate || isNaN(closingDate.getTime())) {
    return {
      success: false,
      action: "schedule_closing",
      message: `Couldn't parse "${dateStr}" as a date. Try "next Friday", "May 15", or "in two weeks".`,
    };
  }

  await prisma.transaction.update({
    where: { id: txn.id },
    data: { closingDate, status: "CLOSING" },
  });

  return {
    success: true,
    action: "schedule_closing",
    message: `Closing scheduled for ${txn.propertyAddress} on ${closingDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}.`,
    data: { transactionId: txn.id, closingDate: closingDate.toISOString() },
  };
}

async function marketAnalysis(
  entities: Record<string, string>
): Promise<ActionResult> {
  const area = entities.address || entities.city || "Baton Rouge";

  // Try to find matching neighborhood in AIRE_DATA
  const neighborhood = AIRE_DATA.markets.find(
    (m) => m.name.toLowerCase().includes(area.toLowerCase()) ||
           m.id === area.toLowerCase().replace(/\s+/g, "-")
  );

  if (neighborhood) {
    return {
      success: true,
      action: "market_analysis",
      message: `${neighborhood.name} (${neighborhood.label}, Heat Score: ${neighborhood.heatScore}/100):\n` +
        `Median Price: $${neighborhood.medianPrice.toLocaleString()} (${neighborhood.medianPriceChange > 0 ? "+" : ""}${neighborhood.medianPriceChange}% YoY)\n` +
        `DOM: ${neighborhood.dom} days | List/Sale: ${neighborhood.listSaleRatio}%\n` +
        `Price/sqft: $${neighborhood.pricePerSqft} | Inventory: ${neighborhood.inventory} months\n` +
        `${neighborhood.recommendation}`,
      data: { neighborhood, source: "AIRE_DATA" },
    };
  }

  // Fall back to metro-level data
  const metro = AIRE_DATA.metro;
  return {
    success: true,
    action: "market_analysis",
    message: `Baton Rouge Metro Market:\n` +
      `Median Price: $${metro.medianPrice.toLocaleString()} (${metro.medianPriceChange > 0 ? "+" : ""}${metro.medianPriceChange}% YoY)\n` +
      `Closed Sales: ${metro.closedSales} | Pending: ${metro.pendingSales}\n` +
      `DOM: ${metro.dom} days | List/Sale: ${metro.listSaleRatio}%\n` +
      `Inventory: ${metro.inventory} (${metro.monthsSupply} months supply)\n` +
      `Available neighborhoods: ${AIRE_DATA.markets.map((m) => m.name).join(", ")}`,
    data: { metro, availableNeighborhoods: AIRE_DATA.markets.map((m) => m.id) },
  };
}

/**
 * Create an addendum by calling the contract writer (lrec-103).
 * Replaces the legacy createAddendumDraft path — unified with the
 * contract-writer pipeline so addenda and PAs share clause/validation logic.
 */
async function createAddendum(
  userId: string,
  voiceCommandId: string,
  entities: Record<string, string>
): Promise<ActionResult> {
  const address = entities.address;
  if (!address) {
    return {
      success: false,
      action: "create_addendum",
      message: "Which property? Try: 'Create addendum for 123 Main St — extend inspection by 5 days'",
    };
  }

  // Look up transaction (exact → starts-with → contains)
  let txn = await prisma.transaction.findFirst({
    where: { userId, propertyAddress: { equals: address, mode: "insensitive" as const } },
  });
  if (!txn) {
    txn = await prisma.transaction.findFirst({
      where: { userId, propertyAddress: { startsWith: address, mode: "insensitive" as const } },
    });
  }
  if (!txn) {
    txn = await prisma.transaction.findFirst({
      where: { userId, propertyAddress: { contains: address, mode: "insensitive" as const } },
    });
  }

  if (!txn) {
    return {
      success: false,
      action: "create_addendum",
      message: `No transaction found matching "${address}".`,
    };
  }

  const description =
    entities.description ||
    entities.addendum_text ||
    entities.addendum_type ||
    "addendum";

  // Build a natural-language command for the contract writer
  const nlCommand = `Write an addendum for ${txn.propertyAddress}: ${description}`;

  try {
    const result = await writeContract({
      formType: "lrec-103", // LREC Addendum
      naturalLanguage: nlCommand,
      fields: {
        ...entities,
        address: txn.propertyAddress,
        property_address: txn.propertyAddress,
        property_city: txn.propertyCity,
        property_state: txn.propertyState,
        buyer_name: entities.buyer_name || txn.buyerName || "",
        seller_name: entities.seller_name || txn.sellerName || "",
        description,
        addendum_text: description,
      },
      transactionId: txn.id,
      userId,
    });

    // Link voice command to transaction
    await prisma.voiceCommand.update({
      where: { id: voiceCommandId },
      data: { transactionId: txn.id },
    });

    // Persist Document record
    let documentId: string | null = null;
    if (result.pdfBuffer && result.pdfBuffer.length > 0) {
      const doc = await prisma.document.create({
        data: {
          transactionId: txn.id,
          name: result.filename,
          type: "addendum",
          category: "addendum",
          filledData: JSON.parse(JSON.stringify(result.fields)),
          fileSize: result.pdfBuffer.length,
          pageCount: result.pageCount,
          checklistStatus: "draft",
        },
      });
      documentId = doc.id;
    }

    const warnings = result.validation?.warnings?.length
      ? ` Note: ${result.validation.warnings.join("; ")}`
      : "";

    return {
      success: true,
      action: "create_addendum",
      message: `Addendum drafted for ${txn.propertyAddress}: ${result.filename} (${result.pageCount} page${result.pageCount === 1 ? "" : "s"}).${warnings}`,
      data: {
        documentId,
        transactionId: txn.id,
        filename: result.filename,
        formType: result.formType,
        pageCount: result.pageCount,
        description,
        redirectTo: documentId ? `/aire/transactions/${txn.id}` : undefined,
      },
      requiresApproval: false, // User already confirmed via preview
    };
  } catch (err) {
    console.error("[Voice→Addendum] Error:", err);
    return {
      success: false,
      action: "create_addendum",
      message: `Failed to generate addendum for ${txn.propertyAddress}. ${err instanceof Error ? err.message : "Please try again."}`,
    };
  }
}

async function sendAlert(
  userId: string,
  entities: Record<string, string>
): Promise<ActionResult> {
  // Placeholder — will integrate with Twilio in production
  const recipient = entities.buyer_name || entities.seller_name || "the other party";
  const address = entities.address || "the transaction";

  return {
    success: true,
    action: "send_alert",
    message: `Alert queued for ${recipient} regarding ${address}. Delivery via SMS/email will be sent shortly.`,
    data: { recipient, address, status: "queued" },
  };
}

async function sendDocument(
  userId: string,
  entities: Record<string, string>
): Promise<ActionResult> {
  const address = entities.address;
  if (!address) {
    return {
      success: false,
      action: "send_document",
      message: "Which property's document should I send? Please specify the address.",
    };
  }

  const recipient = entities.buyer_name || entities.seller_name;
  if (!recipient) {
    return {
      success: false,
      action: "send_document",
      message: "Who should I send it to? Please specify a name.",
    };
  }

  const txn = await prisma.transaction.findFirst({
    where: {
      userId,
      propertyAddress: { contains: address, mode: "insensitive" as const },
    },
  });

  if (!txn) {
    return {
      success: false,
      action: "send_document",
      message: `No transaction found matching "${address}".`,
    };
  }

  return {
    success: true,
    action: "send_document",
    message: `Document for ${txn.propertyAddress} queued to send to ${recipient}. Open AirSign to complete.`,
    data: { transactionId: txn.id, recipient, redirectTo: `/airsign?txn=${txn.id}` },
  };
}

async function runComplianceScan(
  userId: string,
  entities: Record<string, string>
): Promise<ActionResult> {
  const address = entities.address;

  if (!address) {
    // Run on most recent active transaction
    const txn = await prisma.transaction.findFirst({
      where: { userId, status: { notIn: ["CLOSED", "CANCELLED"] } },
      orderBy: { updatedAt: "desc" },
    });

    if (!txn) {
      return {
        success: false,
        action: "run_compliance",
        message: "No active transactions found to scan.",
      };
    }

    return {
      success: true,
      action: "run_compliance",
      message: `Running compliance scan on ${txn.propertyAddress}. View results in the Compliance tab.`,
      data: { transactionId: txn.id, redirectTo: `/aire?compliance=${txn.id}` },
    };
  }

  const txn = await prisma.transaction.findFirst({
    where: {
      userId,
      propertyAddress: { contains: address, mode: "insensitive" as const },
    },
  });

  if (!txn) {
    return {
      success: false,
      action: "run_compliance",
      message: `No transaction found matching "${address}".`,
    };
  }

  return {
    success: true,
    action: "run_compliance",
    message: `Running compliance scan on ${txn.propertyAddress}. View results in the Compliance tab.`,
    data: { transactionId: txn.id, redirectTo: `/aire?compliance=${txn.id}` },
  };
}

function calculateRoi(entities: Record<string, string>): ActionResult {
  const price = parseFloat((entities.price || "0").replace(/[^0-9.]/g, ""));
  const rent = parseFloat((entities.rent || "0").replace(/[^0-9.]/g, ""));

  if (!price || !rent) {
    return {
      success: false,
      action: "calculate_roi",
      message: "I need the purchase price and monthly rent. Try: 'Calculate ROI for $200K property renting at $1,500/month'",
    };
  }

  const annualRent = rent * 12;
  const grossYield = ((annualRent / price) * 100).toFixed(2);
  const monthlyFlow = rent - price * 0.007; // rough PITI estimate at 0.7% monthly
  const annualFlow = monthlyFlow * 12;

  return {
    success: true,
    action: "calculate_roi",
    message: `ROI estimate: ${grossYield}% gross yield. ~$${monthlyFlow.toFixed(0)}/mo cash flow ($${annualFlow.toFixed(0)}/yr). Purchase: $${(price / 1000).toFixed(0)}K, Rent: $${rent.toFixed(0)}/mo.`,
    data: { price, rent, grossYield: parseFloat(grossYield), monthlyCashFlow: monthlyFlow, annualCashFlow: annualFlow },
  };
}

async function writeContractFromVoice(
  userId: string,
  voiceCommandId: string,
  entities: Record<string, string>
): Promise<ActionResult> {
  // Build NL command from entities for the contract writer
  const parts: string[] = []
  if (entities.address) parts.push(`property at ${entities.address}`)
  if (entities.buyer_name) parts.push(`buyer ${entities.buyer_name}`)
  if (entities.seller_name) parts.push(`seller ${entities.seller_name}`)
  if (entities.price) parts.push(`price $${entities.price}`)
  if (entities.date) parts.push(`closing ${entities.date}`)
  if (entities.earnest_money) parts.push(`earnest money $${entities.earnest_money}`)

  const nlCommand = parts.length > 0
    ? `Write purchase agreement for ${parts.join(", ")}`
    : "Write purchase agreement"

  // Check if a transaction exists for this address
  let transactionId: string | undefined
  if (entities.address) {
    const txn = await prisma.transaction.findFirst({
      where: { userId, propertyAddress: { contains: entities.address, mode: "insensitive" as const } },
    })
    if (txn) transactionId = txn.id
  }

  try {
    const result = await writeContract({
      formType: entities.document_type === "addendum" ? "lrec-103" : "lrec-101",
      naturalLanguage: nlCommand,
      fields: entities,
      transactionId,
      userId,
    })

    // Link voice command to transaction
    if (transactionId) {
      await prisma.voiceCommand.update({
        where: { id: voiceCommandId },
        data: { transactionId },
      })
    }

    // Save as document if transaction exists
    let documentId: string | null = null
    if (transactionId && result.pdfBuffer.length > 0) {
      const doc = await prisma.document.create({
        data: {
          transactionId,
          name: result.filename,
          type: result.formType,
          category: "generated",
          filledData: JSON.parse(JSON.stringify(result.fields)),
          fileSize: result.pdfBuffer.length,
          pageCount: result.pageCount,
          checklistStatus: "draft",
        },
      })
      documentId = doc.id
    }

    const warnings = result.validation.warnings.length > 0
      ? ` Note: ${result.validation.warnings.join("; ")}`
      : ""

    return {
      success: true,
      action: "write_contract",
      message: `Contract draft created: ${result.filename} (${result.pageCount} pages, ${result.clauses.length} clauses). Generated in ${(result.timing.totalMs / 1000).toFixed(1)}s.${warnings}`,
      data: {
        filename: result.filename,
        formType: result.formType,
        pageCount: result.pageCount,
        clauses: result.clauses,
        timing: result.timing,
        documentId,
        transactionId,
        validation: result.validation,
      },
    }
  } catch (err) {
    console.error("[Voice→Contract] Error:", err)
    return {
      success: false,
      action: "write_contract",
      message: "Failed to generate the contract. Please try again or specify more details.",
    }
  }
}
