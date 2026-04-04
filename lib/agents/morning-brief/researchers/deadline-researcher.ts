// lib/agents/morning-brief/researchers/deadline-researcher.ts
// Queries Deadline table for next 7 days, returns grouped by urgency.

import prisma from "@/lib/prisma"

export interface DeadlineItem {
  id: string
  name: string
  dueDate: Date
  daysUntilDue: number
  urgency: "overdue" | "today" | "urgent" | "upcoming"
  propertyAddress: string
  transactionId: string
  transactionStatus: string
}

export interface DeadlineResearchResult {
  overdue: DeadlineItem[]
  today: DeadlineItem[]
  urgent: DeadlineItem[]   // 1-3 days
  upcoming: DeadlineItem[] // 4-7 days
  total: number
}

export async function researchDeadlines(userId: string): Promise<DeadlineResearchResult> {
  const user = await prisma.user.findUnique({ where: { clerkId: userId } })
  if (!user) throw new Error(`User not found for clerkId: ${userId}`)

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const sevenDaysOut = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000)

  const deadlines = await prisma.deadline.findMany({
    where: {
      userId: user.id,
      completedAt: null,
      dueDate: { lte: sevenDaysOut },
    },
    include: {
      transaction: {
        select: { propertyAddress: true, status: true, id: true },
      },
    },
    orderBy: { dueDate: "asc" },
  })

  const result: DeadlineResearchResult = {
    overdue: [],
    today: [],
    urgent: [],
    upcoming: [],
    total: deadlines.length,
  }

  for (const d of deadlines) {
    const dueDate = new Date(d.dueDate)
    const diffMs = dueDate.getTime() - startOfToday.getTime()
    const daysUntilDue = Math.floor(diffMs / (24 * 60 * 60 * 1000))

    const item: DeadlineItem = {
      id: d.id,
      name: d.name,
      dueDate: d.dueDate,
      daysUntilDue,
      urgency: daysUntilDue < 0 ? "overdue" : daysUntilDue === 0 ? "today" : daysUntilDue <= 3 ? "urgent" : "upcoming",
      propertyAddress: d.transaction.propertyAddress,
      transactionId: d.transaction.id,
      transactionStatus: d.transaction.status,
    }

    if (daysUntilDue < 0) result.overdue.push(item)
    else if (daysUntilDue === 0) result.today.push(item)
    else if (daysUntilDue <= 3) result.urgent.push(item)
    else result.upcoming.push(item)
  }

  return result
}
