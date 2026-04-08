import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { LISTING_CHECKLIST } from "@/lib/tc/listing-checklist"

/**
 * GET /api/transactions/[id]/listing-checklist
 * Returns the listing checklist with document status for a transaction.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const user = await prisma.user.findUnique({ where: { clerkId: userId } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const transaction = await prisma.transaction.findFirst({
    where: { id, userId: user.id },
    include: {
      documents: {
        select: {
          id: true,
          name: true,
          type: true,
          fileUrl: true,
          signatureStatus: true,
          checklistStatus: true,
          createdAt: true,
        },
      },
    },
  })

  if (!transaction) return NextResponse.json({ error: "Transaction not found" }, { status: 404 })

  // Map checklist items to their document status
  const checklist = LISTING_CHECKLIST.map((item) => {
    // Try to find a matching document by type or name
    const doc = transaction.documents.find(
      (d) =>
        d.type === item.id ||
        d.name?.toLowerCase().includes(item.shortName.toLowerCase()) ||
        d.name?.toLowerCase().includes(item.name.toLowerCase())
    )

    return {
      ...item,
      status: doc?.checklistStatus || doc?.signatureStatus || "missing",
      documentId: doc?.id || null,
      fileUrl: doc?.fileUrl || null,
      signatureStatus: doc?.signatureStatus || null,
      uploadedAt: doc?.createdAt || null,
    }
  })

  return NextResponse.json({
    transaction: {
      id: transaction.id,
      propertyAddress: transaction.propertyAddress,
      propertyCity: transaction.propertyCity,
      propertyState: transaction.propertyState,
      propertyZip: transaction.propertyZip,
      listPrice: transaction.listPrice,
      sellerName: transaction.sellerName,
      sellerEmail: transaction.sellerEmail,
      status: transaction.status,
    },
    checklist,
    autoFill: {
      propertyAddress: transaction.propertyAddress,
      propertyCity: transaction.propertyCity,
      propertyState: transaction.propertyState,
      propertyZip: transaction.propertyZip || "",
      listPrice: transaction.listPrice?.toString() || "",
      sellerName: transaction.sellerName || "",
      sellerEmail: transaction.sellerEmail || "",
      agentName: [user.firstName, user.lastName].filter(Boolean).join(" "),
      agentEmail: user.email,
      agentLicense: user.licenseNumber || "",
      brokerageName: user.brokerageName || "Reve Realtors",
      listingDate: new Date().toLocaleDateString("en-US"),
    },
  })
}
