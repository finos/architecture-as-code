# CALMGuard - Claude Code Instructions

## Project Overview

CALMGuard is a CALM-native continuous compliance DevSecOps platform. It reads FINOS CALM (Common Architecture Language Model) architecture definitions and analyzes them with multi-agent AI to produce compliance reports, risk assessments, and generated CI/CD pipeline configs — all streamed in real-time to a dashboard.

Built for the DTCC/FINOS Innovate.DTCC AI Hackathon (Feb 23-27, 2026).

## Tech Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Framework | Next.js 15 (App Router, Turbopack) | `src/app/` routing, API routes for SSE |
| Package Manager | npm (workspaces) | CalmGuard is a workspace of the monorepo root. Run `npm` commands from the repo root or use `--workspace=calmguard`. The docs sub-package is `calmguard-docs`. |
| Language | TypeScript (strict mode) | No `any` types. Use Zod for runtime validation |
| LLM SDK | Vercel AI SDK (`ai`) | `generateObject` with Zod schemas for all agent outputs |
| Default LLM | Google Gemini | `@ai-sdk/google`. Multi-provider: also supports Anthropic, OpenAI, xAI/Grok |
| UI | shadcn/ui + Tailwind CSS | Dark theme (slate palette). Components in `src/components/ui/` |
| Visualization | React Flow (`@xyflow/react`) | Architecture graphs. Custom nodes per CALM node-type |
| Charts | Recharts | Compliance gauges, heat maps |
| State | Zustand | Single store in `src/store/analysis-store.ts` |
| Validation | Zod | Schema validation for CALM parsing AND agent outputs |
| Agent Definitions | YAML files in `agents/` | AOF-inspired. Loaded by registry |
| Skills | Markdown files in `skills/` | Compliance knowledge injected into agent prompts |
| Deployment | Vercel | Zero-config Next.js deployment |

## CALM Schema Reference (v1.2)

Source: `https://github.com/finos/architecture-as-code` (CALM release 1.2)

### Core Entities

**Nodes** (required: unique-id, node-type, name, description):
- `node-type`: any string. The 9 well-known values (`actor`, `ecosystem`, `system`, `service`, `database`, `network`, `ldap`, `webclient`, `data-asset`) get first-class UI, but canonical CALM allows any string (e.g. extension types like `aws:lambda`), so CALMGuard accepts any string for interoperability.
- Optional: `interfaces[]`, `controls{}`, `metadata`, `details`

**Relationships** (required: unique-id, relationship-type):
- `relationship-type` is a **nested object** keyed by exactly one variant — NOT a string discriminant. The variant payload lives inside it; `protocol`/`controls`/`metadata`/`description` are siblings of `relationship-type` at the relationship level.
- Canonical nested form:
  ```json
  { "unique-id": "r1", "relationship-type": { "connects": { "source": { "node": "a" }, "destination": { "node": "b" } } }, "protocol": "HTTPS" }
  ```
- Variants (exactly one present):
  - `connects`: `{ source: { node, interfaces?[] }, destination: { node, interfaces?[] } }`
  - `interacts`: `{ actor: string, nodes: string[] }`
  - `deployed-in` / `composed-of`: `{ container: string, nodes: string[] }`
  - `options`: loosely typed (CALMGuard treats as `unknown`)
- `protocol` enum: `HTTP`, `HTTPS`, `FTP`, `SFTP`, `JDBC`, `WebSocket`, `SocketIO`, `LDAP`, `AMQP`, `TLS`, `mTLS`, `TCP`
- Optional (siblings): `controls{}`, `metadata`, `description`
- NOTE: the legacy flat form (`"relationship-type": "connects"` + sibling `connects`) is **no longer accepted** — use the nested form so documents round-trip with the CLI, Hub, Visualizer, and Studio.

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
2. Loads skills from the skills markdown files (`skills/*.md`) via the skill loader (`src/lib/skills/loader.ts`)
3. Calls Vercel AI SDK `generateObject` with Zod output schema
4. Emits typed `AgentEvent`s via SSE event emitter
5. Returns structured result matching its Zod schema

### SSE Streaming
- API routes return `ReadableStream` with `text/event-stream` content type
- Global event emitter in `src/lib/ai/streaming.ts`
- Client connects via `EventSource` hook in `src/hooks/use-agent-stream.ts`
- Events flow: Agent → EventEmitter → SSE Route → EventSource → Zustand Store → React Components

### Agents
Seven agents (YAML in `agents/`, implementations in `src/lib/agents/`):
- **orchestrator** — coordinates the run and aggregates results
- **architecture-analyzer** — parses and analyzes the CALM model
- **compliance-mapper** — maps controls to frameworks (SOX, PCI-DSS, NIST-CSF, ...)
- **pipeline-generator** — generates CI/CD pipeline configs
- **cloud-infra-generator** — generates IaC / cloud infrastructure config
- **risk-scorer** — produces aggregate risk assessment
- **calm-remediator** — proposes CALM model remediations (merged via `remediation-merge.ts`)

### Orchestration
- Phase 1 (parallel, `Promise.allSettled` for graceful degradation): Architecture Analyzer + Compliance Mapper + Pipeline Generator + Cloud Infra Generator
- Phase 2 (sequential): Risk Scorer runs on aggregated Phase 1 results
- The CALM Remediator runs as a separate remediation flow
- All events stream to dashboard in real-time

### GitHub / GitOps Integration
- `src/lib/github/` plus API routes under `src/app/api/github/` (`fetch-calm`, `create-pr`, `status`)
- Fetches CALM models directly from GitHub repos, and opens pull requests with remediated CALM
- Surfaced in the UI via `gitops-card.tsx`

### Learning Subsystem
- `src/lib/learning/` stores and replays learned compliance patterns/insights, injected into agent runs (the orchestrator pre-checks the learning store)
- Exposed via the `dashboard/learning` and `dashboard/squad` routes

### CALM CLI Validation
- Uses the `@finos/calm-cli` dependency via `src/lib/calm/cli-validator.ts`
- Exposed through the `src/app/api/calm/validate` route to validate CALM input against the official schema

## File Organization

```
src/
  app/                          # Next.js App Router pages and API routes
    api/                        # Backend API routes (SSE streaming, CALM parsing)
    dashboard/                  # Dashboard pages
  lib/                          # Core business logic (framework-agnostic)
    agents/                     # Agent implementations, orchestrator, registry
    ai/                         # AI SDK provider setup, streaming utilities
    api/                        # Shared API helpers
    calm/                       # CALM parsing, types, validation, CLI validator
    github/                     # GitHub/GitOps integration (fetch CALM, create PR, status)
    learning/                   # Learning subsystem (compliance pattern store)
    report/                     # Report generation
    skills/                     # Skill loader (markdown files live in top-level skills/)
  components/
    ui/                         # shadcn/ui base components (do not modify)
    dashboard/                  # Dashboard-specific components
    layout/                     # Sidebar, header, theme
  hooks/                        # React hooks (SSE, CALM parser, compliance)
  store/                        # Zustand store
agents/                         # YAML agent definitions (AOF-inspired)
skills/                         # Compliance knowledge markdown files (e.g. SOX.md, PCI-DSS.md, NIST-CSF.md)
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

Run from monorepo root (preferred) or from `calm-suite/calm-guard/` (drop the `--workspace=calmguard` flag).

```bash
# From monorepo root
npm ci                                       # Install all workspaces (one-time / on lockfile change)
npm run dev --workspace=calmguard            # Start dev server
npm run build --workspace=calmguard          # Production build
npm run lint --workspace=calmguard           # ESLint
npm run typecheck --workspace=calmguard      # TypeScript strict check
npm run test:run --workspace=calmguard       # Vitest single run

# Docs site (Docusaurus)
npm run docs:dev                             # From calm-suite/calm-guard/
```

## Environment Variables

```
GOOGLE_GENERATIVE_AI_API_KEY=   # Gemini (default provider)
ANTHROPIC_API_KEY=              # Anthropic (optional)
OPENAI_API_KEY=                 # OpenAI (optional)
```

## Important References

- CALM Schema 1.2: https://github.com/finos/architecture-as-code/tree/main/calm/release/1.2
- CALM CLI: https://github.com/finos/architecture-as-code/tree/main/cli
- CALM AI module: https://github.com/finos/architecture-as-code/tree/main/calm-ai
- Vercel AI SDK: https://sdk.vercel.ai/docs
- React Flow (`@xyflow/react`): https://reactflow.dev
- shadcn/ui: https://ui.shadcn.com

## Git Workflow

- Always commit with `git commit -s` (signs off with user's identity via DCO)
- Claude should commit on the user's behalf — do not defer commits to the user

## Learnings

<!-- Compounding learnings surface here as the project progresses -->
