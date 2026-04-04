// app/airsign/new/page.tsx
// Create new envelope — upload PDF, add signers, place fields, send.

import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { NewEnvelopeForm } from "./NewEnvelopeForm"

export default async function NewEnvelopePage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in?redirect_url=/airsign/new")

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <p className="text-warm text-sm tracking-wide mb-1">AirSign</p>
      <h1 className="font-[family-name:var(--font-newsreader)] italic text-cream text-3xl mb-8">
        New envelope
      </h1>
      <NewEnvelopeForm />
    </div>
  )
}
