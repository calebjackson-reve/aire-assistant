import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { formatDeadlineAlert } from "@/lib/louisiana-rules-engine";

/**
 * AIRE Intelligence — Daily Deadline Alert Cron Job
 * Runs at 6:00 AM daily via Vercel Cron or external scheduler.
 * Sends SMS alerts via Twilio for deadlines due within 48 hours.
 *
 * Vercel cron config (add to vercel.json):
 * { "crons": [{ "path": "/api/cron/deadline-alerts", "schedule": "0 6 * * *" }] }
 */

// Verify cron secret to prevent unauthorized triggers
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: NextRequest) {
  // Verify authorization
  const authHeader = req.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const in48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    // Find all deadlines due within 48 hours that haven't been alerted
    const upcomingDeadlines = await prisma.deadline.findMany({
      where: {
        dueDate: {
          gte: now,
          lte: in48Hours,
        },
        alertSent: false,
        completedAt: null,
      },
      include: {
        transaction: true,
        user: true,
      },
    });

    if (upcomingDeadlines.length === 0) {
      return NextResponse.json({
        message: "No upcoming deadlines to alert",
        checked: now.toISOString(),
      });
    }

    const results: { userId: string; deadline: string; status: string }[] = [];

    for (const deadline of upcomingDeadlines) {
      const alertMessage = formatDeadlineAlert(
        {
          name: deadline.name,
          dueDate: deadline.dueDate,
          daysFromContract: 0,
          category: "closing",
          priority: "high",
          description: deadline.notes || "",
        },
        deadline.transaction.propertyAddress
      );

      // Send SMS via Twilio if configured
      const twilioSid = process.env.TWILIO_ACCOUNT_SID;
      const twilioAuth = process.env.TWILIO_AUTH_TOKEN;
      const twilioFrom = process.env.TWILIO_PHONE_NUMBER;

      if (twilioSid && twilioAuth && twilioFrom && deadline.user.email) {
        try {
          // Look up user's phone from their profile or use a default
          const userPhone = process.env.ALERT_PHONE_NUMBER || "";

          if (userPhone) {
            const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
            const credentials = Buffer.from(`${twilioSid}:${twilioAuth}`).toString("base64");

            const smsRes = await fetch(twilioUrl, {
              method: "POST",
              headers: {
                Authorization: `Basic ${credentials}`,
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: new URLSearchParams({
                To: userPhone,
                From: twilioFrom,
                Body: alertMessage,
              }),
            });

            if (smsRes.ok) {
              results.push({
                userId: deadline.userId,
                deadline: deadline.name,
                status: "sms_sent",
              });
            } else {
              results.push({
                userId: deadline.userId,
                deadline: deadline.name,
                status: `sms_failed: ${smsRes.status}`,
              });
            }
          }
        } catch (smsError) {
          console.error("Twilio SMS error:", smsError);
          results.push({
            userId: deadline.userId,
            deadline: deadline.name,
            status: "sms_error",
          });
        }
      } else {
        // No Twilio configured — log the alert
        console.log(`📢 DEADLINE ALERT (no SMS): ${alertMessage}`);
        results.push({
          userId: deadline.userId,
          deadline: deadline.name,
          status: "logged_no_twilio",
        });
      }

      // Mark alert as sent regardless
      await prisma.deadline.update({
        where: { id: deadline.id },
        data: { alertSent: true },
      });
    }

    console.log(`✅ Deadline alerts processed: ${results.length} alerts sent`);

    return NextResponse.json({
      message: `Processed ${results.length} deadline alerts`,
      results,
      checked: now.toISOString(),
    });
  } catch (error) {
    console.error("Deadline alert cron error:", error);
    return NextResponse.json(
      { error: "Cron job failed" },
      { status: 500 }
    );
  }
}
