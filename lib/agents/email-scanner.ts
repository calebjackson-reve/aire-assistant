/**
 * AIRE Email Intelligence Agent
 * Scans connected Gmail accounts for real estate document attachments.
 * Classifies attachments using the existing document classifier and
 * creates Document records linked to transactions.
 */

import prisma from "@/lib/prisma";
import { classifyByPatterns, classifyWithAI } from "@/lib/document-classifier";
import { extractDocumentFields } from "@/lib/document-extractor";
import { multiPassExtract } from "@/lib/multi-pass-extractor";
import { autoFileDocument } from "@/lib/document-autofiler";
import { classifyEmail, type ClassifierContext } from "@/lib/comms/email-classifier";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";

// Real estate email keywords to filter relevant messages
const RE_KEYWORDS = [
  "contract",
  "inspection",
  "appraisal",
  "closing",
  "title",
  "disclosure",
  "addendum",
  "amendment",
  "purchase agreement",
  "earnest money",
  "LREC",
  "Act of Sale",
  "property",
  "offer",
  "counter offer",
  "repair",
  "walkthrough",
  "survey",
  "HOA",
  "lead paint",
  "termite",
];

const PDF_MIME_TYPES = [
  "application/pdf",
  "application/x-pdf",
  "image/pdf",
];

interface GmailMessage {
  id: string;
  threadId: string;
}

interface GmailMessageDetail {
  id: string;
  snippet: string;
  payload: {
    headers: { name: string; value: string }[];
    parts?: GmailPart[];
    mimeType: string;
    body?: { attachmentId?: string; size: number; data?: string };
  };
}

interface GmailPart {
  partId: string;
  mimeType: string;
  filename: string;
  body: { attachmentId?: string; size: number; data?: string };
  parts?: GmailPart[];
}

export interface ScanResult {
  accountId: string;
  email: string;
  emailsScanned: number;
  attachmentsFound: number;
  documentsCreated: number;
  errors: string[];
  /** Agent 4 — 3-tier classification tallies across scanned messages. */
  classifications?: {
    deal_related: number;
    work_related: number;
    personal: number;
  };
}

/**
 * Refresh an expired Gmail access token using the stored refresh token.
 */
async function refreshAccessToken(
  accountId: string,
  refreshToken: string
): Promise<string | null> {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!res.ok) {
      console.error(`[EmailScanner] Token refresh failed for ${accountId}:`, await res.text());
      return null;
    }

    const data = (await res.json()) as { access_token: string; expires_in: number };

    await prisma.emailAccount.update({
      where: { id: accountId },
      data: {
        accessToken: data.access_token,
        tokenExpiry: new Date(Date.now() + data.expires_in * 1000),
      },
    });

    return data.access_token;
  } catch (err) {
    console.error(`[EmailScanner] Token refresh error for ${accountId}:`, err);
    return null;
  }
}

/**
 * Get a valid access token for an email account, refreshing if needed.
 */
async function getValidToken(account: {
  id: string;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiry: Date | null;
}): Promise<string | null> {
  if (!account.accessToken) return null;

  // If token is still valid (with 5-minute buffer), use it
  if (account.tokenExpiry && account.tokenExpiry > new Date(Date.now() + 5 * 60 * 1000)) {
    return account.accessToken;
  }

  // Try to refresh
  if (account.refreshToken) {
    return refreshAccessToken(account.id, account.refreshToken);
  }

  return null;
}

/**
 * Fetch Gmail messages matching real estate keywords from the last scan window.
 */
async function fetchRecentMessages(
  accessToken: string,
  afterDate?: Date
): Promise<GmailMessage[]> {
  const after = afterDate
    ? Math.floor(afterDate.getTime() / 1000)
    : Math.floor((Date.now() - 30 * 60 * 1000) / 1000); // default: last 30 min

  const query = `has:attachment after:${after} (${RE_KEYWORDS.slice(0, 10).join(" OR ")})`;

  const res = await fetch(
    `https://www.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=20`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    console.error("[EmailScanner] Gmail list failed:", await res.text());
    return [];
  }

  const data = (await res.json()) as { messages?: GmailMessage[] };
  return data.messages || [];
}

/**
 * Get full message detail including attachment metadata.
 */
async function getMessageDetail(
  accessToken: string,
  messageId: string
): Promise<GmailMessageDetail | null> {
  const res = await fetch(
    `https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) return null;
  return (await res.json()) as GmailMessageDetail;
}

/**
 * Download an attachment from Gmail.
 */
async function downloadAttachment(
  accessToken: string,
  messageId: string,
  attachmentId: string
): Promise<Buffer | null> {
  const res = await fetch(
    `https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) return null;

  const data = (await res.json()) as { data: string };
  // Gmail returns URL-safe base64
  const base64 = data.data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64");
}

/**
 * Extract PDF attachments from a Gmail message's parts tree.
 */
function extractPdfParts(parts?: GmailPart[]): GmailPart[] {
  if (!parts) return [];
  const pdfs: GmailPart[] = [];

  for (const part of parts) {
    if (
      PDF_MIME_TYPES.includes(part.mimeType) &&
      part.filename &&
      part.body?.attachmentId
    ) {
      pdfs.push(part);
    }
    if (part.parts) {
      pdfs.push(...extractPdfParts(part.parts));
    }
  }

  return pdfs;
}

/**
 * Get email subject and sender from message headers.
 */
function parseHeaders(headers: { name: string; value: string }[]): {
  subject: string;
  from: string;
} {
  let subject = "";
  let from = "";
  for (const h of headers) {
    if (h.name.toLowerCase() === "subject") subject = h.value;
    if (h.name.toLowerCase() === "from") from = h.value;
  }
  return { subject, from };
}

/**
 * Scan a single email account for real estate document attachments.
 */
export async function scanEmailAccount(accountId: string): Promise<ScanResult> {
  const account = await prisma.emailAccount.findUnique({
    where: { id: accountId },
    include: { user: true },
  });

  if (!account || !account.isActive) {
    return {
      accountId,
      email: account?.email || "unknown",
      emailsScanned: 0,
      attachmentsFound: 0,
      documentsCreated: 0,
      errors: ["Account not found or inactive"],
    };
  }

  const result: ScanResult = {
    accountId,
    email: account.email,
    emailsScanned: 0,
    attachmentsFound: 0,
    documentsCreated: 0,
    errors: [],
    classifications: { deal_related: 0, work_related: 0, personal: 0 },
  };

  // Load classifier context once per scan (active transactions for this user)
  const activeTransactions = await prisma.transaction.findMany({
    where: { userId: account.userId, status: { notIn: ["CLOSED", "CANCELLED"] } },
    select: {
      id: true,
      propertyAddress: true,
      propertyCity: true,
      mlsNumber: true,
      buyerName: true,
      buyerEmail: true,
      sellerName: true,
      sellerEmail: true,
      lenderName: true,
      titleCompany: true,
    },
  });
  const classifierCtx: ClassifierContext = { activeTransactions, vendorEmails: [] };

  // Create scan record
  const scan = await prisma.emailScan.create({
    data: { accountId, status: "running" },
  });

  try {
    const accessToken = await getValidToken(account);
    if (!accessToken) {
      result.errors.push("No valid access token — user needs to re-authorize");
      await prisma.emailScan.update({
        where: { id: scan.id },
        data: { status: "failed", error: "No valid access token", scanEnd: new Date() },
      });
      return result;
    }

    // Fetch recent messages with attachments
    const messages = await fetchRecentMessages(accessToken, account.lastScan || undefined);
    result.emailsScanned = messages.length;

    for (const msg of messages) {
      try {
        const detail = await getMessageDetail(accessToken, msg.id);
        if (!detail) continue;

        const { subject, from } = parseHeaders(detail.payload.headers);

        // Agent 4 — 3-tier classification of the email itself (not its attachments).
        // Pure function; we just tally the bucket and log. DB persistence of the
        // classification lives on CommunicationLog via runCommsScan — this scanner
        // is attachment-focused so we only record counts here.
        try {
          const cls = await classifyEmail(
            { from, subject, body: detail.snippet || "" },
            classifierCtx
          );
          if (result.classifications) result.classifications[cls.category]++;
          console.log(
            `[EmailScanner] Email "${subject}" → ${cls.category} (t${cls.tier}, ${(cls.confidence * 100).toFixed(0)}%) — ${cls.reason}`
          );
        } catch (clsErr) {
          console.error(`[EmailScanner] Classification error:`, clsErr);
        }

        const pdfParts = extractPdfParts(detail.payload.parts);

        for (const part of pdfParts) {
          result.attachmentsFound++;

          // Check if we already processed this attachment
          const existing = await prisma.emailAttachment.findFirst({
            where: { emailId: msg.id, filename: part.filename },
          });
          if (existing) continue;

          // Record the attachment
          const attachment = await prisma.emailAttachment.create({
            data: {
              scanId: scan.id,
              emailId: msg.id,
              emailSubject: subject,
              emailFrom: from,
              filename: part.filename,
              mimeType: part.mimeType,
              size: part.body.size,
            },
          });

          // Download and classify
          const pdfBuffer = await downloadAttachment(
            accessToken,
            msg.id,
            part.body.attachmentId!
          );

          if (!pdfBuffer) {
            result.errors.push(`Failed to download: ${part.filename}`);
            continue;
          }

          await prisma.emailAttachment.update({
            where: { id: attachment.id },
            data: { downloaded: true },
          });

          // Classify using existing classifier
          let classification = classifyByPatterns(part.filename);
          if (classification.confidence < 0.7) {
            // For low-confidence, try AI classification
            // We don't have extracted text from the PDF here yet,
            // so use filename-only classification for now
            try {
              classification = await classifyWithAI(
                part.filename,
                `Email subject: ${subject}\nFrom: ${from}\nAttachment: ${part.filename}`,
                account.userId
              );
            } catch {
              // AI classification failed, use pattern result
            }
          }

          // Run extraction on the PDF buffer
          let extractedFields: Record<string, unknown> = {};
          let extractedText = "";
          let pageCount: number | undefined;
          try {
            // Try text-based extraction first, fall back to Vision
            const multiResult = await multiPassExtract(pdfBuffer, classification.type, part.filename);
            extractedFields = multiResult.fields;
            pageCount = multiResult.pageCount;
            console.log(`[EmailScanner] Extracted ${Object.keys(extractedFields).length} fields from "${part.filename}"`);
          } catch (extractErr) {
            console.error(`[EmailScanner] Extraction failed for "${part.filename}":`, extractErr);
          }

          // Create Document record with extracted data
          const doc = await prisma.document.create({
            data: {
              name: part.filename,
              type: classification.type,
              category: classification.category,
              classification: JSON.parse(JSON.stringify(classification)),
              filledData: Object.keys(extractedFields).length > 0 ? JSON.parse(JSON.stringify(extractedFields)) : null,
              extractedText: extractedText.slice(0, 50000) || null,
              fileSize: pdfBuffer.length,
              pageCount: pageCount ?? null,
              signatureStatus: "draft",
              checklistStatus: Object.keys(extractedFields).length > 0 ? "extracted" : "uploaded",
            },
          });

          // Auto-file to a transaction
          try {
            const autoFile = await autoFileDocument({
              userId: account.userId,
              extractedFields: extractedFields as Record<string, string | number | boolean | null>,
              filename: part.filename,
            });
            if (autoFile && autoFile.confidence >= 0.5) {
              await prisma.document.update({
                where: { id: doc.id },
                data: { transactionId: autoFile.transactionId },
              });
              console.log(`[EmailScanner] Auto-filed "${part.filename}" to "${autoFile.propertyAddress}"`);
            }
          } catch (autoFileErr) {
            console.error(`[EmailScanner] Auto-file failed:`, autoFileErr);
          }

          // Link attachment to document
          await prisma.emailAttachment.update({
            where: { id: attachment.id },
            data: { classified: true, documentId: doc.id },
          });

          result.documentsCreated++;

          console.log(
            `[EmailScanner] Classified "${part.filename}" as ${classification.type} (${(classification.confidence * 100).toFixed(0)}%) from email "${subject}"`
          );
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        result.errors.push(`Error processing message ${msg.id}: ${errMsg}`);
      }
    }

    // Update scan record
    await prisma.emailScan.update({
      where: { id: scan.id },
      data: {
        status: "complete",
        scanEnd: new Date(),
        emailsScanned: result.emailsScanned,
        attachmentsFound: result.attachmentsFound,
        documentsCreated: result.documentsCreated,
      },
    });

    // Update last scan time
    await prisma.emailAccount.update({
      where: { id: accountId },
      data: { lastScan: new Date() },
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    result.errors.push(errMsg);
    await prisma.emailScan.update({
      where: { id: scan.id },
      data: { status: "failed", error: errMsg, scanEnd: new Date() },
    });
  }

  return result;
}

/**
 * Scan all active email accounts. Called by the cron job.
 */
export async function scanAllAccounts(): Promise<ScanResult[]> {
  const accounts = await prisma.emailAccount.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  const results: ScanResult[] = [];
  for (const account of accounts) {
    const result = await scanEmailAccount(account.id);
    results.push(result);
  }

  return results;
}
