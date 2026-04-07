import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import Link from "next/link"
import { TransactionList } from "./TransactionList"

export default async function TransactionsPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    include: {
      transactions: {
        include: {
          deadlines: { orderBy: { dueDate: "asc" }, take: 5 },
          documents: { select: { id: true } },
        },
        orderBy: { updatedAt: "desc" },
      },
    },
  })

  if (!user) redirect("/sign-in")

  const active = user.transactions.filter(t => !["CLOSED", "CANCELLED"].includes(t.status))
  const closed = user.transactions.filter(t => t.status === "CLOSED")

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link href="/aire" className="text-[#6b7d52] text-xs hover:underline mb-1 block">← Dashboard</Link>
          <h1 className="font-[family-name:var(--font-cormorant)] italic text-[#1e2416] text-2xl">
            Transactions
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-3 text-xs">
            <span className="text-[#6b7d52]">{active.length} active</span>
            <span className="text-[#6b7d52]/40">{closed.length} closed</span>
          </div>
          <Link
            href="/aire/transactions/new"
            className="bg-[#6b7d52] text-[#f5f2ea] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#6b7d52]/90 transition"
          >
            + New
          </Link>
        </div>
      </div>

      <TransactionList transactions={JSON.parse(JSON.stringify(user.transactions))} />
    </div>
  )
}
