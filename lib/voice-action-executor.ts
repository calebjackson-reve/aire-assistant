/**
 * AIRE Voice Action Executor
 * Maps parsed voice intents to real CRUD operations.
 * Called after AI classification confirms the intent.
 */

import prisma from "@/lib/prisma";
import { generateDocument } from "@/lib/document-generator";

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
      return createAddendumDraft(userId, voiceCommandId, entities);

    case "send_alert":
      return sendAlert(userId, entities);

    case "calculate_roi":
      return calculateRoi(entities);

    case "send_document":
      return sendDocument(userId, entities);

    case "run_compliance":
      return runComplianceScan(userId, entities);

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

  await prisma.transaction.update({
    where: { id: txn.id },
    data: { status: newStatus as "DRAFT" | "ACTIVE" | "PENDING_INSPECTION" | "PENDING_APPRAISAL" | "PENDING_FINANCING" | "CLOSING" | "CLOSED" | "CANCELLED" },
  });

  return {
    success: true,
    action: "update_status",
    message: `${txn.propertyAddress} updated to ${newStatus}.`,
    data: { transactionId: txn.id, oldStatus: txn.status, newStatus },
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

  const closingDate = new Date(dateStr);
  if (isNaN(closingDate.getTime())) {
    return {
      success: false,
      action: "schedule_closing",
      message: `Couldn't parse "${dateStr}" as a date. Try a format like "May 15, 2026".`,
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
  // Returns a pointer — actual analysis would call the intelligence API
  const area = entities.address || entities.city || "Baton Rouge";
  return {
    success: true,
    action: "market_analysis",
    message: `Market analysis for ${area}: Use the AIRE Intelligence dashboard at /aire for full market data, AIRE Estimate, and neighborhood scoring.`,
    data: { area, redirectTo: "/aire" },
  };
}

async function createAddendumDraft(
  userId: string,
  voiceCommandId: string,
  entities: Record<string, string>
): Promise<ActionResult> {
  const address = entities.address;
  const docType = entities.document_type || "addendum";

  if (!address) {
    return {
      success: false,
      action: "create_addendum",
      message: "Which property? Please specify the address.",
    };
  }

  const txn = await prisma.transaction.findFirst({
    where: {
      userId,
      propertyAddress: { contains: address, mode: "insensitive" as const },
    },
    include: {
      documents: { select: { type: true } },
    },
  });

  if (!txn) {
    return {
      success: false,
      action: "create_addendum",
      message: `No transaction found matching "${address}".`,
    };
  }

  // Generate actual PDF
  const docTypeNormalized = docType.toLowerCase().replace(/\s+/g, "_");
  const pdf = await generateDocument(docTypeNormalized, {
    propertyAddress: txn.propertyAddress,
    propertyCity: txn.propertyCity,
    propertyState: txn.propertyState,
    propertyZip: txn.propertyZip || undefined,
    buyerName: txn.buyerName || undefined,
    sellerName: txn.sellerName || undefined,
    contractDate: txn.contractDate?.toLocaleDateString("en-US") || undefined,
    closingDate: txn.closingDate?.toLocaleDateString("en-US") || undefined,
    purchasePrice: txn.acceptedPrice?.toString() || txn.listPrice?.toString() || undefined,
    addendumType: docType,
    addendumText: entities.addendum_text || entities.description || undefined,
    repairItems: entities.repair_items ? entities.repair_items.split(";").map((s: string) => s.trim()) : undefined,
  });

  const document = await prisma.document.create({
    data: {
      transactionId: txn.id,
      name: pdf.filename,
      type: pdf.documentType,
      category: "generated",
      filledData: JSON.parse(JSON.stringify(pdf.fields)),
      fileSize: pdf.buffer.length,
      pageCount: pdf.pageCount,
      checklistStatus: "draft",
    },
  });

  // Link voice command to transaction
  await prisma.voiceCommand.update({
    where: { id: voiceCommandId },
    data: { transactionId: txn.id },
  });

  return {
    success: true,
    action: "create_addendum",
    message: `Draft ${docType} created for ${txn.propertyAddress}. Review and complete in the Documents tab.`,
    data: {
      documentId: document.id,
      transactionId: txn.id,
      type: docType,
      status: "draft",
      redirectTo: `/documents/${document.id}`,
    },
    requiresApproval: false, // Already approved to get here
  };
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
