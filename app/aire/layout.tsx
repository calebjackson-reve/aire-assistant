import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import { DarkLayout } from "@/components/layouts/DarkLayout"

export default async function AireLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  // Quick lightweight query — just check if user exists and needs onboarding
  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { onboarded: true },
  })

  if (!user) redirect("/sign-in")
  if (user.onboarded === false) redirect("/onboarding")

  // Render immediately — badge counts load client-side
  return (
    <DarkLayout>
      {children}
    </DarkLayout>
  )
}
