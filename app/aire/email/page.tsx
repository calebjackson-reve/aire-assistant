import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import { EmailDashboard } from "./EmailDashboard"

export default async function EmailPage(props: {
  searchParams: Promise<{ connected?: string; email?: string; error?: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in?redirect_url=/aire/email")

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
  })
  if (!user) redirect("/sign-in")

  const searchParams = await props.searchParams
  const justConnected = searchParams.connected === "true"
  const connectedEmail = searchParams.email || null
  const error = searchParams.error || null

  const googleConfigured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <p className="text-cream-dark text-xs tracking-[0.15em] uppercase">Communications</p>
        <h1 className="font-[family-name:var(--font-cormorant)] italic text-cream text-3xl mt-1">
          Email Intelligence
        </h1>
        <p className="text-cream-dim text-sm mt-1">
          Inbox triage · Missed responses · AI draft replies
        </p>
      </div>

      {error && (
        <div className="card-earth !p-4 mb-6 border-status-red/30">
          <p className="text-status-red text-sm font-medium">Connection failed</p>
          <p className="text-cream-dim text-xs mt-1">
            {error === "denied" && "Gmail access was denied. Please try again and grant permissions."}
            {error === "config" && "Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET."}
            {error === "token_exchange" && "Failed to exchange authorization code. Try again."}
            {error === "missing_code" && "No authorization code received from Google."}
            {error === "server" && "Server error during OAuth. Check logs."}
            {error === "user_not_found" && "User account not found. Sign in again."}
          </p>
        </div>
      )}

      {justConnected && (
        <div className="card-sage !p-4 mb-6">
          <p className="text-cream text-sm font-medium">Gmail connected</p>
          {connectedEmail && (
            <p className="text-cream-dim text-xs mt-1">Connected as {connectedEmail}</p>
          )}
        </div>
      )}

      <EmailDashboard googleConfigured={googleConfigured} />
    </div>
  )
}
