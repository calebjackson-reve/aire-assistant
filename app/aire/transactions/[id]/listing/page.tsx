import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import Link from "next/link"
import { ListingChecklist } from "./ListingChecklist"

export default async function ListingChecklistPage({
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
  })

  if (!transaction) redirect("/aire/transactions")

  return (
    <div className="min-h-screen">
      {/* ── Big address header — Dotloop style ── */}
      <div className="border-b border-champagne-light bg-white">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <Link
            href={`/aire/transactions/${id}`}
            className="text-sage text-xs hover:underline mb-4 block"
          >
            ← Back to Transaction
          </Link>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="font-[family-name:var(--font-cormorant)] text-[#1e2416] text-3xl md:text-4xl italic font-light leading-tight">
                {transaction.propertyAddress}
              </h1>
              <p className="text-ink-muted text-sm mt-2">
                {transaction.propertyCity}, {transaction.propertyState}{" "}
                {transaction.propertyZip}
              </p>
            </div>

            <div className="flex items-center gap-3 mt-1">
              {/* Status badges — mirroring Dotloop's top bar */}
              <span className="inline-flex items-center px-3 py-1 text-[10px] tracking-wider uppercase font-[family-name:var(--font-label)] bg-sage/10 text-sage rounded-full">
                Listing for Sale
              </span>
              {transaction.listPrice && (
                <span className="text-ink font-[family-name:var(--font-mono)] text-lg">
                  ${transaction.listPrice.toLocaleString()}
                </span>
              )}
            </div>
          </div>

          {/* Quick info row */}
          <div className="flex flex-wrap items-center gap-6 mt-5 text-xs text-ink-muted">
            {transaction.sellerName && (
              <span>
                <span className="text-ink-faint">Seller:</span>{" "}
                {transaction.sellerName}
              </span>
            )}
            {transaction.contractDate && (
              <span>
                <span className="text-ink-faint">Listed:</span>{" "}
                {new Date(transaction.contractDate).toLocaleDateString()}
              </span>
            )}
            <span>
              <span className="text-ink-faint">Status:</span>{" "}
              {transaction.status}
            </span>
          </div>
        </div>
      </div>

      {/* ── Document checklist ── */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <ListingChecklist transactionId={id} />
      </div>
    </div>
  )
}
