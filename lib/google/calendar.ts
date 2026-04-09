/**
 * Google Calendar Integration for AIRE Morning Brief
 *
 * Fetches today's events from the agent's Google Calendar.
 * Uses OAuth2 tokens stored in the EmailAccount table (same OAuth flow as Gmail).
 *
 * Required scopes: https://www.googleapis.com/auth/calendar.readonly
 */

import prisma from "@/lib/prisma"

const GCAL_API = "https://www.googleapis.com/calendar/v3"

export interface CalendarEvent {
  id: string
  title: string
  start: string // ISO datetime or date
  end: string
  location?: string
  description?: string
  allDay: boolean
  status: string
}

export interface DaySchedule {
  events: CalendarEvent[]
  nextEvent: CalendarEvent | null
  freeSlots: { start: string; end: string }[]
  busyHours: number
}

/**
 * Refresh an expired Google OAuth token.
 */
async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  })

  if (!res.ok) {
    console.error("[GCal] Token refresh failed:", res.status)
    return null
  }

  const data = await res.json()
  return data.access_token || null
}

/**
 * Get a valid access token for a user's Google account.
 * Refreshes if expired.
 */
async function getAccessToken(userId: string): Promise<string | null> {
  const account = await prisma.emailAccount.findFirst({
    where: { userId, provider: "gmail", isActive: true },
    select: { id: true, accessToken: true, refreshToken: true, tokenExpiry: true },
  })

  if (!account || !account.refreshToken) return null

  // Check if token is expired (with 5min buffer)
  const isExpired = !account.tokenExpiry || account.tokenExpiry < new Date(Date.now() + 5 * 60_000)

  if (isExpired) {
    const newToken = await refreshAccessToken(account.refreshToken)
    if (!newToken) return null

    // Update stored token
    await prisma.emailAccount.update({
      where: { id: account.id },
      data: {
        accessToken: newToken,
        tokenExpiry: new Date(Date.now() + 3500 * 1000), // ~1 hour
      },
    })
    return newToken
  }

  return account.accessToken
}

/**
 * Fetch today's calendar events for a user.
 */
export async function getTodayEvents(userId: string): Promise<CalendarEvent[]> {
  const token = await getAccessToken(userId)
  if (!token) {
    console.log("[GCal] No Google account linked for user", userId)
    return []
  }

  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)

  const params = new URLSearchParams({
    timeMin: startOfDay.toISOString(),
    timeMax: endOfDay.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "25",
  })

  const res = await fetch(`${GCAL_API}/calendars/primary/events?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    console.error("[GCal] Events fetch failed:", res.status)
    return []
  }

  const data = await res.json()
  const items = data.items || []

  return items.map((item: Record<string, unknown>) => {
    const start = item.start as Record<string, string> | undefined
    const end = item.end as Record<string, string> | undefined
    const allDay = !!start?.date
    return {
      id: item.id as string,
      title: (item.summary as string) || "Untitled",
      start: start?.dateTime || start?.date || "",
      end: end?.dateTime || end?.date || "",
      location: (item.location as string) || undefined,
      description: (item.description as string) || undefined,
      allDay,
      status: (item.status as string) || "confirmed",
    }
  })
}

/**
 * Build a full day schedule with free slots.
 */
export async function getDaySchedule(userId: string): Promise<DaySchedule> {
  const events = await getTodayEvents(userId)

  const now = new Date()
  const nextEvent = events.find((e) => new Date(e.start) > now) || null

  // Calculate free slots between events (business hours 8am-6pm)
  const businessStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0)
  const businessEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0)
  const freeSlots: { start: string; end: string }[] = []

  let cursor = businessStart.getTime()
  for (const event of events) {
    if (event.allDay) continue
    const eventStart = new Date(event.start).getTime()
    const eventEnd = new Date(event.end).getTime()

    if (eventStart > cursor && eventStart <= businessEnd.getTime()) {
      freeSlots.push({
        start: new Date(cursor).toISOString(),
        end: new Date(eventStart).toISOString(),
      })
    }
    cursor = Math.max(cursor, eventEnd)
  }

  if (cursor < businessEnd.getTime()) {
    freeSlots.push({
      start: new Date(cursor).toISOString(),
      end: businessEnd.toISOString(),
    })
  }

  // Calculate busy hours
  let busyMs = 0
  for (const event of events) {
    if (event.allDay) continue
    busyMs += new Date(event.end).getTime() - new Date(event.start).getTime()
  }

  return {
    events,
    nextEvent,
    freeSlots,
    busyHours: Math.round((busyMs / (1000 * 60 * 60)) * 10) / 10,
  }
}
