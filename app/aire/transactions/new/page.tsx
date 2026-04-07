import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { DarkLayout } from "@/components/layouts/DarkLayout"
import { TransactionWizard } from "./TransactionWizard"

export default async function NewTransactionPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  return (
    <DarkLayout>
      <TransactionWizard />
    </DarkLayout>
  )
}
