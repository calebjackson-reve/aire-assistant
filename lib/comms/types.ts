export interface InboundMessage {
  externalId: string
  threadId?: string
  channel: "email" | "sms" | "call"
  from: string
  to: string
  subject?: string
  bodyPreview: string
  sentAt: Date
  metadata?: Record<string, unknown>
}

export interface UnansweredMessage {
  id: string
  channel: "email" | "sms" | "call"
  from: string
  subject?: string
  bodyPreview: string
  sentAt: Date
  hoursUnanswered: number
  contactName?: string
  contactId?: string
  urgency: "low" | "medium" | "high" | "critical"
}

export interface CommsScanResult {
  scannedAt: Date
  newInbound: number
  newOutbound: number
  unansweredCount: number
  missedCallCount: number
  unanswered: UnansweredMessage[]
}

export function classifyUrgency(hoursUnanswered: number, channel: string): UnansweredMessage["urgency"] {
  if (channel === "call") {
    if (hoursUnanswered > 4) return "critical"
    if (hoursUnanswered > 1) return "high"
    return "medium"
  }
  if (hoursUnanswered > 48) return "critical"
  if (hoursUnanswered > 24) return "high"
  if (hoursUnanswered > 8) return "medium"
  return "low"
}
