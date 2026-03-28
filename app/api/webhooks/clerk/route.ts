import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { WebhookEvent } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    console.error("CLERK_WEBHOOK_SECRET not set");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  // Get headers
  const svix_id = req.headers.get("svix-id");
  const svix_timestamp = req.headers.get("svix-timestamp");
  const svix_signature = req.headers.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json(
      { error: "Missing svix headers" },
      { status: 400 }
    );
  }

  // Get raw body
  const body = await req.text();

  // Verify webhook signature
  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("Webhook verification failed:", err);
    return NextResponse.json(
      { error: "Verification failed" },
      { status: 400 }
    );
  }

  // Handle events
  const eventType = evt.type;

  if (eventType === "user.created") {
    const { id, email_addresses, first_name, last_name } = evt.data;
    const primaryEmail = email_addresses?.[0]?.email_address;

    if (!primaryEmail) {
      return NextResponse.json(
        { error: "No email found" },
        { status: 400 }
      );
    }

    // Create User record in Neon DB with tier=FREE
    await prisma.user.create({
      data: {
        clerkId: id,
        email: primaryEmail,
        firstName: first_name || null,
        lastName: last_name || null,
        tier: "FREE",
      },
    });

    console.log(`✅ User created in DB: ${primaryEmail} (tier=FREE)`);
  }

  if (eventType === "user.updated") {
    const { id, email_addresses, first_name, last_name } = evt.data;
    const primaryEmail = email_addresses?.[0]?.email_address;

    await prisma.user.update({
      where: { clerkId: id },
      data: {
        email: primaryEmail || undefined,
        firstName: first_name || undefined,
        lastName: last_name || undefined,
      },
    });

    console.log(`✅ User updated in DB: ${id}`);
  }

  if (eventType === "user.deleted") {
    const { id } = evt.data;

    if (id) {
      await prisma.user.delete({
        where: { clerkId: id },
      }).catch(() => {
        console.log(`User ${id} not found in DB, skipping delete`);
      });

      console.log(`✅ User deleted from DB: ${id}`);
    }
  }

  return NextResponse.json({ received: true });
}
