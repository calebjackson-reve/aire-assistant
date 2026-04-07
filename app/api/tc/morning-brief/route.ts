import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { generateTCMorningBrief } from "@/lib/tc/morning-brief";

/**
 * TC Morning Brief API
 *
 * GET  — Generate or return today's TC morning brief for the authenticated user.
 * POST — Force-regenerate today's brief (even if one exists).
 */

export async function GET(req: NextRequest) {
  try {
    const { requireFeature } = await import("@/lib/auth/subscription-gate");
    const gate = await requireFeature("morning_brief");
    if (gate) return gate;

    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true, tier: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Suppress unused variable warning — req is required by Next.js route signature
    void req;

    const brief = await generateTCMorningBrief(user.id);

    return NextResponse.json({
      brief: {
        agentName: brief.agentName,
        briefDate: brief.briefDate.toISOString(),
        summary: brief.summary,
        actionItems: brief.actionItems,
        stats: {
          totalActive: brief.totalActive,
          totalDeadlinesUpcoming: brief.totalDeadlinesUpcoming,
          totalDeadlinesOverdue: brief.totalDeadlinesOverdue,
          totalMissingDocs: brief.totalMissingDocs,
        },
        transactions: brief.transactions.map((tx) => ({
          id: tx.id,
          propertyAddress: tx.propertyAddress,
          status: tx.status,
          buyerName: tx.buyerName,
          sellerName: tx.sellerName,
          closingDate: tx.closingDate?.toISOString() ?? null,
          documentCount: tx.documentCount,
          missingDocs: tx.missingDocs,
          upcomingDeadlines: tx.upcomingDeadlines.map((d) => ({
            name: d.name,
            dueDate: d.dueDate.toISOString(),
            priority: d.priority,
            category: d.category,
          })),
          overdueDeadlines: tx.overdueDeadlines.map((d) => ({
            name: d.name,
            dueDate: d.dueDate.toISOString(),
            priority: d.priority,
            category: d.category,
          })),
        })),
      },
    });
  } catch (error) {
    console.error("TC Morning Brief error:", error);
    return NextResponse.json(
      { error: "Failed to generate TC morning brief" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  // POST = force regenerate (same logic, just always generates fresh)
  return GET(req);
}
