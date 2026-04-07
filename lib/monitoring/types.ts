export interface AgentStatus {
  id: string
  name: string
  phase: number
  totalPhases: number
  status: "complete" | "building" | "pending" | "error"
  lastActivity?: string
  lastActivityAt?: Date
}

export interface MonitoringSnapshot {
  timestamp: Date
  agents: AgentStatus[]
  overallProgress: number
  errors: ActivityEntry[]
  recentActivity: ActivityEntry[]
  metrics: MetricEntry[]
}

export interface ActivityEntry {
  id: string
  agent: string
  action: string
  phase?: number
  message: string
  severity: "info" | "warn" | "error" | "critical"
  createdAt: Date
}

export interface MetricEntry {
  name: string
  value: number
  agent?: string
  createdAt: Date
}

export const AGENTS = [
  { id: "agent-1", name: "Infrastructure & Data Merge", totalPhases: 10 },
  { id: "agent-2", name: "Transaction Coordinator", totalPhases: 10 },
  { id: "agent-3", name: "Document Intelligence", totalPhases: 13 },
  { id: "agent-4", name: "Monitoring Dashboard", totalPhases: 13 },
] as const
