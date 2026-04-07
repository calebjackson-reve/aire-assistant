import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { DarkLayout } from "@/components/layouts/DarkLayout"
import { ContactForm } from "./ContactForm"

export default async function NewContactPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")
  return (
    <DarkLayout>
      <ContactForm />
    </DarkLayout>
  )
}
