import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Public routes — no auth required
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/tools(.*)",               // Public tools — lead magnets, no auth
  "/api/webhooks(.*)",
  "/api/cron(.*)",
  "/api/documents/extract",
  "/api/documents/classify",
  "/api/data/health(.*)",
  "/sign/(.*)",
  "/api/airsign/sign/(.*)",
  "/api/billing/webhook",
  "/billing",
  "/test(.*)",
  "/demo(.*)",
  "/ui-preview(.*)",           // Public mirror of /aire/ui-lab for mock review (hardcoded data, no PII) — remove before ui/remodel merges to main
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|txt|xml|mp4)).*)",
    "/(api|trpc)(.*)",
  ],
};
