import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import { DarkLayoutWithBadges } from "./DarkLayoutWithBadges"
import { WisprShell } from "@/components/voice"
import { expireTrialIfOver } from "@/lib/billing/trial"
import "./ui-lab/_theme.css"

// FOUC-safe: set data-theme on the .ui-lab-scope wrapper before first paint.
// Nocturne is the locked default on every /aire/* route.
const THEME_BOOTSTRAP = `
(function(){try{
  var root=document.querySelector('.ui-lab-scope');
  if(!root)return;
  root.setAttribute('data-theme','nocturne');
}catch(e){}})();
`

export default async function AireLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { onboarded: true, id: true },
  })

  if (!user) redirect("/sign-in")
  if (user.onboarded === false) redirect("/onboarding")

  // Lazy trial expiry — demotes user to FREE if trial ended without checkout.
  await expireTrialIfOver(user.id)

  // Lightweight count queries — integers only, no heavy joins
  const [activeCount, overdueCount] = await Promise.all([
    prisma.transaction.count({
      where: { userId: user.id, status: { notIn: ["CLOSED", "CANCELLED"] } },
    }),
    prisma.deadline.count({
      where: {
        transaction: { userId: user.id, status: { notIn: ["CLOSED", "CANCELLED"] } },
        completedAt: null,
        dueDate: { lt: new Date() },
      },
    }),
  ])

  return (
    <DarkLayoutWithBadges activeCount={activeCount} overdueCount={overdueCount}>
      <WisprShell>
        <div className="ui-lab-scope" data-theme="nocturne">
          {children}
        </div>
      </WisprShell>
      <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
    </DarkLayoutWithBadges>
  )
}
