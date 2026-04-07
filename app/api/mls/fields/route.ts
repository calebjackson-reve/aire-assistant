import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { PARAGON_FIELDS, getFieldsBySection } from "@/lib/paragon/field-definitions"

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  return NextResponse.json({
    fields: PARAGON_FIELDS,
    sections: {
      location: getFieldsBySection("location"),
      property_details: getFieldsBySection("property_details"),
      features: getFieldsBySection("features"),
      agent_info: getFieldsBySection("agent_info"),
    },
    totalRequired: PARAGON_FIELDS.filter(f => f.required).length,
  })
}
