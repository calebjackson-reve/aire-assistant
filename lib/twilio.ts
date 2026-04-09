/**
 * AIRE Twilio Client — Centralized SMS + Call API
 *
 * Replaces duplicated Twilio fetch() calls across:
 *   - lib/tc/notifications.ts
 *   - lib/tc/party-communications.ts
 *   - lib/tc/vendor-scheduler.ts
 *   - app/api/cron/deadline-alerts/route.ts
 *
 * All SMS in the platform should flow through this module.
 */

const TWILIO_API = "https://api.twilio.com/2010-04-01"

interface TwilioConfig {
  accountSid: string
  authToken: string
  phoneNumber: string
}

interface SmsResult {
  ok: boolean
  sid?: string
  error?: string
}

function getConfig(): TwilioConfig | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER
  if (!accountSid || !authToken || !phoneNumber) return null
  return { accountSid, authToken, phoneNumber }
}

/**
 * Check if Twilio is configured.
 */
export function isTwilioConfigured(): boolean {
  return getConfig() !== null
}

/**
 * Send an SMS via Twilio.
 * Falls back to console.log in dev/unconfigured environments.
 */
export async function sendSms(to: string, body: string): Promise<SmsResult> {
  const config = getConfig()

  if (!config) {
    console.log(`[Twilio Dev] SMS to ${to}: ${body}`)
    return { ok: true, sid: "dev-mode" }
  }

  try {
    const res = await fetch(
      `${TWILIO_API}/Accounts/${config.accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: to,
          From: config.phoneNumber,
          Body: body,
        }),
      }
    )

    if (!res.ok) {
      const err = await res.text()
      console.error(`[Twilio] SMS failed ${res.status}: ${err}`)
      return { ok: false, error: `Twilio ${res.status}: ${err}` }
    }

    const data = await res.json()
    return { ok: true, sid: data.sid }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[Twilio] SMS error: ${msg}`)
    return { ok: false, error: msg }
  }
}

/**
 * Fetch recent SMS messages (inbound + outbound).
 */
export async function fetchRecentMessages(sinceMins = 30): Promise<{ messages: TwilioMessage[] }> {
  const config = getConfig()
  if (!config) return { messages: [] }

  const since = new Date(Date.now() - sinceMins * 60_000).toISOString()
  const res = await fetch(
    `${TWILIO_API}/Accounts/${config.accountSid}/Messages.json?DateSent>=${since}&PageSize=50`,
    {
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64")}`,
      },
    }
  )

  if (!res.ok) return { messages: [] }
  const data = await res.json()
  return { messages: data.messages || [] }
}

/**
 * Fetch recent calls (for missed call detection).
 */
export async function fetchRecentCalls(sinceMins = 30): Promise<{ calls: TwilioCall[] }> {
  const config = getConfig()
  if (!config) return { calls: [] }

  const since = new Date(Date.now() - sinceMins * 60_000).toISOString()
  const res = await fetch(
    `${TWILIO_API}/Accounts/${config.accountSid}/Calls.json?StartTime>=${since}&PageSize=50`,
    {
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64")}`,
      },
    }
  )

  if (!res.ok) return { calls: [] }
  const data = await res.json()
  return { calls: data.calls || [] }
}

// Twilio API response types
export interface TwilioMessage {
  sid: string
  from: string
  to: string
  body: string
  status: string
  direction: string
  date_sent: string
  date_created: string
}

export interface TwilioCall {
  sid: string
  from: string
  to: string
  status: string
  direction: string
  duration: string
  start_time: string
  end_time: string
}
