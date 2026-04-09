# Vercel Environment Variables — Complete List

Go to **vercel.com → Your Project → Settings → Environment Variables**
Add ALL of these for the **Production** environment.

## Required (App Won't Work Without These)

| Variable | Value | Source |
|----------|-------|--------|
| `DATABASE_URL` | `postgresql://...` | Neon dashboard |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | console.anthropic.com |
| `CLERK_SECRET_KEY` | `sk_live_...` | dashboard.clerk.com |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_live_...` | dashboard.clerk.com |
| `STRIPE_SECRET_KEY` | `sk_live_...` | dashboard.stripe.com |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Stripe webhooks page |
| `RESEND_API_KEY` | `re_...` | resend.com |
| `BLOB_READ_WRITE_TOKEN` | `vercel_blob_...` | Vercel Blob storage |
| `NEXT_PUBLIC_APP_URL` | `https://aireintel.org` | Your domain |
| `CRON_SECRET` | Any random string (e.g. `aire-cron-2026`) | You create this |

## AirSign

| Variable | Value | Source |
|----------|-------|--------|
| `AIRSIGN_INTERNAL_SECRET` | Random string | You create this |
| `AIRE_WEBHOOK_SECRET` | Random string | You create this |

## Twilio (SMS + Calls)

| Variable | Value | Source |
|----------|-------|--------|
| `TWILIO_ACCOUNT_SID` | `AC...` | twilio.com/console |
| `TWILIO_AUTH_TOKEN` | Auth token | twilio.com/console |
| `TWILIO_PHONE_NUMBER` | `+1225...` | Twilio phone number |

## Google (Gmail + Calendar)

| Variable | Value | Source |
|----------|-------|--------|
| `GOOGLE_CLIENT_ID` | `...apps.googleusercontent.com` | console.cloud.google.com |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-...` | console.cloud.google.com |

## Meta Business Suite (Facebook + Instagram)

| Variable | Value | Source |
|----------|-------|--------|
| `META_APP_ID` | `1318936140081144` | developers.facebook.com |
| `META_APP_SECRET` | `2dce36759ff63aadffbce3273fb18f4b` | developers.facebook.com |
| `META_ACCESS_TOKEN` | `EAATo3k16D78BRAw...` | Graph API Explorer |
| `META_PAGE_ID` | `107195095165191` | Graph API Explorer |
| `META_IG_USER_ID` | `17841400823470448` | Graph API Explorer |

## ClickUp (Transcript-to-Tasks)

| Variable | Value | Source |
|----------|-------|--------|
| `CLICKUP_API_TOKEN` | `pk_204168753_...` | ClickUp Settings → Apps |
| `CLICKUP_LIST_ID` | `2kyd8mk1-434` | ClickUp list URL |
| `CLICKUP_TEAM_ID` | `90141119073` | ClickUp URL |
| `CLICKUP_SPACE_ID` | `90145012977` | ClickUp URL |

## Stripe Price IDs

| Variable | Value | Source |
|----------|-------|--------|
| `STRIPE_PRO_PRICE_ID` | `price_...` | Stripe Products page |
| `STRIPE_INVESTOR_PRICE_ID` | `price_...` | Stripe Products page |

## Optional (Features Degrade Gracefully)

| Variable | Needed For | Source |
|----------|-----------|--------|
| `RPR_API_KEY` | RPR valuations in CMA | narrpr.com (restricted) |
| `PARAGON_RETS_URL` | MLS auto-upload | GBRAR RETS agreement |
| `PARAGON_RETS_USERNAME` | MLS auto-upload | GBRAR RETS agreement |
| `PARAGON_RETS_PASSWORD` | MLS auto-upload | GBRAR RETS agreement |
| `PARAGON_AGENT_ID` | MLS auto-upload | Your MLS agent ID |
| `OPENAI_API_KEY` | Whisper transcription | platform.openai.com |
| `CLERK_WEBHOOK_SECRET` | Clerk webhooks | dashboard.clerk.com |

## Total: 30 env vars (22 required + 8 optional)
