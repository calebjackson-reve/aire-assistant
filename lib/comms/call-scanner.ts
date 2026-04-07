import prisma from "@/lib/prisma"

/**
 * Fetch recent calls from Twilio and detect missed calls (duration=0, inbound).
 */
export async function scanMissedCalls(userId: string, sinceMins = 30): Promise<number> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN

  if (!accountSid || !authToken) return 0

  const sinceDate = new Date(Date.now() - sinceMins * 60000).toISOString().split("T")[0]
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64")

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json?StartTime>=${sinceDate}&PageSize=50`,
    { headers: { Authorization: `Basic ${auth}` } }
  )

  if (!res.ok) {
    console.error("[CommsMonitor] Twilio calls fetch failed:", res.status)
    return 0
  }

  const data = await res.json() as {
    calls: Array<{
      sid: string
      from: string
      to: string
      duration: string
      direction: string
      start_time: string
      status: string
    }>
  }

  let missedCount = 0

  for (const call of data.calls) {
    const isMissed = call.direction === "inbound" &&
      (call.status === "no-answer" || call.status === "busy" || parseInt(call.duration) === 0)

    if (!isMissed) continue

    // Check if already logged
    const existing = await prisma.missedCallLog.findFirst({
      where: { userId, callerPhone: call.from, callTime: new Date(call.start_time) },
    })
    if (existing) continue

    // Try to match to a contact
    const contact = await prisma.contact.findFirst({
      where: { agentId: userId, phone: call.from },
    })

    await prisma.missedCallLog.create({
      data: {
        userId,
        callerPhone: call.from,
        callerName: contact ? `${contact.firstName} ${contact.lastName}` : null,
        contactId: contact?.id,
        callTime: new Date(call.start_time),
        duration: parseInt(call.duration) || 0,
      },
    })

    missedCount++
  }

  return missedCount
}
