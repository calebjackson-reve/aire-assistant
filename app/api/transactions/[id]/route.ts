import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import prisma from "@/lib/prisma"

// GET: Fetch a single transaction with all relations
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const user = await prisma.user.findUnique({ where: { clerkId } })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const transaction = await prisma.transaction.findFirst({
      where: { id, userId: user.id },
      include: {
        deadlines: { orderBy: { dueDate: "asc" } },
        documents: { orderBy: { createdAt: "desc" } },
        workflowEvents: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    })

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
    }

    return NextResponse.json(transaction)
  } catch (error) {
    console.error("Fetch transaction error:", error)
    return NextResponse.json({ error: "Failed to fetch transaction" }, { status: 500 })
  }
}

// PATCH: Update transaction fields
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const user = await prisma.user.findUnique({ where: { clerkId } })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Verify ownership
    const existing = await prisma.transaction.findFirst({
      where: { id, userId: user.id },
      select: { id: true, status: true },
    })

    if (!existing) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
    }

    const body = await req.json()

    // Fields that can be updated directly (not status — use /advance for that)
    const allowedFields = [
      "propertyAddress", "propertyCity", "propertyState", "propertyZip",
      "propertyType", "mlsNumber", "listPrice", "offerPrice", "acceptedPrice",
      "buyerName", "buyerEmail", "buyerPhone",
      "sellerName", "sellerEmail", "sellerPhone",
      "lenderName", "titleCompany",
      "contractDate", "closingDate",
      "inspectionDeadline", "appraisalDeadline", "financingDeadline",
    ]

    const data: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field.endsWith("Date") || field.endsWith("Deadline")) {
          data[field] = body[field] ? new Date(body[field]) : null
        } else if (["listPrice", "offerPrice", "acceptedPrice"].includes(field)) {
          data[field] = body[field] ? parseFloat(body[field]) : null
        } else {
          data[field] = body[field]
        }
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
    }

    const updated = await prisma.transaction.update({
      where: { id },
      data,
      include: {
        deadlines: { orderBy: { dueDate: "asc" } },
        documents: { orderBy: { createdAt: "desc" } },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Update transaction error:", error)
    return NextResponse.json({ error: "Failed to update transaction" }, { status: 500 })
  }
}

// DELETE: Soft-cancel a transaction (only DRAFT transactions can be hard-deleted)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const user = await prisma.user.findUnique({ where: { clerkId } })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const transaction = await prisma.transaction.findFirst({
      where: { id, userId: user.id },
      select: { id: true, status: true },
    })

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
    }

    if (transaction.status === "DRAFT") {
      // Hard delete drafts — no workflow history to preserve
      await prisma.$transaction([
        prisma.deadline.deleteMany({ where: { transactionId: id } }),
        prisma.document.deleteMany({ where: { transactionId: id } }),
        prisma.transaction.delete({ where: { id } }),
      ])
      return NextResponse.json({ deleted: true })
    }

    // Non-draft: cancel instead of delete
    await prisma.$transaction([
      prisma.transaction.update({
        where: { id },
        data: { status: "CANCELLED" },
      }),
      prisma.workflowEvent.create({
        data: {
          transactionId: id,
          fromStatus: transaction.status,
          toStatus: "CANCELLED",
          trigger: "manual",
          triggeredBy: user.id,
          metadata: JSON.parse(JSON.stringify({ reason: "Deleted by user" })),
        },
      }),
    ])

    return NextResponse.json({ cancelled: true, previousStatus: transaction.status })
  } catch (error) {
    console.error("Delete transaction error:", error)
    return NextResponse.json({ error: "Failed to delete transaction" }, { status: 500 })
  }
}
