# CALM Hub UI - AI Assistant Guide

This guide helps AI assistants work efficiently with the CALM Hub UI frontend codebase.

## Tech Stack

- **Language**: TypeScript
- **Framework**: React 19 with React Router
- **Build Tool**: Vite
- **Testing**: Vitest, React Testing Library, Cypress (E2E)
- **Styling**: TailwindCSS + DaisyUI
- **HTTP Client**: Axios
- **Auth**: OIDC via `oidc-client-ts` / `react-oidc-context`

## Key Commands

```bash
# All commands from repository root using workspaces
npm run build --workspace calm-hub-ui     # Production build
npm test --workspace calm-hub-ui          # Run unit tests (vitest run)
npm run lint --workspace calm-hub-ui      # Lint
npm run dev --workspace calm-hub-ui       # Dev server with hot reload
```

## Directory Structure

```
src/
├── service/              # API service classes (axios-based)
├── model/                # TypeScript interfaces and types
├── hub/
│   └── components/       # Feature components
│       ├── tree-navigation/
│       ├── control-detail-section/
│       ├── document-detail-section/
│       ├── diagram-section/
│       ├── json-renderer/
│       ├── adr-renderer/
│       ├── section-header/
│       └── value-table/
├── components/           # Shared/common components
├── visualizer/           # Architecture visualiser
├── fixtures/             # Test fixtures
└── theme/                # Theme configuration
```

## Conventions

### Service Pattern

All API services follow a **class-based pattern with injectable Axios instances**, matching `CalmService` as the reference implementation:

```typescript
import axios, { AxiosInstance } from 'axios';

class MyService {
    private ax: AxiosInstance;

    constructor(ax: AxiosInstance = axios.create()) {
        this.ax = ax;
    }

    async fetchItems(): Promise<Item[]> {
        try {
            const response = await this.ax.get<Item[]>('/api/items');
            return response.data;
        } catch (error) {
            console.error('%s', error);
            return Promise.reject(new Error('Failed to fetch items'));
        }
    }
}
```

Key rules:
- Constructor accepts an optional `AxiosInstance` (defaults to `axios.create()`)
- Methods return promises directly — **no setter callbacks**
- Errors use `Promise.reject(new Error(...))`, not thrown exceptions
- Log errors with `console.error('%s', error)` (format-string style)
- Encode user-supplied path segments with `encodeURIComponent`

### Service Testing Pattern

Tests use `AxiosMockAdapter` on a test axios instance:

```typescript
import axios from 'axios';
import AxiosMockAdapter from 'axios-mock-adapter';

const ax = axios.create();
const mock = new AxiosMockAdapter(ax);
const service = new MyService(ax);

afterEach(() => mock.reset());

it('fetches items', async () => {
    mock.onGet('/api/items').reply(200, ['item1']);
    const result = await service.fetchItems();
    expect(result).toEqual(['item1']);
});
```

### Component Decomposition

**Prefer small, focused components in separate files over large monolithic components with comment-delimited sections.**

When a component grows beyond roughly 150 lines or contains logically distinct UI regions, extract those regions into their own component files. This keeps files readable, simplifies testing, and makes it easier to review diffs.

Avoid patterns like:
```typescript
// ---- Header Section ----
function HeaderSection() { ... }

// ---- Body Section ----
function BodySection() { ... }

// Main component
export default function BigPage() { ... }
```

Instead, place `HeaderSection` and `BodySection` in their own files and import them.

### React Hooks

- Instantiate services with `useMemo`: `const service = useMemo(() => new MyService(), []);`
- Use `useCallback` for functions referenced in `useEffect` dependency arrays
- **Never suppress** `react-hooks/exhaustive-deps` — fix the dependency array properly

## Testing

- Unit tests use Vitest + React Testing Library
- All new components and services must have tests
- Mock services at the module level with `vi.mock` and class constructor patterns
- E2E tests are in `cypress/`
