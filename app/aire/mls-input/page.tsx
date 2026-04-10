import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import { MLSAutoFillWizard } from "./MLSAutoFillWizard"

export default async function MLSInputPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    include: {
      transactions: {
        where: { status: { notIn: ["CLOSED", "CANCELLED"] } },
        select: { id: true, propertyAddress: true, status: true },
        orderBy: { updatedAt: "desc" },
      },
    },
  })

  if (!user) redirect("/sign-in")

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="mb-8">
        <h1 className="font-[family-name:var(--font-playfair)] italic text-[#1e2416] text-3xl font-light">
          MLS Auto-Fill
        </h1>
        <p className="font-mono text-[10px] text-[#6b7d52]/60 tracking-wider uppercase mt-1.5">
          Upload an appraisal or old listing to auto-populate Paragon fields
        </p>
      </div>
      <MLSAutoFillWizard
        transactions={JSON.parse(JSON.stringify(user.transactions))}
      />
    </div>
  )
}
