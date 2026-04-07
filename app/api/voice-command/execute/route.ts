import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { executeAction, requiresApproval } from "@/lib/voice-action-executor";

/**
 * POST /api/voice-command/execute
 * Executes a previously classified voice command.
 * Called when user clicks "Confirm" in VoiceCommandBar.
 */
export async function POST(req: NextRequest) {
  try {
    const { requireFeature } = await import("@/lib/auth/subscription-gate");
    const gate = await requireFeature("voice_commands");
    if (gate) return gate;

    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { clerkId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { voiceCommandId, intent, entities, confirmed } = await req.json();

    if (!voiceCommandId || !intent) {
      return NextResponse.json(
        { error: "voiceCommandId and intent are required" },
        { status: 400 }
      );
    }

    // Verify the voice command belongs to this user
    const voiceCommand = await prisma.voiceCommand.findFirst({
      where: { id: voiceCommandId, userId: user.id },
    });

    if (!voiceCommand) {
      return NextResponse.json(
        { error: "Voice command not found" },
        { status: 404 }
      );
    }

    // High-stakes actions need explicit confirmation
    if (requiresApproval(intent) && !confirmed) {
      return NextResponse.json({
        requiresConfirmation: true,
        intent,
        entities,
        message: `This will ${intent.replace(/_/g, " ")}. Confirm?`,
      });
    }

    const result = await executeAction({
      userId: user.id,
      voiceCommandId,
      intent,
      entities: entities || {},
      confidence: voiceCommand.confidence || 0,
    });

    // Update voice command with execution result
    await prisma.voiceCommand.update({
      where: { id: voiceCommandId },
      data: {
        status: result.success ? "executed" : "failed",
        result: JSON.parse(JSON.stringify({
          ...(voiceCommand.result as Record<string, unknown> || {}),
          execution: result,
        })),
      },
    });

    console.log(`🎙️ Voice action executed: ${intent} → ${result.success ? "SUCCESS" : "FAILED"}`);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Voice execute error:", error);
    return NextResponse.json(
      { error: "Failed to execute voice command" },
      { status: 500 }
    );
  }
}
