---
sidebar_position: 9
title: Contributing
---

# Contributing to CALMGuard

CALMGuard is an open-source project built for the DTCC/FINOS Innovate Hackathon 2026. Contributions are welcome.

## Development Setup

### Prerequisites

- Node.js 22+
- pnpm 9+
- A Gemini API key (free tier works for development)

### Installation

```bash
git clone https://github.com/finos/dtcch-2026-opsflow-llc.git
cd dtcch-2026-opsflow-llc
pnpm install
cp .env.example .env.local
# Edit .env.local and add your GOOGLE_GENERATIVE_AI_API_KEY
pnpm dev
```

## Project Structure

See the [System Overview](/architecture/system-overview) for a full directory breakdown. Key areas:

- `src/lib/agents/` — AI agent implementations (add new agents here)
- `src/components/dashboard/` — Dashboard UI components
- `skills/` — Compliance knowledge files for LLM prompts
- `agents/` — Agent YAML configurations

## Code Style

### TypeScript

- Strict mode — no `any`. Use `unknown` + type guards
- Zod schemas for all external data (CALM input, LLM output, API payloads)
- `interface` for object shapes, `type` for unions/intersections

### React

- Server Components by default (App Router)
- `'use client'` only where needed (hooks, Zustand, interactivity)
- `React.memo` on expensive render components

### Naming Conventions

| Thing | Convention | Example |
|-------|-----------|---------|
| Files | kebab-case | `architecture-analyzer.ts` |
| Components | PascalCase | `ComplianceGauge.tsx` |
| Types/Interfaces | PascalCase | `AgentEvent` |
| Constants | UPPER_SNAKE_CASE | `SEVERITY_ORDER` |
| Zod schemas | camelCase + `Schema` suffix | `agentEventSchema` |

### Styling

- Dark theme only (slate-900 bg, slate-800 cards)
- Tailwind CSS classes — no CSS modules
- shadcn/ui components for all standard UI elements
- Compliance colors: emerald (compliant), amber (partial), red (non-compliant)

## Testing

Run the test suite:

```bash
pnpm test        # Watch mode
pnpm test:run    # Single run
```

Tests use Vitest with jsdom for component testing.

### Test Coverage Requirements

- Unit tests for all parser logic (`src/lib/calm/`)
- Unit tests for compliance scoring (`src/lib/compliance/`)
- Integration tests for API route schemas

## Pull Request Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Make your changes with tests
4. Run the full check suite:
   ```bash
   pnpm typecheck
   pnpm lint
   pnpm test:run
   pnpm build
   ```
5. Commit with DCO sign-off: `git commit -s -m "feat: add my feature"`
6. Push and open a Pull Request

### Commit Message Format

We use Conventional Commits:

```
type(scope): description

Types: feat, fix, refactor, test, docs, chore
Scope: component name, agent name, or subsystem
```

Examples:
```
feat(compliance-mapper): add DORA framework support
fix(risk-scorer): handle empty findings array
docs(api): update response schema examples
```

### DCO Sign-Off

All commits must include a Developer Certificate of Origin (DCO) sign-off:

```bash
git commit -s -m "your message"
```

This adds `Signed-off-by: Your Name <email@example.com>` to the commit.

## License

CALMGuard is licensed under the [Apache 2.0 License](https://github.com/finos/dtcch-2026-opsflow-llc/blob/main/LICENSE).

By contributing, you agree that your contributions will be licensed under Apache 2.0.

## Code of Conduct

This project follows the [FINOS Community Code of Conduct](https://www.finos.org/code-of-conduct).
