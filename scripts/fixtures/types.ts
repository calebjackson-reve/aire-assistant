/**
 * AIRE Agent Test Harness — Type Definitions
 * Shared types for fixtures, agent inputs/outputs, and test validation.
 */

// ── Transaction Types ──

export interface FixtureTransaction {
  id: string;
  userId: string;
  propertyAddress: string;
  propertyCity: string;
  propertyState: string;
  propertyZip: string;
  propertyType: string;
  mlsNumber: string;
  listPrice: number;
  offerPrice: number | null;
  acceptedPrice: number | null;
  status: "DRAFT" | "ACTIVE" | "PENDING_INSPECTION" | "PENDING_APPRAISAL" | "PENDING_FINANCING" | "CLOSING" | "CLOSED" | "CANCELLED";
  buyerName: string | null;
  buyerEmail: string | null;
  buyerPhone: string | null;
  sellerName: string | null;
  sellerEmail: string | null;
  sellerPhone: string | null;
  lenderName: string | null;
  titleCompany: string | null;
  contractDate: Date | null;
  inspectionDeadline: Date | null;
  appraisalDeadline: Date | null;
  financingDeadline: Date | null;
  closingDate: Date | null;
  dotloopLoopId: string | null;
  createdAt: Date;
  updatedAt: Date;
  _la: {
    parish: string;
    floodZone: string;
    mineralRightsExcluded: boolean;
  };
}

// ── Email Types ──

export interface FixtureEmail {
  id: string;
  fromEmail: string;
  fromName: string;
  subject: string;
  bodySnippet: string;
  receivedAt: Date;
  labels: string[];
  threadId: string;
  _matchesTransaction: string;
}

// ── Agent Output Types ──

export interface VoiceOutput {
  intent: string;
  entities: Record<string, string>;
  action: string;
  response: string;
  confidence: number;
}

export interface EmailOutput {
  classification: string;
  priority: "urgent" | "high" | "normal" | "low";
  actionItems: string[];
  matchedTransaction: string | null;
  suggestedResponse?: string;
}

export interface MorningBriefOutput {
  date: string;
  urgentItems: { label: string; detail: string }[];
  deadlines: { name: string; date: string; transaction: string }[];
  summary: string;
}

export interface ComplianceOutput {
  transactionId: string;
  issues: { severity: string; message: string }[];
  score: number;
  missingDocuments: string[];
}

// ── Test Harness Types ──

export interface TestResult {
  agent: string;
  passed: boolean;
  time: number;
}
