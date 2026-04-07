import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import prisma from "@/lib/prisma"
import { onDeadlineCompleted } from "@/lib/workflow/state-machine"

// GET: List all deadlines for a transaction
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: transactionId } = await params

    const user = await prisma.user.findUnique({ where: { clerkId } })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const transaction = await prisma.transaction.findFirst({
      where: { id: transactionId, userId: user.id },
      select: { id: true, propertyAddress: true },
    })

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
    }

    const deadlines = await prisma.deadline.findMany({
      where: { transactionId },
      orderBy: { dueDate: "asc" },
    })

    const now = new Date()
    const categorized = {
      overdue: deadlines.filter(d => !d.completedAt && d.dueDate < now),
      upcoming: deadlines.filter(d => !d.completedAt && d.dueDate >= now),
      completed: deadlines.filter(d => d.completedAt),
    }

    return NextResponse.json({
      transactionId,
      propertyAddress: transaction.propertyAddress,
      deadlines,
      summary: {
        total: deadlines.length,
        overdue: categorized.overdue.length,
        upcoming: categorized.upcoming.length,
        completed: categorized.completed.length,
      },
    })
  } catch (error) {
    console.error("Fetch deadlines error:", error)
    return NextResponse.json({ error: "Failed to fetch deadlines" }, { status: 500 })
  }
}

// POST: Create a custom deadline or mark a deadline as complete
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: transactionId } = await params

    const user = await prisma.user.findUnique({ where: { clerkId } })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const transaction = await prisma.transaction.findFirst({
      where: { id: transactionId, userId: user.id },
      select: { id: true },
    })

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
    }

    const body = await req.json()

    // Action: complete an existing deadline
    if (body.action === "complete" && body.deadlineId) {
      const deadline = await prisma.deadline.findFirst({
        where: { id: body.deadlineId, transactionId },
      })

      if (!deadline) {
        return NextResponse.json({ error: "Deadline not found" }, { status: 404 })
      }

      if (deadline.completedAt) {
        return NextResponse.json({ error: "Already completed" }, { status: 400 })
      }

      const updated = await prisma.deadline.update({
        where: { id: body.deadlineId },
        data: { completedAt: new Date(), notes: body.notes ?? deadline.notes },
      })

      // Trigger workflow auto-advance
      const advanceResult = await onDeadlineCompleted(transactionId, deadline.name, user.id)

      return NextResponse.json({
        deadline: updated,
        workflowAdvance: advanceResult,
      })
    }

    // Action: create a new custom deadline
    if (!body.name || !body.dueDate) {
      return NextResponse.json({ error: "name and dueDate are required" }, { status: 400 })
    }

    const deadline = await prisma.deadline.create({
      data: {
        userId: user.id,
        transactionId,
        name: body.name,
        dueDate: new Date(body.dueDate),
        notes: body.notes ?? null,
      },
    })

    return NextResponse.json(deadline, { status: 201 })
  } catch (error) {
    console.error("Deadline action error:", error)
    return NextResponse.json({ error: "Failed to process deadline" }, { status: 500 })
  }
}
