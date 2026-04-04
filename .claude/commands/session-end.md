---
name: session-end
description: End-of-session logging. Documents what was built, what broke, what comes next.
---

1. Append a session summary to SESSIONS.md:
   - Date, goal, what was built (file paths), errors encountered, what is still broken, first task for next session
2. Update CURRENT_STATE.md — move completed items, update broken list, update NEXT PRIORITY
3. Run npm run build one final time to confirm clean state
4. Report: "Session logged. Build: [PASS/FAIL]"
