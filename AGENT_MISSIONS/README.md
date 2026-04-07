# AIRE Agent Missions — Coordination Hub

## 4 Agents, 4 Chats, 1 Product

| Agent | Mission | Files It Owns | Files It Reads |
|-------|---------|---------------|----------------|
| Agent 1 | AirSign | `app/airsign/`, `app/sign/`, `lib/airsign/`, `app/api/airsign/`, `components/airsign/` | `prisma/schema.prisma`, `lib/workflow/` |
| Agent 2 | TC Assistant | `app/aire/transactions/`, `components/tc/`, `lib/tc/`, `app/api/transactions/`, `app/api/tc/` | `prisma/schema.prisma`, `lib/workflow/`, `lib/documents/` |
| Agent 3 | Document Pipeline | `app/api/documents/`, `lib/document-*.ts`, `lib/multi-pass-extractor.ts`, `app/aire/documents/` | `prisma/schema.prisma`, `lib/workflow/` |
| Agent 4 | Auto-Research | `lib/research/`, `app/api/research/`, `app/aire/research/` | Everything (read-only) |

## CONFLICT RULES

1. **Schema changes:** If you need to modify `prisma/schema.prisma`, write your proposed change to `AGENT_MISSIONS/SCHEMA_PROPOSALS.md` with your agent number. Do NOT run `prisma db push` or `prisma migrate` without Caleb's approval.

2. **Shared files:** These files are used by multiple agents. If you modify them, document in `SHARED_CHANGES.md`:
   - `app/aire/layout.tsx` (sidebar navigation)
   - `app/aire/page.tsx` (main dashboard)
   - `lib/workflow/state-machine.ts`
   - `prisma/schema.prisma`
   - `app/layout.tsx`

3. **New dependencies:** If you need to `npm install` a package, add it to `SHARED_CHANGES.md` first. Do NOT install without documenting.

4. **API routes:** Stay in your lane. Don't modify another agent's API routes.

5. **Blockers:** If you can't proceed because another agent's code isn't ready, write it to `BLOCKERS.md` and continue with what you CAN do.

## HOW TO START EACH AGENT

Open 4 separate Claude Code chats. In each one, paste:

```
Read these files in order before doing anything:
1. CLAUDE.md (project root)
2. COMPLETION_PLAN.md (project root)  
3. AGENT_MISSIONS/README.md
4. AGENT_MISSIONS/AGENT-[N]-[NAME].md (your specific mission)

Then execute Phase 1 of your mission. Report what you find before making changes.
```

Replace `[N]` with 1, 2, 3, or 4.

## COMPLETION ORDER

```
Agent 1 (AirSign)    ████████████░░░░░░░░  Phase 1-2 first (env vars + upload)
Agent 3 (Documents)  ████████░░░░░░░░░░░░  Phase 1 first (wire upload → extract)  
Agent 2 (TC)         ██████░░░░░░░░░░░░░░  Phase 1 first (audit existing)
Agent 4 (Research)   ████░░░░░░░░░░░░░░░░  Phase 1 first (document learner)
```

Agent 1 and Agent 3 are the most critical — they unblock everything else.
Agent 2 is the core product UX.
Agent 4 makes everything smarter over time.

## FILES FOR CROSS-AGENT COMMUNICATION

- `BLOCKERS.md` — Things you're stuck on (include agent number)
- `SHARED_CHANGES.md` — Changes to shared files (include agent number + what changed)
- `SCHEMA_PROPOSALS.md` — Proposed Prisma schema additions (include agent number)
