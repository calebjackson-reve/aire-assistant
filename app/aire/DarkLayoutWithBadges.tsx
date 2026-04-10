"use client"

import { DarkLayout } from "@/components/layouts/DarkLayout"
import { PageTransition } from "@/components/ui/PageTransition"

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
    </DarkLayout>
  )
}
