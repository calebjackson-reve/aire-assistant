/**
 * MCP endpoint for the AIRE assistant (C3).
 *
 * Wraps existing AIRE API routes as MCP tools so Claude Desktop, Cursor, and
 * the in-app floating assistant share one capability surface. Does NOT modify
 * or replace lib/voice-pipeline.ts — the pipeline is the fast-path, MCP is the
 * federated skill/tool surface on top.
 *
 * Per-request auth relies on the parent app's Clerk middleware (when called
 * from an authenticated browser) or an x-aire-internal-secret header for
 * external MCP clients. Week-1 scaffold — tighten before exposing publicly.
 */

import { NextResponse, type NextRequest } from "next/server"
import { auth } from "@clerk/nextjs/server"
import {
  handleRpc,
  JSONRPC_CODES,
  MCP_PROTOCOL_VERSION,
  MCP_SERVER_NAME,
  MCP_SERVER_VERSION,
  tools,
  type JsonRpcRequest,
} from "@/lib/mcp"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function baseUrlFrom(req: NextRequest): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL
  if (envUrl) return envUrl
  const forwardedHost = req.headers.get("x-forwarded-host")
  const host = forwardedHost ?? req.headers.get("host") ?? "localhost:3000"
  const proto =
    req.headers.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https")
  return `${proto}://${host}`
}

async function resolveUserId(req: NextRequest): Promise<string | null> {
  const headerUser = req.headers.get("x-aire-mcp-user-id")
  if (headerUser) return headerUser
  try {
    const { userId } = await auth()
    return userId
  } catch {
    return null
  }
}

// GET — lightweight discovery / health check.
export async function GET(req: NextRequest) {
  return NextResponse.json({
    protocolVersion: MCP_PROTOCOL_VERSION,
    serverInfo: { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
    toolCount: tools.length,
    tools: tools.map((t) => ({ name: t.name, description: t.description })),
    baseUrl: baseUrlFrom(req),
  })
}

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: JSONRPC_CODES.parseError, message: "Invalid JSON" },
      },
      { status: 400 },
    )
  }

  const userId =
    (await resolveUserId(req)) ??
    (req.headers.get("x-aire-internal-secret") ? "mcp-internal" : null)

  if (!userId) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: JSONRPC_CODES.invalidRequest,
          message:
            "Unauthenticated MCP request — sign in, or provide x-aire-internal-secret",
        },
      },
      { status: 401 },
    )
  }

  const ctx = {
    userId,
    baseUrl: baseUrlFrom(req),
    internalSecret:
      req.headers.get("x-aire-internal-secret") ?? undefined,
  }

  if (Array.isArray(body)) {
    const responses = await Promise.all(
      body.map((item) => handleRpc(item as JsonRpcRequest, ctx)),
    )
    return NextResponse.json(responses)
  }

  const response = await handleRpc(body as JsonRpcRequest, ctx)
  return NextResponse.json(response)
}
