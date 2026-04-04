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

    const corrections = await prisma.documentMemory.findMany({
      where: { userId: user.id, status: "AGENT_CORRECTED" },
      select: {
        classifiedType: true,
        correctedType: true,
        fileName: true,
        correctionNotes: true,
      },
      orderBy: { correctedAt: "desc" },
      take: 50,
    });

    const typeDistribution = await prisma.documentMemory.groupBy({
      by: ["classifiedType"],
      where: { userId: user.id },
      _count: true,
      orderBy: { _count: { classifiedType: "desc" } },
      take: 20,
    });

    let markdown = "# Document Memory — Learned Patterns\n\n";
    markdown += `Last exported: ${new Date().toISOString()}\n\n`;

    markdown += "## Document Type Distribution\n\n";
    for (const t of typeDistribution) {
      markdown += `- ${t.classifiedType}: ${t._count} documents\n`;
    }

    if (corrections.length > 0) {
      markdown += "\n## Known Corrections (Classification Mistakes)\n\n";
      markdown += "These documents were corrected by the agent:\n\n";
      for (const c of corrections) {
        markdown += `- "${c.fileName}": was **${c.classifiedType}**, corrected to **${c.correctedType}**`;
        if (c.correctionNotes) markdown += ` — "${c.correctionNotes}"`;
        markdown += "\n";
      }
    }

    return new Response(markdown, {
      headers: { "Content-Type": "text/markdown" },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Failed to export" }, { status: 500 });
  }
}
