#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# AIRE Intelligence — Vercel Environment Variable Setup
#
# Run this to add ALL required env vars to your Vercel project.
# Prerequisites: Install Vercel CLI and link your project first.
#
#   npm i -g vercel
#   vercel link
#   bash scripts/vercel-env-setup.sh
#
# ═══════════════════════════════════════════════════════════════════

set -e

echo "═══════════════════════════════════════════════════════"
echo "AIRE Intelligence — Vercel Environment Variable Setup"
echo "═══════════════════════════════════════════════════════"
echo ""

# ─── Core Database ─────────────────────────────────────────────
echo "Adding core database..."
echo "$DATABASE_URL" | vercel env add DATABASE_URL production --force 2>/dev/null || echo "  DATABASE_URL: already set or missing from shell"

# ─── Authentication (Clerk) ────────────────────────────────────
echo "Adding Clerk auth..."
echo "$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" | vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production --force 2>/dev/null || true
echo "$CLERK_SECRET_KEY" | vercel env add CLERK_SECRET_KEY production --force 2>/dev/null || true
echo "$CLERK_WEBHOOK_SECRET" | vercel env add CLERK_WEBHOOK_SECRET production --force 2>/dev/null || true

# ─── AI / Anthropic ────────────────────────────────────────────
echo "Adding Anthropic..."
echo "$ANTHROPIC_API_KEY" | vercel env add ANTHROPIC_API_KEY production --force 2>/dev/null || true

# ─── Billing (Stripe) ─────────────────────────────────────────
echo "Adding Stripe..."
echo "$STRIPE_SECRET_KEY" | vercel env add STRIPE_SECRET_KEY production --force 2>/dev/null || true
echo "$STRIPE_WEBHOOK_SECRET" | vercel env add STRIPE_WEBHOOK_SECRET production --force 2>/dev/null || true
echo "$STRIPE_PRO_PRICE_ID" | vercel env add STRIPE_PRO_PRICE_ID production --force 2>/dev/null || true
echo "$STRIPE_INVESTOR_PRICE_ID" | vercel env add STRIPE_INVESTOR_PRICE_ID production --force 2>/dev/null || true

# ─── Email (Resend) ───────────────────────────────────────────
echo "Adding Resend..."
echo "$RESEND_API_KEY" | vercel env add RESEND_API_KEY production --force 2>/dev/null || true

# ─── File Storage (Vercel Blob) ───────────────────────────────
echo "Adding Vercel Blob..."
echo "$BLOB_READ_WRITE_TOKEN" | vercel env add BLOB_READ_WRITE_TOKEN production --force 2>/dev/null || true

# ─── SMS & Calls (Twilio) ────────────────────────────────────
echo "Adding Twilio..."
echo "$TWILIO_ACCOUNT_SID" | vercel env add TWILIO_ACCOUNT_SID production --force 2>/dev/null || true
echo "$TWILIO_AUTH_TOKEN" | vercel env add TWILIO_AUTH_TOKEN production --force 2>/dev/null || true
echo "$TWILIO_PHONE_NUMBER" | vercel env add TWILIO_PHONE_NUMBER production --force 2>/dev/null || true

# ─── Google OAuth (Gmail + Calendar) ─────────────────────────
echo "Adding Google OAuth..."
echo "$GOOGLE_CLIENT_ID" | vercel env add GOOGLE_CLIENT_ID production --force 2>/dev/null || true
echo "$GOOGLE_CLIENT_SECRET" | vercel env add GOOGLE_CLIENT_SECRET production --force 2>/dev/null || true

# ─── Meta Business Suite (Instagram + Facebook) ──────────────
echo "Adding Meta Business Suite..."
echo "$META_APP_ID" | vercel env add META_APP_ID production --force 2>/dev/null || true
echo "$META_APP_SECRET" | vercel env add META_APP_SECRET production --force 2>/dev/null || true
echo "$META_ACCESS_TOKEN" | vercel env add META_ACCESS_TOKEN production --force 2>/dev/null || true
echo "$META_PAGE_ID" | vercel env add META_PAGE_ID production --force 2>/dev/null || true
echo "$META_IG_USER_ID" | vercel env add META_IG_USER_ID production --force 2>/dev/null || true

# ─── ClickUp (Transcript-to-Tasks) ──────────────────────────
echo "Adding ClickUp..."
echo "$CLICKUP_API_TOKEN" | vercel env add CLICKUP_API_TOKEN production --force 2>/dev/null || true
echo "$CLICKUP_LIST_ID" | vercel env add CLICKUP_LIST_ID production --force 2>/dev/null || true
echo "$CLICKUP_TEAM_ID" | vercel env add CLICKUP_TEAM_ID production --force 2>/dev/null || true
echo "$CLICKUP_SPACE_ID" | vercel env add CLICKUP_SPACE_ID production --force 2>/dev/null || true

# ─── AirSign ─────────────────────────────────────────────────
echo "Adding AirSign..."
echo "$AIRSIGN_INTERNAL_SECRET" | vercel env add AIRSIGN_INTERNAL_SECRET production --force 2>/dev/null || true
echo "$AIRE_WEBHOOK_SECRET" | vercel env add AIRE_WEBHOOK_SECRET production --force 2>/dev/null || true

# ─── Cron Auth ───────────────────────────────────────────────
echo "Adding Cron..."
echo "$CRON_SECRET" | vercel env add CRON_SECRET production --force 2>/dev/null || true

# ─── App URL ─────────────────────────────────────────────────
echo "Adding app URL..."
echo "https://aireintel.org" | vercel env add NEXT_PUBLIC_APP_URL production --force 2>/dev/null || true

echo ""
echo "═══════════════════════════════════════════════════════"
echo "Done! Redeploy to pick up new env vars:"
echo "  vercel --prod"
echo "═══════════════════════════════════════════════════════"
