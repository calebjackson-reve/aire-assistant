import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ""
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || ""
const GOOGLE_REDIRECT_URI = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/email/callback`
  : "http://localhost:3000/api/email/callback"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const state = searchParams.get("state") // clerkId
  const error = searchParams.get("error")

  if (error) {
    console.error("[Email OAuth] Google returned error:", error)
    return NextResponse.redirect(new URL("/aire/email?error=denied", request.url))
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL("/aire/email?error=missing_code", request.url))
  }

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    console.error("[Email OAuth] Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET")
    return NextResponse.redirect(new URL("/aire/email?error=config", request.url))
  }

  try {
    // Exchange code for tokens
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
      const err = await tokenRes.text()
      console.error("[Email OAuth] Token exchange failed:", err)
      return NextResponse.redirect(new URL("/aire/email?error=token_exchange", request.url))
    }

    const tokens = await tokenRes.json() as {
      access_token: string
      refresh_token?: string
      expires_in: number
      token_type: string
    }

    // Get user email from Google
    const profileRes = await fetch("https://www.googleapis.com/gmail/v1/users/me/profile", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })

    const profile = profileRes.ok
      ? (await profileRes.json() as { emailAddress: string })
      : null

    // Store tokens in user record (using JSON field or separate table)
    // For now, store in a lightweight way using user metadata
    const user = await prisma.user.findUnique({ where: { clerkId: state } })
    if (!user) {
      return NextResponse.redirect(new URL("/aire/email?error=user_not_found", request.url))
    }

    // Store tokens in EmailAccount table
    const emailAddress = profile?.emailAddress || "unknown";
    await prisma.emailAccount.upsert({
      where: {
        userId_email: { userId: user.id, email: emailAddress },
      },
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
    });

    console.log(`[Email OAuth] Gmail connected for user ${state}: ${emailAddress}`)

    const redirectUrl = new URL("/aire/email", request.url)
    redirectUrl.searchParams.set("connected", "true")
    if (profile?.emailAddress) {
      redirectUrl.searchParams.set("email", profile.emailAddress)
    }
    return NextResponse.redirect(redirectUrl)
  } catch (err) {
    console.error("[Email OAuth] Callback error:", err)
    return NextResponse.redirect(new URL("/aire/email?error=server", request.url))
  }
}
