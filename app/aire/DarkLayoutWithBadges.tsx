"use client"

import { DarkLayout } from "@/components/layouts/DarkLayout"
import { PageTransition } from "@/components/ui/PageTransition"
import { AireChat } from "@/components/AireChat"

export function DarkLayoutWithBadges({
  children,
  activeCount,
  overdueCount,
}: {
  children: React.ReactNode
  activeCount: number
  overdueCount: number
}) {
  return (
    <DarkLayout activeCount={activeCount} overdueCount={overdueCount}>
      <PageTransition>{children}</PageTransition>
      <AireChat />
    </DarkLayout>
  )
}
