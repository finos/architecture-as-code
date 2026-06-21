# CALM Widgets - AI Assistant Guide

This guide helps AI assistants work efficiently with the CALM widgets codebase.

## Overview

CALM Widgets is a TypeScript widget system built on Handlebars that provides reusable components for generating Markdown/HTML documentation from CALM architecture data.

## Tech Stack

- **Language**: TypeScript (compiler provided by the monorepo root, not pinned in this package)
- **Template Engine**: Handlebars
- **Build Tool**: tsup (esbuild-based)
- **Test Framework**: Vitest
- **Output Format**: HTML/Markdown

## Key Commands

**IMPORTANT**: Always run npm commands from the **repository root** using workspaces, not from within this package directory.

```bash
# All commands run from repository root
npm run build --workspace calm-widgets   # Build the package
npm test --workspace calm-widgets        # Run all tests
npm run lint --workspace calm-widgets    # Check for linting issues
npm run lint-fix --workspace calm-widgets # Auto-fix linting issues
npm run watch --workspace calm-widgets   # Watch mode for development
```

## Directory Structure

```
calm-widgets/
├── src/
│   ├── index.ts                    # Public exports
│   ├── widget-renderer.ts          # Template compilation & rendering
│   ├── widget-logger.ts            # Configurable logging for debugging
│   ├── widgets/                    # Widget implementations
│   │   ├── table/                  # Table widget
│   │   │   ├── index.ts             # Logic & transformToViewModel
│   │   │   ├── index.spec.ts        # Unit tests
│   │   │   ├── table-template.html  # Dispatcher (branches on isNested/isVertical)
│   │   │   ├── table-horizontal.html # Horizontal table template
│   │   │   ├── table-vertical.html  # Vertical table template
│   │   │   └── row-template.html    # Row rendering (recursive)
│   │   ├── list/                   # List widget
│   │   ├── json-viewer/            # JSON display widget
│   │   ├── flow-sequence/          # Mermaid sequence diagrams
│   │   ├── related-nodes/          # Mermaid graph diagrams
│   │   └── block-architecture/     # Block architecture diagrams
│   └── *.spec.ts                   # Unit tests
├── test-fixtures/                  # E2E test fixtures
│   ├── table-widget/               # Table widget test cases
│   │   ├── simple-object/          # Each scenario has:
│   │   │   ├── context.json        # Input data
│   │   │   ├── template.hbs        # Handlebars template
│   │   │   └── expected.md         # Expected output
│   │   └── ...
│   └── combined-widgets/           # Multi-widget test cases
└── README.md                       # User documentation
```

## Widget Architecture

### Widget Structure

Each widget implements the `CalmWidget<TContext, TOptions, TViewModel>` interface
(see `src/types.ts`):

```typescript
export const MyWidget: CalmWidget<MyContext, MyOptions, MyViewModel> = {
    id: 'my-widget',                 // helper name used in templates
    templatePartial: 'template.html', // main template file (relative to widget folder)
    partials: ['row-template.html'], // optional extra partials to register

    // Optional: register widget-scoped Handlebars helpers
    registerHelpers: () => ({
        myHelper: (value: unknown) => String(value),
    }),

    // Optional: transform raw context into the view model the template consumes
    transformToViewModel: (context, options) => {
        // Process context, apply options, return structured data
        return { /* view model */ };
    },

    // REQUIRED: type-guard validating the incoming context
    validateContext: (context): context is MyContext => {
        return typeof context === 'object' && context !== null;
    },
};
```

Key points:
- `id` is the Handlebars helper name (e.g. `{{my-widget ...}}`), not `name`.
- `templatePartial` names the main template file (resolved against the widget
  folder), not a `templatePath`.
- `partials` lists any additional partial templates to register.
- `validateContext` is **required** — it is a type-guard that gates rendering.
- `registerHelpers` and `transformToViewModel` are optional. Widgets such as
  `related-nodes` and `block-architecture` use `registerHelpers`/`partials`.

### Template System

Widgets use Handlebars templates rendered to HTML/Markdown:
- Each widget folder holds its template(s) plus any partials.
- Templates can call other widgets via Handlebars helpers.
- Template extensions are mixed: `flow-sequence`, `related-nodes`, and
  `block-architecture` use `.hbs`; `table`, `list`, and `json-viewer` use `.html`.

## Key Concepts

### Sections Parameter (Table Widget)

The table widget supports filtering columns by logical sections:

```handlebars
{{table node sections="overview"}}   {{!-- unique-id, name, description, node-type --}}
{{table node sections="extended"}}   {{!-- Custom properties, excludes schema fields --}}
{{table node sections="metadata"}}   {{!-- Only metadata property --}}
```

### Empty Message

Display a custom message when a table has no data:

```handlebars
{{table node sections="metadata" empty-message="There is no metadata"}}
```

### Nested Tables

When a cell value is an object/array, it renders as a nested table. The `isNested` flag controls wrapper elements to ensure valid HTML.

## Testing

### Unit Tests

Located alongside source files (`*.spec.ts`):

```typescript
describe('TableWidget', () => {
    it('transforms data to view model', () => {
        const vm = TableWidget.transformToViewModel!(context, options);
        expect(vm.rows).toHaveLength(3);
    });
});
```

### E2E Tests (Fixture-Based)

Located in `test-fixtures/` with `widgets.e2e.spec.ts`:

```
test-fixtures/<widget-name>/<scenario>/
├── context.json     # Input data (CALM model fragment)
├── template.hbs     # Handlebars template calling the widget
└── expected.md      # Expected HTML output (no markdown fences!)
```

**Important**: The `expected.md` files contain raw HTML/Markdown output, NOT wrapped in markdown code fences.

## Common Pitfalls & Lessons Learned

### 1. Undefined vs Missing Properties

**Problem**: When `toCanonicalSchema()` is used (e.g., in VSCode extension), it adds ALL optional properties with `undefined` values. This means:

```typescript
// This check is WRONG - returns true even when metadata is undefined!
if (Object.prototype.hasOwnProperty.call(context, 'metadata')) { ... }

// This is CORRECT - checks for truthy value
const metadataValue = context['metadata'];
const hasMetadata = !!metadataValue && typeof metadataValue === 'object';
```

**Rule**: Always check for truthy values, not just key existence, when working with schema-generated objects.

### 2. Nested HTML Structure

**Problem**: Nested tables must not wrap with `<div>` inside `<table>`:

```html
<!-- INVALID - div cannot be inside table -->
<table class="nested-table">
    <div class="table-container">  <!-- Browsers will close table here! -->
        <table>...</table>
    </div>
</table>
```

**Solution**: Use `isNested` flag to conditionally apply wrappers:
- Top-level: `<div class="table-container"><table>...</table></div>`
- Nested: `<table class="nested-table">...</table>` (no div)

### 3. Test Fixture Format

**Problem**: Expected output files should contain raw output, not markdown code fences.

The `expected.md` files in test fixtures should contain the **raw HTML output** that the template produces, not wrapped in markdown code fences.

**Wrong** - `expected.md` containing a code fence:
````
```markdown
<div class="table-container">...</div>
```
````

**Correct** - `expected.md` containing raw HTML:
```
<div class="table-container">...</div>
```

### 4. Edge Case Testing

Always test these scenarios for nullable/optional properties:
- Property missing entirely
- Property explicitly set to `undefined`
- Property explicitly set to `null`
- Property set to empty object `{}`

```typescript
it('handles metadata being explicitly undefined', () => {
    const node = { ...baseNode, metadata: undefined };
    // Test behavior...
});
```

## Debugging

### Enable Widget Logging

The widget system has configurable logging:

```typescript
import { setWidgetLogger } from '@finos/calm-widgets';

// In VSCode extension
setWidgetLogger({
    debug: (msg) => outputChannel.appendLine(`[DEBUG] ${msg}`),
    info: (msg) => outputChannel.appendLine(`[INFO] ${msg}`),
    warn: (msg) => outputChannel.appendLine(`[WARN] ${msg}`),
    error: (msg) => outputChannel.appendLine(`[ERROR] ${msg}`),
});
```

### Common Debugging Steps

1. **Output not rendering**: Check if `hasRows` is false in the view model
2. **Properties missing**: Check if sections filtering is excluding them
3. **HTML breaking**: Inspect for invalid nesting (div inside table)
4. **Empty message not showing**: Verify the data is actually empty/undefined (see pitfall #1)

## Dependencies

```
calm-widgets is used by:
├── calm-plugins/vscode (preview panel rendering)
├── cli (documentation generation)
└── shared (template processing)
```

**Build Order**: calm-widgets must be built before dependent packages:
```bash
# From repository root
npm run build --workspace calm-widgets
```

## Adding a New Widget

1. Create directory: `src/widgets/my-widget/`
2. Create `index.ts` exporting a `CalmWidget` (include the required `validateContext`)
3. Create template file(s), e.g. `template.html` (or `.hbs`), plus any partials
4. Create tests: `index.spec.ts`
5. Export from `src/index.ts`
6. **Register the widget** in `widget-engine.ts` `registerDefaultWidgets()` —
   add `{ widget: MyWidget, folder: __dirname + '/widgets/my-widget' }`.
   A widget is not usable until it is registered here.
   **The registration list must stay in alphabetical order by widget name** (e.g. `block-architecture` before `table`).
   Likewise, the helper registrations in `widget-helpers.ts` must stay alphabetical.
   Both orderings are enforced by tests in `widget-engine.spec.ts` and `widget-helpers.spec.ts` — CI will fail if a new entry is added out of order.
7. Add test fixtures in `test-fixtures/my-widget/`
8. Document in `README.md`

## Useful Links

- [README.md](./README.md) - User documentation with examples
- [Handlebars Guide](https://handlebarsjs.com/guide/) - Template syntax
- [Root AGENTS.md](../AGENTS.md) - Monorepo overview
- [VSCode Plugin AGENTS.md](../calm-plugins/vscode/AGENTS.md) - Primary consumer
