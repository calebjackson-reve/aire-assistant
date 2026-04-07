import { type InboundMessage } from "./types"

/**
 * Fetch recent SMS messages from Twilio.
 * Classifies as inbound/outbound based on the agent's Twilio number.
 */
export async function scanSms(sinceMins = 30): Promise<{ inbound: InboundMessage[]; outbound: InboundMessage[] }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const twilioPhone = process.env.TWILIO_PHONE_NUMBER

  if (!accountSid || !authToken || !twilioPhone) return { inbound: [], outbound: [] }

  const sinceDate = new Date(Date.now() - sinceMins * 60000).toISOString().split("T")[0]
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64")

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json?DateSent>=${sinceDate}&PageSize=50`,
    { headers: { Authorization: `Basic ${auth}` } }
  )

  if (!res.ok) {
    console.error("[CommsMonitor] Twilio fetch failed:", res.status)
    return { inbound: [], outbound: [] }
  }

  const data = await res.json() as {
    messages: Array<{
      sid: string
      from: string
      to: string
      body: string
      date_sent: string
      direction: string
    }>
  }

  const inbound: InboundMessage[] = []
  const outbound: InboundMessage[] = []

  for (const msg of data.messages) {
    const parsed: InboundMessage = {
      externalId: msg.sid,
      channel: "sms",
      from: msg.from,
      to: msg.to,
      bodyPreview: msg.body?.slice(0, 500) ?? "",
      sentAt: new Date(msg.date_sent),
    }

    if (msg.direction.startsWith("inbound")) {
      inbound.push(parsed)
    } else {
      outbound.push(parsed)
    }
  }

  return { inbound, outbound }
}
