import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { listVisibleTemplates, createTemplate } from "@/lib/airsign/v2/templates"
import type { TemplateKind, TemplateScope } from "@prisma/client"

export async function GET(req: Request) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const url = new URL(req.url)
  const kind = (url.searchParams.get("kind") as TemplateKind | null) ?? undefined
  const folder = url.searchParams.get("folder") ?? undefined
  const search = url.searchParams.get("q") ?? undefined

  const templates = await listVisibleTemplates(user.id, { kind, folder, search })
  return NextResponse.json({ templates })
}

export async function POST(req: Request) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const body = await req.json()
  if (!body.name || !body.scope || !body.kind) {
    return NextResponse.json({ error: "name, scope, kind required" }, { status: 400 })
  }
  try {
    const tmpl = await createTemplate(user.id, {
      scope: body.scope as TemplateScope,
      kind: body.kind as TemplateKind,
      name: body.name,
      description: body.description,
      folder: body.folder,
      tags: body.tags,
      brokerageId: body.brokerageId,
      officeId: body.officeId,
      formCode: body.formCode,
      pdfBlobUrl: body.pdfBlobUrl,
      pageCount: body.pageCount,
      fieldLayout: body.fieldLayout,
      dataBindings: body.dataBindings,
      clauseBody: body.clauseBody,
      taskList: body.taskList,
    })
    return NextResponse.json({ template: tmpl })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown" }, { status: 400 })
  }
}
