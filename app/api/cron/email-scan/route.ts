/**
 * AIRE Email Scan Cron Job
 * Runs every 30 minutes via Vercel Cron.
 * Scans all active Gmail accounts for real estate document attachments.
 *
 * Vercel cron config in vercel.json:
 * Schedule runs every 30 minutes
 */

import { NextRequest, NextResponse } from "next/server";
import { scanAllAccounts } from "@/lib/agents/email-scanner";

export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized triggers
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[Cron:EmailScan] Starting scan of all active accounts...");

  try {
    const results = await scanAllAccounts();

    const summary = {
      timestamp: new Date().toISOString(),
      accountsScanned: results.length,
      totalEmails: results.reduce((sum, r) => sum + r.emailsScanned, 0),
      totalAttachments: results.reduce((sum, r) => sum + r.attachmentsFound, 0),
      totalDocuments: results.reduce((sum, r) => sum + r.documentsCreated, 0),
      errors: results.flatMap((r) => r.errors),
      results,
    };

    console.log(
      `[Cron:EmailScan] Complete — ${summary.accountsScanned} accounts, ${summary.totalDocuments} docs created`
    );

    return NextResponse.json(summary);
  } catch (err) {
    console.error("[Cron:EmailScan] Fatal error:", err);
    return NextResponse.json(
      { error: "Scan failed", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggering from dashboard
export async function POST(request: NextRequest) {
  return GET(request);
}
