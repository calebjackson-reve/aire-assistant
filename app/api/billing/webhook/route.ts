import { NextRequest, NextResponse } from "next/server";
import { constructWebhookEvent, priceIdToTier } from "@/lib/stripe";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event;
  try {
    event = constructWebhookEvent(body, signature);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as any;
        const userId = session.metadata?.userId;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        if (!userId) {
          console.error("No userId in checkout session metadata");
          break;
        }

        // Retrieve subscription to get the price ID
        const stripe = (await import("@/lib/stripe")).getStripe();
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const priceId = subscription.items.data[0]?.price.id;
        const tier = priceId ? priceIdToTier(priceId) : "PRO";

        await prisma.user.update({
          where: { id: userId },
          data: {
            tier,
            stripeCustomerId: customerId,
            subscriptionId,
            subscriptionStatus: subscription.status,
          },
        });

        // Funnel event — converted (trialing counts as converted; real payment
        // lands as a subscription.updated status=active webhook below)
        await prisma.conversionEvent.create({
          data: {
            userId,
            event: "converted",
            tier,
            metadata: { subscriptionStatus: subscription.status },
          },
        }).catch(() => {});

        console.log(`[Billing] User ${userId} upgraded to ${tier}`);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as any;
        const customerId = subscription.customer as string;
        const priceId = subscription.items.data[0]?.price.id;
        const tier = priceId ? priceIdToTier(priceId) : "FREE";

        await prisma.user.updateMany({
          where: { stripeCustomerId: customerId },
          data: {
            tier,
            subscriptionStatus: subscription.status,
          },
        });

        console.log(`[Billing] Subscription updated for customer ${customerId} → ${tier} (${subscription.status})`);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as any;
        const customerId = subscription.customer as string;

        await prisma.user.updateMany({
          where: { stripeCustomerId: customerId },
          data: {
            tier: "FREE",
            subscriptionId: null,
            subscriptionStatus: "canceled",
          },
        });

        console.log(`[Billing] Subscription canceled for customer ${customerId} → FREE`);
        break;
      }

      default:
        // Unhandled event type — acknowledge it
        break;
    }
  } catch (err) {
    console.error(`[Billing] Error processing ${event.type}:`, err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
