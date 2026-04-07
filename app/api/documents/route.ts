import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

/**
 * GET /api/documents — List all documents for the authenticated user.
 * Query params: search, category, status, transactionId
 */
export async function GET(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { clerkId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const url = new URL(req.url);
    const search = url.searchParams.get("search");
    const category = url.searchParams.get("category");
    const status = url.searchParams.get("status");
    const transactionId = url.searchParams.get("transactionId");

    // Build where clause — documents belong to user's transactions
    const where: Record<string, unknown> = {
      transaction: { userId: user.id },
    };

    // Also include unfiled documents (transactionId is null) — we can't filter by userId directly
    // so we use OR to include both
    const orConditions: Record<string, unknown>[] = [
      { transaction: { userId: user.id } },
    ];

    if (search) {
      for (const cond of orConditions) {
        Object.assign(cond, { name: { contains: search, mode: "insensitive" } });
      }
    }
    if (category) {
      for (const cond of orConditions) {
        Object.assign(cond, { category });
      }
    }
    if (status) {
      for (const cond of orConditions) {
        Object.assign(cond, { checklistStatus: status });
      }
    }
    if (transactionId) {
      // Override: just filter by specific transaction
      Object.assign(where, { transactionId });
    } else {
      Object.assign(where, { OR: orConditions });
    }

    const documents = await prisma.document.findMany({
      where,
      select: {
        id: true,
        name: true,
        type: true,
        category: true,
        checklistStatus: true,
        fileSize: true,
        pageCount: true,
        classification: true,
        createdAt: true,
        transaction: {
          select: {
            id: true,
            propertyAddress: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return NextResponse.json({ documents });
  } catch (error) {
    console.error("Documents list error:", error);
    return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 });
  }
}
