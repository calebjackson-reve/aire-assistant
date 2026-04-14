/**
 * AIRE Admin Gate
 *
 * Admins are identified by email allowlist from ADMIN_EMAILS env var
 * (comma-separated). Falls back to caleb@aireintel.org if unset so the
 * founder always has access on a fresh environment.
 */

import { auth } from "@clerk/nextjs/server"
import prisma from "@/lib/prisma"

const FALLBACK_ADMIN_EMAIL = "caleb@aireintel.org"

function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? ""
  const list = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  if (list.length === 0) return [FALLBACK_ADMIN_EMAIL]
  return list
}

export async function isAdmin(): Promise<boolean> {
  const { userId: clerkId } = await auth()
  if (!clerkId) return false

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { email: true },
  })
  if (!user?.email) return false

  return getAdminEmails().includes(user.email.toLowerCase())
}

export async function requireAdmin(): Promise<{ email: string } | null> {
  const { userId: clerkId } = await auth()
  if (!clerkId) return null

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { email: true },
  })
  if (!user?.email) return null
  if (!getAdminEmails().includes(user.email.toLowerCase())) return null
  return { email: user.email }
}
