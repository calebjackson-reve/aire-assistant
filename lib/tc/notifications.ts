/**
 * AIRE TC Notification System — Deadline Reminders (Email + SMS)
 *
 * Uses Louisiana rules engine for deadline calculations.
 * Dev mode: console.log instead of actual delivery.
 * Prod mode: Twilio for SMS, Resend for email (when configured).
 */

import prisma from "@/lib/prisma";
import {
  formatDeadlineAlert,
  type CalculatedDeadline,
} from "@/lib/louisiana-rules-engine";

// ─── Types ─────────────────────────────────────────────────────

export interface NotificationResult {
  channel: "sms" | "email" | "console";
  recipient: string;
  deadline: string;
  propertyAddress: string;
  status: "sent" | "failed" | "dev_logged";
  error?: string;
}

export interface ReminderBatch {
  userId: string;
  notifications: NotificationResult[];
  deadlinesChecked: number;
  alertsTriggered: number;
}

// ─── Channel Senders ───────────────────────────────────────────

export async function sendSMS(to: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!sid || !token || !from) {
    console.log(`[TC/SMS-DEV] To: ${to}\n${body}`);
    return { ok: true }; // dev mode
  }

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: to, From: from, Body: body }),
      }
    );
    if (!res.ok) return { ok: false, error: `Twilio ${res.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log(`[TC/Email-DEV] To: ${to} | Subject: ${subject}\n${html}`);
    return { ok: true }; // dev mode
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "AIRE TC <tc@aireintel.org>",
        to,
        subject,
        html,
      }),
    });
    if (!res.ok) return { ok: false, error: `Resend ${res.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Deadline Email Template ───────────────────────────────────

function buildDeadlineEmailHTML(
  agentName: string,
  deadlines: Array<{ deadline: CalculatedDeadline; propertyAddress: string }>
): string {
  const rows = deadlines
    .map(({ deadline, propertyAddress }) => {
      const dateStr = deadline.dueDate.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      const priorityColor =
        deadline.priority === "high" ? "#c53030" : deadline.priority === "medium" ? "#b7791f" : "#6b7d52";
      return `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e8e4d8">
            <strong style="color:${priorityColor}">${deadline.name}</strong><br/>
            <span style="color:#6b7d52;font-size:13px">${propertyAddress}</span>
          </td>
          <td style="padding:8px 12px;border-bottom:1px solid #e8e4d8;text-align:right;white-space:nowrap">
            ${dateStr}
          </td>
        </tr>`;
    })
    .join("");

  return `
    <div style="font-family:'Space Grotesk',sans-serif;max-width:560px;margin:0 auto;color:#1e2416">
      <div style="background:#9aab7e;padding:20px 24px;border-radius:8px 8px 0 0">
        <h2 style="margin:0;color:#f5f2ea;font-family:'Cormorant Garamond',serif;font-size:20px">
          AIRE Deadline Reminder
        </h2>
      </div>
      <div style="background:#f5f2ea;padding:20px 24px;border-radius:0 0 8px 8px">
        <p style="margin:0 0 16px">Good morning, ${agentName}. You have <strong>${deadlines.length}</strong> upcoming deadline${deadlines.length > 1 ? "s" : ""}:</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          ${rows}
        </table>
        <p style="margin:16px 0 0;font-size:12px;color:#6b7d52">
          Log in to AIRE to view details and take action.
        </p>
      </div>
    </div>`;
}

// ─── Core: Process Reminders for a User ────────────────────────

// Reminder windows — fire at each of these day offsets before a deadline.
// Cron runs daily, so each deadline naturally hits one window per day.
const REMINDER_WINDOWS = [7, 3, 1, 0] as const;

function daysUntil(target: Date, now: Date = new Date()): number {
  const startOfDay = (d: Date) => {
    const c = new Date(d);
    c.setHours(0, 0, 0, 0);
    return c;
  };
  return Math.round((startOfDay(target).getTime() - startOfDay(now).getTime()) / 86_400_000);
}

// Per-window idempotency: stash already-fired windows in the Deadline.notes field
// as a tag `[alerted:7,3]`. Avoids a schema change; survives cron reruns.
function parseAlertedWindows(notes: string | null): Set<number> {
  if (!notes) return new Set();
  const m = notes.match(/\[alerted:([\d,]+)\]/);
  if (!m) return new Set();
  return new Set(m[1].split(",").map((n) => parseInt(n, 10)).filter((n) => !isNaN(n)));
}

function writeAlertedWindows(notes: string | null, windows: Set<number>): string {
  const stripped = (notes || "").replace(/\s*\[alerted:[\d,]*\]\s*/g, "").trim();
  if (windows.size === 0) return stripped;
  const sorted = [...windows].sort((a, b) => b - a).join(",");
  return stripped ? `${stripped} [alerted:${sorted}]` : `[alerted:${sorted}]`;
}

/**
 * Check all active transactions for a user and send reminders for deadlines
 * hitting a reminder window [7, 3, 1, 0] days out. Per-window idempotent.
 */
export async function processDeadlineReminders(
  userId: string,
  _withinDays?: number // legacy param, ignored — we now use REMINDER_WINDOWS
): Promise<ReminderBatch> {
  void _withinDays;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, firstName: true },
  });

  if (!user) {
    return { userId, notifications: [], deadlinesChecked: 0, alertsTriggered: 0 };
  }

  // Pull DB deadline records directly — these are the source of truth the UI shows.
  const deadlines = await prisma.deadline.findMany({
    where: {
      userId,
      completedAt: null,
      transaction: { status: { notIn: ["CLOSED", "CANCELLED"] } },
    },
    include: {
      transaction: { select: { propertyAddress: true } },
    },
  });

  const notifications: NotificationResult[] = [];
  const now = new Date();
  const pendingEmailDeadlines: Array<{
    deadline: CalculatedDeadline;
    propertyAddress: string;
    daysOut: number;
  }> = [];

  for (const dl of deadlines) {
    const days = daysUntil(dl.dueDate, now);
    // Only fire on exact window days (or same-day overdue of 0). Skip past-due (<0) — those
    // belong in the overdue view, not the reminder email.
    if (!REMINDER_WINDOWS.includes(days as (typeof REMINDER_WINDOWS)[number])) continue;

    const alreadyFired = parseAlertedWindows(dl.notes);
    if (alreadyFired.has(days)) continue;

    // Map DB deadline into CalculatedDeadline shape for existing template code.
    const calc: CalculatedDeadline = {
      name: dl.name,
      dueDate: dl.dueDate,
      daysFromContract: 0,
      category: "custom",
      priority: days <= 1 ? "high" : days <= 3 ? "medium" : "low",
      description: dl.notes?.replace(/\s*\[alerted:[\d,]*\]\s*/g, "").trim() || dl.name,
    };

    // SMS notification (dev mode -> console.log if Twilio not configured)
    const smsBody = formatDeadlineAlert(calc, dl.transaction.propertyAddress);
    // TODO: Add phone field to User model for real SMS delivery
    // For now, skip SMS — user.email is not a valid phone number
    const smsResult = { ok: false, error: "No phone number on User model" };
    notifications.push({
      channel: "console",
      recipient: user.email,
      deadline: `${dl.name} (${days}d)`,
      propertyAddress: dl.transaction.propertyAddress,
      status: smsResult.ok ? (process.env.TWILIO_ACCOUNT_SID ? "sent" : "dev_logged") : "failed",
      error: smsResult.error,
    });

    pendingEmailDeadlines.push({
      deadline: calc,
      propertyAddress: dl.transaction.propertyAddress,
      daysOut: days,
    });

    // Record this window as fired. Mark alertSent=true once the final 0-day hits.
    alreadyFired.add(days);
    await prisma.deadline.update({
      where: { id: dl.id },
      data: {
        notes: writeAlertedWindows(dl.notes, alreadyFired),
        alertSent: days === 0 ? true : dl.alertSent,
      },
    });
  }

  // Batched email
  if (pendingEmailDeadlines.length > 0) {
    const subject = `AIRE: ${pendingEmailDeadlines.length} deadline${pendingEmailDeadlines.length > 1 ? "s" : ""} coming up`;
    const html = buildDeadlineEmailHTML(
      user.firstName || "Agent",
      pendingEmailDeadlines.map((p) => ({ deadline: p.deadline, propertyAddress: p.propertyAddress }))
    );
    const emailResult = await sendEmail(user.email, subject, html);

    notifications.push({
      channel: process.env.RESEND_API_KEY ? "email" : "console",
      recipient: user.email,
      deadline: `${pendingEmailDeadlines.length} deadlines (batch)`,
      propertyAddress: pendingEmailDeadlines.map((d) => d.propertyAddress).join(", "),
      status: emailResult.ok ? (process.env.RESEND_API_KEY ? "sent" : "dev_logged") : "failed",
      error: emailResult.error,
    });
  }

  return {
    userId,
    notifications,
    deadlinesChecked: deadlines.length,
    alertsTriggered: pendingEmailDeadlines.length,
  };
}

/**
 * Process reminders for all eligible users (PRO + INVESTOR).
 */
export async function processAllReminders(withinDays: number = 3): Promise<ReminderBatch[]> {
  const users = await prisma.user.findMany({
    where: { tier: { in: ["PRO", "INVESTOR"] } },
    select: { id: true },
  });

  const results: ReminderBatch[] = [];
  for (const user of users) {
    const batch = await processDeadlineReminders(user.id, withinDays);
    results.push(batch);
  }
  return results;
}
