# GWS Calendar + Drive Integration — Research

## What Exists Today

### Deadline System
- **Model:** `Deadline` in `prisma/schema.prisma:196` — fields: id, userId, transactionId, name, dueDate, alertSent, completedAt, notes
- **No `calendarEventId` field** — schema needs one new optional field for idempotency
- **Create path:** `app/api/transactions/[id]/deadlines/route.ts:124` — POST creates deadline with `prisma.deadline.create()`. No side effects. **Hook Calendar sync here.**
- **Complete path:** `route.ts:105` — `action: "complete"` → `onDeadlineCompleted()`. Delete Calendar event here.
- **Reminder cron:** `lib/tc/notifications.ts:179` — fires at 7/3/1/0 days. No Calendar write needed here.

### Document System
- **Model:** `Document` in `schema.prisma:216` — fields: fileUrl, type, category, transactionId. **No `driveFileId` field.**
- **Auto-filer:** `lib/document-autofiler.ts` — matches docs to transactions by address/MLS/parties. Returns confidence score. Does not write externally.
- **Upload route:** `app/api/documents/upload/route.ts` — Blob → classifier → autofiler. **Hook Drive upload here after match.**

### Google Auth
- `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` already in `.env.local` (used by gmail-scanner)
- GWS CLI auth: `gws auth login` (one-time browser OAuth) OR service account via `GOOGLE_APPLICATION_CREDENTIALS`
- **One-time setup required:** Caleb runs `gws auth login` in terminal before first use

### GWS Skills Available (from install)
- `gws-calendar` — full Calendar v3 API
- `gws-calendar-insert` — create event helper
- `gws-drive` — full Drive v3 API
- `gws-drive-upload` — upload with metadata helper
- `recipe-log-deal-update` — log update to Google Sheet
- `recipe-organize-drive-folder` — structure Drive folders

---

## What Changes

### 1. Schema — 3 new optional nullable fields (zero breaking risk)
```prisma
model Deadline {
  googleCalendarEventId  String?
}
model Document {
  driveFileId      String?
  driveFolderPath  String?
}
```

### 2. New: `lib/integrations/gws-calendar.ts`
- `createCalendarEvent(deadline, propertyAddress, userEmail)` → `gws calendar events insert` → returns eventId
- `deleteCalendarEvent(eventId)` → `gws calendar events delete`
- `updateCalendarEvent(eventId, deadline)` → `gws calendar events patch`
- All wrapped in try/catch — Calendar failure never blocks deadline CRUD

### 3. New: `lib/integrations/gws-drive.ts`
- `ensureTransactionFolder(propertyAddress, transactionId)` → create/find `AIRE Transactions/{address}-{txId}/`
- `uploadDocumentToDrive(fileUrl, docName, docType, folderPath)` → fetch from Blob → `gws drive +upload` → returns fileId
- `getTransactionFolderUrl(propertyAddress)` → returns shareable link

### 4. Deadline route hooks
- Line 124 after `prisma.deadline.create()` → call `createCalendarEvent()`, store eventId
- Line 105 after deadline.update (complete) → call `deleteCalendarEvent(eventId)`

### 5. Document upload hook
- After Blob upload + autofiler match → call `uploadDocumentToDrive()`, store driveFileId on Document

---

## What Could Break

| Risk | Fix |
|------|-----|
| GWS not authenticated | Try/catch on all CLI calls; never block primary operation |
| `gws` binary not on PATH in Next.js server | Use full path from `which gws`; check on startup |
| Drive folder name collision (same address, 2 transactions) | Append transactionId suffix to folder name |
| Blob URL expiry before Drive fetch | Fetch file buffer immediately at upload time, not lazily |
| Schema migration on production Neon | 3 nullable fields — zero risk, no data loss |

---

## Schema Fields Used

| Model | Field | New? | Purpose |
|-------|-------|------|---------|
| Deadline | id, name, dueDate, userId, transactionId | existing | Calendar event payload |
| Deadline | googleCalendarEventId | NEW | Update/delete Calendar event |
| Transaction | propertyAddress, closingDate | existing | Folder name + event title |
| Document | fileUrl, name, type, transactionId | existing | Drive upload source |
| Document | driveFileId, driveFolderPath | NEW | Drive reference |
| User | email | existing | Calendar owned by user's Google account |

---

## Build Sequence

1. `npx prisma migrate dev --name add_gws_fields` — add 3 nullable fields
2. Build `lib/integrations/gws-calendar.ts`
3. Build `lib/integrations/gws-drive.ts`
4. Hook calendar into `deadlines/route.ts` (create + complete)
5. Hook drive into `documents/upload/route.ts`
6. One-time: `gws auth login` in terminal
7. Test: create deadline → verify GCal event appears in Caleb's calendar
8. Test: upload doc → verify Drive folder created at `AIRE Transactions/`
