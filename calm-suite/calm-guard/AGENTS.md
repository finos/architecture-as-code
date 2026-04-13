# CALMGuard - Claude Code Instructions

## Project Overview

CALMGuard is a CALM-native continuous compliance DevSecOps platform. It reads FINOS CALM (Common Architecture Language Model) architecture definitions and analyzes them with multi-agent AI to produce compliance reports, risk assessments, and generated CI/CD pipeline configs — all streamed in real-time to a dashboard.

Built for the DTCC/FINOS Innovate.DTCC AI Hackathon (Feb 23-27, 2026).

## Tech Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Framework | Next.js 14+ (App Router) | `src/app/` routing, API routes for SSE |
| Package Manager | pnpm | Use `pnpm` for all package operations |
| Language | TypeScript (strict mode) | No `any` types. Use Zod for runtime validation |
| LLM SDK | Vercel AI SDK (`ai`) | `generateObject` with Zod schemas for all agent outputs |
| Default LLM | Google Gemini | `@ai-sdk/google`. Multi-provider: also supports Anthropic, OpenAI, Ollama, Grok |
| UI | shadcn/ui + Tailwind CSS | Dark theme (slate palette). Components in `src/components/ui/` |
| Visualization | React Flow | Architecture graphs. Custom nodes per CALM node-type |
| Charts | Recharts | Compliance gauges, heat maps |
| State | Zustand | Single store in `src/store/analysis-store.ts` |
| Validation | Zod | Schema validation for CALM parsing AND agent outputs |
| Agent Definitions | YAML files in `agents/` | AOF-inspired. Loaded by registry |
| Skills | Markdown files in `skills/` | Compliance knowledge injected into agent prompts |
| Deployment | Vercel | Zero-config Next.js deployment |

## CALM Schema Reference (v1.1)

Source: `https://github.com/finos/architecture-as-code` (CALM release 1.1)

### Core Entities

**Nodes** (required: unique-id, node-type, name, description):
- `node-type` enum: `actor`, `ecosystem`, `system`, `service`, `database`, `network`, `ldap`, `webclient`, `data-asset`
- Optional: `interfaces[]`, `controls{}`, `metadata`, `details`

**Relationships** (required: unique-id, relationship-type):
- Types (mutually exclusive): `interacts`, `connects`, `deployed-in`, `composed-of`, `options`
- `interacts`: `{ actor: string, nodes: string[] }`
- `connects`: `{ source: { node, interfaces[] }, destination: { node, interfaces[] } }`
- `deployed-in` / `composed-of`: `{ container: string, nodes: string[] }`
- `protocol` enum: `HTTP`, `HTTPS`, `FTP`, `SFTP`, `JDBC`, `WebSocket`, `SocketIO`, `LDAP`, `AMQP`, `TLS`, `mTLS`, `TCP`
- Optional: `controls{}`, `metadata`, `description`

**Controls** (pattern-keyed object `^[a-zA-Z0-9-]+$`):
- Each control: `{ description (required), requirements: [{ requirement-url (required), config-url | config }] }`
- Controls attach to both nodes and relationships

**Flows** (required: unique-id, name, description, transitions[]):
- Transitions: `{ relationship-unique-id, sequence-number (int), description, direction? }`
- Direction: `source-to-destination` (default) | `destination-to-source`

**Interfaces**:
- `interface-definition`: `{ unique-id, definition-url, config }`
- `node-interface`: `{ node, interfaces[] }`

## Architecture Patterns

### Agent Pattern
Each agent in `src/lib/agents/` follows this pattern:
1. Loads config from YAML definition in `agents/`
2. Loads skills from `skills/*.md` via skill loader
3. Calls Vercel AI SDK `generateObject` with Zod output schema
4. Emits typed `AgentEvent`s via SSE event emitter
5. Returns structured result matching its Zod schema

### SSE Streaming
- API routes return `ReadableStream` with `text/event-stream` content type
- Global event emitter in `src/lib/ai/streaming.ts`
- Client connects via `EventSource` hook in `src/hooks/use-agent-stream.ts`
- Events flow: Agent → EventEmitter → SSE Route → EventSource → Zustand Store → React Components

### Orchestration
- Phase 1: Architecture Analyzer + Compliance Mapper + Pipeline Generator run in parallel (`Promise.all`)
- Phase 2: Risk Scorer runs sequentially on aggregated Phase 1 results
- All events stream to dashboard in real-time

## File Organization

```
src/
  app/                          # Next.js App Router pages and API routes
    api/                        # Backend API routes (SSE streaming, CALM parsing)
    dashboard/                  # Dashboard pages
  lib/                          # Core business logic (framework-agnostic)
    calm/                       # CALM parsing, types, validation
    agents/                     # Agent implementations, orchestrator, registry
    ai/                         # AI SDK provider setup, streaming utilities
    skills/                     # SKILL.md loader
    compliance/                 # Framework definitions, control mapping, scoring
    pipeline/                   # GitHub Actions, security scanning, IaC generation
  components/
    ui/                         # shadcn/ui base components (do not modify)
    dashboard/                  # Dashboard-specific components
    layout/                     # Sidebar, header, theme
  hooks/                        # React hooks (SSE, CALM parser, compliance)
  store/                        # Zustand store
agents/                         # YAML agent definitions (AOF-inspired)
skills/                         # SKILL.md compliance knowledge files
examples/                       # Demo CALM architecture JSON files
```

## Coding Conventions

### TypeScript
- Strict mode. No `any`. Use `unknown` + type guards where needed
- Zod schemas for all external data (CALM input, LLM output, API payloads)
- Export types from co-located `types.ts` files
- Prefer `interface` for object shapes, `type` for unions/intersections

### React
- Server Components by default (App Router)
- `'use client'` only where needed (hooks, interactivity, Zustand)
- Prefer composition over prop drilling
- `React.memo` on expensive render components (React Flow, Heat Map)

### Naming
- Files: kebab-case (`architecture-analyzer.ts`)
- Components: PascalCase (`ComplianceScore.tsx` → exported as `ComplianceScore`)
- Types/Interfaces: PascalCase (`AgentEvent`, `CalmNode`)
- Constants: UPPER_SNAKE_CASE
- Zod schemas: camelCase with `Schema` suffix (`agentEventSchema`)

### Agent Development
- Each agent gets its own file in `src/lib/agents/`
- Define Zod output schema at top of file
- Use `generateObject` (not `generateText`) for structured output
- Emit events via the global event emitter — never return raw LLM text
- Agent YAML definitions in `agents/` match the agent filename

### Styling
- Dark theme only (slate-900 bg, slate-800 cards)
- Compliance colors: emerald (compliant), amber (partial), red (non-compliant), blue (info)
- Use Tailwind classes, not CSS modules
- shadcn/ui components for all standard UI elements

## Key Commands

```bash
pnpm dev          # Start dev server
pnpm build        # Production build
pnpm lint         # ESLint
pnpm typecheck    # TypeScript strict check
```

## Environment Variables

```
GOOGLE_GENERATIVE_AI_API_KEY=   # Gemini (default provider)
ANTHROPIC_API_KEY=              # Anthropic (optional)
OPENAI_API_KEY=                 # OpenAI (optional)
```

## Important References

- CALM Schema 1.1: https://github.com/finos/architecture-as-code/tree/main/calm/release/1.1
- CALM CLI: https://github.com/finos/architecture-as-code/tree/main/cli
- CALM AI module: https://github.com/finos/architecture-as-code/tree/main/calm-ai
- Vercel AI SDK: https://sdk.vercel.ai/docs
- React Flow: https://reactflow.dev
- shadcn/ui: https://ui.shadcn.com

## Git Workflow

- Always commit with `git commit -s` (signs off with user's identity via DCO)
- Claude should commit on the user's behalf — do not defer commits to the user

## Learnings

<!-- Compounding learnings surface here as the project progresses -->
