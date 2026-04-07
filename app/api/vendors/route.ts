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

// PATCH: Update an existing vendor (toggle preferred, edit fields)
export async function PATCH(req: NextRequest) {
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
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: "Vendor id is required" }, { status: 400 })
    }

    // Verify vendor belongs to user
    const existing = await prisma.vendor.findFirst({
      where: { id, userId: user.id },
    })
    if (!existing) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 })
    }

    const vendor = await prisma.vendor.update({
      where: { id },
      data: {
        ...(updates.name !== undefined && { name: updates.name }),
        ...(updates.company !== undefined && { company: updates.company }),
        ...(updates.category !== undefined && { category: updates.category }),
        ...(updates.phone !== undefined && { phone: updates.phone }),
        ...(updates.email !== undefined && { email: updates.email }),
        ...(updates.notes !== undefined && { notes: updates.notes }),
        ...(updates.preferred !== undefined && { preferred: updates.preferred }),
      },
    })

    return NextResponse.json({ vendor })
  } catch (error) {
    console.error("Update vendor error:", error)
    return NextResponse.json({ error: "Failed to update vendor" }, { status: 500 })
  }
}
