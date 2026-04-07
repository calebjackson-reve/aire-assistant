import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import VoiceAnalyticsDashboard from "./VoiceAnalyticsDashboard"

export const metadata = { title: "Voice Analytics | AIRE" }

export default async function VoiceAnalyticsPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="font-[family-name:var(--font-cormorant)] italic text-cream text-3xl">
          Voice Pipeline Analytics
        </h1>
        <p className="text-cream-dim text-sm mt-1">
          Timing, intent distribution, and fast-path hit rate
        </p>
      </div>
      <VoiceAnalyticsDashboard />
    </div>
  )
}
