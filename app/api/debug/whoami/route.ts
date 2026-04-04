import { NextResponse } from "next/server"
import { auth, currentUser } from "@clerk/nextjs/server"
import prisma from "@/lib/prisma"

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 })

  const clerkUser = await currentUser()
  const dbUser = await prisma.user.findUnique({ where: { clerkId: userId } })

  return NextResponse.json({
    clerkId: userId,
    email: clerkUser?.emailAddresses?.[0]?.emailAddress,
    firstName: clerkUser?.firstName,
    lastName: clerkUser?.lastName,
    inDatabase: !!dbUser,
    dbUser: dbUser || null,
  })
}
