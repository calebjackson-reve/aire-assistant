# AirSign E-Signature UX Deep Dive

*Updated 2026-04-04 -- Full rewrite with codebase audit*
*Cross-referenced with: `SigningFlow.tsx`, `SignatureModal.tsx`, `PDFViewer.tsx`, `FieldOverlay.tsx`, `seal-pdf.ts`, sign/send API routes, Prisma schema*

Every recommendation includes what AirSign has today, what the best platforms do, and specific implementation guidance with effort estimates (1 = afternoon, 5 = multi-day sprint).

---

## 1. Mobile Signing UX

### What AirSign Has Today
- Touch event handlers (onTouchStart/Move/End) on SignatureModal canvas
- DPI-corrected coordinate mapping via `devicePixelRatio`
- Sticky bottom action bar (`fixed bottom-0`)
- Canvas dimensions: 500x120 (signature), 200x80 (initials) -- fixed pixel values, not responsive
- No pinch-to-zoom on PDF
- No landscape detection or prompt
- PDF rendered at scale=1.3 with `maxWidth: 100%` CSS

### What DocuSign Does
- **Responsive signing ceremony**: On mobile, the entire document is replaced with a "guided view" that shows one field at a time, full-width, with the relevant document excerpt visible behind it. Signers never need to pinch-zoom to find fields.
- **Signature pad**: Full-viewport-width modal, minimum 320px wide, ~150px tall. On phones, they force landscape orientation for draw mode via a prompt overlay ("Rotate your phone for a better signing experience") with a rotation animation icon.
- **Auto-advance**: After completing a field, the view automatically scrolls (with a 300ms smooth animation) to the next field. The field pulses with a yellow highlight before the signer interacts.
- **Pinch-to-zoom**: Enabled on the document preview but disabled within the signature capture modal to prevent accidental zoom while drawing.
- **Bottom sheet pattern**: On mobile, text input fields slide up as a bottom sheet rather than inline editing, keeping the keyboard from obscuring the field context.
- **Touch target sizing**: All interactive elements are minimum 48x48px (exceeds WCAG's 44px minimum). The "Next" button is a large floating action button (56px diameter).

### What HelloSign (Dropbox Sign) Does
- **Single-page simplification**: On mobile, they strip the PDF viewer entirely for simple documents and present fields as a vertical form. The document is available via a "View Document" expandable section.
- **Signature capture**: Full-screen modal with a clear instruction "Sign in the box below." Canvas fills the full screen width minus 16px padding on each side. Height is 40% of viewport height on mobile.
- **Haptic feedback**: On supported devices, a subtle vibration on successful field completion.

### What PandaDoc Does
- **Step-by-step wizard**: Mobile signers see a card-based UI, one field per card, swipeable left/right. Progress dots at the top. Document preview is a thumbnail in the corner.
- **Smart field sizing**: Signature fields expand to 100% width on screens under 640px. Text fields get 16px font size minimum to prevent iOS auto-zoom.

### AirSign Implementation Recommendations

| # | Recommendation | Effort | Priority |
|---|---------------|--------|----------|
| 1A | **Responsive signature canvas**: Replace fixed 500x120 with `min(100vw - 48px, 500px)` width and `max(120px, 15vh)` height. On screens < 640px, canvas should be full-width. | 1 | HIGH |
| 1B | **Landscape prompt for draw mode**: Detect `window.innerWidth < 640 && tab === "draw"`, show a rotating-phone icon with "Rotate for better signing" text. Use `screen.orientation.lock('landscape')` where supported (Chrome Android). | 2 | HIGH |
| 1C | **Auto-scroll to next field**: After `handleFieldClick` completes a field, call `document.getElementById(nextFieldId)?.scrollIntoView({ behavior: 'smooth', block: 'center' })` with a 400ms delay. The `goToNextField` function exists but doesn't scroll. | 1 | HIGH |
| 1D | **Pinch-to-zoom on PDF**: Wrap the PDFViewer in a container with `touch-action: pinch-zoom` CSS. Use CSS `transform: scale()` controlled by touch gesture state. Disable during signature capture by setting `touch-action: none` on the modal. | 3 | MEDIUM |
| 1E | **iOS input zoom prevention**: Add `font-size: 16px` minimum on all `<input>` elements in the signing flow. iOS Safari auto-zooms on inputs with font-size < 16px. Currently the text input in SigningFlow uses `text-sm` (14px). | 1 | HIGH |
| 1F | **Bottom sheet for text fields**: On mobile, replace the inline text input with a slide-up bottom sheet (positioned `fixed bottom-0` with a backdrop). This keeps the field visible above the keyboard. | 2 | MEDIUM |
| 1G | **Viewport height fix**: Use `100dvh` instead of `100vh` for the signing modal to account for mobile browser chrome (address bar, toolbar). Safari's `100vh` includes the hidden toolbar area. | 1 | HIGH |

### Code Change: Responsive Canvas (1A)

In `SignatureModal.tsx`, replace the fixed dimensions:
```tsx
// Before
const canvasWidth = isInitials ? 200 : 500
const canvasHeight = isInitials ? 80 : 120

// After
const [viewportWidth, setViewportWidth] = useState(500)
useEffect(() => {
  const update = () => setViewportWidth(window.innerWidth)
  update()
  window.addEventListener('resize', update)
  return () => window.removeEventListener('resize', update)
}, [])

const canvasWidth = isInitials
  ? Math.min(viewportWidth - 48, 200)
  : Math.min(viewportWidth - 48, 500)
const canvasHeight = isInitials
  ? Math.max(80, Math.round(window.innerHeight * 0.1))
  : Math.max(120, Math.round(window.innerHeight * 0.15))
```

---

## 2. Guided Signing Flow

### What AirSign Has Today
- Progress bar showing `completedRequired / totalRequired`
- "Next" button that navigates to the next unfilled required field's page and triggers `handleFieldClick`
- Fields are sorted by page then yPercent
- No auto-scroll within a page
- No field highlighting/pulsing animation
- No step-by-step indicator ("Field 2 of 5")

### What DocuSign Does
- **Yellow tag system**: Each unsigned field has a bright yellow tag with the field action ("Sign", "Initial", "Date"). The current/next field has a larger, animated tag with an arrow pointing to it.
- **"Start" button**: Before showing any fields, there's a prominent "Start" button. Clicking it scrolls to field 1 and begins the guided flow.
- **Auto-scroll with context**: When scrolling to the next field, DocuSign shows ~100px of document above the field so the signer can read the clause they're signing next to. It doesn't just center the field -- it shows context above.
- **Field counter**: "1 of 7 fields" in the top bar, updating as each field is completed.
- **Completion celebration**: After the last field, a brief confetti/checkmark animation before the "Finish" button appears.
- **Required field validation**: If a signer tries to skip ahead to "Finish", the flow scrolls back to the first incomplete required field with a red highlight and shake animation.

### What HelloSign Does
- **Sidebar checklist**: On desktop, a left sidebar shows all fields as a checklist. Completed fields get a green checkmark. Clicking any item scrolls to that field.
- **Floating "Next" button**: A sticky button at the bottom that says "Next: Sign here" (or whatever the next field type is). It follows the signer as they scroll.
- **Field glow**: The active field has a blue glow (box-shadow: 0 0 0 3px rgba(59,130,246,0.5)) that pulses twice when first scrolled to.

### What PandaDoc Does
- **Progress percentage**: Shows "60% complete" rather than "3 of 5 fields."
- **Smart field grouping**: If multiple fields are on the same page area, they're grouped as one "step." The signer fills them all before advancing.
- **Undo capability**: A small "Undo" link next to completed fields lets signers re-do a signature without starting over.

### AirSign Implementation Recommendations

| # | Recommendation | Effort | Priority |
|---|---------------|--------|----------|
| 2A | **Field counter in progress bar**: Replace raw `3/7 fields` with `"Field 3 of 7 -- Sign here"` that describes the next action. Trivial text change in the progress section. | 1 | HIGH |
| 2B | **Auto-scroll with context offset**: After field completion, scroll to next field with a 100px offset above: `element.scrollIntoView({ block: 'center' })` then `window.scrollBy(0, -100)`. Add a 300ms delay after the page change settles. | 1 | HIGH |
| 2C | **Field pulse animation**: Add a CSS keyframe animation to the active/next field overlay. Use `@keyframes pulse-field { 0%,100% { box-shadow: 0 0 0 0 rgba(154,171,126,0.4) } 50% { box-shadow: 0 0 0 8px rgba(154,171,126,0) } }` on the field with `selectedFieldId`. | 1 | HIGH |
| 2D | **"Start Signing" entry screen**: Before showing fields, show a brief intro card with document name, sender name, field count, and a large "Start Signing" button. This sets expectations and gives the signer a moment to orient. | 2 | MEDIUM |
| 2E | **Validation shake on submit attempt**: If the signer clicks "Sign Document" with missing fields, animate the first missing field with a CSS shake: `@keyframes shake { 0%,100% { transform: translateX(0) } 25% { transform: translateX(-4px) } 75% { transform: translateX(4px) } }` and scroll to it. | 1 | MEDIUM |
| 2F | **Completion animation**: After successful signing, show a brief checkmark animation (scale from 0 to 1 with a spring easing) before the "Document Signed" confirmation. Use `@keyframes pop { 0% { transform: scale(0) } 80% { transform: scale(1.1) } 100% { transform: scale(1) } }`. | 1 | LOW |
| 2G | **Undo last signature**: Add a small "Redo" link on completed signature/initial fields that clears the value and reopens the capture modal. Store the previous value so it's non-destructive. | 2 | MEDIUM |

### Code Change: Auto-Scroll (2B)

In `SigningFlow.tsx`, modify `goToNextField`:
```tsx
function goToNextField() {
  if (!nextUnfilledField) return
  if (nextUnfilledField.page !== currentPage) {
    setCurrentPage(nextUnfilledField.page)
    // Wait for page render, then scroll
    setTimeout(() => {
      const el = document.getElementById(`field-${nextUnfilledField.id}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      handleFieldClick(nextUnfilledField.id)
    }, 500)
  } else {
    const el = document.getElementById(`field-${nextUnfilledField.id}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    handleFieldClick(nextUnfilledField.id)
  }
}
```
Also add `id={`field-${field.id}`}` to each FieldOverlay item.

---

## 3. Accessibility (WCAG 2.1 AA)

### What AirSign Has Today
- `focus:outline-none focus:ring-2 focus:ring-[#9aab7e]/30` on page nav buttons (partial focus indicators)
- No `aria-label` on field overlays
- No keyboard navigation between fields (Tab order)
- No `aria-live` region for progress updates
- No `role` attributes on the signature modal
- No `prefers-reduced-motion` handling
- The `animate-pulse` on the Next button runs indefinitely (motion concern)
- Type-to-sign exists as an accessible alternative to draw (good)
- Color contrast: `#e8e4d8` on `#1e2416` background = ~10:1 ratio (passes AAA)
- Field overlay colors use blue/purple/amber which may not meet 3:1 on dark backgrounds

### WCAG 2.1 AA Requirements for E-Signatures

**Source: WCAG 2.1 Guidelines (W3C), Section 508 of the Rehabilitation Act**

1. **1.1.1 Non-text Content**: Signature images must have text alternatives. The typed text value serves as the alt text.
2. **1.3.1 Info and Relationships**: Field groupings must be programmatically determinable. Use `fieldset`/`legend` or `role="group"` with `aria-label`.
3. **1.4.3 Contrast (Minimum)**: Text and interactive elements need 4.5:1 for normal text, 3:1 for large text. Field highlight borders against the PDF background (typically white) must meet 3:1.
4. **1.4.11 Non-text Contrast**: UI components (field borders, buttons, focus indicators) need 3:1 against adjacent colors.
5. **2.1.1 Keyboard**: All functionality must be keyboard-operable. The signature canvas must have a keyboard alternative (type-to-sign satisfies this).
6. **2.4.3 Focus Order**: Tab order must match the logical signing order (top-to-bottom, left-to-right on each page).
7. **2.4.7 Focus Visible**: Focus indicators must be clearly visible. Current `ring-[#9aab7e]/30` (30% opacity) is too faint.
8. **2.5.1 Pointer Gestures**: Multi-point gestures (pinch-to-zoom) must have single-pointer alternatives.
9. **3.3.1 Error Identification**: When required fields are missing, errors must identify the specific fields.
10. **4.1.2 Name, Role, Value**: All interactive components need accessible names and roles.

**Legal note (ESIGN Act, 15 U.S.C. 7001-7006)**: The ESIGN Act requires that consumers can access electronic records. If your signing platform isn't accessible, signed documents may be legally challenged on the grounds that the signer couldn't meaningfully review the document.

### AirSign Implementation Recommendations

| # | Recommendation | Effort | Priority |
|---|---------------|--------|----------|
| 3A | **aria-labels on all field overlays**: Add `aria-label="Sign here - required"`, `aria-label="Initial here"`, etc. to each field button in FieldOverlay. Add `role="button"` and `tabIndex={0}`. | 1 | CRITICAL |
| 3B | **Keyboard field navigation**: Add `onKeyDown` handler to fields: Enter/Space to activate, Tab to move to next field. Set `tabIndex` in signing order. | 2 | CRITICAL |
| 3C | **Fix focus indicator opacity**: Change `focus:ring-[#9aab7e]/30` to `focus-visible:ring-2 focus-visible:ring-[#9aab7e]` (full opacity). Use `focus-visible` instead of `focus` to avoid showing rings on mouse clicks. | 1 | CRITICAL |
| 3D | **aria-live progress region**: Wrap the progress bar in `<div role="status" aria-live="polite" aria-label="Signing progress: 3 of 7 fields complete">`. Screen readers will announce progress changes. | 1 | HIGH |
| 3E | **Dialog role on modals**: Add `role="dialog" aria-modal="true" aria-label="Signature capture"` to the SignatureModal outer div. Add `role="alertdialog"` to the confirm action modal. | 1 | HIGH |
| 3F | **Focus trap in modals**: When SignatureModal or confirm dialog opens, trap focus within it. On close, return focus to the triggering element. Use a simple focus-trap: query all focusable elements, on Tab at last element cycle to first. | 2 | HIGH |
| 3G | **prefers-reduced-motion**: Wrap all CSS animations in `@media (prefers-reduced-motion: no-preference)`. The `animate-pulse` on the Next button should stop for users who prefer reduced motion. In Tailwind: `motion-safe:animate-pulse`. | 1 | HIGH |
| 3H | **Error identification on submit**: When validation fails, list the specific missing fields by label and auto-focus the first one. Use `aria-describedby` to link error messages to fields. Currently the error says "Please complete 3 required field(s)" -- it should name them. | 2 | MEDIUM |
| 3I | **Skip to content link**: Add a visually-hidden "Skip to first field" link at the top of the signing page. Real estate documents can be 20+ pages; signers shouldn't have to Tab through the entire PDF. | 1 | MEDIUM |
| 3J | **Screen reader announcements for field completion**: After completing a field, use `aria-live="assertive"` to announce "Signature applied. 4 of 7 fields complete. Next: Initial on page 3." | 1 | MEDIUM |

### Code Change: Field Accessibility (3A + 3B)

In `FieldOverlay.tsx`, update each field element:
```tsx
<button
  id={`field-${field.id}`}
  role="button"
  tabIndex={0}
  aria-label={`${TYPE_LABELS[field.type]}${field.required ? ' - required' : ' - optional'}${field.filled ? ' - completed' : ''}`}
  onClick={() => onFieldClick?.(field.id)}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onFieldClick?.(field.id)
    }
  }}
  className={`absolute pointer-events-auto cursor-pointer border-2 rounded transition-all
    ${field.filled ? 'border-green-500 bg-green-500/10' : colors.border + ' ' + colors.bg}
    ${selectedFieldId === field.id ? 'ring-2 ring-offset-2 ring-[#9aab7e]' : ''}
    focus-visible:ring-2 focus-visible:ring-[#9aab7e] focus-visible:ring-offset-2`}
  style={{...}}
>
```

---

## 4. Decline/Void Flow

### What AirSign Has Today
- Decline button in the signing flow with confirmation dialog
- Decline records `declinedAt`, `declineReason`, `ipAddress`, `userAgent`
- Audit event logged with reason
- Decline reason is hardcoded to "Signer declined" -- no user input
- No notification to sender (no email sent on decline)
- No notification to other signers
- No void flow from the sender side
- Envelope status doesn't change when one signer declines (critical gap)

### What DocuSign Does
- **Decline flow for signer**:
  1. Signer clicks "Decline to Sign" (separate from "Other Actions" menu on mobile)
  2. A modal asks "Why are you declining?" with a required text area (minimum 1 character, not 10)
  3. Common reasons are offered as checkboxes: "I need to make changes", "I'm not the right signer", "I don't agree with the terms", "Other"
  4. After confirming, signer sees "You've declined to sign. [Sender name] has been notified."
  5. The sender gets an immediate email: "[Signer name] has declined to sign [Document]. Reason: [reason]"
  6. Other signers who haven't signed yet get an email: "Signing has been paused for [Document]"
  7. The envelope moves to "Declined" status (not voided -- the sender can still correct and resend)

- **Void flow for sender**:
  1. Sender clicks "Void" on an in-progress envelope
  2. Requires a void reason (text input)
  3. All signers get notified: "This document has been voided by [Sender]. Reason: [reason]"
  4. The signing links immediately stop working (return 410 Gone)
  5. Voided envelopes are kept in history with all audit events preserved

- **Sender recovery options after decline**:
  1. "Correct" -- edit the document and resend to all signers (resets completed signatures)
  2. "Replace signer" -- assign a new person to the declined signer's role
  3. "Void" -- cancel the entire envelope
  4. "Resend" -- send a new invitation to the same signer (for cases where they declined by mistake)

### AirSign Implementation Recommendations

| # | Recommendation | Effort | Priority |
|---|---------------|--------|----------|
| 4A | **Require decline reason input**: Replace the hardcoded "Signer declined" with a text area in the confirmation modal. Offer 3-4 common reasons as quick-select chips plus "Other" with free text. | 1 | HIGH |
| 4B | **Update envelope status on decline**: When a signer declines, set envelope status to `DECLINED` (add to enum). This prevents other signers from continuing to sign a disputed document. | 2 | HIGH |
| 4C | **Notify sender on decline**: Send email (via Resend) and create an in-app notification. Email template: "[Signer] declined to sign [Document]. Reason: [reason]. View envelope to take action." | 2 | HIGH |
| 4D | **Notify other signers on decline**: Send a brief email to all other signers: "Signing for [Document] has been paused. [Sender] will follow up with next steps." | 2 | MEDIUM |
| 4E | **Void envelope API**: Add `POST /api/airsign/envelopes/[id]/void` with auth, void reason, status update to VOIDED, and notification to all signers. The schema already has `voidedAt` and `voidReason` fields. | 2 | HIGH |
| 4F | **Sender recovery UI**: On envelope detail page, when status is DECLINED, show action buttons: "Resend to signer", "Replace signer", "Void envelope". Resend generates a new token for the same signer. | 3 | MEDIUM |
| 4G | **Add DECLINED to EnvelopeStatus enum**: Current enum likely has DRAFT, SENT, IN_PROGRESS, COMPLETED, VOIDED. Add DECLINED as a distinct state (different from voided because it's signer-initiated, not sender-initiated). | 1 | HIGH |

### Schema Change Needed

```prisma
enum EnvelopeStatus {
  DRAFT
  SENT
  IN_PROGRESS
  COMPLETED
  DECLINED    // <-- add: signer-initiated refusal
  VOIDED
  EXPIRED     // <-- add: auto-expired past expiresAt
}
```

---

## 5. Sequential vs Parallel Signing

### What AirSign Has Today
- `order` field on AirSignSigner (Int, default 1)
- No logic that gates signing by order -- all signers get links simultaneously when envelope is sent
- No routing logic after one signer completes to trigger the next

### What DocuSign Does
- **Routing order**: Each signer (called "recipient") has a `routingOrder` number. Signers with the same number receive their invitation simultaneously (parallel). Different numbers are sequential.
- **Sequential gating**: When signer 1 completes, the system checks if there's a signer 2. If yes, it generates and sends the signing invitation only then. Signer 2's token isn't even created until signer 1 finishes.
- **Mixed mode**: You can have signers 1 and 2 in parallel (both order=1), then signer 3 sequential (order=2).
- **CC recipients**: People who receive a copy of the completed document but don't sign. Separate role from SIGNER.
- **In-person signing**: A host opens the document on their device and hands it to the signer (for when buyer/seller are in the same room). The host's device becomes the signing terminal.

### What DotLoop Does (Real Estate Specific)
- **Loop order**: Typical flow is Buyer Agent uploads -> Buyer signs -> Listing Agent reviews -> Seller signs -> Both agents sign -> Broker signs. This 5-step sequential flow is their default for purchase agreements.
- **Parallel for addenda/disclosures**: Property disclosures go to all parties simultaneously since order doesn't legally matter.

### AirSign Implementation Recommendations

| # | Recommendation | Effort | Priority |
|---|---------------|--------|----------|
| 5A | **Sequential signing gate on send**: When sending an envelope, only send emails/create active links for signers with the lowest `order` value. Store other signers' tokens but mark them as "pending" (not yet deliverable). | 2 | HIGH |
| 5B | **Auto-advance on signer completion**: After a signer completes (in the POST handler), check if all signers at the current order level are done. If yes, send invitations to signers at the next order level. Add this to the existing completion-check logic. | 3 | HIGH |
| 5C | **Add signer status field**: Add a computed or stored status: `PENDING` (not yet their turn), `INVITED` (link sent), `VIEWED`, `SIGNED`, `DECLINED`. Currently this is inferred from timestamps but an explicit status makes queries easier. | 2 | MEDIUM |
| 5D | **Parallel signing for same-order signers**: When multiple signers share the same `order` value, send all their invitations simultaneously. The completion check should verify all signers at that order level finished before advancing. | 1 | HIGH (part of 5B) |
| 5E | **"Needs to act" vs "Waiting" UI**: On the envelope detail page, show each signer's state. Signers whose turn hasn't come yet show "Waiting for [Signer 1 name]" instead of a signing link. | 2 | MEDIUM |
| 5F | **Louisiana RE signing order preset**: When creating an envelope for a purchase agreement, offer a preset: "Buyer -> Seller -> Agents -> Broker" that auto-sets order values (1, 2, 3, 4). | 2 | MEDIUM |

### Code Change: Sequential Gate (5A)

In `app/api/airsign/envelopes/[id]/send/route.ts`, modify the sending logic:
```typescript
// Get the minimum order value (first batch to sign)
const minOrder = Math.min(...envelope.signers.map(s => s.order))

// Only send to signers in the first batch
const firstBatchSigners = envelope.signers.filter(s => s.order === minOrder)
const waitingSigners = envelope.signers.filter(s => s.order > minOrder)

// Build signing URLs only for first batch
const signingLinks = firstBatchSigners.map((s) => ({
  signerName: s.name,
  signerEmail: s.email,
  signingUrl: `${appUrl}/sign/${s.token}`,
  order: s.order,
}))

// Send emails only to first batch
for (const link of signingLinks) {
  // ... existing email logic
}

// Log waiting signers
for (const s of waitingSigners) {
  console.log(`[AirSign] Signer ${s.name} (order ${s.order}) queued`)
}
```

In the POST sign handler, after marking a signer as signed:
```typescript
// Check if all signers at this order level are done
const currentOrderSigners = allSigners.filter(s => s.order === signer.order)
const allCurrentDone = currentOrderSigners.every(
  s => s.id === signer.id ? true : !!s.signedAt
)

if (allCurrentDone) {
  // Find next order level
  const nextOrderSigners = allSigners
    .filter(s => s.order > signer.order && !s.signedAt && !s.declinedAt)
  
  if (nextOrderSigners.length > 0) {
    const nextOrder = Math.min(...nextOrderSigners.map(s => s.order))
    const nextBatch = nextOrderSigners.filter(s => s.order === nextOrder)
    // Send emails to next batch
    for (const nextSigner of nextBatch) {
      await sendSigningInvitation(nextSigner, envelope)
    }
  } else {
    // All signers done -- seal
    await sealEnvelope(envelope.id)
  }
}
```

---

## 6. Signing Link Security

### What AirSign Has Today
- Tokens: `cuid()` -- 25-character unique IDs (collision-resistant but not cryptographically random)
- Token expiration: 30-day expiry set on send, checked in GET handler
- IP logging: Captured from `x-forwarded-for` or `x-real-ip` headers
- User agent logging: Captured and stored
- No rate limiting on signing attempts
- No identity verification beyond "having the link"
- HTTPS: Enforced by Vercel deployment
- No token revocation mechanism
- After signing, link returns 410 error (should show read-only confirmation instead)

### What DocuSign Does
- **Access authentication options (tiered)**:
  1. **Email only** (default): Having the link is sufficient. The email delivery IS the authentication.
  2. **Access code**: Sender sets a PIN that must be entered before viewing. Delivered via separate channel (SMS or told verbally).
  3. **Phone authentication**: Signer receives a phone call or SMS with a one-time code.
  4. **Knowledge-Based Authentication (KBA)**: Third-party service asks questions from credit bureau data ("Which of these addresses have you lived at?"). Used for notarized documents.
  5. **ID verification**: Signer uploads a government ID photo + takes a selfie. AI matches them. Highest assurance level.

- **Token security**:
  - Tokens are cryptographically random UUIDs (v4)
  - Tokens expire after the envelope's expiration date
  - After signing, the link shows a read-only view of what was signed (not an error)
  - Rate limiting: 5 failed access code attempts locks the signer out for 24 hours

### ESIGN Act Compliance (15 U.S.C. 7001-7006)

The ESIGN Act requires:
1. **Intent to sign**: The signer must demonstrate intent. A click-to-sign or draw-to-sign action satisfies this. (AirSign has this.)
2. **Consent to do business electronically**: Must be clearly presented before signing. (AirSign has the consent banner.)
3. **Association of signature with record**: The signature must be logically associated with the document. Embedding in the PDF satisfies this. (AirSign does this via seal-pdf.)
4. **Record retention**: The signed record must be accessible to all parties after signing. (AirSign stores sealed PDF.)

The ESIGN Act does NOT require:
- Multi-factor authentication
- ID verification
- Notarization (unless state law requires it for the specific document type)
- Specific technology or format

**Louisiana UETA adoption (RS 9:2607-2618)**: Louisiana adopted UETA, which mirrors ESIGN. Electronic signatures are valid for real estate transactions except for wills, trusts, and certain UCC filings.

**What IS legally sufficient for Louisiana real estate**: Email-based delivery (link to signer's email = authentication via email ownership) + IP address + timestamp + user agent in audit trail + document hash integrity + consent banner. AirSign already has all of this.

### AirSign Implementation Recommendations

| # | Recommendation | Effort | Priority |
|---|---------------|--------|----------|
| 6A | **Switch to crypto-random tokens**: Replace `cuid()` default with `crypto.randomUUID()` for signing tokens. CUIDs are unique but predictable. UUIDs v4 are cryptographically random with 122 bits of entropy. | 1 | HIGH |
| 6B | **Rate limiting on sign endpoint**: Add rate limiting: max 10 POST attempts per token per hour, max 30 GET loads per token per hour. Use an in-memory map or Redis. Return 429 on excess. | 2 | HIGH |
| 6C | **Optional access code**: Allow senders to set a 4-6 digit PIN per signer. Signing page shows a PIN entry form before loading the document. Store hashed PIN on AirSignSigner. | 3 | MEDIUM |
| 6D | **Post-signing read-only view**: After signing, the link should show a read-only confirmation with the signer's completed fields visible, not a 410 error. Change the `signedAt` check in GET to return data with a `readOnly: true` flag. | 2 | MEDIUM |
| 6E | **Document hash verification**: Before displaying the document to the signer, compute SHA-256 of the PDF and compare against a stored hash (set when document was uploaded). If they differ, refuse to display and log a tamper alert. | 2 | HIGH |
| 6F | **Geolocation capture**: In addition to IP, capture approximate geolocation from the IP (using a free API like ip-api.com) and include it in the audit certificate. Shows "Signed from Baton Rouge, Louisiana" which adds legal weight. | 2 | LOW |
| 6G | **Token expiration per-signer**: Allow different expiration dates per signer (not just per envelope). A counter-offer scenario might give the seller 48 hours to respond while the original has a 30-day window. Add `expiresAt` to AirSignSigner model. | 2 | LOW |

### Schema Addition for Access Code (6C)

```prisma
model AirSignSigner {
  // ... existing fields
  accessCodeHash  String?       // bcrypt hash of optional PIN
  accessAttempts  Int     @default(0)
  lockedUntil     DateTime?
}
```

---

## 7. Real Estate-Specific Patterns

### What AirSign Has Today
- Transaction linking via `transactionId` on envelope
- LREC form type detection in field auto-placement
- Smart field placement for known form types
- Signer roles: SIGNER, WITNESS, NOTARY
- Louisiana rules engine for compliance scanning
- AirSign webhook fires on completion -> creates Document record + advances transaction workflow

### What DotLoop Does
- **Transaction room**: Every document lives inside a "loop" (transaction). All parties are members of the loop. When any document is signed, all loop members can see the status. AirSign already has this concept via `transactionId`.
- **Template library**: Pre-loaded state-specific forms. For Louisiana: LREC Purchase Agreement, Counter-Offer, Property Disclosure, Lead Paint Disclosure, FHA/VA Addenda. Forms have pre-mapped fields with the correct signer assignments.
- **Broker compliance review**: Before a transaction can close, the managing broker can require review of all signed documents. DotLoop has a "Compliance" tab where brokers see pending reviews. They can approve, reject (requiring corrections), or mark exceptions.
- **Auto-population across documents**: When a buyer's name is entered on the Purchase Agreement, it auto-fills on all subsequent documents in the loop (disclosures, addenda, etc.). This is their killer feature for real estate.
- **MLS integration**: Pulls property data (address, listing price, listing agent) directly from MLS into form fields. Eliminates manual entry for 60%+ of purchase agreement fields.

### What Authentisign Does
- **Brokerage-level admin**: The broker controls which templates are available, which agents can create envelopes, and reviews compliance before closing.
- **Role-based field assignment**: Forms know that "Buyer Signature" goes to the buyer role, "Listing Agent" goes to the listing agent role. When you add a purchase agreement, fields are pre-assigned by role, not by specific person.
- **Automatic disclosure packet**: When a property type is selected (residential, condo, new construction), the system auto-generates the required disclosure package for that state/property type.
- **Deadline tracking**: Integrates signing deadlines with transaction deadlines. "Inspection contingency expires in 5 days -- Property Disclosure not yet signed by Buyer" triggers alerts.

### AirSign Implementation Recommendations

| # | Recommendation | Effort | Priority |
|---|---------------|--------|----------|
| 7A | **LREC form template library**: Create JSON templates for the top 5 Louisiana forms (Purchase Agreement, Counter-Offer, Residential Property Disclosure, Lead Paint Disclosure, Exclusive Right to Represent Buyer). Each template maps form type -> field positions + signer role assignments. | 4 | HIGH |
| 7B | **Role-based field assignment**: Instead of assigning fields to specific signers, assign to roles (BUYER, SELLER, BUYER_AGENT, LISTING_AGENT, BROKER). When signers are added with a role, their fields auto-populate. Add `signerRole` to AirSignField or use the existing signer `role` field. | 3 | HIGH |
| 7C | **Cross-document auto-fill**: When creating a new envelope in a transaction, pre-fill signer names and emails from the transaction's parties. Pull property address, price, closing date from the transaction record. | 2 | HIGH |
| 7D | **Broker compliance review gate**: Add an optional `requiresBrokerReview` boolean on the envelope. When enabled, after all signers complete, the envelope goes to PENDING_REVIEW instead of COMPLETED. The broker gets a notification and can approve/reject. | 3 | MEDIUM |
| 7E | **Disclosure packet generator**: For a given transaction type, auto-generate the set of required documents. Louisiana residential sale requires: Property Disclosure (RS 9:3198), Lead Paint (if pre-1978), and various LREC addenda. | 4 | MEDIUM |
| 7F | **Deadline integration**: Link envelope status to transaction deadlines. If a document isn't signed by its deadline, auto-send a reminder. The TC Morning Brief already tracks deadlines -- wire AirSign status into it. | 2 | MEDIUM |
| 7G | **Signing room view**: A dedicated page per transaction showing all envelopes, their status, and which parties still need to sign. Similar to DotLoop's "loop" view. Route: `/aire/transactions/[id]/signing`. | 3 | MEDIUM |
| 7H | **Agent/broker signature reuse**: Store an agent's signature image for reuse across envelopes. Agents sign dozens of documents per transaction -- drawing their signature each time is friction. Store on the User model or a separate AgentSignature model. | 2 | HIGH |

### Code Change: Cross-Document Auto-Fill (7C)

In `app/airsign/new/NewEnvelopeForm.tsx`, when a transaction is selected:
```typescript
async function onTransactionSelect(transactionId: string) {
  const res = await fetch(`/api/transactions/${transactionId}`)
  const txn = await res.json()

  // Auto-populate signers from transaction parties
  const autoSigners = []
  if (txn.buyerName && txn.buyerEmail) {
    autoSigners.push({ name: txn.buyerName, email: txn.buyerEmail, role: 'BUYER', order: 1 })
  }
  if (txn.sellerName && txn.sellerEmail) {
    autoSigners.push({ name: txn.sellerName, email: txn.sellerEmail, role: 'SELLER', order: 2 })
  }
  if (txn.buyerAgentName && txn.buyerAgentEmail) {
    autoSigners.push({ name: txn.buyerAgentName, email: txn.buyerAgentEmail, role: 'BUYER_AGENT', order: 3 })
  }
  if (txn.listingAgentName && txn.listingAgentEmail) {
    autoSigners.push({ name: txn.listingAgentName, email: txn.listingAgentEmail, role: 'LISTING_AGENT', order: 3 })
  }
  setSigners(autoSigners)
}
```

---

## Implementation Priority Matrix

### Phase 1: Quick Wins (1-2 days total, all effort=1)
Ship immediately. Dramatically improves signing experience.

1. **1A** -- Responsive signature canvas
2. **1E** -- iOS input zoom prevention (font-size: 16px)
3. **1G** -- 100dvh viewport fix
4. **2A** -- Field counter with action description
5. **2B** -- Auto-scroll to next field
6. **2C** -- Field pulse animation
7. **3A** -- aria-labels on fields
8. **3C** -- Fix focus indicator opacity
9. **3D** -- aria-live progress region
10. **3E** -- Dialog roles on modals
11. **3G** -- prefers-reduced-motion
12. **6A** -- Crypto-random tokens

### Phase 2: Core UX (3-5 days total)
Fills the biggest gaps vs DocuSign/DotLoop.

1. **4A** -- Decline reason input
2. **4B + 4G** -- Envelope status on decline + DECLINED enum
3. **4E** -- Void envelope API
4. **5A** -- Sequential signing gate
5. **5B + 5D** -- Auto-advance to next signer batch
6. **6B** -- Rate limiting
7. **6E** -- Document hash verification
8. **7C** -- Cross-document auto-fill from transaction

### Phase 3: Competitive Differentiators (1-2 weeks)
Puts AirSign ahead for real estate specifically.

1. **7A** -- LREC form template library
2. **7B** -- Role-based field assignment
3. **7H** -- Agent signature reuse
4. **1B** -- Landscape prompt for mobile draw
5. **1D** -- Pinch-to-zoom on PDF
6. **2D** -- "Start Signing" entry screen
7. **3F** -- Focus trap in modals
8. **4F** -- Sender recovery UI after decline
9. **5F** -- Louisiana RE signing order preset
10. **6C** -- Optional access code

### Phase 4: Full Platform (2-4 weeks)
Completes the DotLoop replacement story.

1. **7D** -- Broker compliance review gate
2. **7E** -- Disclosure packet generator
3. **7F** -- Deadline integration with TC
4. **7G** -- Signing room per transaction
5. **3H** -- Detailed error identification
6. **4C/4D** -- Decline notifications to all parties
7. **5E** -- "Waiting for" UI on envelope detail

---

## Key Takeaways

1. **Biggest gap vs DocuSign -- Sequential signing**: The `order` field exists on AirSignSigner but nothing enforces it. All signers get links simultaneously. This is the single highest-impact backend change. The schema is ready; only the send route and completion handler need logic updates.

2. **Biggest gap vs DotLoop -- Form template library**: In real estate, agents send the same 5-10 form types hundreds of times. Auto-mapped fields per form type eliminates 80% of prep work. This is what makes DotLoop sticky for real estate agents.

3. **Mobile UX is 70% there**: Touch events work, sticky action bar works. The missing pieces (responsive canvas, auto-scroll, landscape prompt) are all effort=1-2 fixes that can ship in a day.

4. **Accessibility is a legal risk**: An inaccessible signing platform is a liability under ESIGN Act. If a signer with a disability can't complete the flow, the transaction could be challenged. Phase 1 accessibility fixes (aria-labels, keyboard nav, focus indicators) take half a day.

5. **Decline flow is broken for production**: Declining doesn't change envelope status, doesn't notify anyone, and doesn't prevent other signers from continuing. This is a data integrity issue -- fix before using with real clients.

6. **Security is legally sufficient but should be hardened**: Email delivery + IP/timestamp/UA logging + consent banner + PDF hash meets ESIGN Act and Louisiana UETA requirements. Adding crypto-random tokens and rate limiting are the two highest-ROI security improvements.

7. **Cross-document auto-fill is the killer feature**: Pulling buyer/seller/property data from the transaction into every new envelope is the single feature that will make agents prefer AirSign over DotLoop. The transaction model already has all the data -- this is a UI wiring task.
