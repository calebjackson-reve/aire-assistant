---
name: send-update
description: Send a templated status update (email/SMS) to transaction parties — offer accepted, inspection scheduled, closing confirmed, general update. Use when the user says "tell the buyer/seller/lender...", "send an update to...", "let them know...", or references a party on an active transaction.
type: action
surface: mcp:send-update
triggers:
  - "send an update"
  - "tell the buyer"
  - "tell the seller"
  - "let them know"
  - "notify the lender"
  - "email the title company"
requiresConfirmation: true
---

# send-update

Dispatches a status update to the parties on an AIRE transaction using one of
four pre-approved templates. This is the canonical way to keep buyers, sellers,
lenders, and the title team informed without Caleb drafting from scratch.

## When to use

Invoke when the user explicitly asks to notify a party, or when a workflow
transition (offer accepted → inspection → closing) completes and Caleb has
standing instructions to keep parties in the loop.

## Inputs

- `transactionId` — required
- `template` — one of `offer_accepted`, `inspection`, `closing`, `update`
- `customMessage` — optional override appended to the template body
- `channel` — `email`, `sms`, or `both` (defaults to channel inferred from party
  contact info)

## Guardrails

- **Always confirm before sending.** This is an irreversible outbound action.
  The in-app proposer must render the final message body and signatories before
  firing the MCP call.
- Respect party communication preferences — the backend reads them; do not
  override unless the user is explicit.
- If `RESEND_API_KEY` or Twilio creds are missing the route logs to console —
  warn the user instead of claiming the message was sent.

## Related

- Fallback: draft by hand via `draft-reply` if no template fits.
- Upstream triggers: `advance-workflow` often wants to `send-update` immediately
  after a status change.
