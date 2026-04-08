import { auth } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

/**
 * POST /api/contacts/import — Bulk import contacts from CSV
 * Supports: Google Contacts, Follow Up Boss, Dotloop, iPhone/Android vCard exports, generic CSV
 * Body: { rows: ParsedContact[], source: string }
 */

interface ParsedContact {
  firstName: string
  lastName?: string
  email?: string
  phone?: string
  type?: string
  source?: string
  notes?: string
  neighborhood?: string
  tags?: string[]
}

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = await prisma.user.findUnique({ where: { clerkId } })
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

    const { rows, source } = (await req.json()) as { rows: ParsedContact[]; source: string }

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "No contacts to import" }, { status: 400 })
    }

    if (rows.length > 5000) {
      return NextResponse.json({ error: "Maximum 5000 contacts per import" }, { status: 400 })
    }

    // Fetch existing contacts to dedupe by email/phone
    const existing = await prisma.contact.findMany({
      where: { agentId: user.id },
      select: { email: true, phone: true },
    })
    const existingEmails = new Set(existing.map((c) => c.email?.toLowerCase()).filter(Boolean))
    const existingPhones = new Set(existing.map((c) => normalizePhone(c.phone)).filter(Boolean))

    let imported = 0
    let skipped = 0
    let errors = 0

    // Batch create in chunks of 100
    const toCreate: Array<{
      agentId: string
      firstName: string
      lastName: string
      email: string | null
      phone: string | null
      type: string
      source: string | null
      notes: string | null
      neighborhood: string | null
      tags: string[]
    }> = []

    for (const row of rows) {
      if (!row.firstName?.trim()) {
        skipped++
        continue
      }

      const email = row.email?.trim().toLowerCase() || null
      const phone = normalizePhone(row.phone) || null

      // Skip duplicates
      if (email && existingEmails.has(email)) { skipped++; continue }
      if (phone && existingPhones.has(phone)) { skipped++; continue }

      // Track for in-batch dedup
      if (email) existingEmails.add(email)
      if (phone) existingPhones.add(phone)

      toCreate.push({
        agentId: user.id,
        firstName: row.firstName.trim(),
        lastName: (row.lastName ?? "").trim(),
        email,
        phone,
        type: mapContactType(row.type),
        source: source || row.source || null,
        notes: row.notes?.trim() || null,
        neighborhood: row.neighborhood?.trim() || null,
        tags: row.tags ?? [],
      })
    }

    // Batch insert
    for (let i = 0; i < toCreate.length; i += 100) {
      const batch = toCreate.slice(i, i + 100)
      try {
        await prisma.contact.createMany({ data: batch })
        imported += batch.length
      } catch (err) {
        console.error("[Contact Import] Batch error:", err)
        errors += batch.length
      }
    }

    return NextResponse.json({
      imported,
      skipped,
      errors,
      total: rows.length,
    })
  } catch (error) {
    console.error("[Contact Import] Error:", error)
    return NextResponse.json({ error: "Import failed" }, { status: 500 })
  }
}

function normalizePhone(phone?: string | null): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, "")
  if (digits.length === 10) return digits
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1)
  return digits || null
}

function mapContactType(type?: string): string {
  if (!type) return "LEAD"
  const t = type.toLowerCase().trim()
  if (t.includes("buyer")) return "BUYER"
  if (t.includes("seller")) return "SELLER"
  if (t.includes("client") || t.includes("past")) return "PAST_CLIENT"
  if (t.includes("vendor")) return "VENDOR"
  if (t.includes("referral")) return "REFERRAL_SOURCE"
  if (t.includes("lead")) return "LEAD"
  return "LEAD"
}
