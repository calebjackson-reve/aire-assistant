/**
 * GWS Calendar Integration
 * Syncs AIRE TC deadlines to Google Calendar via the gws CLI.
 * All operations are best-effort — Calendar failures never block AIRE.
 */

import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

// Full path to gws binary (installed via npm install -g @googleworkspace/cli)
const GWS = "C:\\Users\\cjjfr\\AppData\\Roaming\\npm\\gws.cmd"

// AIRE calendar name — created once, reused for all deadlines
const AIRE_CALENDAR_ID = "primary" // uses user's primary calendar; swap for a dedicated calendar ID if preferred

export interface CalendarEventPayload {
  deadlineName: string
  dueDate: Date
  propertyAddress: string
  transactionId: string
  notes?: string | null
}

/**
 * Create a Google Calendar event for a TC deadline.
 * Returns the GCal event ID, or null if creation fails.
 */
export async function createCalendarEvent(
  payload: CalendarEventPayload
): Promise<string | null> {
  try {
    const { deadlineName, dueDate, propertyAddress, transactionId, notes } = payload

    const summary = `AIRE: ${deadlineName} — ${propertyAddress}`
    const description = [
      `Transaction: ${propertyAddress}`,
      notes ? `Notes: ${notes}` : null,
      `AIRE ID: ${transactionId}`,
      `Managed by AIRE Intelligence`,
    ]
      .filter(Boolean)
      .join("\\n")

    // All-day event on the due date
    const dateStr = dueDate.toISOString().split("T")[0] // YYYY-MM-DD

    const eventJson = JSON.stringify({
      summary,
      description,
      start: { date: dateStr },
      end: { date: dateStr },
      colorId: "5", // banana yellow for visibility
      reminders: {
        useDefault: false,
        overrides: [
          { method: "email", minutes: 24 * 60 * 7 },  // 7 days
          { method: "email", minutes: 24 * 60 * 3 },  // 3 days
          { method: "popup", minutes: 24 * 60 },       // 1 day
        ],
      },
    })

    const cmd = `"${GWS}" calendar events insert --calendarId ${AIRE_CALENDAR_ID} --json ${JSON.stringify(eventJson)}`
    const { stdout } = await execAsync(cmd, { timeout: 10000 })

    const result = JSON.parse(stdout)
    const eventId = result?.id

    if (eventId) {
      console.log(`[GWS/Calendar] Created event "${summary}" → ${eventId}`)
      return eventId
    }

    console.warn("[GWS/Calendar] Event created but no ID returned:", stdout)
    return null
  } catch (err) {
    console.error("[GWS/Calendar] createCalendarEvent failed (non-blocking):", err)
    return null
  }
}

/**
 * Delete a Google Calendar event when a deadline is completed or removed.
 */
export async function deleteCalendarEvent(eventId: string): Promise<void> {
  try {
    const cmd = `"${GWS}" calendar events delete --calendarId ${AIRE_CALENDAR_ID} --eventId ${eventId}`
    await execAsync(cmd, { timeout: 10000 })
    console.log(`[GWS/Calendar] Deleted event ${eventId}`)
  } catch (err) {
    console.error("[GWS/Calendar] deleteCalendarEvent failed (non-blocking):", err)
  }
}

/**
 * Update a Calendar event's date (e.g., when a deadline is rescheduled).
 */
export async function updateCalendarEventDate(
  eventId: string,
  newDueDate: Date
): Promise<void> {
  try {
    const dateStr = newDueDate.toISOString().split("T")[0]
    const patchJson = JSON.stringify({
      start: { date: dateStr },
      end: { date: dateStr },
    })

    const cmd = `"${GWS}" calendar events patch --calendarId ${AIRE_CALENDAR_ID} --eventId ${eventId} --json ${JSON.stringify(patchJson)}`
    await execAsync(cmd, { timeout: 10000 })
    console.log(`[GWS/Calendar] Updated event ${eventId} to ${dateStr}`)
  } catch (err) {
    console.error("[GWS/Calendar] updateCalendarEventDate failed (non-blocking):", err)
  }
}
