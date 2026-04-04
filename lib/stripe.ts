import Stripe from "stripe";

// Lazy-init Stripe — avoids crash when STRIPE_SECRET_KEY is missing at build time
let _stripe: Stripe | null = null;
export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-02-24.acacia" as Stripe.LatestApiVersion,
      typescript: true,
    });
  }
  return _stripe;
}

// Backwards compat — existing code imports `stripe` directly
export const stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    return (getStripe() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

// ============== Checkout Session ==============
export async function createCheckoutSession({
  userId,
  email,
  priceId,
  customerId,
}: {
  userId: string;
  email: string;
  priceId: string;
  customerId?: string;
}) {
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing?canceled=true`,
    customer: customerId || undefined,
    customer_email: customerId ? undefined : email,
    metadata: { userId },
    subscription_data: {
      metadata: { userId },
    },
  });

  return session;
}

// ============== Customer Portal ==============
export async function createCustomerPortalSession(customerId: string) {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing`,
  });

  return session;
}

// ============== Subscription Status ==============
export async function getSubscriptionStatus(subscriptionId: string) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId) as any;
  return {
    status: subscription.status,
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    priceId: subscription.items.data[0]?.price.id,
  };
}

// ============== Price → Tier Mapping ==============
export function priceIdToTier(priceId: string): "FREE" | "PRO" | "INVESTOR" {
  if (priceId === process.env.STRIPE_PRO_PRICE_ID) return "PRO";
  if (priceId === process.env.STRIPE_INVESTOR_PRICE_ID) return "INVESTOR";
  return "FREE";
}

// ============== Construct Webhook Event ==============
export function constructWebhookEvent(
  body: string | Buffer,
  signature: string
) {
  return stripe.webhooks.constructEvent(
    body,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!
  );
}
