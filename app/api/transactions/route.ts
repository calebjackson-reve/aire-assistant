import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { calculateDeadlines } from "@/lib/louisiana-rules-engine";

// GET: List all transactions for the authenticated user
export async function GET() {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { clerkId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const transactions = await prisma.transaction.findMany({
      where: { userId: user.id },
      include: { deadlines: true },
      orderBy: { createdAt: "desc" },
    });

    // Get upcoming deadlines (within 7 days)
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const upcomingDeadlines = await prisma.deadline.findMany({
      where: {
        userId: user.id,
        dueDate: { gte: now, lte: weekFromNow },
        completedAt: null,
      },
      orderBy: { dueDate: "asc" },
    });

    return NextResponse.json({ transactions, upcomingDeadlines });
  } catch (error) {
    console.error("Fetch transactions error:", error);
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}

// POST: Create a new transaction + auto-calculate Louisiana deadlines
export async function POST(req: NextRequest) {
  try {
    // Free tier: max 3 transactions
    const { requireFeature } = await import("@/lib/auth/subscription-gate");
    const gate = await requireFeature("transactions");
    if (gate) return gate;

    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { clerkId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json();

    const {
      propertyAddress,
      propertyCity = "Baton Rouge",
      propertyState = "LA",
      propertyZip,
      propertyType,
      mlsNumber,
      listPrice,
      offerPrice,
      acceptedPrice,
      buyerName,
      buyerEmail,
      buyerPhone,
      sellerName,
      sellerEmail,
      sellerPhone,
      lenderName,
      titleCompany,
      contractDate,
      closingDate,
      inspectionDays,
      appraisalDays,
      financingDays,
    } = body;

    if (!propertyAddress) {
      return NextResponse.json(
        { error: "Property address is required" },
        { status: 400 }
      );
    }

    // Create transaction
    const transaction = await prisma.transaction.create({
      data: {
        userId: user.id,
        propertyAddress,
        propertyCity,
        propertyState,
        propertyZip,
        propertyType,
        mlsNumber,
        listPrice: listPrice ? parseFloat(listPrice) : null,
        offerPrice: offerPrice ? parseFloat(offerPrice) : null,
        acceptedPrice: acceptedPrice ? parseFloat(acceptedPrice) : null,
        status: contractDate ? "ACTIVE" : "DRAFT",
        buyerName,
        buyerEmail,
        buyerPhone,
        sellerName,
        sellerEmail,
        sellerPhone,
        lenderName,
        titleCompany,
        contractDate: contractDate ? new Date(contractDate) : null,
        closingDate: closingDate ? new Date(closingDate) : null,
      },
    });

    // Auto-calculate Louisiana deadlines if contract date is provided
    if (contractDate) {
      const deadlines = calculateDeadlines({
        contractDate: new Date(contractDate),
        closingDate: closingDate ? new Date(closingDate) : undefined,
        inspectionDays,
        appraisalDays,
        financingDays,
      });

      // Bulk create deadline records
      await prisma.deadline.createMany({
        data: deadlines.map((dl) => ({
          userId: user.id,
          transactionId: transaction.id,
          name: dl.name,
          dueDate: dl.dueDate,
          notes: dl.description,
        })),
      });
    }

    // Fetch the complete transaction with deadlines
    const fullTransaction = await prisma.transaction.findUnique({
      where: { id: transaction.id },
      include: { deadlines: { orderBy: { dueDate: "asc" } } },
    });

    console.log(`✅ Transaction created: ${propertyAddress} with auto-calculated LA deadlines`);

    return NextResponse.json(fullTransaction, { status: 201 });
  } catch (error) {
    console.error("Create transaction error:", error);
    return NextResponse.json(
      { error: "Failed to create transaction" },
      { status: 500 }
    );
  }
}
