import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import Link from "next/link"
import { EmailSettings } from "./EmailSettings"

export default async function EmailSettingsPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in?redirect_url=/aire/settings/email")

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    include: {
      emailAccounts: {
        select: {
          id: true,
          email: true,
          provider: true,
          isActive: true,
          lastScan: true,
          createdAt: true,
        },
      },
    },
  })
  if (!user) redirect("/sign-in")

  const googleConfigured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="mb-8">
        <Link href="/aire" className="text-copper-light text-xs hover:text-peach transition-colors mb-1 block">
          ← Dashboard
        </Link>
        <h1 className="font-[family-name:var(--font-cormorant)] italic text-cream text-2xl">
          Email Settings
        </h1>
        <p className="text-cream-dim text-sm mt-1">
          Manage connected email accounts for AIRE intelligence scanning.
        </p>
      </div>

      <EmailSettings
        accounts={user.emailAccounts.map((a) => ({
          ...a,
          lastScan: a.lastScan?.toISOString() ?? null,
          createdAt: a.createdAt.toISOString(),
        }))}
        googleConfigured={googleConfigured}
      />
    </div>
  )
}
