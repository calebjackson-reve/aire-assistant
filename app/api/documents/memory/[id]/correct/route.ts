import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    const memory = await prisma.documentMemory.findUnique({
      where: { id },
    });
    if (!memory) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (body.confirmed) {
      const updated = await prisma.documentMemory.update({
        where: { id },
        data: {
          status: "AGENT_CONFIRMED",
          correctedBy: clerkId,
          correctedAt: new Date(),
          correctionNotes: body.notes || null,
        },
      });
      return NextResponse.json(updated);
    }

    if (body.correctedType) {
      const updated = await prisma.documentMemory.update({
        where: { id },
        data: {
          status: "AGENT_CORRECTED",
          correctedType: body.correctedType,
          correctedBy: clerkId,
          correctedAt: new Date(),
          correctionNotes: body.notes || null,
        },
      });
      return NextResponse.json(updated);
    }

    return NextResponse.json(
      { error: "Provide correctedType or confirmed: true" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Correction error:", error);
    return NextResponse.json({ error: "Failed to save correction" }, { status: 500 });
  }
}
