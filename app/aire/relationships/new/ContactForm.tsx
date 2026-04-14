"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

const CATEGORIES = [
  { value: "client", label: "Client" },
  { value: "lead", label: "Lead" },
  { value: "vendor", label: "Vendor" },
  { value: "lender", label: "Lender" },
  { value: "title", label: "Title" },
  { value: "inspector", label: "Inspector" },
  { value: "appraiser", label: "Appraiser" },
  { value: "other", label: "Other" },
]

export function ContactForm() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [category, setCategory] = useState("lead")
  const [source, setSource] = useState("")
  const [notes, setNotes] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (!firstName.trim()) {
      setError("First name is required.")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim() || undefined,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          category,
          source: source.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Failed to create contact (${res.status})`)
      }

      router.push("/aire/relationships")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass =
    "w-full bg-surface-elevated border border-[#d4c8b8]/60 rounded-lg px-4 py-2.5 text-[#1e2416] placeholder:text-[#6a6a60]/50 focus:outline-none focus:border-[#9aab7e]"

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <Link
        href="/aire/relationships"
        className="text-[#6a6a60] hover:text-[#1e2416] text-sm inline-block mb-6"
      >
        &larr; Back to Relationships
      </Link>

      <div className="border border-brown-border rounded-xl p-8">
        <h1 className="font-[family-name:var(--font-cormorant)] italic text-[#1e2416] text-3xl mb-8">
          New Contact
        </h1>

        {error && (
          <div className="text-red-400 text-sm mb-4">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[#6a6a60] text-sm block mb-1">
                First Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className="text-[#6a6a60] text-sm block mb-1">Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Smith"
                className={inputClass}
              />
            </div>
          </div>

          {/* Email + Phone row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[#6a6a60] text-sm block mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@example.com"
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-[#6a6a60] text-sm block mb-1">Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(225) 555-0100"
                className={inputClass}
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="text-[#6a6a60] text-sm block mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={inputClass}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Source */}
          <div>
            <label className="text-[#6a6a60] text-sm block mb-1">Source</label>
            <input
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="zillow, referral, open house..."
              className={inputClass}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-[#6a6a60] text-sm block mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional context about this contact..."
              rows={4}
              className={inputClass + " resize-none"}
            />
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="bg-[#6b7d52] hover:bg-[#5a6c44] text-[#f5f2ea] font-medium px-6 py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Creating..." : "Create Contact"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
