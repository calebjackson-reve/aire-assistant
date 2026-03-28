# AIRE Database Schema

All data lives in Neon PostgreSQL, managed via Prisma ORM. This is the single source
of truth for all 7 AIRE agents.

---

## Core Tables

### Users & Agents

```prisma
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  name          String
  licenseNumber String?  // LREC license number
  brokerage     String?
  phone         String?
  role          UserRole @default(AGENT)
  stripeCustomerId    String?
  stripeSubscriptionId String?
  subscriptionStatus  SubscriptionStatus @default(TRIAL)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  transactions  Transaction[]
  voiceCommands VoiceCommand[]
  emailScans    EmailScanLog[]
  contentItems  ContentItem[]
}

enum UserRole {
  AGENT
  BROKER
  ADMIN
}

enum SubscriptionStatus {
  TRIAL
  ACTIVE
  PAST_DUE
  CANCELLED
}
```

### Transactions

```prisma
model Transaction {
  id                String   @id @default(cuid())
  userId            String
  user              User     @relation(fields: [userId], references: [id])

  // Property
  propertyAddress   String
  propertyCity      String   @default("Baton Rouge")
  propertyParish    String   @default("East Baton Rouge")
  propertyZip       String
  mlsNumber         String?
  listPrice         Decimal?
  salePrice         Decimal?

  // Louisiana-Specific
  floodZone         String?  // AE, X, AH, etc.
  mineralRights     MineralRightsStatus @default(INCLUDED)
  propertyType      PropertyType

  // Deal Status
  status            TransactionStatus @default(PENDING)
  side              TransactionSide   // LISTING or BUYING

  // Key Dates
  contractDate      DateTime?
  inspectionDeadline DateTime?
  appraisalDeadline DateTime?
  financingDeadline DateTime?
  closingDate       DateTime?

  // Parties
  clientName        String
  clientEmail       String?
  clientPhone       String?
  otherAgentName    String?
  otherAgentEmail   String?
  titleCompany      String?
  lenderName        String?
  lenderContact     String?

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  documents         Document[]
  voiceCommands     VoiceCommand[]
  complianceChecks  ComplianceCheck[]
  emailMatches      EmailScanLog[]
}

enum TransactionStatus {
  PENDING
  ACTIVE
  UNDER_CONTRACT
  INSPECTION
  APPRAISAL
  CLEAR_TO_CLOSE
  CLOSED
  CANCELLED
  EXPIRED
}

enum TransactionSide {
  LISTING
  BUYING
}

enum MineralRightsStatus {
  INCLUDED
  EXCLUDED
  PARTIAL
  UNKNOWN
}

enum PropertyType {
  SINGLE_FAMILY
  CONDO
  TOWNHOUSE
  MULTI_FAMILY
  LAND
  COMMERCIAL
}
```

### Documents & Contracts

```prisma
model Document {
  id              String   @id @default(cuid())
  transactionId   String
  transaction     Transaction @relation(fields: [transactionId], references: [id])

  documentType    DocumentType
  fileName        String
  fileUrl         String
  status          DocumentStatus @default(PENDING)
  dotloopId       String?  // Dotloop document ID for tracking
  signatureStatus SignatureStatus @default(NOT_REQUIRED)

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

enum DocumentType {
  PURCHASE_AGREEMENT
  ADDENDUM
  AMENDMENT
  DISCLOSURE
  INSPECTION_REPORT
  APPRAISAL
  TITLE_COMMITMENT
  CLOSING_DISCLOSURE
  MINERAL_RIGHTS_EXCLUSION
  FLOOD_CERTIFICATION
  LEAD_PAINT_DISCLOSURE
  OTHER
}

enum DocumentStatus {
  PENDING
  UPLOADED
  SENT_FOR_SIGNATURE
  SIGNED
  REJECTED
  EXPIRED
}

enum SignatureStatus {
  NOT_REQUIRED
  AWAITING_SIGNATURE
  PARTIALLY_SIGNED
  FULLY_SIGNED
}
```

### Voice Commands

```prisma
model VoiceCommand {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  transactionId   String?
  transaction     Transaction? @relation(fields: [transactionId], references: [id])

  rawTranscript   String   // Exact text from Web Speech API
  classifiedIntent String  // Intent category from Claude
  confidence      Float    // Classification confidence 0-1
  entities        Json     // Extracted entities (names, dates, addresses)
  actionTaken     String?  // What was executed
  status          CommandStatus @default(PROCESSING)
  processingTimeMs Int?    // Track the 8-second target
  errorMessage    String?

  createdAt       DateTime @default(now())
}

enum CommandStatus {
  PROCESSING
  AWAITING_APPROVAL
  APPROVED
  EXECUTED
  FAILED
  CANCELLED
}
```

### Email Scan Log

```prisma
model EmailScanLog {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  transactionId   String?
  transaction     Transaction? @relation(fields: [transactionId], references: [id])

  gmailMessageId  String   @unique
  from            String
  subject         String
  classification  EmailClassification
  urgency         UrgencyLevel
  extractedActions Json    // Array of action items
  suggestedResponse String?
  reviewStatus    ReviewStatus @default(PENDING)

  scannedAt       DateTime @default(now())
}

enum EmailClassification {
  CLIENT_QUESTION
  LENDER_UPDATE
  TITLE_UPDATE
  INSPECTION_REPORT
  CONTRACT_ACTION
  MARKETING_LEAD
  INFORMATIONAL
}

enum UrgencyLevel {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum ReviewStatus {
  PENDING
  REVIEWED
  ACTION_TAKEN
  DISMISSED
}
```

### Compliance Checks

```prisma
model ComplianceCheck {
  id              String   @id @default(cuid())
  transactionId   String
  transaction     Transaction @relation(fields: [transactionId], references: [id])

  checkType       String
  status          ComplianceStatus
  description     String
  requiredAction  String?
  deadline        DateTime?
  lrecReference   String   // Specific LREC rule citation
  resolvedAt      DateTime?
  resolvedBy      String?

  createdAt       DateTime @default(now())
}

enum ComplianceStatus {
  COMPLIANT
  WARNING
  VIOLATION
  RESOLVED
}
```

### Content Items

```prisma
model ContentItem {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id])

  contentType     ContentType
  title           String
  body            String   @db.Text
  platform        String?  // instagram, facebook, blog, email
  status          ContentStatus @default(DRAFT)
  scheduledFor    DateTime?
  publishedAt     DateTime?
  mlsNumber       String?  // If tied to a listing

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

enum ContentType {
  LISTING_DESCRIPTION
  SOCIAL_POST
  MARKET_REPORT
  EMAIL_NEWSLETTER
  BLOG_POST
}

enum ContentStatus {
  DRAFT
  PENDING_APPROVAL
  APPROVED
  PUBLISHED
  ARCHIVED
}
```

---

## Key Relationships

- A **User** has many Transactions, VoiceCommands, EmailScans, and ContentItems
- A **Transaction** has many Documents, VoiceCommands, ComplianceChecks, and matched Emails
- **VoiceCommands** optionally link to a Transaction (some are general queries)
- **EmailScanLog** entries optionally link to a Transaction (some emails don't match any deal)
- **ComplianceChecks** always link to a Transaction (compliance is transaction-scoped)

## Indexes to Create

Prioritize these for query performance:
- `Transaction.userId` + `Transaction.status` (dashboard queries)
- `Transaction.closingDate` (deadline queries)
- `VoiceCommand.userId` + `VoiceCommand.createdAt` (recent commands)
- `EmailScanLog.gmailMessageId` (dedup check)
- `EmailScanLog.userId` + `EmailScanLog.reviewStatus` (unreviewed emails)
- `ComplianceCheck.transactionId` + `ComplianceCheck.status` (active violations)
