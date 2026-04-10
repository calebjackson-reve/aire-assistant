"use client"

import { DarkLayout } from "@/components/layouts/DarkLayout"

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
      {children}
    </DarkLayout>
  )
}
