import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { generateDocument, type DocumentFields } from "@/lib/document-generator";

/**
 * POST /api/documents/generate
 * Generate a pre-filled LREC document PDF.
 *
 * Body: { type, transactionId?, fields, voiceCommandId? }
 * Returns: { documentId, filename, downloadUrl, pageCount }
 */
export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { clerkId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { type, transactionId, fields, voiceCommandId } = await req.json();

    if (!type) {
      return NextResponse.json(
        { error: "Document type is required" },
        { status: 400 }
      );
    }

    // If transactionId provided, auto-populate fields from transaction
    let docFields: DocumentFields = fields || {};
    if (transactionId) {
      const txn = await prisma.transaction.findFirst({
        where: { id: transactionId, userId: user.id },
      });
      if (txn) {
        docFields = {
          propertyAddress: txn.propertyAddress,
          propertyCity: txn.propertyCity,
          propertyState: txn.propertyState,
          propertyZip: txn.propertyZip || undefined,
          buyerName: txn.buyerName || undefined,
          sellerName: txn.sellerName || undefined,
          purchasePrice: txn.acceptedPrice?.toString() || txn.offerPrice?.toString() || txn.listPrice?.toString() || undefined,
          contractDate: txn.contractDate?.toLocaleDateString("en-US") || undefined,
          closingDate: txn.closingDate?.toLocaleDateString("en-US") || undefined,
          ...docFields, // User-provided fields override transaction data
        };
      }
    }

    // Generate the PDF
    const result = await generateDocument(type, docFields);

    // Save document record
    const document = await prisma.document.create({
      data: {
        transactionId: transactionId || null,
        name: result.filename,
        type: result.documentType,
        category: "generated",
        filledData: JSON.parse(JSON.stringify(result.fields)),
        pageCount: result.pageCount,
        fileSize: result.buffer.length,
        checklistStatus: "draft",
      },
    });

    // Return PDF as base64 for now (Vercel Blob upload in Phase 2)
    const base64 = result.buffer.toString("base64");

    console.log(`📄 Document generated: ${result.filename} (${result.buffer.length} bytes)`);

    return NextResponse.json({
      documentId: document.id,
      filename: result.filename,
      pageCount: result.pageCount,
      documentType: result.documentType,
      fileSize: result.buffer.length,
      pdf: base64,
    });
  } catch (error) {
    console.error("Document generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate document" },
      { status: 500 }
    );
  }
}
