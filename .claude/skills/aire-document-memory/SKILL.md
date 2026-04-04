---
name: aire-document-memory
description: >
  Self-improving document classification memory and learning engine for the AIRE platform.
  Logs every document upload, flags low-confidence results for review, stores corrections
  as few-shot learning examples. Use when building/extending document memory features.
---

# AIRE Document Memory — Self-Improving Classification Engine

See the full spec in the user's original prompt. This skill was built and deployed with:

- DocumentMemory model in prisma/schema.prisma
- lib/document-memory.ts (logDocumentMemory + getLearningExamples)
- Memory logging wired into POST /api/documents/extract
- Few-shot injection in lib/document-classifier.ts classifyWithAI()
- GET /api/documents/memory/review-queue
- PATCH /api/documents/memory/[id]/correct
- GET /api/documents/memory/stats
- GET /api/documents/memory/export-skill
- Review queue UI at /documents/review
