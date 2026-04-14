import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { isAdmin } from "@/lib/auth/admin"
import { SystemStatusDashboard } from "./SystemStatusDashboard"

export const metadata = {
  title: "System Status | AIRE",
}

export const dynamic = "force-dynamic"

export default async function SystemStatusPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const admin = await isAdmin()
  if (!admin) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16">
        <p className="text-[#6b7d52] text-xs tracking-[0.2em] uppercase mb-2">403</p>
        <h1 className="font-[family-name:var(--font-cormorant)] italic text-[#e8e4d8] text-3xl mb-4">
          Admin only
        </h1>
        <p className="text-[#6b7d52] text-sm">
          The system status dashboard is restricted. If this is a mistake, add your email to{" "}
          <code className="text-[#9aab7e] font-mono text-xs">ADMIN_EMAILS</code>.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="mb-8">
        <p className="text-[#6b7d52] text-xs tracking-[0.2em] uppercase">Reliability</p>
        <h1 className="font-[family-name:var(--font-cormorant)] italic text-[#e8e4d8] text-3xl mt-1">
          System Status
        </h1>
        <p className="text-[#6b7d52] text-sm mt-2">
          Real-time health of crons, database, and external services. Auto-refreshes every 30 seconds.
        </p>
      </div>
      <SystemStatusDashboard />
    </div>
  )
}
