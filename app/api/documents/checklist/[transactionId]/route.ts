import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { generateChecklist, evaluateChecklist } from "@/lib/extraction/checklist-generator";

/**
 * GET /api/documents/checklist/[transactionId]
 * Returns the document checklist status for a transaction.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ transactionId: string }> }
) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { transactionId } = await params;
    void req;

    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      select: {
        id: true,
        propertyAddress: true,
        propertyType: true,
        status: true,
        user: { select: { clerkId: true } },
        documents: {
          select: {
            id: true,
            type: true,
            name: true,
            checklistStatus: true,
            classification: true,
          },
        },
      },
    });

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    if (transaction.user.clerkId !== clerkId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const checklist = generateChecklist({
      propertyType: transaction.propertyType ?? undefined,
      transactionStatus: transaction.status,
    });

    const status = evaluateChecklist(checklist, transaction.documents);

    const summary = {
      total: status.length,
      complete: status.filter((s) => s.status === "verified").length,
      extracted: status.filter((s) => s.status === "extracted").length,
      uploaded: status.filter((s) => s.status === "uploaded").length,
      missing: status.filter((s) => s.status === "missing").length,
      completionPercent: Math.round(
        (status.filter((s) => s.status !== "missing").length / status.length) * 100
      ),
    };

    return NextResponse.json({
      transactionId,
      propertyAddress: transaction.propertyAddress,
      summary,
      checklist: status.map((s) => ({
        type: s.item.type,
        label: s.item.label,
        category: s.item.category,
        required: s.item.required,
        lrecFormNumber: s.item.lrecFormNumber,
        status: s.status,
        documentId: s.documentId ?? null,
        confidence: s.confidence ?? null,
      })),
    });
  } catch (error) {
    console.error("Checklist error:", error);
    return NextResponse.json({ error: "Failed to generate checklist" }, { status: 500 });
  }
}
