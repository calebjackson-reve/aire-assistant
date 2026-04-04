import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { extractDocumentFields } from "@/lib/document-extractor";
import { classifyByPatterns } from "@/lib/document-classifier";
import { multiPassExtract } from "@/lib/multi-pass-extractor";
import { logDocumentMemory } from "@/lib/document-memory";
import { PDFDocument } from "pdf-lib";

// Common English words — used to detect real text vs binary garbage
const REAL_WORDS = new Set([
  "the", "and", "for", "are", "but", "not", "you", "all", "can", "had",
  "her", "was", "one", "our", "out", "has", "his", "how", "its", "may",
  "new", "now", "old", "see", "way", "who", "did", "get", "let", "say",
  "she", "too", "use", "property", "buyer", "seller", "agreement", "sale",
  "purchase", "price", "date", "closing", "inspection", "address", "state",
  "parish", "louisiana", "agent", "broker", "earnest", "money", "deposit",
  "title", "loan", "mortgage", "lender", "deed", "contract", "real",
  "estate", "residential", "disclosure", "condition", "repair", "insurance",
  "appraisal", "financing", "contingency", "deadline", "notice", "shall",
  "section", "page", "this", "that", "with", "from", "have", "been",
  "will", "each", "make", "like", "just", "over", "such", "take", "year",
  "them", "some", "than", "other", "into", "more", "time", "very", "when",
  "come", "could", "after", "before", "between", "under", "within",
]);

function countRealWords(text: string): number {
  const words = text.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
  return words.filter((w) => REAL_WORDS.has(w)).length;
}

export async function POST(req: NextRequest) {
  try {
    // Auth is optional for test mode
    try { await auth(); } catch { /* proceed without user */ }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const transactionId = formData.get("transactionId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Only PDF files are supported" }, { status: 400 });
    }

    // File size limit: 20MB
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 20MB." },
        { status: 413 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // ── Step 0: Get real page count ──
    let pageCount = 1;
    let pdfDoc: PDFDocument | null = null;
    try {
      pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      pageCount = pdfDoc.getPageCount();
      console.log(`📊 [Extract] File: "${file.name}" | Size: ${(buffer.length / 1024).toFixed(1)} KB | Pages: ${pageCount}`);
    } catch (pdfError) {
      console.error(`❌ [Extract] pdf-lib failed to load PDF:`, pdfError);
    }

    // ── Step 1: Try AcroForm extraction ──
    let acroFormData: Record<string, string> = {};
    let acroFieldCount = 0;
    let rawText = "";

    if (pdfDoc) {
      try {
        const form = pdfDoc.getForm();
        const fields = form.getFields();
        acroFieldCount = fields.length;
        console.log(`📋 [AcroForm] Found ${acroFieldCount} form fields`);

        for (const field of fields) {
          const name = field.getName();
          try {
            const textField = form.getTextField(name);
            const value = textField.getText();
            if (value && value.trim()) acroFormData[name] = value.trim();
          } catch {
            try {
              const checkbox = form.getCheckBox(name);
              acroFormData[name] = checkbox.isChecked() ? "checked" : "unchecked";
            } catch {
              try {
                const dropdown = form.getDropdown(name);
                const selected = dropdown.getSelected();
                if (selected.length > 0) acroFormData[name] = selected.join(", ");
              } catch {
                try {
                  const radio = form.getRadioGroup(name);
                  const selected = radio.getSelected();
                  if (selected) acroFormData[name] = selected;
                } catch { /* unsupported field type */ }
              }
            }
          }
        }

        const filledFields = Object.keys(acroFormData).length;
        console.log(`📋 [AcroForm] Extracted ${filledFields} filled fields out of ${acroFieldCount} total`);
        if (filledFields > 0) {
          console.log(`📋 [AcroForm] Sample:`, JSON.stringify(
            Object.fromEntries(Object.entries(acroFormData).slice(0, 8)), null, 2
          ));
          rawText = Object.entries(acroFormData)
            .map(([key, val]) => `${key}: ${val}`)
            .join("\n");
        }
      } catch (formError) {
        console.log(`📋 [AcroForm] No form found:`, formError);
      }
    }

    // ── Step 2: Try text stream extraction if AcroForm was empty ──
    const acroFilledCount = Object.keys(acroFormData).length;
    if (acroFilledCount < 5) {
      try {
        const pdfStr = buffer.toString("latin1");
        const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
        let streamText = "";
        let match;
        while ((match = streamRegex.exec(pdfStr)) !== null) {
          const segment = match[1].replace(/[^\x20-\x7E\r\n]/g, " ").trim();
          if (segment.length > 20) streamText += segment + "\n";
        }
        const streamWordCount = countRealWords(streamText);
        console.log(`📝 [Text] Stream: ${streamText.length} chars, ${streamWordCount} real words`);
        if (streamWordCount > 30) rawText = streamText;
      } catch {
        console.log(`📝 [Text] Stream extraction failed`);
      }
    }

    // ── Step 3: Classify ──
    const classification = classifyByPatterns(file.name, rawText);
    console.log(`📊 [Extract] Classification: ${classification.type} (${classification.category}) — ${(classification.confidence * 100).toFixed(0)}%`);

    // ── Step 4: Choose extraction strategy ──
    const realWordCount = countRealWords(rawText);
    const hasUsableText = realWordCount >= 30 || acroFilledCount >= 5;

    let extractionResult;
    let extractionMethod: string;

    if (acroFilledCount >= 5) {
      // AcroForm has enough data — use text extraction on the form field values
      console.log(`📋 [Extract] Using AcroForm data (${acroFilledCount} fields) for AI extraction`);
      extractionMethod = "acroform";
      extractionResult = await extractDocumentFields(rawText, classification.type, file.name);
      extractionResult.pageCount = pageCount;
    } else if (hasUsableText) {
      // Real text extracted from streams — use text extraction
      console.log(`📝 [Extract] Using text stream data (${realWordCount} real words) for AI extraction`);
      extractionMethod = "text";
      extractionResult = await extractDocumentFields(rawText, classification.type, file.name);
      extractionResult.pageCount = pageCount;
    } else {
      // No usable text — use multi-pass Vision extraction
      console.log(`🚀 [Extract] No usable text — launching multi-pass Vision extraction`);
      extractionMethod = "multi-pass-vision";
      const multiResult = await multiPassExtract(buffer, classification.type, file.name);
      extractionResult = {
        fields: multiResult.fields,
        confidence: multiResult.confidence,
        warnings: multiResult.warnings,
        pageCount: multiResult.pageCount,
        rawText: "",
        documentType: classification.type,
      };
      // Include pass-level detail in the response
      (extractionResult as unknown as Record<string, unknown>).passResults = multiResult.passResults;
    }

    // ── Step 5: Save to database ──
    const document = await prisma.document.create({
      data: {
        transactionId: transactionId || null,
        name: file.name,
        type: classification.type,
        category: classification.category,
        filledData: extractionResult.fields,
        extractedText: rawText.slice(0, 50000),
        classification: JSON.parse(JSON.stringify(classification)),
        fileSize: buffer.length,
        pageCount,
        checklistStatus: "extracted",
      },
    });

    // Log to document memory (non-blocking)
    try {
      // Get user ID if authenticated
      let memoryUserId = "anonymous";
      try {
        const session = await auth();
        if (session.userId) {
          const user = await prisma.user.findUnique({ where: { clerkId: session.userId } });
          if (user) memoryUserId = user.id;
        }
      } catch { /* no auth */ }

      if (memoryUserId !== "anonymous") {
        await logDocumentMemory({
          userId: memoryUserId,
          transactionId: transactionId || undefined,
          fileBuffer: buffer,
          fileName: file.name,
          pageCount,
          classifiedType: classification.type,
          confidence: classification.confidence,
          formNumber: classification.lrecFormNumber,
          extractionMethod,
          extractedFields: extractionResult.fields as Record<string, unknown>,
        });
        console.log(`🧠 [Memory] Logged document "${file.name}" — ${classification.type} (${(classification.confidence * 100).toFixed(0)}%)`);
      }
    } catch (memoryError) {
      console.error("[DocumentMemory] Failed to log:", memoryError);
    }

    return NextResponse.json({
      documentId: document.id,
      filename: file.name,
      classification: {
        type: classification.type,
        category: classification.category,
        confidence: classification.confidence,
        lrecFormNumber: classification.lrecFormNumber,
      },
      extraction: {
        fields: extractionResult.fields,
        confidence: extractionResult.confidence,
        warnings: extractionResult.warnings,
        pageCount,
        extractionMethod,
        acroFormFieldCount: acroFieldCount,
        acroFormFilledCount: acroFilledCount,
        ...("passResults" in extractionResult
          ? { passResults: (extractionResult as unknown as Record<string, unknown>).passResults }
          : {}),
      },
    });
  } catch (error) {
    console.error("❌ Document extraction error:", error);
    return NextResponse.json(
      { error: "Failed to extract document" },
      { status: 500 }
    );
  }
}
