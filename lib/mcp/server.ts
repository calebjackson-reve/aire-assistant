/**
 * MCP protocol handler (JSON-RPC 2.0 over HTTP).
 *
 * Implements the three methods AIRE needs for week-1 skill-plugin integration:
 *   - initialize
 *   - tools/list
 *   - tools/call
 *
 * Deliberately minimal — no resources/prompts/completion yet. Those slots
 * stay open for the C7 proactive-brief work and skill-file streaming.
 */

import { ZodError } from "zod"
import { getTool, tools, type ToolContext, type ToolDefinition } from "./tools"

export const MCP_PROTOCOL_VERSION = "2025-06-18"
export const MCP_SERVER_NAME = "aire-assistant"
export const MCP_SERVER_VERSION = "0.1.0"

export interface JsonRpcRequest {
  jsonrpc: "2.0"
  id?: string | number | null
  method: string
  params?: unknown
}

export interface JsonRpcSuccess {
  jsonrpc: "2.0"
  id: string | number | null
  result: unknown
}

export interface JsonRpcError {
  jsonrpc: "2.0"
  id: string | number | null
  error: {
    code: number
    message: string
    data?: unknown
  }
}

export type JsonRpcResponse = JsonRpcSuccess | JsonRpcError

export const JSONRPC_CODES = {
  parseError: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internalError: -32603,
} as const

function ok(id: string | number | null, result: unknown): JsonRpcSuccess {
  return { jsonrpc: "2.0", id, result }
}

function err(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcError {
  return { jsonrpc: "2.0", id, error: { code, message, data } }
}

function describeTool(tool: ToolDefinition) {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }
}

export async function handleRpc(
  request: JsonRpcRequest,
  ctx: ToolContext,
): Promise<JsonRpcResponse> {
  const id = request.id ?? null

  if (request.jsonrpc !== "2.0" || typeof request.method !== "string") {
    return err(id, JSONRPC_CODES.invalidRequest, "Invalid JSON-RPC 2.0 request")
  }

  switch (request.method) {
    case "initialize":
      return ok(id, {
        protocolVersion: MCP_PROTOCOL_VERSION,
        serverInfo: {
          name: MCP_SERVER_NAME,
          version: MCP_SERVER_VERSION,
        },
        capabilities: {
          tools: { listChanged: false },
        },
      })

    case "tools/list":
      return ok(id, { tools: tools.map(describeTool) })

    case "tools/call": {
      const params = request.params as
        | { name?: string; arguments?: unknown }
        | undefined
      if (!params || typeof params.name !== "string") {
        return err(
          id,
          JSONRPC_CODES.invalidParams,
          "tools/call requires { name, arguments }",
        )
      }
      const tool = getTool(params.name)
      if (!tool) {
        return err(
          id,
          JSONRPC_CODES.methodNotFound,
          `Unknown tool: ${params.name}`,
        )
      }
      try {
        const input = tool.zodSchema.parse(params.arguments ?? {})
        const data = await (
          tool as ToolDefinition<unknown>
        ).handler(input, ctx)
        return ok(id, {
          content: [
            {
              type: "text",
              text: typeof data === "string" ? data : JSON.stringify(data),
            },
          ],
          isError: false,
          structuredContent: data,
        })
      } catch (e: unknown) {
        if (e instanceof ZodError) {
          return err(
            id,
            JSONRPC_CODES.invalidParams,
            "Input validation failed",
            e.issues,
          )
        }
        const message =
          e instanceof Error ? e.message : "Tool handler threw"
        return err(id, JSONRPC_CODES.internalError, message)
      }
    }

    case "ping":
      return ok(id, {})

    default:
      return err(
        id,
        JSONRPC_CODES.methodNotFound,
        `Method not found: ${request.method}`,
      )
  }
}
