# E-Signature Competitive Intelligence
*Agent 4 Research — 2026-04-04*

## Platform Analysis

### DocuSign (Market Leader)
**Source:** https://www.docusign.com/features

**What Makes Them Best-in-Class:**
1. **Signing order** — Sequential, parallel, or hybrid per envelope. Agent controls exact flow.
2. **Mobile-first UX** — Responsive signing, pinch-to-zoom on documents, auto-scroll between fields.
3. **Guided signing** — Yellow "Sign Here" tags that pulse to draw attention. Progress bar: "Field 2 of 7".
4. **Declined signatures** — Required reason, notifies all parties, creator can void or reassign.
5. **Audit certificate** — Full page: envelope ID, document hash, signer IP, user agent, timestamp (ISO 8601), signature method.
6. **Templates** — Pre-place fields on reusable templates. Map to roles (Buyer, Seller, Agent).
7. **Bulk send** — Send same document to many signers (useful for disclosures).
8. **In-person signing** — Tablet mode where agent hands device to client.
9. **Payment collection** — Collect payments during signing flow (earnest money).
10. **API-first** — RESTful API, webhooks for all events, SDKs in every language.

**What We Don't Have (Gap List):**
- Sequential signing order ← **CRITICAL**
- Decline to sign flow ← **CRITICAL**
- Initials field type ← **HIGH**
- Signing progress indicator ← **HIGH**
- Auto-scroll to next field ← **HIGH**
- Template system (pre-placed fields for LREC forms) ← **MEDIUM**
- In-person signing mode ← **MEDIUM**
- Bulk send ← **LOW**
- Payment collection ← **LOW (future)**

---

### DotLoop (Real Estate Focused)
**Source:** https://www.dotloop.com/features/

**Real Estate-Specific Features:**
1. **Transaction rooms** — Everything for one deal in one place: documents, tasks, contacts, activity.
2. **MLS integration** — Auto-populate transaction details from MLS listing data.
3. **Document template library** — Pre-loaded with state-specific forms (they have LREC forms).
4. **Agent-client sharing** — Clients get a portal to view/sign docs without creating a full account.
5. **Compliance workflow** — Broker reviews and approves documents before they're finalized.
6. **Activity feed** — Every action logged and visible: who opened, viewed, signed, commented.
7. **Loopkit** — Pre-built transaction templates with all required docs for a deal type.

**What We Should Steal:**
- "Transaction room" concept → We already have this (transaction detail with tabs) ✓
- MLS auto-population → Would need MLS API integration
- Pre-loaded LREC form templates → **HIGH PRIORITY** — Auto-place fields by form type
- Activity feed → We have audit trail for AirSign, could expand to TC

---

### Authentisign
**Source:** https://www.authentisign.com/

**Differentiators:**
- Integrated directly into MLS platforms (GBRAR uses it)
- Simple UI aimed at agents who aren't tech-savvy
- Auto-detects signature/initial/date fields from PDF markup
- Cheaper than DocuSign for real estate use

**Takeaway:** Simplicity is their edge. Our UX should be simpler than DocuSign for the specific real estate use case.

---

## Open Source Findings

### Signature Capture Libraries

| Library | Stars | License | Last Updated | What We'd Use It For |
|---------|-------|---------|-------------|---------------------|
| **signature_pad** | 10K+ | MIT | Active | Better signature smoothing algorithm (Bezier curves). We could replace our canvas code. |
| **react-signature-canvas** | 2K+ | MIT | Active | React wrapper around signature_pad. Drop-in replacement for our SignatureModal canvas. |
| **perfect-freehand** | 4K+ | MIT | Active | Pressure-sensitive, natural-looking strokes. Would make typed+drawn signatures look professional. |

**Source:** GitHub search "signature pad javascript", "react signature canvas"

### PDF Libraries

| Library | Stars | License | What It Does |
|---------|-------|---------|-------------|
| **pdf-lib** | 5K+ | MIT | We already use this ✓ — PDF creation, form filling, signature embedding |
| **react-pdf** | 8K+ | MIT | PDF viewer component for React. Better than our current viewer. |
| **pdfjs-dist** | 45K+ | Apache 2.0 | Mozilla's PDF renderer. Powers react-pdf. |
| **pdf-annotate.js** | 500+ | MIT | PDF annotation overlay. Could enhance field placement UX. |

### Audit Trail / Digital Signature

| Library | Stars | License | What It Does |
|---------|-------|---------|-------------|
| **node-forge** | 5K+ | BSD | Digital signatures, certificate generation. Could add cryptographic signing. |
| **pkijs** | 1K+ | BSD | PKI.js for X.509 certificates. Overkill for now but future-proofing. |

---

## Priority Feature Ranking

Ranked by: (impact on user experience) × (ease of integration)

| Rank | Feature | Impact | Effort | What To Do |
|------|---------|--------|--------|-----------|
| 1 | Sequential signing order | 10 | 3 | Add signingOrder field, gate delivery by order |
| 2 | Decline to sign | 9 | 2 | Decline button + reason + notifications |
| 3 | Initials field type | 9 | 3 | New field type, smaller capture, auto-generate |
| 4 | Progress indicator | 8 | 1 | "Field 2 of 5" banner on signing page |
| 5 | Auto-scroll to next field | 8 | 2 | scrollIntoView after field completion |
| 6 | LREC form field templates | 8 | 4 | Pre-map field positions for each LREC form |
| 7 | react-signature-canvas upgrade | 6 | 2 | Drop-in replacement with better smoothing |
| 8 | react-pdf viewer | 7 | 3 | Better PDF rendering on signing page |
| 9 | Signing link expiration | 5 | 2 | 7-day default, reminder emails |
| 10 | In-person signing mode | 6 | 4 | Tablet-optimized mode, pass-device flow |
