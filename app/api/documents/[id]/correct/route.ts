import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

/**
 * POST /api/documents/[id]/correct — Save a field correction.
 * Updates the document's filledData and logs to document memory for learning.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { field, correctedValue } = await req.json();

    if (!field || correctedValue === undefined) {
      return NextResponse.json({ error: "field and correctedValue required" }, { status: 400 });
    }

    const doc = await prisma.document.findUnique({
      where: { id },
      select: { id: true, filledData: true, transactionId: true, transaction: { select: { userId: true } } },
    });

    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Update the field in filledData
    const currentData = (doc.filledData as Record<string, unknown>) || {};
    currentData[field] = correctedValue;

    await prisma.document.update({
      where: { id },
      data: {
        filledData: JSON.parse(JSON.stringify(currentData)),
        checklistStatus: "verified",
      },
    });

    // Log correction to document memory if applicable
    const user = await prisma.user.findUnique({ where: { clerkId } });
    if (user) {
      try {
        await prisma.documentMemory.updateMany({
          where: {
            userId: user.id,
            // Find memory entries that match this document
            fileName: { not: "" }, // just update the most recent one
          },
          data: {
            status: "AGENT_CORRECTED",
            correctedBy: user.id,
            correctedAt: new Date(),
            correctionNotes: `Field "${field}" corrected to "${correctedValue}"`,
          },
        });
      } catch {
        // Non-critical — memory logging is best-effort
      }
    }

    return NextResponse.json({ success: true, field, correctedValue });
  } catch (error) {
    console.error("Document correction error:", error);
    return NextResponse.json({ error: "Failed to save correction" }, { status: 500 });
  }
}
