import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { classifyByPatterns, classifyWithAI } from "@/lib/document-classifier";

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { filename, text, useAI = false } = body;

    if (!filename) {
      return NextResponse.json(
        { error: "filename is required" },
        { status: 400 }
      );
    }

    let result;
    if (useAI && text) {
      result = await classifyWithAI(filename, text);
    } else {
      result = classifyByPatterns(filename, text);
    }

    return NextResponse.json({
      filename,
      classification: result,
    });
  } catch (error) {
    console.error("Document classification error:", error);
    return NextResponse.json(
      { error: "Failed to classify document" },
      { status: 500 }
    );
  }
}
