import { auth } from "@clerk/nextjs/server"
import { redirect, notFound } from "next/navigation"
import prisma from "@/lib/prisma"
import Link from "next/link"
import { TransactionDetail } from "@/components/tc/TransactionDetail"

export default async function TransactionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const { id } = await params

  const user = await prisma.user.findUnique({ where: { clerkId: userId } })
  if (!user) redirect("/sign-in")

  const transaction = await prisma.transaction.findFirst({
    where: { id, userId: user.id },
    include: {
      deadlines: { orderBy: { dueDate: "asc" } },
      documents: { orderBy: { createdAt: "desc" } },
      // DNA strip needs chronological order (oldest first) — reversed by TransactionTimeline
      workflowEvents: { orderBy: { createdAt: "asc" }, take: 50 },
    },
  })

  if (!transaction) notFound()

  return (
    // overflow-x:hidden prevents CopilotDrawer translateX from creating a horizontal scrollbar
    <div className="max-w-5xl mx-auto px-6 py-10" style={{ overflowX: "hidden" }}>
      <Link
        href="/aire/transactions"
        className="text-xs hover:underline mb-4 block transition-colors"
        style={{ color: "#6b7d52" }}
      >
        ← All Transactions
      </Link>
      <TransactionDetail transaction={JSON.parse(JSON.stringify(transaction))} />
    </div>
  )
}
