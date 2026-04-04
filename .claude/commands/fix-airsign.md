---
name: fix-airsign
description: Fix the /airsign 404 in production. Removes auth guard from layout.tsx.
---

Read aire-error-prevention SKILL.md first.

The /airsign route is 404 in production because app/airsign/layout.tsx has an auth guard that blocks unauthenticated static generation.

Fix sequence:
1. Open app/airsign/layout.tsx
2. Remove any auth() call, redirect(), or Clerk protection from this layout
3. The layout should only return children wrapped in a basic div — no auth logic
4. Signers who access /sign/[token] must NEVER be blocked by auth — that route is public
5. Auth goes in the individual protected pages (/airsign/new, /airsign/[id]) not the layout
6. Run npx tsc --noEmit — fix any errors
7. Run npm run build — confirm passes
8. Deploy to Vercel
9. Update CURRENT_STATE.md — move /airsign from BROKEN to LIVE
10. Run /session-end

After completing, tell me the exact change made to layout.tsx.
