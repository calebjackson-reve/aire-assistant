import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { classifyByPatterns, classifyWithAI } from "@/lib/document-classifier";
import { extractDocumentFields } from "@/lib/document-extractor";
import { logDocumentMemory } from "@/lib/document-memory";
import { autoFileDocument } from "@/lib/document-autofiler";

/**
 * POST /api/documents/scan-email
 * Scans Gmail for PDF attachments and processes them.
 *
 * Requires an active EmailAccount with Gmail OAuth tokens.
 * Uses Gmail API to search for recent emails with PDF attachments.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true, tier: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { requireFeature } = await import("@/lib/auth/subscription-gate");
    const gate = await requireFeature("email_scanning");
    if (gate) return gate;

    const body = await req.json();
    const { maxResults = 20, query = "has:attachment filename:pdf newer_than:7d" } = body;

    // Find active email account
    const emailAccount = await prisma.emailAccount.findFirst({
      where: { userId: user.id, isActive: true, provider: "gmail" },
    });

    if (!emailAccount || !emailAccount.accessToken) {
      return NextResponse.json(
        { error: "No active Gmail account connected. Connect via Settings > Email." },
        { status: 400 }
      );
    }

    // Check token expiry
    if (emailAccount.tokenExpiry && emailAccount.tokenExpiry < new Date()) {
      // Attempt token refresh
      if (!emailAccount.refreshToken) {
        return NextResponse.json(
          { error: "Gmail refresh token missing. Please reconnect your email account." },
          { status: 401 }
        );
      }
      const refreshed = await refreshGmailToken(emailAccount.id, emailAccount.refreshToken);
      if (!refreshed) {
        return NextResponse.json(
          { error: "Gmail token expired. Please reconnect your email account." },
          { status: 401 }
        );
      }
    }

    // Create scan record
    const scan = await prisma.emailScan.create({
      data: {
        accountId: emailAccount.id,
        status: "running",
      },
    });

    // Search Gmail for PDF attachments
    const token = emailAccount.accessToken;
    const searchRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!searchRes.ok) {
      await prisma.emailScan.update({
        where: { id: scan.id },
        data: { status: "error", error: `Gmail search failed: ${searchRes.status}` },
      });
      return NextResponse.json({ error: "Gmail API search failed" }, { status: 502 });
    }

    const searchData = await searchRes.json();
    const messageIds: string[] = (searchData.messages || []).map((m: { id: string }) => m.id);

    let emailsScanned = 0;
    let attachmentsFound = 0;
    let documentsCreated = 0;
    const processed: Array<{ email: string; filename: string; type: string; status: string }> = [];

    for (const msgId of messageIds) {
      emailsScanned++;

      // Get full message
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!msgRes.ok) continue;

      const msg = await msgRes.json();
      const subject = msg.payload?.headers?.find((h: { name: string }) => h.name === "Subject")?.value || "";
      const from = msg.payload?.headers?.find((h: { name: string }) => h.name === "From")?.value || "";

      // Find PDF attachments
      const parts = flattenParts(msg.payload);
      const pdfParts = parts.filter(
        (p: { mimeType: string; filename: string }) =>
          p.mimeType === "application/pdf" && p.filename
      );

      for (const part of pdfParts) {
        attachmentsFound++;

        // Log attachment
        await prisma.emailAttachment.create({
          data: {
            scanId: scan.id,
            emailId: msgId,
            emailSubject: subject,
            emailFrom: from,
            filename: part.filename,
            mimeType: part.mimeType,
            size: part.body?.size || 0,
          },
        });

        // Download attachment
        const attachmentId = part.body?.attachmentId;
        if (!attachmentId) continue;

        const attachRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}/attachments/${attachmentId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!attachRes.ok) continue;

        const attachData = await attachRes.json();
        const buffer = Buffer.from(attachData.data, "base64url");

        // Classify
        const rawText = buffer.toString("latin1").slice(0, 5000);
        let classification = classifyByPatterns(part.filename, rawText);
        if (classification.confidence < 0.5) {
          classification = await classifyWithAI(part.filename, rawText, user.id);
        }

        // Extract fields
        let extractedFields: Record<string, unknown> = {};
        if (classification.confidence >= 0.3) {
          try {
            const extraction = await extractDocumentFields(rawText, classification.type, part.filename);
            extractedFields = extraction.fields;
          } catch {
            // Extraction failed — proceed with classification only
          }
        }

        // Auto-file
        const autoFile = await autoFileDocument({
          userId: user.id,
          extractedFields: extractedFields as Record<string, string | number | boolean | null>,
          filename: part.filename,
        });

        // Save document
        const doc = await prisma.document.create({
          data: {
            transactionId: autoFile && autoFile.confidence >= 0.5 ? autoFile.transactionId : null,
            name: part.filename,
            type: classification.type,
            category: classification.category,
            filledData: JSON.parse(JSON.stringify(extractedFields)),
            classification: JSON.parse(JSON.stringify(classification)),
            fileSize: buffer.length,
            checklistStatus: "extracted",
          },
        });

        // Log to memory
        try {
          await logDocumentMemory({
            userId: user.id,
            transactionId: autoFile?.transactionId,
            fileBuffer: buffer,
            fileName: part.filename,
            classifiedType: classification.type,
            confidence: classification.confidence,
            formNumber: classification.lrecFormNumber,
            extractionMethod: "email_scan",
            extractedFields,
          });
        } catch (memoryError) {
          console.error(`[EmailScan] Memory logging failed for ${part.filename}:`, memoryError);
        }

        documentsCreated++;
        processed.push({
          email: subject,
          filename: part.filename,
          type: classification.type,
          status: autoFile ? `filed:${autoFile.propertyAddress}` : "unfiled",
        });

        // Mark attachment as processed
        await prisma.emailAttachment.updateMany({
          where: { scanId: scan.id, emailId: msgId, filename: part.filename },
          data: { downloaded: true, classified: true, documentId: doc.id },
        });
      }
    }

    // Update scan record
    await prisma.emailScan.update({
      where: { id: scan.id },
      data: {
        scanEnd: new Date(),
        emailsScanned,
        attachmentsFound,
        documentsCreated,
        status: "completed",
      },
    });

    // Update last scan timestamp
    await prisma.emailAccount.update({
      where: { id: emailAccount.id },
      data: { lastScan: new Date() },
    });

    return NextResponse.json({
      scanId: scan.id,
      emailsScanned,
      attachmentsFound,
      documentsCreated,
      processed,
    });
  } catch (error) {
    console.error("Email scan error:", error);
    return NextResponse.json({ error: "Failed to scan email" }, { status: 500 });
  }
}

// ─── Helpers ───────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function flattenParts(payload: any): any[] {
  if (!payload) return [];
  const results: unknown[] = [];
  if (payload.filename && payload.body) results.push(payload);
  if (payload.parts) {
    for (const part of payload.parts) {
      results.push(...flattenParts(part));
    }
  }
  return results;
}

async function refreshGmailToken(accountId: string, refreshToken: string): Promise<boolean> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return false;

  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!res.ok) return false;

    const data = await res.json();
    await prisma.emailAccount.update({
      where: { id: accountId },
      data: {
        accessToken: data.access_token,
        tokenExpiry: new Date(Date.now() + data.expires_in * 1000),
      },
    });

    return true;
  } catch {
    return false;
  }
}
