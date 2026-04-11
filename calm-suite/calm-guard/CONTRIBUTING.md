# Contributing to CALMGuard

CALMGuard is an Apache 2.0 licensed FINOS Hackathon project. All contributions via pull request. Each commit must include a DCO sign-off line:

```
Signed-off-by: Your Name <your.email@example.com>
```

Use `git commit -s` to add this automatically.

## Development Setup

```bash
git clone https://github.com/your-org/calmguard
cd calmguard
pnpm install          # also runs pnpm prepare which installs Husky
cp .env.example .env  # add your GOOGLE_GENERATIVE_AI_API_KEY
pnpm dev
```

**Required:** At least one LLM provider API key. Gemini is the default (`GOOGLE_GENERATIVE_AI_API_KEY`).

## Development Workflow

### Branch Naming

Create feature branches from `main`. Use these prefixes:

| Prefix | When |
|--------|------|
| `feat/` | New feature or component |
| `fix/` | Bug fix |
| `docs/` | Documentation only |
| `test/` | Tests only |
| `refactor/` | Refactoring, no behavior change |
| `chore/` | Tooling, config, dependencies |

Example: `feat/risk-heat-map`, `fix/sse-reconnect`, `docs/threat-model`

### Commit Messages

Conventional commits format:

```
type(scope): short description

- detail 1
- detail 2

Signed-off-by: Your Name <email>
```

Types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`

Scope: the subsystem being changed (e.g., `agent`, `parser`, `dashboard`, `ci`)

## Pull Request Process

### Before Opening a PR

1. Run all checks locally:
   ```bash
   pnpm lint        # ESLint (must pass with 0 warnings)
   pnpm typecheck   # TypeScript strict check
   pnpm test:run    # Vitest test suite
   pnpm build       # Production build
   ```

2. Make sure CI would pass — the same checks run in GitHub Actions.

3. Self-review your diff. As a solo developer (hackathon context), you are your own reviewer.

### PR Requirements

- **All CI checks must pass:** lint, typecheck, test, build
- **SAST scans must pass:** CodeQL and Semgrep must not report error-severity findings
- **One PR per feature/fix:** Keep PRs focused. Reviewer sanity matters.
- **PR template:** Fill out `.github/PULL_REQUEST_TEMPLATE.md` — describe what changed and how to verify it.

### CI Pipeline

On every PR and push to `main`:

| Check | Tool | Condition |
|-------|------|-----------|
| Lint | `pnpm lint` | 0 warnings, 0 errors |
| TypeScript | `pnpm typecheck` | 0 errors (strict mode) |
| Tests | `pnpm test:run` | All pass |
| Build | `pnpm build` | Exits 0 |
| Dependency audit | `pnpm audit` | No high/critical CVEs |
| License check | `license-checker` | No GPL/AGPL dependencies |
| SAST | CodeQL + Semgrep | No error-severity findings |

## Branch Protection Rules

These rules are configured in GitHub Settings > Branches for the `main` branch:

- **Require a pull request before merging** — no direct pushes to `main`
- **Require status checks to pass before merging:** `lint`, `test`, `build`
- **Require conversation resolution** — all review comments resolved
- **Do not allow bypassing the above settings** — applies to admins too

To configure programmatically:
```bash
gh api repos/OWNER/REPO/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["lint","test","build"]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews=null \
  --field restrictions=null
```

## Pre-commit Hooks

Husky runs ESLint on staged `.ts` and `.tsx` files before every commit.

**Setup** (automatic after `pnpm install` via the `prepare` script):
```bash
pnpm install  # installs hooks
```

**What runs:**
- `eslint --fix --max-warnings=0` on all staged `.ts`/`.tsx` files
- Auto-fixes where possible, blocks commit if unfixable issues remain

**Skip if needed** (use sparingly):
```bash
git commit --no-verify -m "wip: broken state, will fix"
```

Don't use `--no-verify` to bypass real issues — fix them instead.

## Code Standards

See `CLAUDE.md` for the full technical spec, but the key points:

- **TypeScript strict mode:** No `any`, no unsafe type assertions
- **Zod schemas:** For all external data (CALM input, LLM output, API payloads)
- **Tailwind CSS:** Dark theme, no CSS modules, no inline styles
- **React Server Components:** Default; `'use client'` only where required
- **Agent outputs:** Always `generateObject` with typed Zod schema, never `generateText`

## Security

See `SECURITY.md` for our threat model and vulnerability reporting process.

If you find a security issue, report it responsibly before opening a public issue.
