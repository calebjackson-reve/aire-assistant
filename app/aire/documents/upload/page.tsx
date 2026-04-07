import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import { DarkLayout } from "@/components/layouts/DarkLayout"
import { DocumentUploader } from "./DocumentUploader"

export default async function UploadDocumentPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const user = await prisma.user.findUnique({ where: { clerkId: userId } })
  if (!user) redirect("/sign-in")

  // Get transactions for the picker dropdown
  const transactions = await prisma.transaction.findMany({
    where: { userId: user.id, status: { not: "CANCELLED" } },
    select: { id: true, propertyAddress: true, status: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  return (
    <DarkLayout>
      <DocumentUploader transactions={transactions} />
    </DarkLayout>
  )
}
