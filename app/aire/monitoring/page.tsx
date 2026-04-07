import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { MonitoringDashboard } from "@/components/monitoring/MonitoringDashboard"

export default async function MonitoringPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="mb-8">
        <p className="text-[#6b7d52] text-xs tracking-[0.15em] uppercase">System Monitor</p>
        <h1 className="font-[family-name:var(--font-cormorant)] italic text-[#1e2416] text-3xl mt-1">
          Agent Activity
        </h1>
      </div>
      <MonitoringDashboard />
    </div>
  )
}
