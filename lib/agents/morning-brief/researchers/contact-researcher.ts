// lib/agents/morning-brief/researchers/contact-researcher.ts
// Queries Contact + RelationshipIntelLog for high-priority outreach.
// Replaces email-researcher since EmailLog table doesn't exist yet.

import prisma from "@/lib/prisma"

export interface ContactOutreach {
  id: string
  firstName: string
  lastName: string
  type: string
  phone: string | null
  email: string | null
  relationshipScore: number
  daysSinceLastContact: number | null
  recommendation: string | null
  suggestedMessage: string | null
  channel: string | null
  priority: string | null
}

export interface ContactResearchResult {
  hotLeads: ContactOutreach[]       // score >= 70
  needsFollow: ContactOutreach[]    // last contact > 14 days
  recentIntel: ContactOutreach[]    // scored in last 7 days
  totalContacts: number
}

export async function researchContacts(userId: string): Promise<ContactResearchResult> {
  const user = await prisma.user.findUnique({ where: { clerkId: userId } })
  if (!user) throw new Error(`User not found for clerkId: ${userId}`)

  const now = new Date()
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const contacts = await prisma.contact.findMany({
    where: { agentId: user.id },
    include: {
      intelLogs: {
        orderBy: { runDate: "desc" },
        take: 1,
      },
    },
    orderBy: { relationshipScore: "desc" },
  })

  const mapContact = (c: typeof contacts[number]): ContactOutreach => {
    const lastLog = c.intelLogs[0] ?? null
    const daysSinceLastContact = c.lastContactedAt
      ? Math.floor((now.getTime() - new Date(c.lastContactedAt).getTime()) / (24 * 60 * 60 * 1000))
      : null

    return {
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      type: c.type,
      phone: c.phone,
      email: c.email,
      relationshipScore: c.relationshipScore,
      daysSinceLastContact,
      recommendation: lastLog?.recommendation ?? null,
      suggestedMessage: lastLog?.suggestedMessage ?? null,
      channel: lastLog?.channel ?? null,
      priority: lastLog?.priority ?? null,
    }
  }

  const all = contacts.map(mapContact)

  return {
    hotLeads: all.filter((c) => c.relationshipScore >= 70).slice(0, 10),
    needsFollow: all
      .filter((c) => c.daysSinceLastContact !== null && c.daysSinceLastContact > 14)
      .slice(0, 10),
    recentIntel: contacts
      .filter((c) => c.intelLogs[0] && new Date(c.intelLogs[0].runDate) >= sevenDaysAgo)
      .map(mapContact)
      .slice(0, 10),
    totalContacts: contacts.length,
  }
}
