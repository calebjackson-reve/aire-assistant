import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

/**
 * PATCH /api/documents/bulk — Bulk actions on documents.
 * Body: { ids: string[], action: "verify" | "delete" }
 */
export async function PATCH(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { clerkId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { ids, action } = await req.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids array required" }, { status: 400 });
    }

    if (action === "verify") {
      const result = await prisma.document.updateMany({
        where: {
          id: { in: ids },
          transaction: { userId: user.id },
        },
        data: { checklistStatus: "verified" },
      });
      return NextResponse.json({ updated: result.count });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("Bulk document error:", error);
    return NextResponse.json({ error: "Failed to process bulk action" }, { status: 500 });
  }
}
