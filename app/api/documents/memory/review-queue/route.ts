import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

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

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    const items = await prisma.documentMemory.findMany({
      where: {
        userId: user.id,
        status: { in: ["NEEDS_REVIEW", "UNKNOWN_TYPE"] },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        transaction: { select: { propertyAddress: true } },
      },
    });

    const total = await prisma.documentMemory.count({
      where: {
        userId: user.id,
        status: { in: ["NEEDS_REVIEW", "UNKNOWN_TYPE"] },
      },
    });

    return NextResponse.json({ items, total, limit, offset });
  } catch (error) {
    console.error("Review queue error:", error);
    return NextResponse.json({ error: "Failed to fetch review queue" }, { status: 500 });
  }
}
