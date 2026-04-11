# Phase 9: Testing Suite - Research

**Researched:** 2026-03-15
**Domain:** Vitest (coverage), @testing-library/svelte 5, Playwright 1.x, CI coverage reporting
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**E2E Test Scope**
- All four critical workflows covered by Playwright E2E tests:
  1. Core diagram flow — create diagram, add nodes, draw edges, export CALM JSON, re-import and verify
  2. Template + governance — load FluxNova template, select AI node, open governance panel, apply mitigation, export with decorator
  3. C4 navigation — switch Context/Container/Component views, drill into container, breadcrumb back
  4. Validation flow — create invalid architecture, click Validate, see errors, click error to select node, fix, re-validate clean
- Functional assertions only — no visual regression snapshots (screenshot comparison too fragile across OS/browser/DPI)
- Mock file I/O at browser level — intercept File System Access API, test export content not OS file dialogs
- E2E CI timing: Claude's Discretion (every PR vs merge-to-main based on test runtime)

**Component Test Depth**
- Test interactive panels only (~7 components): NodeProperties, EdgeProperties, ControlsList, GovernancePanel, TemplatePicker, ValidationPanel, Toolbar
- Skip pure-display node/edge components (GenericNode, ContainerNode, ExtensionNode) — covered by E2E
- Test via rendered output using @testing-library/svelte render() + fireEvent — treat Svelte 5 runes as implementation details
- Use real data with fixtures, not mocked stores — consistent with existing no-mock test pattern
- Include basic a11y checks — assert ARIA labels exist, buttons focusable, form inputs labeled

**Test Data Strategy**
- Shared fixture library in `packages/calm-core/test-fixtures/`
- TypeScript factory functions: createMinimalArch(), createFluxNovaArch(), createAIGovernanceArch() — type-safe, composable, accept overrides
- New tests use shared fixtures; existing 13 test suites stay as-is (don't migrate working tests)

**Coverage Threshold**
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

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TEST-01 | London School TDD — outside-in test development for all features | Existing store pattern (call functions directly, assert state via getters) is outside-in behavior testing; no change in approach needed |
| TEST-02 | Unit tests for sync engine, CALM model, CALM validation (vitest) | calmModel.svelte.ts, validation.svelte.ts, c4State.svelte.ts, governance.svelte.ts are pure state modules fully testable with vitest + jsdom; coverage config needed in all 4 packages |
| TEST-03 | Integration tests for bidirectional sync, MCP server tools, extension pack loading | MCP integration.test.ts pattern already established; sync engine needs applyFromJson → getModel → applyFromCanvas round-trip test; extension pack loading tested via registry.test.ts pattern |
| TEST-04 | E2E tests for full user workflows (Playwright) — create diagram, edit code, export, import | Playwright 1.58.2 installed, config exists at apps/studio/playwright.config.ts; zero test files yet; 4 workflow scenarios locked |
| TEST-05 | Component tests for all custom Svelte node/edge components (@testing-library/svelte) | @testing-library/svelte 5.3.1 + jsdom 25.0.1 installed but never used; 7 interactive panel components identified; Svelte 5 rune-aware render() pattern available |

</phase_requirements>

---

## Summary

CalmStudio already has a functional test infrastructure: Vitest across all 4 packages, 13 existing test suites (~3,547 lines), Playwright configured but with zero E2E tests, and @testing-library/svelte installed but never invoked. Phase 9 does not build test infrastructure from scratch — it fills four specific gaps: (1) coverage configuration and thresholds in all packages, (2) unit/integration tests for the untested stores and modules (validation.svelte.ts, governance.svelte.ts, c4State.svelte.ts, export.ts, templates/registry.ts), (3) four Playwright E2E workflows, and (4) component tests for the 7 interactive panels.

The existing test patterns are clean and consistent: `describe/it/expect`, inline factory functions (`makeNode`, `makeArch`), module-level $state accessed via exported getter functions, `resetModel()`/`resetC4State()` called in `beforeEach`. The new shared fixture library in `packages/calm-core/test-fixtures/` generalizes these inline helpers into reusable typed factories. Coverage is gated by `@vitest/coverage-v8` (not yet installed) configured per-package with the tiered thresholds.

**Primary recommendation:** Install `@vitest/coverage-v8` in all 4 packages, add coverage config with thresholds to each vitest.config.ts, write the missing unit/integration tests following established patterns, write 4 Playwright E2E scenarios as page-object-free inline tests, write 7 component tests with @testing-library/svelte render() + user-event, and wire coverage upload to CI.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | 3.2.4 (studio), 3.2.4/4.1.0 (packages) | Unit + integration test runner | Already in all 4 packages; SvelteKit-native via vite plugin |
| @vitest/coverage-v8 | must match vitest version | V8 native coverage (no instrumentation) | Fastest coverage provider; works without babel; matches vitest version |
| @testing-library/svelte | 5.3.1 | Svelte 5 component tests | Already installed in studio; Svelte 5 rune-aware as of v5 |
| @playwright/test | 1.50.1 | E2E browser automation | Already installed and configured; Chromium + localhost:5173 |
| jsdom | 25.0.1 | DOM environment for vitest | Already installed in studio; set as `environment: 'jsdom'` in vite.config.ts |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @testing-library/user-event | ^14.x | Realistic user interaction simulation | Component tests needing typed input, tab navigation, complex interactions |
| @axe-core/playwright | ^4.x | Accessibility checks in E2E tests | Optional a11y scanning during E2E; heavier than manual aria assertions |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @vitest/coverage-v8 | @vitest/coverage-istanbul | Istanbul adds instrumentation overhead; v8 requires no transform, faster |
| Codecov | Coveralls or GitHub Actions native badge | Codecov has free tier for OSS, integrates with GitHub PRs natively; FINOS-visible |
| Page objects | Inline selectors | Page objects add abstraction for large suites; this suite is 4 flows so inline is fine |

**Installation (coverage provider — required before any coverage can run):**
```bash
pnpm add -D @vitest/coverage-v8 --filter @calmstudio/calm-core
pnpm add -D @vitest/coverage-v8 --filter @calmstudio/extensions
pnpm add -D @vitest/coverage-v8 --filter @calmstudio/mcp-server
pnpm add -D @vitest/coverage-v8 --filter @calmstudio/studio
```

**Coverage badge (Codecov — recommended for FINOS visibility):**
```bash
# No install needed — add codecov.yml config and GitHub Actions upload step
```

---

## Architecture Patterns

### Recommended Project Structure

```
packages/calm-core/
├── src/                      # source (existing)
└── test-fixtures/            # NEW: shared fixture factory functions
    └── index.ts              # createMinimalArch(), createFluxNovaArch(), createAIGovernanceArch()

apps/studio/src/tests/
├── *.test.ts                 # existing unit tests (11 files — unchanged)
├── stores/                   # NEW: untested store tests
│   ├── validation.test.ts    # validation.svelte.ts coverage
│   ├── governance.test.ts    # governance.svelte.ts coverage
│   └── c4State.test.ts       # c4State.svelte.ts coverage (file exists already in src/lib/c4/)
├── io/                       # NEW: export module tests
│   └── export.test.ts        # export.ts coverage (AIGF decorator, exportAsCalm)
├── templates/                # NEW: template registry tests
│   └── registry.test.ts      # templates/registry.ts coverage
├── components/               # NEW: @testing-library/svelte component tests
│   ├── NodeProperties.test.ts
│   ├── EdgeProperties.test.ts
│   ├── ControlsList.test.ts
│   ├── GovernancePanel.test.ts
│   ├── TemplatePicker.test.ts
│   ├── ValidationPanel.test.ts
│   └── Toolbar.test.ts
└── e2e/                      # E2E tests (Playwright)
    ├── core-diagram-flow.spec.ts
    ├── template-governance.spec.ts
    ├── c4-navigation.spec.ts
    └── validation-flow.spec.ts
```

### Pattern 1: Vitest Coverage Configuration (per-package)

**What:** Add `coverage` block to each vitest.config.ts with provider, thresholds, and include/exclude patterns.
**When to use:** All 4 packages need this configuration.
**Example (calm-core):**
```typescript
// packages/calm-core/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.d.ts'],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
    },
  },
});
```

### Pattern 2: Store Unit Test (module-level $state)

**What:** Import getter/mutation functions directly; call `reset*()` in `beforeEach`; assert via getters.
**When to use:** All `.svelte.ts` stores — validation, governance, c4State.
**Example (validation.svelte.ts):**
```typescript
// Source: established pattern in apps/studio/src/tests/calmModel.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  runValidation, clearValidation, getIssues,
  isPanelOpen, closePanel
} from '$lib/stores/validation.svelte';

// NOTE: validation.svelte.ts calls getModel() internally.
// Tests must call applyFromJson() first so getModel() returns known data.
import { applyFromJson, resetModel } from '$lib/stores/calmModel.svelte';

beforeEach(() => {
  resetModel();
  clearValidation();
});

it('runValidation on valid arch returns empty issues, panel opens', () => {
  applyFromJson({ nodes: [], relationships: [] });
  runValidation();
  expect(isPanelOpen()).toBe(true);
  // empty arch: no errors
  const errors = getIssues().filter(i => i.severity === 'error');
  expect(errors).toHaveLength(0);
});
```

### Pattern 3: Shared Fixture Factory

**What:** TypeScript factory functions in `packages/calm-core/test-fixtures/index.ts` that return complete, type-safe CalmArchitecture objects with sensible defaults and override support.
**When to use:** All new test files in Phase 9; existing tests keep their inline helpers.
**Example:**
```typescript
// packages/calm-core/test-fixtures/index.ts
import type { CalmArchitecture, CalmNode, CalmRelationship } from '../src/index.js';

export function createMinimalArch(overrides: Partial<CalmArchitecture> = {}): CalmArchitecture {
  return {
    nodes: [
      { 'unique-id': 'svc-1', 'node-type': 'service', name: 'API Service', description: 'Backend API' },
      { 'unique-id': 'db-1', 'node-type': 'database', name: 'Main DB', description: 'PostgreSQL' },
    ],
    relationships: [
      { 'unique-id': 'rel-1', 'relationship-type': 'connects', source: 'svc-1', destination: 'db-1', protocol: 'HTTPS' },
    ],
    ...overrides,
  };
}

export function createAIGovernanceArch(overrides: Partial<CalmArchitecture> = {}): CalmArchitecture {
  return {
    nodes: [
      { 'unique-id': 'llm-1', 'node-type': 'ai:llm', name: 'LLM', description: 'Language Model' },
      { 'unique-id': 'agent-1', 'node-type': 'ai:agent', name: 'Agent', description: 'AI Agent' },
    ],
    relationships: [
      { 'unique-id': 'rel-1', 'relationship-type': 'interacts', source: 'agent-1', destination: 'llm-1' },
    ],
    ...overrides,
  };
}

export function createFluxNovaArch(overrides: Partial<CalmArchitecture> = {}): CalmArchitecture {
  return {
    nodes: [
      { 'unique-id': 'platform-1', 'node-type': 'fluxnova:platform', name: 'FluxNova Platform', description: '' },
      { 'unique-id': 'engine-1', 'node-type': 'fluxnova:engine', name: 'Process Engine', description: '' },
    ],
    relationships: [],
    ...overrides,
  };
}
```

### Pattern 4: @testing-library/svelte Component Test

**What:** Render a Svelte 5 component with real prop data + real stores (no mocks); interact with fireEvent or user-event; assert rendered DOM output.
**When to use:** The 7 interactive panel components.
**Key constraint:** Components that read module-level $state stores (governance.svelte.ts, validation.svelte.ts) require the store to be pre-populated before render. Use the same store setup pattern as unit tests (call applyFromJson + store setup function before render()).

```typescript
// Source: @testing-library/svelte docs + project pattern
import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import NodeProperties from '$lib/properties/NodeProperties.svelte';
import { applyFromJson, resetModel } from '$lib/stores/calmModel.svelte';
import type { Node } from '@xyflow/svelte';

function makeNode(id: string, calmType: string): Node {
  return {
    id, type: calmType,
    position: { x: 0, y: 0 },
    data: { label: 'API Service', calmId: id, calmType, description: 'Backend API' },
  };
}

beforeEach(() => {
  resetModel();
  applyFromJson({
    nodes: [{ 'unique-id': 'svc-1', 'node-type': 'service', name: 'API Service', description: 'Backend API' }],
    relationships: [],
  });
});

it('renders node name in input field', () => {
  const { getByLabelText } = render(NodeProperties, {
    props: { node: makeNode('svc-1', 'service') },
  });
  const input = getByLabelText(/name/i) as HTMLInputElement;
  expect(input.value).toBe('API Service');
});

it('name input has associated label for a11y', () => {
  const { getByRole } = render(NodeProperties, {
    props: { node: makeNode('svc-1', 'service') },
  });
  expect(getByRole('textbox', { name: /name/i })).toBeTruthy();
});
```

### Pattern 5: Playwright E2E Test

**What:** Browser-level tests that drive the real SvelteKit dev server; use data-testid attributes for stable selectors; assert on DOM state and network intercepts.
**When to use:** The 4 locked workflow scenarios.
**Note on File I/O mocking:** The File System Access API (`showSaveFilePicker`, `showOpenFilePicker`) is a browser API. In Playwright, route intercept is for network; for FSA API mocking, use `page.addInitScript` to stub `window.showSaveFilePicker` before page load. Alternatively, check exported Blob content via `page.evaluate` on the download event.

```typescript
// Source: Playwright docs + project playwright.config.ts
import { test, expect } from '@playwright/test';

test('core diagram flow: add nodes, export CALM JSON, re-import', async ({ page }) => {
  // Stub FSA API before navigation
  await page.addInitScript(() => {
    let capturedContent = '';
    Object.defineProperty(window, '__lastExportContent', {
      get: () => capturedContent,
      set: (v: string) => { capturedContent = v; },
    });
    // Override showSaveFilePicker with a spy that writes to __lastExportContent
    // ... (implementation varies, see pitfalls section)
  });

  await page.goto('/');
  // Drag a node from palette
  // ...
  // Click Export → CALM JSON
  const exportedJson = await page.evaluate(() => (window as unknown as Record<string, string>)['__lastExportContent']);
  const arch = JSON.parse(exportedJson);
  expect(arch.nodes).toHaveLength(1);
});
```

### Anti-Patterns to Avoid

- **Mocking store modules in component tests:** The project pattern explicitly uses real stores with real data. Mocking `$lib/stores/calmModel.svelte` breaks the module-level singleton and produces unreliable tests.
- **Direct $state manipulation in tests:** Never write `module.$state = value`. Always use exported mutation functions (`applyFromJson`, `resetModel`).
- **Snapshot-based visual regression in E2E:** Explicitly out of scope (CONTEXT.md decision). Produces fragile tests across OS/DPI.
- **Testing Svelte 5 rune implementation details:** Do not assert on `$derived` internals. Test rendered DOM output and behavior only.
- **Running E2E without dev server:** The Playwright webServer config auto-starts `pnpm dev`; never call `playwright test` before the dev server is ready or with wrong port.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Coverage instrumentation | Custom transform plugin | @vitest/coverage-v8 | V8 native; zero config beyond provider declaration |
| DOM simulation for component tests | Custom JSDOM setup | jsdom (already in vite.config.ts `environment: 'jsdom'`) | Already configured; @testing-library/svelte uses it automatically |
| ARIA assertion library | Custom a11y checker | Manual `getByRole`, `getByLabelText` | @testing-library queries are accessibility-first by design |
| Coverage badge generation | Custom GitHub Actions step | Codecov GitHub App or shields.io with lcov upload | Standard CI pattern; generates badge URL from coverage reports |
| Playwright fixtures for dev server | Custom test server | Playwright `webServer` config (already in playwright.config.ts) | Already configured to start `pnpm dev` on port 5173 |

**Key insight:** Every infrastructure piece is already in place. This phase is test authorship, not infrastructure setup — except for adding @vitest/coverage-v8 to all 4 packages (currently missing from all vitest configs).

---

## Common Pitfalls

### Pitfall 1: Vitest Can't Resolve $lib Aliases in Store Tests

**What goes wrong:** `import { applyFromJson } from '$lib/stores/calmModel.svelte'` fails in vitest with "Cannot find module '$lib/...'" when running from the packages directory or without SvelteKit plugin.
**Why it happens:** The `$lib` alias is SvelteKit-specific and requires the `@sveltejs/kit/vite` plugin. The studio's `vite.config.ts` includes it; standalone vitest without the plugin won't resolve `$lib`.
**How to avoid:** Studio tests run via `apps/studio/vite.config.ts` which includes `sveltekit()` plugin. Ensure tests are run with `pnpm test` from studio (or `pnpm -r run test`), never with bare `vitest` from project root.
**Warning signs:** Module resolution error on `$lib/*` imports; happens if running `vitest` directly without SvelteKit vite config.

### Pitfall 2: @testing-library/svelte Requires Svelte 5 Mount Mode

**What goes wrong:** `render(Component)` renders nothing or throws "Svelte 5 components cannot be mounted with createComponent".
**Why it happens:** @testing-library/svelte 5.x auto-detects Svelte 5 and uses the rune-aware mount path. If the wrong version is imported or the peer dependency is mismatched, fallback to Svelte 4 behavior.
**How to avoid:** Version installed is 5.3.1 (actual installed: `@testing-library+svelte@5.3.1_svelte@5.53.10`). No configuration needed — auto-detected. If issues arise, check that `svelte` peer dep in @testing-library/svelte resolves to 5.x.
**Warning signs:** Empty rendered output; `component.$set is not a function` errors.

### Pitfall 3: File System Access API Stub in Playwright

**What goes wrong:** `exportAsCalm` calls `window.showSaveFilePicker` (FSA API) which throws `NotSupportedError` in Playwright Chromium (API present but OS dialogs blocked).
**Why it happens:** Playwright runs Chromium without OS-level file dialog support. FSA API is present in the browser but cannot open system file picker.
**How to avoid:** Use `page.addInitScript` to override `window.showSaveFilePicker` before navigation. The stub should capture the written content to a window variable for assertion. Alternatively, configure the browser context to intercept downloads and read the Blob content via download event.
**Warning signs:** `NotSupportedError: showSaveFilePicker is not supported` in E2E tests.

Recommended stub:
```typescript
await page.addInitScript(() => {
  window.showSaveFilePicker = async () => ({
    createWritable: async () => ({
      write: async (data: BlobPart) => {
        (window as Record<string, unknown>)['__lastExport'] = typeof data === 'string' ? data : await new Blob([data]).text();
      },
      close: async () => {},
    }),
  }) as unknown as FileSystemFileHandle;
});
```

### Pitfall 4: Module-Level $state Reset Between Tests

**What goes wrong:** Test 2 sees state pollution from Test 1 — issues array contains stale validation results, governance score is wrong.
**Why it happens:** Vitest runs tests in the same module context within a file. Module-level `$state` persists across tests unless explicitly reset.
**How to avoid:** Always call the exported reset function (`resetModel()`, `clearValidation()`, `resetC4State()`) in `beforeEach`. These reset functions are already provided by each store module.
**Warning signs:** Tests pass in isolation but fail when run as a suite; test order dependency.

### Pitfall 5: Coverage Thresholds Apply to `vitest run --coverage` Only

**What goes wrong:** CI passes because `pnpm -r run test` does not enable coverage by default; thresholds are never enforced.
**Why it happens:** Vitest only runs coverage when the `--coverage` flag is passed or `coverage.enabled: true` is in config. The existing CI job runs `pnpm -r run test` without coverage flag.
**How to avoid:** Either add `--coverage` to the test script in package.json, set `coverage.enabled: true` in vitest.config.ts, or add a separate CI step `pnpm --filter [pkg] run test -- --coverage`. Recommended: add `test:coverage` script to each package and add a CI coverage step.
**Warning signs:** CI passing with 0% coverage reported; no coverage artifacts in CI logs.

### Pitfall 6: governance.svelte.ts Tests Need applyFromJson Setup

**What goes wrong:** `refreshGovernance()` calls `getModel()` which returns an empty arch by default — AI node count is 0, score is null even after test setup.
**Why it happens:** `governance.svelte.ts` reads from `calmModel.svelte.ts` singleton. The model starts empty.
**How to avoid:** In governance tests, call `resetModel()` + `applyFromJson(createAIGovernanceArch())` in `beforeEach` before calling governance functions.
**Warning signs:** `getArchitectureScore()` always returns null; `hasAINodes()` always false.

### Pitfall 7: Playwright webServer Config vs CI

**What goes wrong:** E2E tests hang in CI because the dev server fails to start (port already in use, or build step needed first).
**Why it happens:** `reuseExistingServer: !process.env['CI']` means in CI, Playwright always starts a fresh dev server. If the port is taken or the build is missing, it times out.
**How to avoid:** In CI, add a dedicated E2E job that installs Playwright browsers (`npx playwright install --with-deps chromium`) and runs `pnpm test:e2e` after the build step. Use the `timeout` option in `webServer` config to give the dev server enough time to start.
**Warning signs:** E2E job times out waiting for localhost:5173; `connect ECONNREFUSED` in test output.

---

## Code Examples

Verified patterns from official sources and project codebase:

### Vitest Coverage Config with Thresholds

```typescript
// Source: Vitest docs (https://vitest.dev/config/#coverage) + project pattern
// packages/calm-core/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
    },
  },
});
```

### GitHub Actions Coverage Step

```yaml
# Source: Codecov docs + existing ci.yml pattern
- name: Test with coverage
  run: pnpm --filter @calmstudio/calm-core run test -- --coverage
        && pnpm --filter @calmstudio/extensions run test -- --coverage
        && pnpm --filter @calmstudio/mcp-server run test -- --coverage
        && pnpm --filter @calmstudio/studio run test -- --coverage

- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v4
  with:
    files: |
      packages/calm-core/coverage/lcov.info
      packages/extensions/coverage/lcov.info
      packages/mcp-server/coverage/lcov.info
      apps/studio/coverage/lcov.info
    fail_ci_if_error: true
```

### c4State.svelte.ts Unit Test

```typescript
// Source: project pattern (c4Filter.test.ts) + c4State.svelte.ts resetC4State() export
import { describe, it, expect, beforeEach } from 'vitest';
import {
  resetC4State, enterC4Mode, exitC4Mode, setC4Level,
  drillDown, drillUpTo, isC4Mode, getC4Level, getC4DrillStack,
  getCurrentDrillParentId,
} from '$lib/c4/c4State.svelte';

beforeEach(() => {
  resetC4State();
});

it('initial state: C4 mode off, drill stack empty', () => {
  expect(isC4Mode()).toBe(false);
  expect(getC4Level()).toBeNull();
  expect(getC4DrillStack()).toHaveLength(0);
});

it('enterC4Mode activates mode and clears stack', () => {
  drillDown('svc-1', 'Payment System');
  enterC4Mode('context');
  expect(isC4Mode()).toBe(true);
  expect(getC4Level()).toBe('context');
  expect(getC4DrillStack()).toHaveLength(0);
});

it('drillUpTo(0) returns to root (empty stack)', () => {
  enterC4Mode('container');
  drillDown('svc-1', 'System A');
  drillDown('db-1', 'Database');
  drillUpTo(0);
  expect(getC4DrillStack()).toHaveLength(0);
  expect(getCurrentDrillParentId()).toBeNull();
});
```

### Playwright: C4 Navigation Flow

```typescript
// Source: Playwright docs + project playwright.config.ts
import { test, expect } from '@playwright/test';

test('C4 navigation: switch views, drill down, breadcrumb back', async ({ page }) => {
  await page.goto('/');
  // Load an architecture with container nodes via file import or direct model seeding
  // ...

  // Switch to Context view
  await page.getByRole('button', { name: /context/i }).click();
  await expect(page.getByTestId('c4-level-indicator')).toHaveText('Context');

  // Switch to Container view
  await page.getByRole('button', { name: /container/i }).click();

  // Drill into a container node (double-click)
  const containerNode = page.getByTestId('flow-node-sys-1');
  await containerNode.dblclick();
  await expect(page.getByTestId('c4-breadcrumb')).toBeVisible();

  // Breadcrumb back to root
  await page.getByTestId('c4-breadcrumb-root').click();
  await expect(page.getByTestId('c4-breadcrumb')).not.toBeVisible();
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| @testing-library/svelte 4.x (Svelte 4) | @testing-library/svelte 5.x (Svelte 5 rune-aware) | Oct 2024 | `render()` uses `mount()` instead of `new Component()` — no migration needed, already on 5.3.1 |
| @vitest/coverage-istanbul (babel instrumentation) | @vitest/coverage-v8 (V8 native) | Vitest 0.33+ | V8 is faster, no additional babel transform; recommended for new projects |
| Playwright `page.screenshot()` visual snapshots | Functional DOM assertions | Current best practice | Removes OS/DPI flakiness; this project explicitly decided against visual snapshots |
| Svelte 5 `$state` mutation via `vi.mock()` | Call exported reset functions | Svelte 5 rune era | Module-level runes are reactive by design; mocking them produces unreliable state |

**Deprecated/outdated:**
- `@testing-library/svelte` v4.x: Svelte 4 API (`new Component()`); do not use with Svelte 5
- `@vitest/coverage-istanbul`: Still functional but slower; no reason to choose it for a new project

---

## Open Questions

1. **Coverage badge provider choice**
   - What we know: Codecov (free for OSS), Coveralls (free for OSS), GitHub Actions native shield (simpler but less detail)
   - What's unclear: Whether the FINOS project will have a Codecov org token available or if shields.io static badge from lcov is sufficient for initial FINOS review
   - Recommendation: Start with Codecov (easiest integration, recognized by FINOS reviewers); fall back to GitHub-hosted badge if token setup is a blocker

2. **E2E CI timing: every PR vs merge-to-main**
   - What we know: 4 Playwright workflows; Chromium headless on ubuntu-latest; rough estimate 2-4 minutes per workflow = 8-16 minutes total
   - What's unclear: Actual runtime in CI (Chrome cold start + vite dev server startup can add 60-90s)
   - Recommendation: Run E2E on merge-to-main only initially; add `[e2e]` PR label trigger once timing is measured

3. **`data-testid` attribute coverage in existing components**
   - What we know: Existing Svelte components were not built with E2E selectors in mind; `getByRole` and `getByText` should cover most cases
   - What's unclear: Whether the C4 selector buttons, breadcrumb, and governance apply buttons have stable enough text/ARIA roles for Playwright selectors without adding `data-testid`
   - Recommendation: Planner should include a Wave 0 task to audit the 7 components and 4 E2E workflows for selector stability; add `data-testid` attributes where role/text selectors are ambiguous

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework (unit/integration) | Vitest 3.2.4 (studio, extensions, calm-core), 4.1.0 (mcp-server) |
| Framework (E2E) | Playwright 1.58.2 |
| Config file (studio) | `apps/studio/vite.config.ts` (inline test block) |
| Config file (packages) | `packages/*/vitest.config.ts` (all empty — need coverage config added) |
| E2E config | `apps/studio/playwright.config.ts` |
| Quick run command | `pnpm --filter @calmstudio/studio run test` |
| Full suite command | `pnpm -r run test && pnpm --filter @calmstudio/studio run test:e2e` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TEST-01 | London School TDD outside-in style | methodology (no single test file) | All vitest tests follow behavior-first outside-in pattern | n/a |
| TEST-02 | Unit tests: calmModel, validation store, governance store, c4State, export.ts, templates/registry | unit | `pnpm --filter @calmstudio/studio run test` | ❌ Wave 0: validation.test.ts, governance.test.ts, c4State.test.ts, export.test.ts, registry.test.ts |
| TEST-02 | Unit tests: calm-core validation, types, AIGF | unit | `pnpm --filter @calmstudio/calm-core run test` | ✅ exists |
| TEST-02 | Unit tests: extension pack registry | unit | `pnpm --filter @calmstudio/extensions run test` | ✅ exists |
| TEST-03 | Integration: bidirectional sync round-trip | integration | `pnpm --filter @calmstudio/studio run test` | ❌ Wave 0: sync-integration.test.ts |
| TEST-03 | Integration: MCP server tools end-to-end | integration | `pnpm --filter @calmstudio/mcp-server run test` | ✅ exists (integration.test.ts) |
| TEST-03 | Integration: extension pack loading | integration | `pnpm --filter @calmstudio/extensions run test` | ✅ exists (registry.test.ts + fluxnova.test.ts) |
| TEST-04 | E2E: core diagram flow (create/edit/export/import) | e2e | `pnpm --filter @calmstudio/studio run test:e2e` | ❌ Wave 0: core-diagram-flow.spec.ts |
| TEST-04 | E2E: template + governance flow | e2e | `pnpm --filter @calmstudio/studio run test:e2e` | ❌ Wave 0: template-governance.spec.ts |
| TEST-04 | E2E: C4 navigation flow | e2e | `pnpm --filter @calmstudio/studio run test:e2e` | ❌ Wave 0: c4-navigation.spec.ts |
| TEST-04 | E2E: validation flow | e2e | `pnpm --filter @calmstudio/studio run test:e2e` | ❌ Wave 0: validation-flow.spec.ts |
| TEST-05 | Component tests: 7 interactive panels | component | `pnpm --filter @calmstudio/studio run test` | ❌ Wave 0: all 7 component test files |

### Sampling Rate
- **Per task commit:** `pnpm --filter @calmstudio/studio run test` (unit tests only, <30s)
- **Per wave merge:** `pnpm -r run test` (all unit + integration across 4 packages)
- **Phase gate:** `pnpm -r run test && pnpm --filter @calmstudio/studio run test:e2e` before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/calm-core/test-fixtures/index.ts` — shared fixture factories (createMinimalArch, createFluxNovaArch, createAIGovernanceArch)
- [ ] `apps/studio/src/tests/stores/validation.test.ts` — covers validation.svelte.ts (TEST-02)
- [ ] `apps/studio/src/tests/stores/governance.test.ts` — covers governance.svelte.ts (TEST-02)
- [ ] `apps/studio/src/tests/stores/c4State.test.ts` — covers c4State.svelte.ts (TEST-02, note: resetC4State() already exported)
- [ ] `apps/studio/src/tests/io/export.test.ts` — covers export.ts generateAIGFDecorator + exportAsCalm logic (TEST-02)
- [ ] `apps/studio/src/tests/templates/registry.test.ts` — covers templates/registry.ts (TEST-02)
- [ ] `apps/studio/src/tests/integration/sync-integration.test.ts` — bidirectional sync round-trip (TEST-03)
- [ ] `apps/studio/src/tests/e2e/core-diagram-flow.spec.ts` — E2E workflow 1 (TEST-04)
- [ ] `apps/studio/src/tests/e2e/template-governance.spec.ts` — E2E workflow 2 (TEST-04)
- [ ] `apps/studio/src/tests/e2e/c4-navigation.spec.ts` — E2E workflow 3 (TEST-04)
- [ ] `apps/studio/src/tests/e2e/validation-flow.spec.ts` — E2E workflow 4 (TEST-04)
- [ ] `apps/studio/src/tests/components/NodeProperties.test.ts` — component test (TEST-05)
- [ ] `apps/studio/src/tests/components/EdgeProperties.test.ts` — component test (TEST-05)
- [ ] `apps/studio/src/tests/components/ControlsList.test.ts` — component test (TEST-05)
- [ ] `apps/studio/src/tests/components/GovernancePanel.test.ts` — component test (TEST-05)
- [ ] `apps/studio/src/tests/components/TemplatePicker.test.ts` — component test (TEST-05)
- [ ] `apps/studio/src/tests/components/ValidationPanel.test.ts` — component test (TEST-05)
- [ ] `apps/studio/src/tests/components/Toolbar.test.ts` — component test (TEST-05)
- [ ] Coverage provider install: `pnpm add -D @vitest/coverage-v8` in all 4 packages
- [ ] Coverage config blocks in all 4 `vitest.config.ts` files with tiered thresholds
- [ ] CI: add `test:coverage` script to each package and GitHub Actions coverage step + Codecov upload
- [ ] Playwright browser install: `npx playwright install --with-deps chromium` in CI workflow

---

## Sources

### Primary (HIGH confidence)
- Vitest source code / installed package at `node_modules/.pnpm/vitest@3.2.4*` — coverage config, threshold API confirmed from actual package
- `@testing-library/svelte@5.3.1` installed at `node_modules/.pnpm/@testing-library+svelte@5.3.1_svelte@5.53.10` — Svelte 5 compatibility confirmed
- `@playwright/test@1.50.1` + playwright 1.58.2 installed — confirmed in lockfile
- All 13 existing test files read directly — patterns confirmed from source

### Secondary (MEDIUM confidence)
- Codecov GitHub App documentation — standard FINOS/OSS CI pattern; verified via WebSearch (not fetched)
- Playwright `page.addInitScript` for FSA API mocking — documented pattern; confirmed in Playwright API reference

### Tertiary (LOW confidence)
- E2E runtime estimates (8-16 minutes) — heuristic; actual CI runtime depends on ubuntu-latest Chromium startup

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries directly inspected in node_modules lockfile
- Architecture: HIGH — all source files read; patterns extracted from 13 existing test files
- Pitfalls: HIGH (module resolution, $state reset) / MEDIUM (FSA API stub, CI timing) — code read + Playwright behavior known
- Coverage config: HIGH — vitest docs pattern verified against installed package structure

**Research date:** 2026-03-15
**Valid until:** 2026-06-15 (stable stack: Vitest, Playwright, @testing-library/svelte change slowly)
