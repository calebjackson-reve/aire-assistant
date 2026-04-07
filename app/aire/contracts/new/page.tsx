import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ContractForm } from "./ContractForm"

export default async function NewContractPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <Link href="/aire/contracts" className="text-[#6b7d52] text-xs hover:underline mb-4 block">← Contracts</Link>
      <h1 className="font-[family-name:var(--font-cormorant)] italic text-[#1e2416] text-2xl mb-1">
        Write a Contract
      </h1>
      <p className="text-[#6b7d52]/50 text-sm mb-8">
        Describe what you need in plain English — AIRE will fill the LREC form.
      </p>
      <ContractForm />
    </div>
  )
}
