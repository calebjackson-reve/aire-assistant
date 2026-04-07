import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import prisma from "@/lib/prisma"

// GET: List vendors for the authenticated user
export async function GET() {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { clerkId } })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const vendors = await prisma.vendor.findMany({
      where: { userId: user.id },
      orderBy: [{ preferred: "desc" }, { category: "asc" }, { name: "asc" }],
    })

    return NextResponse.json({ vendors })
  } catch (error) {
    console.error("List vendors error:", error)
    return NextResponse.json({ error: "Failed to list vendors" }, { status: 500 })
  }
}

// POST: Create a new vendor
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

    const body = await req.json()
    const { name, company, category, phone, email, notes, preferred } = body

    if (!name || !category) {
      return NextResponse.json(
        { error: "Name and category are required" },
        { status: 400 }
      )
    }

    const validCategories = ["inspector", "appraiser", "title", "surveyor", "pest", "other"]
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { error: `Category must be one of: ${validCategories.join(", ")}` },
        { status: 400 }
      )
    }

    const vendor = await prisma.vendor.create({
      data: {
        userId: user.id,
        name,
        company: company || null,
        category,
        phone: phone || null,
        email: email || null,
        notes: notes || null,
        preferred: preferred ?? false,
      },
    })

    return NextResponse.json({ vendor }, { status: 201 })
  } catch (error) {
    console.error("Create vendor error:", error)
    return NextResponse.json({ error: "Failed to create vendor" }, { status: 500 })
  }
}
