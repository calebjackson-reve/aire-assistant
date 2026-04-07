import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

/**
 * POST /api/contacts — Create a contact (vendor, lead, client, etc.)
 * GET /api/contacts — List contacts for the authenticated user
 */

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const body = await req.json();
    const { firstName, lastName, email, phone, category, notes } = body;

    if (!firstName) {
      return NextResponse.json({ error: "firstName is required" }, { status: 400 });
    }

    const contact = await prisma.contact.create({
      data: {
        agentId: user.id,
        firstName,
        lastName: lastName || "",
        email: email || null,
        phone: phone || null,
        type: category === "vendor" ? "VENDOR" : "LEAD",
        notes: notes || null,
      },
    });

    return NextResponse.json({ contact });
  } catch (error) {
    console.error("Contact creation error:", error);
    return NextResponse.json({ error: "Failed to create contact" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const contacts = await prisma.contact.findMany({
      where: { agentId: user.id },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return NextResponse.json({ contacts });
  } catch (error) {
    console.error("Contacts list error:", error);
    return NextResponse.json({ error: "Failed to fetch contacts" }, { status: 500 });
  }
}
