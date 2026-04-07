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
  const pipelineValue = active.reduce((a, t) => a + (t.acceptedPrice || t.listPrice || 0), 0)

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-[family-name:var(--font-cormorant)] italic text-cream text-2xl font-light">
            Transactions
          </h1>
          <div className="flex items-center gap-4 mt-1.5">
            <span className="font-mono text-[10px] text-warm/60 tracking-wider uppercase">{active.length} active</span>
            <span className="font-mono text-[10px] text-cream-dim/30 tracking-wider uppercase">{closed.length} closed</span>
            {pipelineValue > 0 && (
              <>
                <span className="text-cream-dim/10">&middot;</span>
                <span className="font-mono text-[10px] text-cream-dim/30 tracking-wider uppercase">
                  ${(pipelineValue / 1_000_000).toFixed(2)}M pipeline
                </span>
              </>
            )}
          </div>
        </div>
        <Link
          href="/aire/transactions/new"
          className="bg-warm/15 text-warm px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-warm/25 transition-colors"
        >
          + New
        </Link>
      </div>

      <TransactionList transactions={JSON.parse(JSON.stringify(user.transactions))} />
    </div>
  )
}
