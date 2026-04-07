import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

/**
 * POST /api/onboarding/market-area — Save market area preferences.
 * Stores parishes and zip codes as user metadata (JSON in notes field on a special Contact record).
 * This avoids schema changes — we use a Contact with type "MARKET_AREA" as config storage.
 */

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const { parishes, zipCodes } = await req.json();

    // Store as a special "config" contact record
    await prisma.contact.upsert({
      where: {
        // Use a deterministic approach: find by agentId + type combo
        id: await getMarketAreaContactId(user.id),
      },
      update: {
        notes: JSON.stringify({ parishes, zipCodes }),
        parish: (parishes as string[])?.join(", ") || null,
      },
      create: {
        agentId: user.id,
        firstName: "Market",
        lastName: "Area Config",
        type: "REFERRAL_SOURCE", // using existing type since we can't add custom
        notes: JSON.stringify({ parishes, zipCodes }),
        parish: (parishes as string[])?.join(", ") || null,
        tags: ["system_config", "market_area"],
      },
    });

    return NextResponse.json({ success: true, parishes, zipCodes });
  } catch (error) {
    console.error("Market area save error:", error);
    return NextResponse.json({ error: "Failed to save market area" }, { status: 500 });
  }
}

async function getMarketAreaContactId(userId: string): Promise<string> {
  const existing = await prisma.contact.findFirst({
    where: {
      agentId: userId,
      tags: { has: "market_area" },
    },
    select: { id: true },
  });
  return existing?.id || "nonexistent_id_to_force_create";
}

export async function GET() {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const config = await prisma.contact.findFirst({
      where: {
        agentId: user.id,
        tags: { has: "market_area" },
      },
      select: { notes: true },
    });

    if (!config?.notes) {
      return NextResponse.json({ parishes: [], zipCodes: [] });
    }

    try {
      const data = JSON.parse(config.notes);
      return NextResponse.json(data);
    } catch {
      return NextResponse.json({ parishes: [], zipCodes: [] });
    }
  } catch (error) {
    console.error("Market area fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch market area" }, { status: 500 });
  }
}
