/**
 * AIRE TC Morning Brief Generator
 *
 * Builds a daily summary for TC coordinators with:
 * - Upcoming deadlines (via Louisiana rules engine)
 * - Active transaction pipeline status
 * - Document completeness per transaction
 * - Action items prioritized by urgency
 *
 * Differs from the agent-level Morning Brief (cron/morning-brief):
 * That one is for the AGENT (outreach, contacts, relationships).
 * This one is for the TC role (deadlines, docs, compliance).
 */

import prisma from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";
import {
  calculateDeadlines,
  type TransactionDates,
  type CalculatedDeadline,
} from "@/lib/louisiana-rules-engine";

// ─── Types ─────────────────────────────────────────────────────

export interface TCBriefTransaction {
  id: string;
  propertyAddress: string;
  status: string;
  buyerName: string | null;
  sellerName: string | null;
  closingDate: Date | null;
  documentCount: number;
  missingDocs: string[];
  upcomingDeadlines: CalculatedDeadline[];
  overdueDeadlines: CalculatedDeadline[];
}

export interface TCMorningBrief {
  userId: string;
  agentName: string;
  briefDate: Date;
  transactions: TCBriefTransaction[];
  totalActive: number;
  totalDeadlinesUpcoming: number;
  totalDeadlinesOverdue: number;
  totalMissingDocs: number;
  summary: string;
  actionItems: Array<{
    action: string;
    priority: "high" | "medium" | "low";
    transactionId: string;
    propertyAddress: string;
  }>;
}

// Required document types for a complete Louisiana RE transaction
const REQUIRED_DOCS = [
  "purchase_agreement",
  "property_disclosure",
  "agency_disclosure",
  "lead_paint",
];

// ─── Core Brief Generator ──────────────────────────────────────

export async function generateTCMorningBrief(userId: string): Promise<TCMorningBrief> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, firstName: true, lastName: true },
  });

  if (!user) throw new Error(`User ${userId} not found`);

  const now = new Date();
  const agentName = [user.firstName, user.lastName].filter(Boolean).join(" ") || "Agent";

  // Get all active transactions with documents and deadlines
  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      status: { notIn: ["CLOSED", "CANCELLED"] },
    },
    include: {
      documents: { select: { type: true, checklistStatus: true } },
      deadlines: { where: { completedAt: null } },
    },
    orderBy: { closingDate: "asc" },
  });

  const briefTransactions: TCBriefTransaction[] = [];
  let totalDeadlinesUpcoming = 0;
  let totalDeadlinesOverdue = 0;
  let totalMissingDocs = 0;

  for (const tx of transactions) {
    // Calculate deadlines using Louisiana rules engine
    let upcomingDeadlines: CalculatedDeadline[] = [];
    let overdueDeadlines: CalculatedDeadline[] = [];

    if (tx.contractDate) {
      const txDates: TransactionDates = {
        contractDate: tx.contractDate,
        closingDate: tx.closingDate ?? undefined,
        inspectionDays: 14,
        appraisalDays: 14,
        financingDays: 25,
      };

      const allDeadlines = calculateDeadlines(txDates);
      const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      upcomingDeadlines = allDeadlines.filter(
        (d) => d.dueDate >= now && d.dueDate <= sevenDaysOut
      );
      overdueDeadlines = allDeadlines.filter((d) => d.dueDate < now);

      // Filter out deadlines that are already completed in DB
      const completedNames = new Set(
        tx.deadlines.filter((d) => d.completedAt).map((d) => d.name)
      );
      upcomingDeadlines = upcomingDeadlines.filter((d) => !completedNames.has(d.name));
      overdueDeadlines = overdueDeadlines.filter((d) => !completedNames.has(d.name));
    }

    // Check document completeness
    const docTypes = new Set(tx.documents.map((d) => d.type));
    const missingDocs = REQUIRED_DOCS.filter((req) => !docTypes.has(req));

    totalDeadlinesUpcoming += upcomingDeadlines.length;
    totalDeadlinesOverdue += overdueDeadlines.length;
    totalMissingDocs += missingDocs.length;

    briefTransactions.push({
      id: tx.id,
      propertyAddress: tx.propertyAddress,
      status: tx.status,
      buyerName: tx.buyerName,
      sellerName: tx.sellerName,
      closingDate: tx.closingDate,
      documentCount: tx.documents.length,
      missingDocs,
      upcomingDeadlines,
      overdueDeadlines,
    });
  }

  // Generate AI summary
  const summary = await synthesizeBrief(agentName, briefTransactions, now);

  // Build action items from data (deterministic, no AI needed)
  const actionItems = buildActionItems(briefTransactions);

  return {
    userId,
    agentName,
    briefDate: now,
    transactions: briefTransactions,
    totalActive: transactions.length,
    totalDeadlinesUpcoming,
    totalDeadlinesOverdue,
    totalMissingDocs,
    summary,
    actionItems,
  };
}

// ─── Action Items Builder ──────────────────────────────────────

function buildActionItems(
  transactions: TCBriefTransaction[]
): TCMorningBrief["actionItems"] {
  const items: TCMorningBrief["actionItems"] = [];

  for (const tx of transactions) {
    // Overdue deadlines = high priority
    for (const d of tx.overdueDeadlines) {
      items.push({
        action: `OVERDUE: ${d.name} — follow up immediately`,
        priority: "high",
        transactionId: tx.id,
        propertyAddress: tx.propertyAddress,
      });
    }

    // Upcoming high-priority deadlines
    for (const d of tx.upcomingDeadlines) {
      if (d.priority === "high") {
        const daysLeft = Math.ceil(
          (d.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        items.push({
          action: `${d.name} due in ${daysLeft} day${daysLeft !== 1 ? "s" : ""} — verify status`,
          priority: daysLeft <= 1 ? "high" : "medium",
          transactionId: tx.id,
          propertyAddress: tx.propertyAddress,
        });
      }
    }

    // Missing required documents
    if (tx.missingDocs.length > 0) {
      const docNames = tx.missingDocs.map((d) => d.replace(/_/g, " ")).join(", ");
      items.push({
        action: `Missing docs: ${docNames} — request from parties`,
        priority: tx.closingDate && tx.closingDate.getTime() - Date.now() < 14 * 24 * 60 * 60 * 1000
          ? "high"
          : "medium",
        transactionId: tx.id,
        propertyAddress: tx.propertyAddress,
      });
    }
  }

  // Sort: high > medium > low
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  items.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return items;
}

// ─── AI Summary Synthesis ──────────────────────────────────────

async function synthesizeBrief(
  agentName: string,
  transactions: TCBriefTransaction[],
  date: Date
): Promise<string> {
  if (transactions.length === 0) {
    return `Good morning, ${agentName}. No active transactions today. Enjoy the quiet.`;
  }

  const dateStr = date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const txSummaries = transactions.map((tx) => {
    const parts = [`${tx.propertyAddress} (${tx.status})`];
    if (tx.overdueDeadlines.length > 0) parts.push(`${tx.overdueDeadlines.length} OVERDUE`);
    if (tx.upcomingDeadlines.length > 0) parts.push(`${tx.upcomingDeadlines.length} upcoming`);
    if (tx.missingDocs.length > 0) parts.push(`missing: ${tx.missingDocs.join(", ")}`);
    if (tx.closingDate) {
      const daysToClose = Math.ceil(
        (tx.closingDate.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysToClose <= 14) parts.push(`closing in ${daysToClose} days`);
    }
    return parts.join(" | ");
  });

  try {
    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 600,
      system: `You are AIRE, a TC coordinator assistant for Louisiana real estate.
Write a concise morning brief (under 200 words). Use "Act of Sale" not "closing", "parish" not "county".
Be direct — this agent is busy. Lead with the most urgent items.
Do not include action items — those are generated separately.`,
      messages: [
        {
          role: "user",
          content: `TC Morning Brief for ${agentName}, ${dateStr}.

${transactions.length} active transaction${transactions.length > 1 ? "s" : ""}:
${txSummaries.join("\n")}

Summarize the day ahead.`,
        },
      ],
    });

    return response.content[0].type === "text" ? response.content[0].text : "";
  } catch (err) {
    console.error("[TC/Brief] AI synthesis failed:", err);
    // Fallback: deterministic summary
    const overdue = transactions.reduce((n, t) => n + t.overdueDeadlines.length, 0);
    const upcoming = transactions.reduce((n, t) => n + t.upcomingDeadlines.length, 0);
    return `Good morning, ${agentName}. ${dateStr}. ${transactions.length} active transactions. ${overdue} overdue deadlines. ${upcoming} upcoming this week. Check action items below.`;
  }
}
