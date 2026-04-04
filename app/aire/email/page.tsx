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
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="font-[family-name:var(--font-newsreader)] italic text-cream text-3xl">
          Email Intelligence
        </h1>
        <p className="text-cream-dim text-sm mt-1">
          Gmail connection · Transaction email scanning · AI classification
        </p>
      </div>

      {error && (
        <div className="border border-status-red/30 bg-status-red/5 rounded-lg p-4 mb-6">
          <p className="text-status-red text-sm font-medium">Connection failed</p>
          <p className="text-cream-dim text-xs mt-1">
            {error === "denied" && "Gmail access was denied. Please try again and grant permissions."}
            {error === "config" && "Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET."}
            {error === "token_exchange" && "Failed to exchange authorization code. Try again."}
            {error === "missing_code" && "No authorization code received from Google."}
            {error === "server" && "Server error during OAuth. Check logs."}
            {error === "user_not_found" && "User account not found. Sign in again."}
          </p>
        </div>
      )}

      {justConnected && (
        <div className="border border-status-green/30 bg-status-green/5 rounded-lg p-4 mb-6">
          <p className="text-status-green text-sm font-medium">Gmail connected</p>
          {connectedEmail && (
            <p className="text-cream-dim text-xs mt-1">Connected as {connectedEmail}</p>
          )}
        </div>
      )}

      <EmailDashboard googleConfigured={googleConfigured} />
    </div>
  )
}
