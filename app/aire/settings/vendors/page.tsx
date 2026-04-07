import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import Link from "next/link"
import { VendorManager } from "./VendorManager"

export default async function VendorSettingsPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in?redirect_url=/aire/settings/vendors")

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    include: {
      vendors: {
        orderBy: [{ preferred: "desc" }, { category: "asc" }, { name: "asc" }],
      },
    },
  })
  if (!user) redirect("/sign-in")

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="mb-8">
        <Link
          href="/aire/settings"
          className="text-copper-light text-xs hover:text-peach transition-colors mb-1 block"
        >
          &larr; Settings
        </Link>
        <h1 className="font-[family-name:var(--font-cormorant)] italic text-cream text-3xl">
          Vendor Management
        </h1>
        <p className="text-cream-dim text-sm mt-1">
          Manage your preferred vendors for inspections, appraisals, title, and more.
        </p>
      </div>

      <VendorManager
        initialVendors={user.vendors.map((v: any) => ({
          ...v,
          createdAt: v.createdAt.toISOString(),
          updatedAt: v.updatedAt.toISOString(),
        }))}
      />
    </div>
  )
}
