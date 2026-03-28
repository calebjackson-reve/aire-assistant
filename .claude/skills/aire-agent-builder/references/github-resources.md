# AIRE GitHub Resources & Reference Architecture

These open-source projects provide patterns, tooling, and reference implementations
for building AIRE's agent system. Use them as architectural guides — not as dependencies
to install wholesale.

---

## 1. Claude Flow — Multi-Agent Orchestration
**Repo**: https://github.com/ruvnet/claude-flow
**Use in AIRE**: Core orchestration engine. Provides patterns for how multiple agents
coordinate, hand off work, and share context.
**When to reference**: When designing how agents communicate with each other (e.g.,
Email Scan Agent feeding results to Morning Brief Agent), setting up task queues,
or building the central routing layer that decides which agent handles a request.

## 2. Claude Agent SDK
**Repo**: https://github.com/kenneth-liao/claude-agent-sdk-intro
**Use in AIRE**: Foundation patterns for structuring individual agents — how they receive
input, process tasks, maintain state, and return structured output.
**When to reference**: When scaffolding a new agent from scratch. Provides the base
interface pattern (input → process → output) that each AIRE agent follows.

## 3. Awesome Agent Skills
**Repo**: https://github.com/VoltAgent/awesome-agent-skills
**Use in AIRE**: Library of reusable AI skill patterns — summarization, classification,
entity extraction, data transformation.
**When to reference**: When implementing specific capabilities within an agent, like
email classification logic in the Email Scan Agent or intent classification in the
Voice Command Agent.

## 4. Anthropic Skills
**Repo**: https://github.com/anthropics/skills
**Use in AIRE**: Official Anthropic skill modules. Production-grade patterns for
building reliable, structured AI outputs.
**When to reference**: When building skills that need to be rock-solid — CMA generation,
contract drafting, compliance checking. These patterns prioritize structured output
and error handling.

## 5. Claude Code Subagents
**Repo**: https://github.com/VoltAgent/awesome-claude-code-subagents
**Use in AIRE**: Patterns for breaking complex tasks into smaller expert sub-agents.
**When to reference**: When a single AIRE agent needs to decompose a complex task.
For example, the Intelligence Agent might spawn sub-agents for comp selection,
adjustment calculation, and document generation as separate steps.

## 6. Claude Agent Farm
**Repo**: https://github.com/Dicklesworthstone/claude_code_agent_farm
**Use in AIRE**: Parallel agent execution. Run multiple agents simultaneously.
**When to reference**: When building the orchestration layer that runs Transaction +
Email Scan + Content agents in parallel. Critical for the Morning Brief Agent that
needs to gather results from multiple agents at once.

## 7. Claude Squad
**Repo**: https://github.com/smtg-ai/claude-squad
**Use in AIRE**: Multi-agent workspace management. Collaborative agent patterns.
**When to reference**: When designing how agents share a workspace (the transaction
context) and collaborate on complex workflows like closing coordination.

## 8. MCP Servers
**Repo**: https://github.com/punkpeye/awesome-mcp-servers
**Use in AIRE**: Connect AI agents to external tools — Gmail, MLS, Stripe, Dotloop.
**When to reference**: When implementing any external API integration. MCP server
patterns provide the standard interface for tool connections that Claude can invoke.

---

## How to Use These Resources

When building an AIRE agent:
1. Check if Claude Flow has an orchestration pattern for the workflow you're designing
2. Use the Agent SDK patterns for the agent's base structure
3. Pull specific skill patterns from Awesome Agent Skills or Anthropic Skills
4. If the agent needs to decompose tasks, reference Claude Code Subagents
5. If agents need to run in parallel, reference Claude Agent Farm
6. For external tool connections (MLS, email, Dotloop), reference MCP Servers

These repos are reference material — read their READMEs and key examples for patterns,
then implement using AIRE's actual tech stack (Next.js, Prisma, Vercel).
