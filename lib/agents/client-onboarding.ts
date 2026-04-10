// lib/agents/client-onboarding.ts
//
// Client Onboarding Agent — triggers on user.created webhook.
// Creates sample transaction, sends welcome email, schedules follow-ups.

import prisma from "@/lib/prisma"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.aireintel.org"

// Sample Baton Rouge addresses for demo transactions
const SAMPLE_ADDRESSES = [
  "4521 Government St, Baton Rouge, LA 70806",
  "1847 Perkins Rd, Baton Rouge, LA 70808",
  "5216 Highland Rd, Baton Rouge, LA 70808",
  "2930 Convention St, Baton Rouge, LA 70806",
  "8744 Jefferson Hwy, Baton Rouge, LA 70809",
]

interface OnboardingResult {
  userId: string
  email: string
  sampleTransactionId: string | null
  welcomeEmailSent: boolean
  processingMs: number
}

export async function runClientOnboarding(
  userId: string,
  email: string,
  firstName: string | null
): Promise<OnboardingResult> {
  const start = Date.now()
  let sampleTransactionId: string | null = null
  let welcomeEmailSent = false

  const name = firstName || email.split("@")[0]

  // 1. Create sample transaction
  try {
    const address = SAMPLE_ADDRESSES[Math.floor(Math.random() * SAMPLE_ADDRESSES.length)]
    const now = new Date()
    const closingDate = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000)

    const txn = await prisma.transaction.create({
      data: {
        userId,
        propertyAddress: address,
        status: "UNDER_CONTRACT",
        listPrice: 225000,
        offerPrice: 218000,
        acceptedPrice: 220000,
        buyerName: "Sample Buyer",
        sellerName: "Sample Seller",
        contractDate: now,
        closingDate,
        mlsNumber: "DEMO-001",
      },
    })
    sampleTransactionId = txn.id

    // Create sample deadlines
    const deadlines = [
      { name: "Inspection Period", daysFromNow: 10 },
      { name: "Appraisal Deadline", daysFromNow: 21 },
      { name: "Financing Contingency", daysFromNow: 30 },
      { name: "Act of Sale", daysFromNow: 45 },
    ]

    for (const d of deadlines) {
      await prisma.deadline.create({
        data: {
          transactionId: txn.id,
          name: d.name,
          dueDate: new Date(now.getTime() + d.daysFromNow * 24 * 60 * 60 * 1000),
        },
      })
    }

    console.log(`[ONBOARDING] Sample transaction created: ${address} for user ${userId}`)
  } catch (err) {
    console.error("[ONBOARDING] Failed to create sample transaction:", err)
  }

  // 2. Send welcome email via Resend
  try {
    const resendKey = process.env.RESEND_API_KEY
    if (resendKey) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Caleb Jackson <caleb@aireintel.org>",
          to: email,
          subject: "Welcome to AIRE — here's your first advantage",
          html: buildWelcomeEmail(name, sampleTransactionId),
        }),
      })
      welcomeEmailSent = res.ok
      if (!res.ok) {
        console.error("[ONBOARDING] Welcome email failed:", await res.text())
      }
    } else {
      console.log(`[ONBOARDING] Welcome email (dev mode) to ${email}:`)
      console.log(buildWelcomeEmail(name, sampleTransactionId))
    }
  } catch (err) {
    console.error("[ONBOARDING] Email error:", err)
  }

  // 3. Log onboarding event
  try {
    await prisma.agentRun.create({
      data: {
        userId,
        agentName: "client_onboarding",
        status: "success",
        completedAt: new Date(),
        durationMs: Date.now() - start,
        resultMetadata: {
          sampleTransactionId,
          welcomeEmailSent,
        },
      },
    })
  } catch {
    // Best effort
  }

  console.log(
    `[ONBOARDING] Complete for ${email}: txn=${!!sampleTransactionId}, email=${welcomeEmailSent} in ${Date.now() - start}ms`
  )

  return {
    userId,
    email,
    sampleTransactionId,
    welcomeEmailSent,
    processingMs: Date.now() - start,
  }
}

function buildWelcomeEmail(name: string, sampleTxnId: string | null): string {
  const dashboardUrl = `${APP_URL}/aire`
  const txnUrl = sampleTxnId ? `${APP_URL}/aire/transactions/${sampleTxnId}` : `${APP_URL}/aire/transactions/new`

  return `
    <div style="font-family: 'Space Grotesk', Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #1e2416;">
      <div style="background: #6b7d52; padding: 20px 24px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0; color: #f5f2ea; font-family: 'Playfair Display', Georgia, serif; font-size: 22px; font-style: italic;">
          Welcome to AIRE
        </h2>
      </div>
      <div style="background: #f5f2ea; padding: 24px; border-radius: 0 0 8px 8px; font-size: 14px; line-height: 1.7;">
        <p>${name},</p>
        <p>I built AIRE because I was tired of juggling spreadsheets, missing deadlines, and losing track of documents across 18 deals last quarter.</p>
        <p>Here's your quick start:</p>
        <ol style="padding-left: 20px;">
          <li><a href="${dashboardUrl}" style="color: #6b7d52; font-weight: 600;">Open your dashboard</a></li>
          <li><a href="${txnUrl}" style="color: #6b7d52; font-weight: 600;">${sampleTxnId ? "Check out your sample transaction" : "Create your first transaction"}</a></li>
          <li>Try a voice command: <em>"What's my pipeline?"</em></li>
        </ol>
        ${sampleTxnId ? '<p style="background: white; border-left: 3px solid #9aab7e; padding: 12px 16px; border-radius: 4px;">I set up a sample deal so you can see what AIRE looks like with real data. Feel free to delete it when you\'re ready.</p>' : ""}
        <p><strong>Your first morning brief arrives tomorrow at 7 AM.</strong></p>
        <p style="margin-top: 24px;">— Caleb<br/>
        <span style="color: #6b7d52; font-size: 12px;">Reve Realtors · Baton Rouge</span></p>
        <hr style="border: none; border-top: 1px solid #e8e4d8; margin: 20px 0;" />
        <p style="color: #6b7d52; font-size: 11px; text-align: center;">
          Powered by AIRE Intelligence · Baton Rouge, Louisiana
        </p>
      </div>
    </div>
  `
}
