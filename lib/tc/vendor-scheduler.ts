/**
 * AIRE TC — Vendor Coordination & Scheduling
 * Manages preferred vendor lists and auto-schedules inspectors,
 * appraisers, and title companies for transactions.
 *
 * Vendors are stored in the Prisma Vendor model (per-user).
 * Dev mode: console.log for SMS confirmations.
 * Prod mode: Twilio SMS for vendor outreach.
 */

import prisma from "@/lib/prisma"

// ─── TYPES ──────────────────────────────────────────────────────────────────

export type VendorType = "inspector" | "appraiser" | "title_company" | "title" | "surveyor" | "pest_inspector" | "pest" | "contractor" | "other"

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
  userId?: string // Prisma user ID for DB vendor lookup
}

export interface ScheduleResult {
  vendor: Vendor
  status: "sms_sent" | "email_sent" | "dev_logged" | "no_contact"
  message: string
  error?: string
}

// ─── CATEGORY MAPPING ──────────────────────────────────────────────────────

/** Map VendorType aliases to Prisma category values */
function toPrismaCategory(type: VendorType): string[] {
  switch (type) {
    case "inspector": return ["inspector"]
    case "appraiser": return ["appraiser"]
    case "title_company":
    case "title": return ["title"]
    case "surveyor": return ["surveyor"]
    case "pest_inspector":
    case "pest": return ["pest"]
    case "contractor":
    case "other": return ["other"]
    default: return [type]
  }
}

// ─── VENDOR LOOKUP ──────────────────────────────────────────────────────────

/**
 * Get preferred vendors of a given type from the database, sorted by preference.
 * Falls back to empty array if no vendors found.
 */
export async function getPreferredVendors(type: VendorType, userId?: string): Promise<Vendor[]> {
  if (!userId) return []

  const categories = toPrismaCategory(type)

  const dbVendors = await prisma.vendor.findMany({
    where: {
      userId,
      category: { in: categories },
    },
    orderBy: [{ preferred: "desc" }, { name: "asc" }],
  })

  return dbVendors.map((v: { name: string; company: string | null; phone: string | null; email: string | null; notes: string | null; preferred: boolean }, i: number) => ({
    name: v.name,
    company: v.company || "",
    phone: v.phone || "",
    email: v.email || undefined,
    type,
    notes: v.notes || undefined,
    priority: v.preferred ? 0 : i + 1,
  }))
}

/**
 * Get the top preferred vendor for a type.
 */
export async function getTopVendor(type: VendorType, userId?: string): Promise<Vendor | null> {
  const vendors = await getPreferredVendors(type, userId)
  return vendors[0] || null
}

/**
 * List all vendor types available for a user.
 */
export async function getAvailableVendorTypes(userId?: string): Promise<string[]> {
  if (!userId) return []

  const result = await prisma.vendor.findMany({
    where: { userId },
    select: { category: true },
    distinct: ["category"],
  })

  return result.map((r: { category: string }) => r.category)
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
  const vendors = await getPreferredVendors(req.vendorType, req.userId)

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
