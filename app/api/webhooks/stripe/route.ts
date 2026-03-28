import { NextRequest, NextResponse } from "next/server";
import { constructWebhookEvent, priceIdToTier } from "@/lib/stripe";
import prisma from "@/lib/prisma";
import Stripe from "stripe";

// CRITICAL: Stripe webhooks require raw body — disable Next.js body parsing
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  // Read raw body as text for signature verification
  const rawBody = await req.text();

  let event: Stripe.Event;

  try {
    event = constructWebhookEvent(rawBody, signature);
  } catch (err) {
    console.error("Stripe webhook verification failed:", err);
    return NextResponse.json(
      { error: "Webhook verification failed" },
      { status: 400 }
    );
  }

  // Handle subscription events
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string;

      if (userId && customerId && subscriptionId) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            stripeCustomerId: customerId,
            subscriptionId: subscriptionId,
            subscriptionStatus: "active",
          },
        });
        console.log(`✅ Checkout completed for user: ${userId}`);
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      const priceId = subscription.items.data[0]?.price.id;
      const newTier = priceIdToTier(priceId);

      const user = await prisma.user.findUnique({
        where: { stripeCustomerId: customerId },
      });

      if (user) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            tier: newTier,
            subscriptionStatus: subscription.status,
          },
        });
        console.log(`✅ Subscription updated: ${user.email} → ${newTier}`);
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      const user = await prisma.user.findUnique({
        where: { stripeCustomerId: customerId },
      });

      if (user) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            tier: "FREE",
            subscriptionStatus: "canceled",
            subscriptionId: null,
          },
        });
        console.log(`✅ Subscription canceled: ${user.email} → FREE`);
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;

      const user = await prisma.user.findUnique({
        where: { stripeCustomerId: customerId },
      });

      if (user) {
        await prisma.user.update({
          where: { id: user.id },
          data: { subscriptionStatus: "past_due" },
        });
        console.log(`⚠️ Payment failed for: ${user.email}`);
      }
      break;
    }

    default:
      console.log(`Unhandled Stripe event: ${event.type}`);
  }

  return NextResponse.json({ received: true });
}
