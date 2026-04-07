// Minimal vCard (.vcf) parser — handles vCard 2.1/3.0/4.0 basics
// Extracts FN, N, EMAIL, TEL, ORG from concatenated vCard files.

export interface ParsedVCardContact {
  firstName: string
  lastName: string
  fullName: string
  email?: string
  phone?: string
  org?: string
}

function unfold(text: string): string {
  // vCard line folding: CRLF + space/tab = continuation
  return text.replace(/\r?\n[ \t]/g, "")
}

function stripParams(line: string): { key: string; value: string } {
  const colonIdx = line.indexOf(":")
  if (colonIdx < 0) return { key: line, value: "" }
  const head = line.slice(0, colonIdx)
  const value = line.slice(colonIdx + 1).trim()
  const key = head.split(";")[0].toUpperCase()
  return { key, value }
}

export function parseVCard(text: string): ParsedVCardContact[] {
  const unfolded = unfold(text)
  const cards = unfolded.split(/BEGIN:VCARD/i).slice(1)
  const contacts: ParsedVCardContact[] = []

  for (const raw of cards) {
    const block = raw.split(/END:VCARD/i)[0]
    const lines = block.split(/\r?\n/).map(l => l.trim()).filter(Boolean)

    let fn = ""
    let n = ""
    let email: string | undefined
    let phone: string | undefined
    let org: string | undefined

    for (const line of lines) {
      const { key, value } = stripParams(line)
      if (key === "FN" && !fn) fn = value
      else if (key === "N" && !n) n = value
      else if (key === "EMAIL" && !email) email = value
      else if (key === "TEL" && !phone) phone = value
      else if (key === "ORG" && !org) org = value
    }

    // N is structured: Family;Given;Middle;Prefix;Suffix
    let firstName = ""
    let lastName = ""
    if (n) {
      const parts = n.split(";")
      lastName = (parts[0] || "").trim()
      firstName = (parts[1] || "").trim()
    }
    if (!firstName && !lastName && fn) {
      const parts = fn.split(/\s+/)
      firstName = parts[0] || ""
      lastName = parts.slice(1).join(" ")
    }
    const fullName = fn || `${firstName} ${lastName}`.trim()

    if (!fullName && !email && !phone) continue

    contacts.push({
      firstName: firstName || fullName.split(" ")[0] || "Unknown",
      lastName: lastName || fullName.split(" ").slice(1).join(" ") || "",
      fullName,
      email,
      phone,
      org,
    })
  }

  return contacts
}
