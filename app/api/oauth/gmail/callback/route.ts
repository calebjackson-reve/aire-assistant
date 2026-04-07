import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { scanGmailForContacts } from "@/lib/onboarding/gmail-contact-scan"

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ""
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || ""
const GOOGLE_REDIRECT_URI = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/gmail/callback`
  : "http://localhost:3000/api/oauth/gmail/callback"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const state = searchParams.get("state") || ""
  const error = searchParams.get("error")

  const back = (params: Record<string, string>) => {
    const url = new URL("/onboarding", request.url)
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
    return NextResponse.redirect(url)
  }

  if (error) return back({ gmail: "denied" })
  if (!code || !state.startsWith("onboarding:")) return back({ gmail: "missing_code" })
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return back({ gmail: "config" })

  const clerkId = state.slice("onboarding:".length)

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    })

    if (!tokenRes.ok) {
      console.error("[Onboarding Gmail] token exchange failed:", await tokenRes.text())
      return back({ gmail: "token_exchange" })
    }

    const tokens = (await tokenRes.json()) as {
      access_token: string
      refresh_token?: string
      expires_in: number
    }

    const profileRes = await fetch(
      "https://www.googleapis.com/gmail/v1/users/me/profile",
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    )
    const profile = profileRes.ok
      ? ((await profileRes.json()) as { emailAddress: string })
      : null

    const user = await prisma.user.findUnique({ where: { clerkId } })
    if (!user) return back({ gmail: "user_not_found" })

    const emailAddress = profile?.emailAddress || "unknown@gmail.com"
    await prisma.emailAccount.upsert({
      where: { userId_email: { userId: user.id, email: emailAddress } },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || undefined,
        tokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
        isActive: true,
      },
      create: {
        userId: user.id,
        email: emailAddress,
        provider: "gmail",
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || undefined,
        tokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
      },
    })

    // Fire-and-forget 90-day contact scan
    scanGmailForContacts({
      userId: user.id,
      accessToken: tokens.access_token,
      selfEmail: emailAddress,
    }).catch(err => console.error("[Onboarding Gmail] scan failed:", err))

    return back({ gmail: "connected", email: emailAddress })
  } catch (err) {
    console.error("[Onboarding Gmail] callback error:", err)
    return back({ gmail: "server_error" })
  }
}
