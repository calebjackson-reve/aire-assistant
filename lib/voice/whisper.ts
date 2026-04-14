/**
 * Whisper transcription helper.
 *
 * Centralizes the OpenAI Whisper call + Louisiana real-estate glossary so
 * every transcription entry point (VoiceOverlay, WisprButton, server routes,
 * tests) gets identical accuracy on local place names, LREC terminology, and
 * AIRE-specific vocabulary.
 *
 * The Whisper `prompt` parameter is a hint: tokens in the prompt are more
 * likely to appear in the output, fixing common mangles like
 * "chop a toolus" → "Tchoupitoulas" or "nat-chit-o-ches" → "Natchitoches".
 */

import OpenAI from "openai"

// Consolidated LA glossary — expanded beyond the stub in the old route.
// Grouped for readability; Whisper ingests the full string.
const LA_PLACES = [
  // Parishes + cities with non-phonetic spellings
  "Baton Rouge",
  "East Baton Rouge Parish",
  "West Baton Rouge Parish",
  "Ascension Parish",
  "Livingston Parish",
  "Tangipahoa Parish",
  "St. Tammany Parish",
  "Iberville Parish",
  "Pointe Coupee Parish",
  "Lafayette Parish",
  "Orleans Parish",
  "Jefferson Parish",
  "Tchoupitoulas",
  "Thibodaux",
  "Natchitoches",
  "Prairieville",
  "Gonzales",
  "Zachary",
  "Denham Springs",
  "Walker",
  "Central",
  "Plaquemine",
  "Donaldsonville",
  "Hammond",
  "Mandeville",
  "Covington",
  "Slidell",
  "Chalmette",
  "Metairie",
  "Kenner",
  "Gretna",
  "Opelousas",
  "Shreveport",
  "Alexandria",
  "Monroe",
  "Lake Charles",
  "Bogalusa",
  "Houma",
  "New Iberia",
  "Morgan City",
]

const LREC_TERMS = [
  "LREC",
  "Louisiana Real Estate Commission",
  "Act of Sale",
  "Purchase Agreement",
  "Seller Disclosure",
  "Property Disclosure Document",
  "Residential Agreement to Buy or Sell",
  "Addendum",
  "Amendment",
  "Counter-Offer",
  "Inspection Response",
  "Financing Contingency",
  "Appraisal Contingency",
  "Earnest Money",
  "Due Diligence",
  "Title Company",
  "Notary",
  "Parish Assessor",
  "GBRAR MLS",
  "Paragon",
  "ROAM",
  "FSBO",
]

const AIRE_TERMS = [
  "AIRE",
  "AIRE Intelligence",
  "AirSign",
  "Morning Brief",
  "Reve Realtors",
  "pipeline",
  "compliance scan",
  "envelope",
  "signer",
  "signature",
  "initials",
  "bulk send",
  "template",
]

const WHISPER_PROMPT = [
  "Louisiana real estate transaction vocabulary.",
  "Places: " + LA_PLACES.join(", ") + ".",
  "Forms: " + LREC_TERMS.join(", ") + ".",
  "Product: " + AIRE_TERMS.join(", ") + ".",
].join(" ")

export const WHISPER_GLOSSARY_PROMPT = WHISPER_PROMPT

let cachedClient: OpenAI | null = null
function getClient(): OpenAI {
  if (!cachedClient) {
    cachedClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return cachedClient
}

export interface TranscribeOptions {
  /** Optional override prompt. Defaults to LA glossary. */
  prompt?: string
  /** Optional language hint (default "en"). */
  language?: string
  /** Optional model (default whisper-1). */
  model?: string
}

/**
 * Transcribe an audio blob/file via OpenAI Whisper.
 * Throws if OPENAI_API_KEY missing — caller decides fallback policy.
 */
export async function transcribeAudio(
  audio: File | Blob,
  options: TranscribeOptions = {}
): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured")
  }

  // OpenAI SDK requires a File with a name for form uploads.
  const file: File =
    audio instanceof File
      ? audio
      : new File([audio], "recording.webm", { type: audio.type || "audio/webm" })

  const transcription = await getClient().audio.transcriptions.create({
    file,
    model: options.model ?? "whisper-1",
    language: options.language ?? "en",
    prompt: options.prompt ?? WHISPER_PROMPT,
  })

  return transcription.text
}
