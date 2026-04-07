import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import Link from "next/link"

export default async function ContractsPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const user = await prisma.user.findUnique({ where: { clerkId: userId } })
  if (!user) redirect("/sign-in")

  const documents = await prisma.document.findMany({
    where: {
      transaction: { userId: user.id },
      category: "generated",
    },
    include: {
      transaction: { select: { propertyAddress: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link href="/aire" className="text-[#6b7d52] text-xs hover:underline mb-1 block">← Dashboard</Link>
          <h1 className="font-[family-name:var(--font-cormorant)] italic text-[#1e2416] text-2xl">
            Contracts
          </h1>
        </div>
        <Link
          href="/aire/contracts/new"
          className="bg-[#6b7d52] text-[#f5f2ea] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#6b7d52]/90 transition"
        >
          Write Contract
        </Link>
      </div>

      {documents.length === 0 ? (
        <div className="card-glass text-center py-16">
          <p className="text-[#6b7d52]/50 text-sm">No contracts generated yet</p>
          <Link href="/aire/contracts/new" className="text-[#6b7d52] text-xs mt-2 hover:underline block">
            Write your first contract →
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map(doc => (
            <div key={doc.id} className="card-glass !p-4 !rounded-xl flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-[#1e2416] text-sm font-medium truncate">{doc.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  {doc.transaction && (
                    <span className="text-[#6b7d52]/50 text-xs truncate">{doc.transaction.propertyAddress}</span>
                  )}
                  <span className="text-[#6b7d52]/20 text-xs">·</span>
                  <span className="text-[#6b7d52]/40 text-xs">{doc.type.replace(/_/g, " ")}</span>
                  <span className="text-[#6b7d52]/20 text-xs">·</span>
                  <span className="text-[#6b7d52]/30 text-[10px]">
                    {new Date(doc.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                doc.checklistStatus === "verified" ? "bg-[#9aab7e]/15 text-[#6b7d52]" :
                doc.checklistStatus === "draft" ? "bg-[#d4944c]/10 text-[#d4944c]" :
                "bg-[#6b7d52]/10 text-[#6b7d52]/50"
              }`}>
                {doc.checklistStatus || "generated"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
