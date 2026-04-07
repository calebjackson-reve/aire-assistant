import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import { CommunicationsHub } from "./CommunicationsHub"

export default async function CommunicationsPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in?redirect_url=/aire/communications")

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    include: {
      contacts: {
        orderBy: { relationshipScore: "desc" },
        take: 50,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          type: true,
          neighborhood: true,
          relationshipScore: true,
          lastContactedAt: true,
        },
      },
      transactions: {
        where: { status: { notIn: ["CLOSED", "CANCELLED"] } },
        select: {
          id: true,
          propertyAddress: true,
          buyerName: true,
          sellerName: true,
          buyerEmail: true,
          sellerEmail: true,
          buyerPhone: true,
          sellerPhone: true,
          status: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 20,
      },
    },
  })

  if (!user) redirect("/sign-in")

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="font-[family-name:var(--font-cormorant)] italic text-cream text-3xl">
          Communications
        </h1>
        <p className="text-cream-dim text-sm mt-1">
          AI-drafted messages · Ninja Selling framework · Fair Housing compliant
        </p>
      </div>

      <CommunicationsHub contacts={user.contacts} transactions={user.transactions} />
    </div>
  )
}
