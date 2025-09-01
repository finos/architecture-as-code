# CALM Widgets Framework

A TypeScript widget system built on Handlebars that provides reusable components for generating Markdown documentation. The framework allows you to create custom widgets that can transform data into formatted output using Handlebars templates.

## 🔧 Built-in Widgets

### Table Widget

Renders data as Markdown tables with support for nested objects and column filtering.

```handlebars
{{!-- Basic table with headers --}}
{{table services}}

{{!-- Table without headers --}}
{{table services headers=false}}

{{!-- Filter specific columns --}}
{{table services columns="name,port,version" key="id"}}
```

**Options:**
- `headers` (boolean): Show/hide table headers (default: true)
- `columns` (string): Comma-separated list of columns to include
- `key` (string): Property to use as unique identifier (default: "unique-id")

### List Widget

Renders arrays as Markdown lists (ordered or unordered).

```handlebars
{{!-- Unordered list --}}
{{list features}}

{{!-- Ordered list --}}
{{list steps ordered=true}}

{{!-- Extract specific property from objects --}}
{{list services property="name"}}
```

**Options:**
- `ordered` (boolean): Create numbered list (default: false)
- `property` (string): Extract specific property from objects

### JSON Viewer Widget
Renders data as formatted JSON blocks.

```handlebars
{{!-- Simple JSON output --}}
{{json-viewer config}}
```

### Flow Sequence Widget

Renders flows (sequence of transitions) as Mermaid sequence diagrams. Use this widget to visualise ordered interactions and connections between nodes defined in a CALM architecture context.

```handlebars
{{!-- Render a flow by its unique-id from the current architecture context --}}
{{flow-sequence this flow-id="flow-unique-id"}}


{{!-- Example: when rendering a nested architecture in a node's details.}}
{{#each nodes}}
  {{#if (eq (lookup this 'unique-id') 'frontend-system')}}
    {{flow-sequence (lookup this 'details') flow-id="flow-frontend"}}
  {{/if}}
{{/each}}
```

**Note: Simplified syntax to become available to end user on completion of https://github.com/finos/architecture-as-code/issues/1556**



Options:
- `flow-id` (string, required): The unique-id of the flow to render from the provided architecture context.

Context requirements:
- The context passed to the widget must be a valid CALM core canonical model (or a nested details object containing `nodes`, `relationships`, and `flows`).
- `flows` must include a flow object with the specified `unique-id` and a `transitions` array.
- Each transition must reference an existing relationship by `relationship-unique-id` and include a `sequence-number` (order) and optional `description`.


## 🛠️ Creating Custom Widgets

### 1. Widget Definition

Create a widget by implementing the `CalmWidget` interface:

```typescript
// src/widgets/my-widget/index.ts
import { CalmWidget } from '@finos/calm-widgets';

export interface MyWidgetContext {
  title: string;
  items: string[];
}

export interface MyWidgetOptions {
  showCount?: boolean;
  prefix?: string;
}

export interface MyWidgetViewModel {
  title: string;
  items: string[];
  count?: number;
  prefix: string;
}

export const MyWidget: CalmWidget<
  MyWidgetContext,
  MyWidgetOptions, 
  MyWidgetViewModel
> = {
  id: 'my-widget',
  templatePartial: 'my-widget-template.html',
  
  // Optional: additional template partials
  partials: ['item-template.html'],
  
  // Transform input data to view model
  transformToViewModel: (context, options) => {
    const showCount = options?.hash?.showCount ?? false;
    const prefix = options?.hash?.prefix ?? '•';
    
    return {
      title: context.title,
      items: context.items,
      count: showCount ? context.items.length : undefined,
      prefix
    };
  },
  
  // Validate input context
  validateContext: (context): context is MyWidgetContext => {
    return (
      typeof context === 'object' &&
      context !== null &&
      typeof (context as any).title === 'string' &&
      Array.isArray((context as any).items) &&
      (context as any).items.every((item: any) => typeof item === 'string')
    );
  },
  
  // Optional: register custom helpers
  registerHelpers: () => ({
    upperCase: (str: string) => str.toUpperCase(),
    repeat: (str: string, count: number) => str.repeat(count)
  })
};
```

### 2. Template Files

Create Handlebars templates for your widget:

```handlebars
<!-- src/widgets/my-widget/my-widget-template.html -->
## {{title}}
{{#if count}}
*Total items: {{count}}*
{{/if}}

{{#each items}}
{{../prefix}} {{upperCase this}}
{{/each}}
```

```handlebars
<!-- src/widgets/my-widget/item-template.html -->
{{prefix}} **{{upperCase this}}**
```

### 3. Widget Tests

Create comprehensive tests for your widget:

```typescript
// src/widgets/my-widget/index.spec.ts
import { describe, it, expect } from 'vitest';
import { MyWidget } from './index';

describe('MyWidget', () => {
  describe('validateContext', () => {
    it('accepts valid context', () => {
      const context = {
        title: 'Test Title',
        items: ['item1', 'item2']
      };
      expect(MyWidget.validateContext(context)).toBe(true);
    });

    it('rejects invalid context', () => {
      expect(MyWidget.validateContext(null)).toBe(false);
      expect(MyWidget.validateContext({ title: 123 })).toBe(false);
    });
  });

  describe('transformToViewModel', () => {
    it('transforms context correctly', () => {
      const context = { title: 'Test', items: ['a', 'b'] };
      const options = { hash: { showCount: true, prefix: '-' } };
      
      const result = MyWidget.transformToViewModel!(context, options);
      
      expect(result).toEqual({
        title: 'Test',
        items: ['a', 'b'],
        count: 2,
        prefix: '-'
      });
    });
  });
});
```

### 4. Test Fixtures

Create test fixtures to verify widget output:

```json
// test-fixtures/my-widget/basic-example/context.json
{
  "title": "My Items",
  "items": ["First Item", "Second Item", "Third Item"]
}
```

```handlebars
{{!-- test-fixtures/my-widget/basic-example/template.hbs --}}
{{my-widget . showCount=true prefix="→"}}
```

```markdown
<!-- test-fixtures/my-widget/basic-example/expected.md -->
## My Items
*Total items: 3*

→ FIRST ITEM
→ SECOND ITEM  
→ THIRD ITEM
```

## 🧪 Testing

The framework includes comprehensive testing utilities:

### Running Tests

```bash
# Run all tests
npm test

# Run specific widget tests
npm test -- my-widget

# Run with coverage
npm run test:coverage
```

### Test Fixtures

Use the fixture system for consistent testing:

```typescript
import { FixtureLoader } from './test-utils/fixture-loader';

const fixtures = new FixtureLoader();
const { context, template, expected } = fixtures.loadFixture('my-widget', 'basic-example');

const compiledTemplate = handlebars.compile(template);
const result = compiledTemplate(context);

expect(result.trim()).toBe(expected);
```

### Updating Fixtures

Use the fixture update script to regenerate expected outputs:

```bash
npx tsx src/scripts/update-fixtures.ts
```

## 🔍 Architecture

### Core Components

- **WidgetEngine**: Orchestrates widget registration and setup
- **WidgetRegistry**: Manages widget storage and Handlebars partial registration  
- **WidgetRenderer**: Handles widget rendering with context validation
- **Widget Helpers**: Global Handlebars helpers available to all widgets

### Helper Functions

The framework provides built-in helpers:

- `eq`, `ne`: Equality comparisons
- `lookup`: Property access
- `json`: JSON stringification  
- `kebabToTitleCase`: Convert "api-service" → "Api Service"
- `kebabCase`: Convert "API Service" → "api-service"
- `isObject`, `isArray`: Type checking
- `notEmpty`: Check for non-empty values
- `or`: Logical OR operations
- `currentTimestamp`, `currentDate`: Date utilities
- `instanceOf`: Constructor name checking
- `eachInMap`: Object iteration

### Type Safety

The framework uses TypeScript generics for type-safe widgets:

```typescript
CalmWidget<TContext, TOptions, TViewModel>
```

- `TContext`: Input data type
- `TOptions`: Handlebars options/parameters
- `TViewModel`: Transformed data for template

## 📝 Best Practices

### Widget Design

1. **Keep widgets focused**: Each widget should have a single responsibility
2. **Validate inputs**: Always implement robust `validateContext` 
3. **Transform data**: Use `transformToViewModel` to prepare data for templates
4. **Handle errors gracefully**: Provide meaningful error messages
5. **Test thoroughly**: Include unit tests and integration fixtures

### Template Guidelines

1. **Use semantic markup**: Generate clean, readable Markdown
2. **Handle empty data**: Gracefully handle missing or empty inputs
3. **Be consistent**: Follow established patterns from built-in widgets
4. **Optimize performance**: Avoid complex logic in templates

### Testing Strategy

1. **Unit test widget logic**: Test `validateContext` and `transformToViewModel`
2. **Integration test output**: Use fixtures to verify rendered output
3. **Test edge cases**: Handle null, undefined, and malformed data
4. **Maintain fixtures**: Keep expected outputs up to date

## 🤝 Contributing

1. **Create your widget** following the structure above
2. **Add comprehensive tests** including fixtures
3. **Update documentation** if adding new concepts
4. **Follow code style** using the project's ESLint configuration
5. **Test thoroughly** with `npm test`
