/**
 * Calendar Researcher — Morning Brief Module
 *
 * Pulls today's Google Calendar events and formats them for the morning brief synthesis.
 */

import { getDaySchedule, type CalendarEvent, type DaySchedule } from "@/lib/google/calendar"

export interface CalendarResearchResult {
  events: {
    time: string
    title: string
    location?: string
    isNext: boolean
  }[]
  freeSlots: { start: string; end: string }[]
  busyHours: number
  totalEvents: number
  hasCalendar: boolean
}

function formatTime(isoDate: string, allDay: boolean): string {
  if (allDay) return "All Day"
  return new Date(isoDate).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Chicago", // Central Time for Louisiana
  })
}

export async function researchCalendar(userId: string): Promise<CalendarResearchResult> {
  let schedule: DaySchedule
  try {
    schedule = await getDaySchedule(userId)
  } catch (err) {
    console.error("[Calendar Researcher] Failed:", err)
    return { events: [], freeSlots: [], busyHours: 0, totalEvents: 0, hasCalendar: false }
  }

  if (schedule.events.length === 0 && !schedule.nextEvent) {
    return { events: [], freeSlots: [], busyHours: 0, totalEvents: 0, hasCalendar: false }
  }

  const events = schedule.events.map((e: CalendarEvent) => ({
    time: formatTime(e.start, e.allDay),
    title: e.title,
    location: e.location,
    isNext: schedule.nextEvent?.id === e.id,
  }))

  return {
    events,
    freeSlots: schedule.freeSlots,
    busyHours: schedule.busyHours,
    totalEvents: schedule.events.length,
    hasCalendar: true,
  }
}
