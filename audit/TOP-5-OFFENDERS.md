# Top 5 worst-offender surfaces (2026-04-14 baseline)

Ordered worst → least-bad among the full 36-route audit. "Severity" reflects how far the surface is from the A-grade bar, weighted for how much of it must be rebuilt vs polished.

| Rank | Cluster | Route | Severity | Why (one line) |
|------|---------|-------|----------|----------------|
| 1 | A10 | `/aire/data-health` | Critical | Entirely off-brand grayscale (`bg-zinc-950 text-white`; 15+ `text-zinc-*` / `bg-zinc-*` at `DataHealthDashboard.tsx:66–146`) — needs ground-up Nocturne rebuild; blueprint rates it **D**. |
| 2 | A8 | `/aire/email` + `/aire/communications` | Critical | Lowest blueprint grades (C / C+); 6× `bg-white` + `[#d4c8b8]` borders on EmailDashboard.tsx lines 117/131/191/244/285/379, plus legacy `forest-deep`/`brown-border`/`copper` tokens in CommunicationsHub. Two views that should be one feed. |
| 3 | A11 | `/aire/transcript-tasks` | High | Only file in the repo shipping the globally-banned blue (`bg-blue-100 text-blue-700` at line 29) + default-Tailwind red/orange at lines 27–28 — hard violation of both project and global frontend rules. |
| 4 | A7 | `/aire/relationships` | High | 9+ `bg-white` cards across page.tsx (105–222); line 252 has a malformed Tailwind class (`border-[#d4c8b8]/60/50`) silently dropped — a live visual bug plus palette drift. Blueprint rates B− and asks for full editorial-card redesign. |
| 5 | A10 | `/aire/intelligence` + `MarketSnapshotPanel` | High | F3 Playfair epicenter — hard-coded `fontFamily: "'Playfair Display', Georgia, serif"` + `color: "#1e2416"` at page.tsx:45 and MarketSnapshotPanel.tsx:53. Inline styles block F2 theme-var migration. |

## Notes
- `A5 /sign/[token]` returns 500 in local dev only — caused by `@prisma/client` module resolution failure (Prisma not generated; OneDrive DLL lock). Env-level, not a design violation; excluded from severity list.
- Shadow directory `aire-assistant-tcs-flagship/` mirrors most cluster paths and would re-introduce every violation if any cluster agent accidentally edits there. Recommend: delete before dispatching A1–A14.
- Clerk key mismatch blocks auth in this local env (dev log: "Refreshing the session token resulted in an infinite redirect loop... keys do not match"). Impacts ability to capture authenticated screenshots but not the static violations cited above.
