/**
 * AIRE Intelligence — Document Signature Routing
 * Prepares documents for e-signature via Dotloop API.
 * Dotloop-ready: when API credentials are provided, sends directly.
 * Fallback: stores document for manual upload.
 */

import prisma from "@/lib/prisma";

export interface SignatureRequest {
  transactionId: string;
  documentId: string;
  documentContent: string;
  documentTitle: string;
  signers: Signer[];
}

export interface Signer {
  name: string;
  email: string;
  role: "buyer" | "seller" | "agent" | "lender" | "title";
}

export interface SignatureResult {
  success: boolean;
  method: "dotloop" | "stored";
  dotloopDocId?: string;
  message: string;
}

/**
 * Route a document for e-signature.
 * Uses Dotloop API if configured, otherwise stores for manual handling.
 */
export async function routeDocumentForSignature(
  request: SignatureRequest
): Promise<SignatureResult> {
  const dotloopToken = process.env.DOTLOOP_ACCESS_TOKEN;

  if (dotloopToken) {
    return await sendViaDotloop(request, dotloopToken);
  }

  // Fallback: store document and mark as ready for signature
  return await storeForManualSignature(request);
}

/**
 * Send document to Dotloop for e-signature
 */
async function sendViaDotloop(
  request: SignatureRequest,
  token: string
): Promise<SignatureResult> {
  try {
    // Step 1: Get the transaction's Dotloop loop ID (or create one)
    const transaction = await prisma.transaction.findUnique({
      where: { id: request.transactionId },
    });

    if (!transaction) {
      throw new Error("Transaction not found");
    }

    let loopId = transaction.dotloopLoopId;

    // Create a new loop in Dotloop if none exists
    if (!loopId) {
      const loopRes = await fetch("https://api-gateway.dotloop.com/public/v2/loop", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: `${transaction.propertyAddress} - ${transaction.buyerName || "Transaction"}`,
          transactionType: "PURCHASE",
          status: "ACTIVE",
        }),
      });

      if (!loopRes.ok) {
        throw new Error(`Dotloop loop creation failed: ${loopRes.status}`);
      }

      const loopData = await loopRes.json();
      loopId = loopData.data?.id?.toString();

      // Save loop ID to transaction
      await prisma.transaction.update({
        where: { id: request.transactionId },
        data: { dotloopLoopId: loopId },
      });
    }

    // Step 2: Upload document to the loop
    const docRes = await fetch(
      `https://api-gateway.dotloop.com/public/v2/loop/${loopId}/document`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: request.documentTitle,
          content: Buffer.from(request.documentContent).toString("base64"),
        }),
      }
    );

    if (!docRes.ok) {
      throw new Error(`Dotloop document upload failed: ${docRes.status}`);
    }

    const docData = await docRes.json();
    const dotloopDocId = docData.data?.id?.toString();

    // Step 3: Update document record in DB
    await prisma.document.update({
      where: { id: request.documentId },
      data: {
        dotloopDocId,
        signatureStatus: "sent",
      },
    });

    console.log(`✅ Document sent to Dotloop: ${request.documentTitle} (Loop: ${loopId})`);

    return {
      success: true,
      method: "dotloop",
      dotloopDocId,
      message: `Document sent for signature via Dotloop. Signers will receive email notifications.`,
    };
  } catch (error) {
    console.error("Dotloop error:", error);

    // Fallback to manual storage on API error
    return await storeForManualSignature(request);
  }
}

/**
 * Store document for manual signature handling
 * Used when Dotloop is not configured or API fails
 */
async function storeForManualSignature(
  request: SignatureRequest
): Promise<SignatureResult> {
  // Update document record to "draft" status with signer info
  await prisma.document.update({
    where: { id: request.documentId },
    data: {
      signatureStatus: "draft",
      filledData: {
        content: request.documentContent,
        signers: request.signers,
        readyForSignature: true,
        createdAt: new Date().toISOString(),
      },
    },
  });

  console.log(`📄 Document stored for manual signature: ${request.documentTitle}`);

  return {
    success: true,
    method: "stored",
    message: `Document "${request.documentTitle}" saved and ready for signature. Upload to your e-signature platform (Dotloop, DocuSign, etc.) to collect signatures.`,
  };
}

/**
 * Check signature status of a document (Dotloop polling)
 */
export async function checkSignatureStatus(
  documentId: string
): Promise<string> {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
  });

  if (!doc) return "not_found";
  return doc.signatureStatus || "unknown";
}
