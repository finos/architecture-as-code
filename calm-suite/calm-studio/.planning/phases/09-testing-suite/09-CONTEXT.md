# Phase 9: Testing Suite - Context

**Gathered:** 2026-03-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Comprehensive test coverage across unit, integration, E2E, and component levels. Fills testing gaps in existing stores/modules, adds Playwright E2E tests for critical user workflows, adds @testing-library/svelte component tests for interactive panels, creates a shared fixture library, and enforces coverage thresholds in CI. Required for FINOS project acceptance.

</domain>

<decisions>
## Implementation Decisions

### E2E Test Scope
- All four critical workflows covered by Playwright E2E tests:
  1. **Core diagram flow** — create diagram, add nodes, draw edges, export CALM JSON, re-import and verify
  2. **Template + governance** — load FluxNova template, select AI node, open governance panel, apply mitigation, export with decorator
  3. **C4 navigation** — switch Context/Container/Component views, drill into container, breadcrumb back
  4. **Validation flow** — create invalid architecture, click Validate, see errors, click error to select node, fix, re-validate clean
- Functional assertions only — no visual regression snapshots (screenshot comparison too fragile across OS/browser/DPI)
- Mock file I/O at browser level — intercept File System Access API, test export content not OS file dialogs
- E2E CI timing: Claude's Discretion (every PR vs merge-to-main based on test runtime)

### Component Test Depth
- Test interactive panels only (~7 components): NodeProperties, EdgeProperties, ControlsList, GovernancePanel, TemplatePicker, ValidationPanel, Toolbar
- Skip pure-display node/edge components (GenericNode, ContainerNode, ExtensionNode) — covered by E2E
- Test via rendered output using @testing-library/svelte render() + fireEvent — treat Svelte 5 runes as implementation details
- Use real data with fixtures, not mocked stores — consistent with existing no-mock test pattern
- Include basic a11y checks — assert ARIA labels exist, buttons focusable, form inputs labeled

### Test Data Strategy
- Shared fixture library in `packages/calm-core/test-fixtures/`
- TypeScript factory functions: createMinimalArch(), createFluxNovaArch(), createAIGovernanceArch() — type-safe, composable, accept overrides
- New tests use shared fixtures; existing 13 test suites stay as-is (don't migrate working tests)

### Coverage Threshold
- Tiered targets enforced in CI (fail if below):
  - calm-core: 90%
  - extensions: 80%
  - mcp-server: 80%
  - studio: 60%
- Fill all untested store/module gaps: validation.svelte.ts, governance.svelte.ts, c4State.svelte.ts, export.ts, templates/registry.ts
- Coverage badge on README for FINOS visibility

### Claude's Discretion
- E2E CI timing (every PR vs merge-to-main)
- Exact Playwright test structure (page objects vs inline selectors)
- Coverage badge provider (Codecov, Coveralls, or GitHub Actions native)
- Whether to add vitest coverage config to existing packages or a shared vitest preset
- Test file organization within apps/studio/src/tests/

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Vitest** — established across all 4 packages (3.x/4.x) with working configs
- **Playwright** — configured in `apps/studio/playwright.config.ts` (Chromium, localhost:5173, auto-starts dev server) but zero tests written
- **@testing-library/svelte 5.2.7** — installed in studio, never used yet
- **jsdom 25.0.1** — installed in studio for component test DOM environment
- **13 existing test suites** — ~3,547 lines of tests across calm-core (4), extensions (2), mcp-server (7), studio (11)
- **Helper functions** — makeNode(), makeRel(), makeArch() patterns in existing tests

### Established Patterns
- `describe/it/expect` with vitest — no custom test DSL
- Inline fixtures per test file (current pattern, not changing for existing tests)
- `beforeEach` resets state between tests
- Store functions called directly, state accessed via getters
- `mkdtempSync` + `rmSync` for temp directories in I/O tests
- `vi.stubGlobal` for browser API mocking (File System Access API)
- Pure TypeScript modules kept separate from .svelte.ts stores for testability

### Integration Points
- `packages/calm-core/vitest.config.ts` — add coverage config
- `packages/extensions/vitest.config.ts` — add coverage config
- `packages/mcp-server/vitest.config.ts` — add coverage config
- `apps/studio/playwright.config.ts` — E2E tests go in `src/tests/e2e/`
- `.github/workflows/` — CI needs coverage reporting + threshold enforcement
- `README.md` — coverage badge

</code_context>

<specifics>
## Specific Ideas

- London School TDD approach per TEST-01 requirement — outside-in, behavior-driven
- FINOS project acceptance requires demonstrable test coverage — the badge and CI enforcement make this auditable
- The OSFF Toronto demo flow (template + governance) should be an E2E test — ensures the demo never regresses

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-testing-suite*
*Context gathered: 2026-03-15*
