/**
 * AIRE Document Auto-Filer
 * Matches uploaded documents to existing transactions by address, parties, or MLS number.
 */

import prisma from "@/lib/prisma";

interface AutoFileMatch {
  transactionId: string;
  propertyAddress: string;
  confidence: number;
  matchedOn: string[]; // which fields matched
}

interface AutoFileInput {
  userId: string;
  extractedFields: Record<string, string | number | boolean | null>;
  filename: string;
}

/**
 * Find the best matching transaction for a document based on extracted fields.
 * Returns null if no confident match found.
 */
export async function autoFileDocument(input: AutoFileInput): Promise<AutoFileMatch | null> {
  const { userId, extractedFields, filename } = input;

  // Get all active transactions for this user
  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      status: { notIn: ["CLOSED", "CANCELLED"] },
    },
    select: {
      id: true,
      propertyAddress: true,
      propertyCity: true,
      propertyZip: true,
      mlsNumber: true,
      buyerName: true,
      sellerName: true,
    },
  });

  if (transactions.length === 0) return null;

  const address = normalize(String(extractedFields.propertyAddress ?? ""));
  const mls = normalize(String(extractedFields.mlsNumber ?? ""));
  const buyer = normalize(String(extractedFields.buyerName ?? ""));
  const seller = normalize(String(extractedFields.sellerName ?? ""));

  let bestMatch: AutoFileMatch | null = null;

  for (const tx of transactions) {
    const matchedOn: string[] = [];
    let score = 0;

    // Address match (strongest signal)
    if (address && normalize(tx.propertyAddress).includes(address.slice(0, 20))) {
      matchedOn.push("address");
      score += 0.5;
    } else if (address && fuzzyAddressMatch(address, normalize(tx.propertyAddress))) {
      matchedOn.push("address_fuzzy");
      score += 0.35;
    }

    // MLS number match (very strong if present)
    if (mls && tx.mlsNumber && normalize(tx.mlsNumber) === mls) {
      matchedOn.push("mls");
      score += 0.4;
    }

    // Party name matches
    if (buyer && tx.buyerName && normalize(tx.buyerName).includes(buyer.split(" ")[0])) {
      matchedOn.push("buyer");
      score += 0.15;
    }
    if (seller && tx.sellerName && normalize(tx.sellerName).includes(seller.split(" ")[0])) {
      matchedOn.push("seller");
      score += 0.15;
    }

    // Filename contains address fragment
    const normalizedFilename = normalize(filename);
    const addressWords = normalize(tx.propertyAddress).split(/\s+/).filter(w => w.length > 3);
    const filenameAddressHits = addressWords.filter(w => normalizedFilename.includes(w)).length;
    if (filenameAddressHits >= 2) {
      matchedOn.push("filename");
      score += 0.2;
    }

    if (score > 0 && matchedOn.length > 0) {
      const confidence = Math.min(0.98, score);
      if (!bestMatch || confidence > bestMatch.confidence) {
        bestMatch = {
          transactionId: tx.id,
          propertyAddress: tx.propertyAddress,
          confidence,
          matchedOn,
        };
      }
    }
  }

  // Only return matches above threshold
  if (bestMatch && bestMatch.confidence >= 0.3) {
    return bestMatch;
  }

  return null;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
}

function fuzzyAddressMatch(a: string, b: string): boolean {
  // Extract street number and first word of street name
  const getCore = (addr: string) => {
    const parts = addr.split(/\s+/);
    return parts.slice(0, 2).join(" ");
  };
  const coreA = getCore(a);
  const coreB = getCore(b);
  return coreA.length > 3 && coreB.length > 3 && (coreA.includes(coreB) || coreB.includes(coreA));
}
