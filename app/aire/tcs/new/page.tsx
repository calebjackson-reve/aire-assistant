import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { TCSWalkthrough } from "./TCSWalkthrough"

export const metadata = {
  title: "TCS — New walkthrough",
}

export default async function NewTCSPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")
  return <TCSWalkthrough />
}
