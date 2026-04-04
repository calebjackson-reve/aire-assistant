import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

/**
 * Refile a document — move it to a different transaction or update its type/category.
 * Used when a document was auto-classified incorrectly or uploaded to the wrong transaction.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: transactionId } = await params;

    const user = await prisma.user.findUnique({ where: { clerkId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify the transaction belongs to this user
    const transaction = await prisma.transaction.findFirst({
      where: { id: transactionId, userId: user.id },
    });
    if (!transaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { documentId, newType, newCategory, newTransactionId } = body;

    if (!documentId) {
      return NextResponse.json(
        { error: "documentId is required" },
        { status: 400 }
      );
    }

    // Verify the document exists and belongs to this transaction
    const document = await prisma.document.findFirst({
      where: { id: documentId, transactionId },
    });
    if (!document) {
      return NextResponse.json(
        { error: "Document not found in this transaction" },
        { status: 404 }
      );
    }

    // If moving to a different transaction, verify ownership
    if (newTransactionId && newTransactionId !== transactionId) {
      const targetTransaction = await prisma.transaction.findFirst({
        where: { id: newTransactionId, userId: user.id },
      });
      if (!targetTransaction) {
        return NextResponse.json(
          { error: "Target transaction not found or unauthorized" },
          { status: 404 }
        );
      }
    }

    // Update the document
    const updated = await prisma.document.update({
      where: { id: documentId },
      data: {
        ...(newType && { type: newType }),
        ...(newCategory && { category: newCategory }),
        ...(newTransactionId && { transactionId: newTransactionId }),
        checklistStatus: "uploaded", // Reset to uploaded since classification changed
      },
    });

    return NextResponse.json({
      document: updated,
      refiled: {
        typeChanged: newType ? `${document.type} → ${newType}` : null,
        categoryChanged: newCategory
          ? `${document.category} → ${newCategory}`
          : null,
        transactionChanged: newTransactionId
          ? `${transactionId} → ${newTransactionId}`
          : null,
      },
    });
  } catch (error) {
    console.error("Refile error:", error);
    return NextResponse.json(
      { error: "Failed to refile document" },
      { status: 500 }
    );
  }
}
