import prisma from "@/lib/prisma"
import type { LoopImport, LoopImportStatus } from "@prisma/client"
import { updateLoopData } from "./autofill"

/**
 * Dotloop import — parse a Dotloop JSON export into the Loop Data Model.
 *
 * Dotloop's export shape varies by API version; we support two common forms:
 *   v2 (Public API):  { loop: { name, address, participants[], fields[], documents[] } }
 *   Legacy flat-CSV:  { properties: { ... }, parties: [...] } — coerced below.
 *
 * Result:
 *   LoopImport row (status transitions PARSING → PARSED → IMPORTED)
 *   Transaction.loopData merged (if transactionId provided)
 *   documentsIndex: array of dotloop document descriptors for later envelope creation
 */

interface DotloopParticipant {
  name?: string
  fullName?: string
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  role?: string                 // BUYER | SELLER | LISTING_AGENT | BUYING_AGENT | ...
  memberType?: string
}

interface DotloopDocument {
  id?: string | number
  name?: string
  url?: string
  folder?: string
  status?: string
}

interface DotloopExport {
  loop?: {
    id?: string | number
    name?: string
    address?: string
    participants?: DotloopParticipant[]
    fields?: Record<string, unknown>
    documents?: DotloopDocument[]
  }
  properties?: Record<string, unknown>
  parties?: DotloopParticipant[]
  documents?: DotloopDocument[]
}

export async function createLoopImport(
  userId: string,
  rawJson: unknown,
  opts: { transactionId?: string; brokerageId?: string | null } = {}
): Promise<LoopImport> {
  return prisma.loopImport.create({
    data: {
      userId,
      transactionId: opts.transactionId ?? null,
      brokerageId: opts.brokerageId ?? null,
      dotloopLoopId: extractLoopId(rawJson),
      sourceFormat: "dotloop_json",
      rawJson: rawJson as object,
      status: "PENDING",
    },
  })
}

export async function parseLoopImport(importId: string): Promise<LoopImport> {
  await updateStatus(importId, "PARSING")
  const row = await prisma.loopImport.findUniqueOrThrow({ where: { id: importId } })
  try {
    const raw = row.rawJson as DotloopExport
    const parsed = normalizeDotloopExport(raw)
    const documentsIndex = normalizeDocuments(raw)
    const updated = await prisma.loopImport.update({
      where: { id: importId },
      data: {
        parsedData: parsed as object,
        documentsIndex: documentsIndex as object,
        status: "PARSED",
      },
    })
    return updated
  } catch (err) {
    await prisma.loopImport.update({
      where: { id: importId },
      data: {
        status: "FAILED",
        errorMessage: err instanceof Error ? err.message : String(err),
      },
    })
    throw err
  }
}

export async function commitLoopImportToTransaction(importId: string, transactionId: string): Promise<LoopImport> {
  const row = await prisma.loopImport.findUniqueOrThrow({ where: { id: importId } })
  if (row.status !== "PARSED") throw new Error("LoopImport must be PARSED before commit")
  if (!row.parsedData) throw new Error("No parsedData available")

  await updateLoopData(transactionId, row.parsedData as Record<string, unknown>)

  return prisma.loopImport.update({
    where: { id: importId },
    data: { transactionId, status: "IMPORTED", importedAt: new Date() },
  })
}

async function updateStatus(importId: string, status: LoopImportStatus) {
  await prisma.loopImport.update({ where: { id: importId }, data: { status } })
}

function extractLoopId(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as DotloopExport
  const id = r.loop?.id
  return id == null ? null : String(id)
}

export function normalizeDotloopExport(raw: DotloopExport): Record<string, unknown> {
  const participants = raw.loop?.participants ?? raw.parties ?? []
  const address = raw.loop?.address ?? (raw.properties?.address as string | undefined) ?? ""
  const fields = (raw.loop?.fields ?? raw.properties ?? {}) as Record<string, unknown>

  const parts = address.trim().split(/\s+/)
  const streetNumber = parts[0] && /^\d+[A-Z]?$/.test(parts[0]) ? parts[0] : ""
  const rest = streetNumber ? parts.slice(1).join(" ") : address

  const buyers: Array<{ name?: string; email?: string; phone?: string }> = []
  const sellers: Array<{ name?: string; email?: string; phone?: string }> = []
  let listingAgent: { name?: string; email?: string; phone?: string } | undefined
  let buyingAgent: { name?: string; email?: string; phone?: string } | undefined

  for (const p of participants) {
    const name = p.name ?? p.fullName ?? [p.firstName, p.lastName].filter(Boolean).join(" ") ?? undefined
    const entry = { name, email: p.email, phone: p.phone }
    const role = (p.role ?? p.memberType ?? "").toUpperCase()
    if (role.includes("BUYER") && !role.includes("AGENT") && !role.includes("BROKER")) {
      buyers.push(entry)
    } else if (role.includes("SELLER") && !role.includes("AGENT") && !role.includes("BROKER")) {
      sellers.push(entry)
    } else if (role === "LISTING_AGENT" || role.includes("LISTING AGENT")) {
      listingAgent = entry
    } else if (role === "BUYING_AGENT" || role.includes("BUYER AGENT") || role.includes("BUYING AGENT")) {
      buyingAgent = entry
    }
  }

  const pick = (key: string) => (fields[key] ?? undefined) as unknown
  const asNumber = (v: unknown) =>
    typeof v === "number"
      ? v
      : typeof v === "string" && v !== ""
      ? Number(v.replace(/[$,]/g, "")) || undefined
      : undefined
  const asDate = (v: unknown) => {
    if (!v) return undefined
    const d = new Date(String(v))
    return isNaN(d.getTime()) ? undefined : d.toISOString()
  }

  return {
    loop: {
      mlsNumber: (pick("mlsNumber") as string | undefined) ?? (pick("mls_number") as string | undefined),
      property: {
        streetNumber: streetNumber || undefined,
        streetName: rest || undefined,
        city: pick("city") as string | undefined,
        state: pick("state") as string | undefined,
        zip: pick("zip") as string | undefined,
        parish: pick("parish") as string | undefined,
        county: pick("county") as string | undefined,
      },
      financials: {
        listPrice: asNumber(pick("listPrice") ?? pick("list_price")),
        offerPrice: asNumber(pick("offerPrice") ?? pick("offer_price")),
        salePrice: asNumber(pick("salePrice") ?? pick("sale_price") ?? pick("purchasePrice")),
        earnestMoney: asNumber(pick("earnestMoney") ?? pick("earnest_money")),
      },
      dates: {
        contract: asDate(pick("contractDate") ?? pick("contract_date")),
        offer: asDate(pick("offerDate") ?? pick("offer_date")),
        inspection: asDate(pick("inspectionDeadline") ?? pick("inspection_deadline")),
        financing: asDate(pick("financingDeadline") ?? pick("financing_deadline")),
        closing: asDate(pick("closingDate") ?? pick("closing_date")),
      },
      buyer: buyers,
      seller: sellers,
      listingAgent,
      buyingAgent,
    },
  }
}

function normalizeDocuments(raw: DotloopExport): Array<{ fileName: string; url?: string; folder?: string; status?: string }> {
  const docs = raw.loop?.documents ?? raw.documents ?? []
  return docs.map((d) => ({
    fileName: d.name ?? `document-${d.id ?? "unknown"}`,
    url: d.url,
    folder: d.folder,
    status: d.status,
  }))
}
