import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

// Louisiana transaction document checklist — what's required for each deal
const REQUIRED_DOCUMENTS = [
  {
    type: "purchase_agreement",
    name: "Residential Agreement to Buy or Sell",
    category: "mandatory",
    required: true,
  },
  {
    type: "property_disclosure",
    name: "Property Disclosure Document",
    category: "mandatory",
    required: true,
  },
  {
    type: "agency_disclosure",
    name: "Agency Disclosure Form",
    category: "mandatory",
    required: true,
  },
  {
    type: "lead_paint",
    name: "Lead-Based Paint Disclosure",
    category: "federal",
    required: true, // required for pre-1978 homes
    conditionalNote: "Required for homes built before 1978",
  },
  {
    type: "inspection_response",
    name: "Inspection Response Addendum",
    category: "addendum",
    required: false,
    conditionalNote: "Required if inspection repairs are requested",
  },
  {
    type: "deposit_addendum",
    name: "Deposit Addendum",
    category: "addendum",
    required: false,
  },
  {
    type: "condominium_addendum",
    name: "Condominium Addendum",
    category: "addendum",
    required: false,
    conditionalNote: "Required for condominium properties",
  },
];

export async function GET(
  _req: NextRequest,
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

    const transaction = await prisma.transaction.findFirst({
      where: { id: transactionId, userId: user.id },
      include: { documents: true },
    });

    if (!transaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    // Build checklist: match required docs against uploaded docs
    const checklist = REQUIRED_DOCUMENTS.map((req) => {
      const uploaded = transaction.documents.filter((d) => d.type === req.type);
      const latest = uploaded.length > 0 ? uploaded[uploaded.length - 1] : null;

      return {
        ...req,
        status: latest
          ? (latest.checklistStatus ?? "uploaded")
          : "missing",
        documentId: latest?.id ?? null,
        uploadedAt: latest?.createdAt ?? null,
        extractionConfidence: latest?.classification
          ? (latest.classification as Record<string, unknown>).confidence
          : null,
      };
    });

    const completedCount = checklist.filter(
      (c) => c.status !== "missing"
    ).length;
    const requiredCount = checklist.filter((c) => c.required).length;
    const requiredCompletedCount = checklist.filter(
      (c) => c.required && c.status !== "missing"
    ).length;

    return NextResponse.json({
      transactionId,
      propertyAddress: transaction.propertyAddress,
      checklist,
      summary: {
        total: checklist.length,
        completed: completedCount,
        requiredTotal: requiredCount,
        requiredCompleted: requiredCompletedCount,
        readyToClose: requiredCompletedCount === requiredCount,
      },
    });
  } catch (error) {
    console.error("Checklist error:", error);
    return NextResponse.json(
      { error: "Failed to generate checklist" },
      { status: 500 }
    );
  }
}
