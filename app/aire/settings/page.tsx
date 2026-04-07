import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import Link from "next/link"

export default async function SettingsPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const user = await prisma.user.findUnique({ where: { clerkId: userId } })
  if (!user) redirect("/sign-in")

  const vendorCount = await prisma.vendor.count({ where: { userId: user.id } })

  const sections = [
    {
      title: "Email Accounts",
      description: "Connect Gmail for email triage, draft replies, and communication monitoring.",
      href: "/aire/settings/email",
      status: "Configure",
    },
    {
      title: "Vendor Management",
      description: `Manage preferred vendors for inspections, appraisals, title, and more.${vendorCount > 0 ? ` ${vendorCount} vendors configured.` : ""}`,
      href: "/aire/settings/vendors",
      status: vendorCount > 0 ? `${vendorCount} vendors` : "Configure",
    },
    {
      title: "Billing & Subscription",
      description: `Current plan: ${user.tier || "FREE"}. Manage your subscription and payment methods.`,
      href: "/billing",
      status: user.tier === "FREE" ? "Upgrade" : "Manage",
    },
  ]

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <Link href="/aire" className="text-[#6b7d52] text-xs hover:underline mb-4 block">← Dashboard</Link>
      <h1 className="font-[family-name:var(--font-cormorant)] italic text-[#1e2416] text-2xl mb-1">
        Settings
      </h1>
      <p className="text-[#6b7d52]/50 text-sm mb-8">
        Manage your account, integrations, and preferences.
      </p>

      <div className="space-y-3">
        {sections.map(section => (
          <Link
            key={section.href}
            href={section.href}
            className="block card-glass !p-5 !rounded-xl hover:border-[#9aab7e]/30 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[#1e2416] text-sm font-medium">{section.title}</p>
                <p className="text-[#6b7d52]/50 text-xs mt-1">{section.description}</p>
              </div>
              <span className="text-xs px-3 py-1 rounded border border-[#9aab7e]/20 text-[#6b7d52] shrink-0">
                {section.status}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
