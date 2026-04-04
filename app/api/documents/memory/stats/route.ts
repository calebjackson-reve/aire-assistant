import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

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

    const stats = await prisma.documentMemory.groupBy({
      by: ["status"],
      where: { userId: user.id },
      _count: true,
    });

    const totalProcessed = stats.reduce((sum, s) => sum + s._count, 0);
    const autoFiled = stats.find((s) => s.status === "AUTO_FILED")?._count || 0;
    const confirmed = stats.find((s) => s.status === "AGENT_CONFIRMED")?._count || 0;
    const corrected = stats.find((s) => s.status === "AGENT_CORRECTED")?._count || 0;
    const needsReview = stats.find((s) => s.status === "NEEDS_REVIEW")?._count || 0;
    const unknown = stats.find((s) => s.status === "UNKNOWN_TYPE")?._count || 0;

    const reviewedTotal = autoFiled + confirmed + corrected;
    const accuracy =
      reviewedTotal > 0
        ? ((autoFiled + confirmed) / reviewedTotal * 100).toFixed(1)
        : "N/A";

    const topCorrections = await prisma.documentMemory.groupBy({
      by: ["classifiedType", "correctedType"],
      where: {
        userId: user.id,
        status: "AGENT_CORRECTED",
        correctedType: { not: null },
      },
      _count: true,
      orderBy: { _count: { classifiedType: "desc" } },
      take: 10,
    });

    const avgConfidence = await prisma.documentMemory.aggregate({
      where: { userId: user.id },
      _avg: { classifiedConf: true },
    });

    return NextResponse.json({
      totalProcessed,
      autoFiled,
      confirmed,
      corrected,
      needsReview,
      unknown,
      accuracy: accuracy + "%",
      avgConfidence: (avgConfidence._avg.classifiedConf || 0).toFixed(2),
      topCorrections: topCorrections.map((c) => ({
        wasClassifiedAs: c.classifiedType,
        shouldHaveBeen: c.correctedType,
        count: c._count,
      })),
    });
  } catch (error) {
    console.error("Stats error:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
