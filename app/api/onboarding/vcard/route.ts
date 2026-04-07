import { auth } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { parseVCard } from "@/lib/onboarding/vcard-parser"

// Accepts one or more .vcf files, parses, and creates Contact records.
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { clerkId: userId } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const form = await req.formData()
  const files = form.getAll("vcf") as File[]
  if (!files.length) return NextResponse.json({ error: "No files" }, { status: 400 })

  let parsed = 0
  let created = 0
  const errors: string[] = []

  for (const file of files) {
    try {
      const text = await file.text()
      const contacts = parseVCard(text)
      parsed += contacts.length

      for (const c of contacts) {
        try {
          // Dedupe by email if present, else by full name
          if (c.email) {
            const exists = await prisma.contact.findFirst({
              where: { agentId: user.id, email: c.email },
            })
            if (exists) continue
          } else {
            const exists = await prisma.contact.findFirst({
              where: {
                agentId: user.id,
                firstName: c.firstName,
                lastName: c.lastName,
              },
            })
            if (exists) continue
          }
          await prisma.contact.create({
            data: {
              agentId: user.id,
              firstName: c.firstName || "Unknown",
              lastName: c.lastName || "",
              email: c.email,
              phone: c.phone,
              type: "LEAD",
              source: "vcard_import",
              notes: c.org ? `Organization: ${c.org}` : null,
            },
          })
          created++
        } catch (err) {
          errors.push(String(err))
        }
      }
    } catch (err) {
      errors.push(`Parse failed for ${file.name}: ${err}`)
    }
  }

  return NextResponse.json({ ok: true, parsed, created, errors: errors.slice(0, 5) })
}
