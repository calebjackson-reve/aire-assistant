/**
 * AIRE TC — Vendor Coordination & Scheduling
 * Manages preferred vendor lists and auto-schedules inspectors,
 * appraisers, and title companies for transactions.
 *
 * Dev mode: console.log for SMS confirmations.
 * Prod mode: Twilio SMS for vendor outreach.
 */

// ─── TYPES ──────────────────────────────────────────────────────────────────

export type VendorType = "inspector" | "appraiser" | "title_company" | "surveyor" | "pest_inspector" | "contractor"

export interface Vendor {
  name: string
  company: string
  phone: string
  email?: string
  type: VendorType
  parish?: string
  notes?: string
  priority: number // lower = preferred
}

export interface ScheduleRequest {
  transactionId: string
  propertyAddress: string
  vendorType: VendorType
  preferredDate?: string
  preferredTime?: string
  notes?: string
  agentName: string
  agentPhone?: string
}

export interface ScheduleResult {
  vendor: Vendor
  status: "sms_sent" | "email_sent" | "dev_logged" | "no_contact"
  message: string
  error?: string
}

// ─── PREFERRED VENDOR LIST (Baton Rouge Area) ───────────────────────────────

const PREFERRED_VENDORS: Vendor[] = [
  // Inspectors
  { name: "Preferred Inspector", company: "BR Home Inspections", phone: "", email: "", type: "inspector", parish: "East Baton Rouge", notes: "Fast turnaround, thorough reports", priority: 1 },
  { name: "Backup Inspector", company: "Capital City Inspections", phone: "", email: "", type: "inspector", parish: "East Baton Rouge", notes: "Available weekends", priority: 2 },

  // Appraisers (ordered by lender, not agent — included for reference)
  { name: "Preferred Appraiser", company: "BR Appraisal Group", phone: "", email: "", type: "appraiser", parish: "East Baton Rouge", notes: "Lender-ordered typically", priority: 1 },

  // Title Companies
  { name: "Preferred Title", company: "Louisiana Title Group", phone: "", email: "", type: "title_company", parish: "East Baton Rouge", notes: "Fast closings, excellent communication", priority: 1 },
  { name: "Backup Title", company: "Capital Title Services", phone: "", email: "", type: "title_company", parish: "East Baton Rouge", notes: "Good for complex deals", priority: 2 },

  // Surveyors
  { name: "Preferred Surveyor", company: "BR Land Surveys", phone: "", email: "", type: "surveyor", parish: "East Baton Rouge", notes: "2-3 day turnaround", priority: 1 },

  // Pest Inspectors
  { name: "Preferred Pest", company: "Bayou Pest Control", phone: "", email: "", type: "pest_inspector", parish: "East Baton Rouge", notes: "WDI reports same day", priority: 1 },
]

// ─── VENDOR LOOKUP ──────────────────────────────────────────────────────────

/**
 * Get preferred vendors of a given type, sorted by priority.
 */
export function getPreferredVendors(type: VendorType, parish?: string): Vendor[] {
  return PREFERRED_VENDORS
    .filter(v => v.type === type && (!parish || !v.parish || v.parish === parish))
    .sort((a, b) => a.priority - b.priority)
}

/**
 * Get the top preferred vendor for a type.
 */
export function getTopVendor(type: VendorType, parish?: string): Vendor | null {
  const vendors = getPreferredVendors(type, parish)
  return vendors[0] || null
}

/**
 * List all vendor types available.
 */
export function getAvailableVendorTypes(): VendorType[] {
  return [...new Set(PREFERRED_VENDORS.map(v => v.type))]
}

// ─── SMS DISPATCH ───────────────────────────────────────────────────────────

async function sendVendorSms(to: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_PHONE_NUMBER

  if (!sid || !token || !from || !to) {
    console.log(`[TC Vendor/SMS-DEV] To: ${to}\n${body}`)
    return { ok: true }
  }

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
    })
    if (!res.ok) return { ok: false, error: `Twilio ${res.status}` }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

// ─── SCHEDULE REQUEST ───────────────────────────────────────────────────────

/**
 * Send a scheduling request to a preferred vendor via SMS.
 * Falls back to next vendor if primary has no phone.
 */
export async function scheduleVendor(req: ScheduleRequest): Promise<ScheduleResult> {
  const vendors = getPreferredVendors(req.vendorType, "East Baton Rouge")

  if (vendors.length === 0) {
    return {
      vendor: { name: "None", company: "None", phone: "", type: req.vendorType, priority: 0 },
      status: "no_contact",
      message: `No ${req.vendorType} vendors found in preferred list`,
    }
  }

  // Try vendors in priority order
  for (const vendor of vendors) {
    if (!vendor.phone) continue

    const dateStr = req.preferredDate || "ASAP"
    const timeStr = req.preferredTime ? ` around ${req.preferredTime}` : ""

    const smsBody = [
      `Hi ${vendor.name}, this is ${req.agentName} with Reve Realtors.`,
      `I'd like to schedule a ${req.vendorType.replace(/_/g, " ")} for ${req.propertyAddress}.`,
      `Preferred date: ${dateStr}${timeStr}.`,
      req.notes ? `Notes: ${req.notes}` : "",
      `Please reply to confirm or suggest an alternative.`,
      req.agentPhone ? `Call/text: ${req.agentPhone}` : "",
    ].filter(Boolean).join(" ")

    const result = await sendVendorSms(vendor.phone, smsBody)

    if (result.ok) {
      return {
        vendor,
        status: process.env.TWILIO_ACCOUNT_SID ? "sms_sent" : "dev_logged",
        message: `Scheduling request sent to ${vendor.name} (${vendor.company}) for ${dateStr}`,
      }
    }

    console.warn(`[TC Vendor] SMS to ${vendor.name} failed, trying next vendor...`)
  }

  // All vendors failed
  return {
    vendor: vendors[0],
    status: "no_contact",
    message: `Failed to reach any ${req.vendorType} vendors`,
    error: "All preferred vendors unreachable",
  }
}

/**
 * Auto-schedule common vendors for a new transaction entering inspection phase.
 * Sends requests to inspector and pest inspector.
 */
export async function autoScheduleInspection(
  transactionId: string,
  propertyAddress: string,
  agentName: string,
  preferredDate?: string
): Promise<ScheduleResult[]> {
  const results: ScheduleResult[] = []

  for (const type of ["inspector", "pest_inspector"] as VendorType[]) {
    const result = await scheduleVendor({
      transactionId,
      propertyAddress,
      vendorType: type,
      preferredDate,
      agentName,
    })
    results.push(result)
  }

  return results
}
