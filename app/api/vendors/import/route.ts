import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import prisma from "@/lib/prisma"
import Anthropic from "@anthropic-ai/sdk"
import * as pdfParse from "pdf-parse"

interface ExtractedVendor {
  name: string
  company?: string
  category: string
  phone?: string
  email?: string
}

const VALID_CATEGORIES = ["inspector", "appraiser", "title", "surveyor", "pest", "other"]

function normalizeCategory(raw: string): string {
  const lower = raw.toLowerCase().trim()
  if (lower.includes("inspect")) return "inspector"
  if (lower.includes("apprais")) return "appraiser"
  if (lower.includes("title")) return "title"
  if (lower.includes("survey")) return "surveyor"
  if (lower.includes("pest") || lower.includes("termite") || lower.includes("wdi")) return "pest"
  if (VALID_CATEGORIES.includes(lower)) return lower
  return "other"
}

// POST: Import vendors from a PDF upload
export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { clerkId } })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const formData = await req.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "File must be a PDF" }, { status: 400 })
    }

    // Extract text from PDF
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const pdfData = await (pdfParse as any).default(buffer)
    const pdfText = pdfData.text

    if (!pdfText || pdfText.trim().length < 10) {
      return NextResponse.json(
        { error: "Could not extract text from PDF. The file may be image-based or empty." },
        { status: 400 }
      )
    }

    // Use Claude to extract vendor data
    const anthropic = new Anthropic()
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `Extract all vendor/contractor information from this document. For each vendor, extract:
- name (person name)
- company (business name)
- category (one of: inspector, appraiser, title, surveyor, pest, other)
- phone
- email

Return ONLY a JSON array, no other text: [{ "name": "...", "company": "...", "category": "...", "phone": "...", "email": "..." }]

Document text:
${pdfText.slice(0, 15000)}`,
        },
      ],
    })

    // Parse Claude response
    const responseText =
      message.content[0].type === "text" ? message.content[0].text : ""

    let extracted: ExtractedVendor[] = []
    try {
      // Find JSON array in the response
      const jsonMatch = responseText.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        extracted = JSON.parse(jsonMatch[0])
      }
    } catch {
      return NextResponse.json(
        { error: "Failed to parse vendor data from PDF", raw: responseText },
        { status: 422 }
      )
    }

    if (!Array.isArray(extracted) || extracted.length === 0) {
      return NextResponse.json(
        { error: "No vendors found in the document", raw: responseText },
        { status: 422 }
      )
    }

    // Create each vendor (skip duplicates by name+category)
    const existing = await prisma.vendor.findMany({
      where: { userId: user.id },
      select: { name: true, category: true },
    })
    const existingSet = new Set(existing.map(e => `${e.name.toLowerCase()}|${e.category}`))

    const vendors = []
    for (const v of extracted) {
      if (!v.name) continue

      const category = normalizeCategory(v.category || "other")
      const key = `${v.name.toLowerCase()}|${category}`

      if (existingSet.has(key)) continue // skip duplicate

      const vendor = await prisma.vendor.create({
        data: {
          userId: user.id,
          name: v.name,
          company: v.company || null,
          category,
          phone: v.phone || null,
          email: v.email || null,
          preferred: false,
        },
      })

      vendors.push(vendor)
      existingSet.add(key)
    }

    return NextResponse.json({
      imported: vendors.length,
      vendors,
    })
  } catch (error) {
    console.error("Vendor import error:", error)
    return NextResponse.json(
      { error: "Failed to import vendors" },
      { status: 500 }
    )
  }
}
