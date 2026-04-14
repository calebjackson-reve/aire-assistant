import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { isAdmin } from "@/lib/auth/admin"
import { LearningDashboard } from "./LearningDashboard"

export const metadata = {
  title: "Learning Insights | AIRE",
}

export const dynamic = "force-dynamic"

export default async function LearningPage() {
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
          Learning insights are restricted. Add your email to{" "}
          <code className="text-[#9aab7e] font-mono text-xs">ADMIN_EMAILS</code>.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="mb-8">
        <p className="text-[#6b7d52] text-xs tracking-[0.2em] uppercase">Self-Learning</p>
        <h1 className="font-[family-name:var(--font-cormorant)] italic text-[#e8e4d8] text-3xl mt-1">
          Learning Insights
        </h1>
        <p className="text-[#6b7d52] text-sm mt-2">
          Top recurring errors, per-feature feedback rates, and the weekly digest. Resolve or ignore
          patterns once they're fixed.
        </p>
      </div>
      <LearningDashboard />
    </div>
  )
}
