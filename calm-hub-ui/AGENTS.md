# CALM Hub UI - AI Assistant Guide

This guide helps AI assistants work efficiently with the CALM Hub UI frontend codebase.

## Tech Stack

- **Language**: TypeScript
- **Framework**: React 19 with React Router
- **Build Tool**: Vite
- **Testing**: Vitest, React Testing Library, Cypress (E2E)
- **Styling**: TailwindCSS + DaisyUI
- **HTTP Client**: Axios
- **Auth**: OIDC via `oidc-client-ts` (see `src/authService.tsx`)

## Key Commands

```bash
# All commands from repository root using workspaces
npm run build --workspace calm-hub-ui     # Production build (vite build → build/)
npm test --workspace calm-hub-ui          # Run unit tests (vitest run)
npm run lint --workspace calm-hub-ui      # Lint (eslint + stylelint on src/**/*.css)
npm run start --workspace calm-hub-ui     # Dev server with hot reload

# Root-level aliases
npm run calm-hub-ui:run                    # Alias for `start`
npm run build:calm-hub-ui                  # Build calm-models + calm-hub-ui
npm run calm-hub-ui:prod                   # Build, then rsync build/ into calm-hub resources
```

The build output goes to `build/` (Vite `outDir`). `npm run prod` (via the
`calm-hub-ui:prod` alias) copies that output into
`../calm-hub/src/main/resources/META-INF/resources` — the UI ships **embedded
in the Quarkus backend**. A `copy-public` prebuild step copies brand assets from
`../brand` into `public/` before both `start` and `build`.

## Directory Structure

```
src/
├── authService.tsx       # OIDC auth (oidc-client-ts) + getAuthHeaders helper
├── ProtectedRoute.tsx    # Route guard for authenticated routes
├── service/              # API service classes (axios-based)
├── model/                # TypeScript interfaces and types
├── hub/
│   └── components/       # Feature components
│       ├── tree-navigation/
│       ├── control-detail-section/
│       ├── interface-detail-section/
│       ├── document-detail-section/
│       ├── diagram-section/
│       ├── json-renderer/
│       ├── adr-renderer/
│       ├── section-header/
│       └── value-table/
├── visualizer/           # Architecture visualiser (largest subtree)
│   ├── components/       # UI: reactflow/, sidebar/, drawer/
│   ├── contracts/        # Typed *-contracts.ts interface definitions
│   ├── helpers/          # Pure helpers (e.g. set-functions)
│   └── services/         # e.g. node-position-service
├── diff/                 # Architecture diff view (components, model, fixtures)
├── components/           # Shared/common components
├── fixtures/             # Test fixtures
└── theme/                # Theme configuration
```

The `visualizer/contracts/*-contracts.ts` files hold the typed interfaces shared
across the visualiser (nodes, edges, decorators, panels, etc.); add new
visualiser-facing types there rather than inline.

## Conventions

### Service Pattern

All API services follow a **class-based pattern with injectable Axios instances**. `ControlService` (`src/service/control-service.ts`) is the clearest reference; `InterfaceService` and `SearchService` follow the same shape:

```typescript
import axios, { AxiosInstance } from 'axios';
import { getAuthHeaders } from '../authService.js';

export class MyService {
    private readonly ax: AxiosInstance;

    constructor(axiosInstance?: AxiosInstance) {
        if (axiosInstance) {
            this.ax = axiosInstance;
        } else {
            this.ax = axios.create();
        }
    }

    public async fetchItems(domain: string): Promise<Item[]> {
        const headers = await getAuthHeaders();
        return this.ax
            .get(`/calm/domains/${encodeURIComponent(domain)}/items`, { headers })
            .then((res) => (Array.isArray(res.data?.values) ? res.data.values : []))
            .catch((error) => {
                const errorMessage = `Error fetching items for domain ${domain}:`;
                console.error('%s', errorMessage, error);
                return Promise.reject(new Error(errorMessage));
            });
    }
}
```

Key rules:
- Constructor accepts an optional `AxiosInstance` (defaults to `axios.create()`)
- Methods return promises directly — **no setter callbacks**
- Resolve auth via `await getAuthHeaders()` and pass `{ headers }` to each request
- Use `.then(...).catch(...)` chaining; on error log then `Promise.reject(new Error(...))`
- Log errors in the format-string style: `console.error('%s', errorMessage, error)`
- Encode user-supplied path segments with `encodeURIComponent`

> Note: the older `CalmService` (`src/service/calm-service.tsx`) predates these
> conventions and is not a clean template — prefer the services above.

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
