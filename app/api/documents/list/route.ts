import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/**
 * GET /api/documents/list — List all documents for the authenticated user.
 * Query params: search, category, status, transactionId, type
 * Also returns the user's transaction list for the filter dropdown.
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
    const search = url.searchParams.get("search") || "";
    const category = url.searchParams.get("category") || "";
    const status = url.searchParams.get("status") || "";
    const transactionId = url.searchParams.get("transactionId") || "";
    const type = url.searchParams.get("type") || "";

    // Build Prisma where clause
    const conditions: Prisma.DocumentWhereInput[] = [];

    // Scope to user's transactions
    if (transactionId) {
      conditions.push({ transactionId });
    } else {
      // Include docs from user's transactions AND unfiled docs
      // (unfiled docs have no transactionId, so we need OR)
      conditions.push({
        OR: [
          { transaction: { userId: user.id } },
          { transactionId: null },
        ],
      });
    }

    if (search) {
      conditions.push({ name: { contains: search, mode: "insensitive" } });
    }
    if (category) {
      conditions.push({ category });
    }
    if (status) {
      conditions.push({ checklistStatus: status });
    }
    if (type) {
      conditions.push({ type });
    }

    const where: Prisma.DocumentWhereInput =
      conditions.length > 1 ? { AND: conditions } : conditions[0] || {};

    const [documents, transactions] = await Promise.all([
      prisma.document.findMany({
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
          fileUrl: true,
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
      }),
      // Return user's transactions for the filter dropdown
      prisma.transaction.findMany({
        where: { userId: user.id },
        select: { id: true, propertyAddress: true, status: true },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    return NextResponse.json({ documents, transactions });
  } catch (error) {
    console.error("Documents list error:", error);
    return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 });
  }
}
