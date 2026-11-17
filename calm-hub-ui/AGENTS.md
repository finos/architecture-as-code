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

### Diagram tabs and decorators

`DiagramSection` draws its tabs from `DIAGRAM_TABS` (`diagram-section/tabs/`). A tab has an id (the
`?tab=` value), a label, an icon, an optional visibility rule and a render function. An unknown or
hidden tab falls back to `diagram`. An unknown tab id is also dropped from the URL. A tab that keeps state in the URL lists its parameters in
`searchParams`, so a version change keeps them. Add a tab there, not as a new branch in
`DiagramSection`.

### Diagram lenses

A different picture of the same architecture is a **lens** of the Diagram tab, not a tab. A lens has the same
shape as a `DIAGRAM_TABS` entry (`diagram-section/tabs/diagramLenses.tsx`). Hub's own lenses are `calm`, the CALM
diagram, and `json` (`?tab=json` redirects to it) (`HUB_LENSES`). An extension adds a lens with a `diagram-lens`
entry in its manifest, such as the `c4` extension, and `DiagramLensView` draws its graph reply with its notation.
`diagramLenses()` lists Hub's lenses, then the lenses of the enabled extensions from the registry. Until the
registry loads, or if it fails, it lists only Hub's lenses, and `DiagramSection` keeps an unknown `?lens=` while the
registry loads. The backend refuses a lens id that two extensions declare, or `calm` or `json`. Do not add a
lens drawing for one extension: extension code must not run in Hub's origin (ADR 0013).

The URL is `?lens=<id>` plus the lens's own `searchParams`, with no `tab`. An unknown or hidden lens falls back to
`calm`. A version change keeps the lens and its parameters (`diagramTabQuery`). A lens change keeps the other query
parameters, such as `node`, and Hub keeps the selection when only the lens or its parameters change
(`withoutLens`). A lens click that selects a node and changes the lens parameters is one navigation that names the
node (`setLens`): two navigations from one click both start from the old URL, so the second undoes the first. A
choice that leaves the query as it is does not navigate, because Hub reloads the resource on a new location key.
Each lens fits its own view. The layout controls, the component search, decorator overlays and the
version compare belong to the `calm` lens. An extension lens draws its controls on its canvas (`LensToolbar`). On desktop,
the Diagram tab names the open lens, and its chevron opens `LensMenu`: the lenses, with a text filter, so many
lenses take no more space in the header. The list and the mobile View sheet show Hub's lenses first, then the
extension lenses (`DiagramLens.extension`) under an "Extensions" heading, with the extension name on each row
(`lensGroups`). The layout controls keep their space (`invisible`) on another lens, so the tabs do not move when the
lens changes.

`src/decorator-renderer/` renders any decorator by the shape of its `data`. It must not import Hub
code, so that it can move to a package that the VS Code extension shares. The UI calls them
"Decorators", never "Metadata", which is the CALM `metadata` field (`MetadataPanel` is the panel
under the diagram). Hub gets the decorators from `DiagramSection` (`onDecoratorsChange`) and gives
them to the details drawer through `DecoratorsContext`, with the containment map that the overlays use, so a
container lists each decorator that its badges count. The API does not require any decorator field, so guard each
read. A missing type shows as "(no type)". A card is keyed by `decoratorKeys()`: the `uniqueId`, or the list index when the id is missing or
not unique, so a shift in the list does not remount a card. The details drawer heads its list "All decorators": a badge can count only
the newest decorator of each key. The card's
JSON view uses the write field names (`writableDecorator`) and leaves out the Hub-owned times, so it can be copied into
a `PUT`.

### Decorator overlays

One engine (`visualizer/overlay/`) draws decorators on the diagram from `decorator-views` entries that have an
`overlay` (types in `visualizer/contracts/decorator-view-contracts.ts`). Status values map to the fixed scale
`ok`, `warn`, `error`, `info`. The built-in views for `control-evaluation` and `deployment` come from classpath manifests through
`GET /api/calm/extensions`. If the registry is unavailable, `useDecoratorViews()` returns the bundled copy in
`builtinDecoratorViews.ts`; its test keeps it the same as the manifests. It reads the views again when `useExtensionsStatus()`
becomes `loaded`, so a retry that succeeds brings back the extension views. Only the registry says that an operator turned a
built-in off (`calm.extensions."<id>".enabled=false`), so the fallback draws both built-ins. `DiagramSection` polls all decorators of
the version every 5 s while the diagram, the Decorators tab or the details drawer shows (`useArchitectureDecorators`, one request;
after three failures in a row it backs off to 30 s, also when the view shows again) and gives the one list to the Decorators tab, the
details drawer and `Drawer`. Do not add a second request. `Drawer` gives the overlays to the diagram through
`DecoratorOverlayContext`. Nodes and
edges read `useElementOverlays(id)`; do not add a type-specific badge. The badge details are a portal, but React still sends their events up to the node, so the details root
stops a click, a double click and a key (it handles Escape itself). The decision callouts, the hover list and the
Evaluations panel read control-evaluation fields, so they use `isControlEvaluationView()`: the id and
`source.builtIn`: when the built-in extension is disabled, an operator view can take its id.

`ExtensionService` uses its own axios instance, not `apiClient`, so a registry or extension call failure does not
open the global auth or outage page. The exception is a registry `401`: the registry is a Hub call, so it opens
the sign-in prompt. `ExtensionsProvider` (`extensions/ExtensionsContext.tsx`) owns the one `ExtensionService`.
Get it with `useExtensionService()`, not `new ExtensionService()` or a module singleton: the registry, the
decorator views and the slots then share one registry request, and a test can inject a service. The service
drops registry entries whose `hubApi` the UI does not support, and malformed entries (no string `id`, no list of routes, no
`contributes` object, or a UI extension point that is not a list of entries), for both paths. A `decorator-views` value
that is not a list gives no views, and the other views stay. After a failed load the provider
tries again with a backoff (5 s, doubled, up to 60 s; a new service starts it again), but not after a `401`.
`useExtensionsStatus()` gives `loading`, `loaded`, `failed` or `signed-out`. Use it where an empty list must not
mean "no extension", for example `ExtensionScreenPage` on a deep link.

### Extension UI layout

Each contribution kind has one place (see `docs/docs/calm-hub/extension-points.md`). Do not add a
per-extension toolbar button or tab: it does not scale to many extensions.

- Home: `IntroBrowse` shows an `ExtensionCard` per extension with a `landing-card` or a top-level page.
  `cardHeadline()` (`extensions/landingCard.ts`) picks what the card shows. The card is not a link: it lists a link
  to each page, so a card with no page has no destination.
- Menu: `ExtensionMenuGroup` in the navbar drawer: a group for each extension with a top-level page, labelled by the
  extension `name`, under an optional `heading`. It omits an extension with no page.
- Both list the pages from `extensionNavLinks()` (`extensions/contributions.ts`): the screens in manifest order, then
  the selected chat. Add a top-level page there, not in one of them, so the labels and the order stay the same in
  both. Both keep registry order, which is the operator `order`. The extension `id` is the group key; do not add a
  second grouping field to the manifest.
- Architecture: one `extensions` tab in `DIAGRAM_TABS`, hidden (not unknown) until the registry loads, so a link
  to it keeps the tab. `resourceExtensions()` decides if it shows.
- Actions: `ExtensionActionButton`, only in the Extensions tab, so each action runs with a resource context. There
  is no home placement. A route that is not `readOnly` asks in `ConfirmActionDialog`, not
  `window.confirm`. The dialog opens with `showModal()`, gives Cancel the focus, and names the target context. Do not abort a confirmed
  write: the backend can still finish it, so a retry can write twice. The busy state and the last result live in
  the provider's `ActionRuns` (`extensions/actionRuns.ts`), not in the button, so a remount cannot enable a write
  in flight or lose its result. A call in flight disables each button of the action (key: extension and
  contribution); a result shows only on the button that ran it (key: also the `placement` prop, which must be
  stable across a remount). An action slot must name its `placement`: there is no default that two places could share.
  The button says `<title>: running…` in a live region that is always in the page. An action slot key leaves out the context, so a change of selection does not remount
  it. A change of context clears the result. The button uses `aria-disabled`, not `disabled`, so focus can go back to it after the
  dialog. While the dialog is modal the page is inert and `focus()` outside it does nothing: the dialog calls
  `close()` before its callback, and the button takes focus in an effect after the dialog unmounts. jsdom has no
  modal dialogs, so a test that checks focus must model inertness (see `ExtensionSlot.test.tsx`).
- Node details: `ExtensionDetailPanels`.
- Identity: `ExtensionLogo` (`extensions/ExtensionLogo.tsx`) is the mark beside an extension name everywhere, also in
  search and chat attribution. It is the `ExtensionMarker` when the manifest has no `logo`, and while a logo loads or
  after it fails. A logo has loaded when its `img` fires `load` or is `complete`, not when its bytes arrive: Firefox
  draws nothing for a large SVG until then. It is decorative (`aria-hidden`), so keep the name as text beside it. Do
  not fetch a logo yourself: `useImageAsset()` (`assets/`) reads Hub assets with the user's credentials through
  `ImageAssetLoader`, which has its own axios instance (a failure must not open the sign-in prompt), accepts only a
  same-origin `/api/calm/` path and the image types of `ImageAsset`, and gives a `data:` URL. Never use a `blob:` URL
  or put asset bytes in markup: an SVG opened from a `blob:` URL as a page runs with Hub's origin. Tests inject a
  loader with `ImageAssetContext` (`test-support/fake-image-assets.tsx`).
- Both use `ExtensionSections`: the first section is open, a choice is kept in `localStorage` per extension, and a
  closed section renders nothing, so it sends no request.
  Give `ExtensionSections` and `ExtensionSlot` a `headingLevel` one below the heading of the place that holds
  them: `h3`/`h4` in the Extensions tab, `h5`/`h6` in the node details, `h1` on a screen page (nothing else
  there is an `h1`).
  A block slot shows its title and its named region in every state (loading, failed, a reply it cannot show:
  the error boundary takes a `frame`), and the screen page has
  an `h1` in the same region (`SlotFrame`) before the registry loads, so the outline does not change. The heading is
  the contribution title; a reply `title` shows under it.
- Overlays: `fetchDecoratorViews()` adds `source` (the extension) to each view. Key a view with `viewKey()`, never
  `view.id` alone. Hub does not start when two enabled extensions declare the same view id, but a disabled one frees
  its id for another extension, and a stored legend choice must not move to it.
  `extensionMarkerColour()` gives the marker colour.
  When there is no stored choice, `useOverlayVisibility` switches on the built-in views and the first 3 extension
  views in registry order. It takes the registered views, not the views drawn, so a default is the same on each diagram.
- Diagram lens: `DiagramLensView` (`extensions/lens/`) draws a `diagram-lens`. `parseLensReply()` checks the reply
  and the limits, `layoutLens()` runs ELK in a web worker (`elk.ts`; tests have no `Worker`, so ELK runs in the
  test), and `LensCanvas` draws SVG elements built from the notation data. Never put notation or reply text into
  markup or a style sheet. Node sizes come from `textWidth()`, an estimate, so layout is the same in every browser
  and in jsdom. An element that takes a click has `data-clickable`: a press on it must not start a drag-pan,
  because pointer capture would send the click to the pane.

### Namespace conventions

`NamespaceConventions` (`namespace-page/`) lists the namespace's conventions (such as `c4-mapping`) under the type
tabs, one group per type from `GET /api/calm/convention-types`, with the default that applies to the namespace.
Conventions are not a `TypeInUI`: they have no tab, no count and no detail route. The list is read-only.

### Operator UI config

`UiConfigProvider` (`components/ui-config/`) loads `GET /api/calm/ui/config` one time.
`useUiConfig()` returns only the sections the operator configured, or `{}` if the request
fails. The `EnvironmentPill` shows in the `Navbar` and on the `IntroScreen`, which has no navbar. A tap shows a truncated
name in full, because a touch screen has no hover for its `title`. The pill is a button only while the name is truncated.
Identity and items show at the bottom of the navbar drawer (`MenuInfo`). The drawer identity is
the server's principal, not the OIDC token profile that `UserMenu` shows.

`useUiConfigStatus()` tells `loading`, `loaded` or `failed`. `BrandLockup` shows nothing while it loads, so the CALM
logo does not flash before the organisation's. A request that has no reply after `UI_CONFIG_WAIT_MS` (3 s) counts as
`failed`, so the page continues with the defaults. A later reply still applies.

- **Branding** (`components/branding/`): `BrandTheme` turns `branding.colour` into a `<style>` that replaces the
  interaction tokens (`--color-primary`, `--color-interaction`, `--calm-interaction-text`,
  `--calm-redesign-active-text`, `--calm-redesign-tint-bg`, `--calm-rail-accent`) for each theme. `brand-colours.ts`
  moves the colour only as far as it must for 4.5:1 text and 3:1 focus rings; `brand-colours.test.ts` checks this.
  `useProductName()` gives the name that the UI uses for the product, "CALM Hub" by default. Logos load through
  `useImageAsset`, never through a plain `<img src>`, because the logo endpoint needs the auth header. `BrandLockup`
  also handles the `<img>` `error` event: the browser can refuse a `data:` URL that loaded (a CSP without `data:`, or
  bytes it cannot decode). Without a dark logo, the dark theme puts the light logo on a white plate.
- **Navigation** (`components/navigation/`): `NavigationMenu` is the one menu, used by the navbar drawer and by the
  `AppLayout` sidebar. Its desktop toggle stores `calm-navigation-collapsed` in the injected storage and hides the menu from keyboard navigation; storage failure must not break toggling. It does not change the mobile drawer. A page uses `AppLayout`, not `Navbar`. `useNavigationSettings()` gives the settings with their
  defaults. `show-namespaces` and `show-control-domains` only hide entries: routes, deep links and access checks must
  not read them. `StartPageRedirect` sends a user to `start-page` only on the first load of `/`. It wraps the routes in
  `App`, not the `/` route, so it decides once for the life of the app: a route unmounts when the user leaves it, and
  Back to the first entry gives `/` the `default` key again. It decides after `START_PAGE_WAIT_MS` (3 s) at most, so a
  slow config or registry neither keeps the page empty nor moves the user later. `App.test.tsx` checks this through the
  real routes and browser history. The navbar drawer is a `<dialog>` opened with `showModal()`: the rest of the page is inert, and a click outside
  the drawer only closes it. It has its own close button, which takes the focus, and Tab stays in the drawer. When it
  closes, the focus goes back to the menu button. jsdom has no modal dialogs, so `Navbar.test.tsx` models them.

## Theming (light + dark)

The app ships a light and a dark theme. `<html data-theme>` is the **single source of
truth**: it is always present and always `light` or `dark`.

### The two systems, and why tokens are split

Colour reaches the DOM two ways, and both must be satisfied:

1. **daisyUI semantic classes** (`bg-base-100`, `text-base-content`, `btn-primary`).
   These follow `data-theme` for free.
2. **`src/theme/colors.ts`**, consumed by **inline `style` props** in ~35 files (the
   ReactFlow visualiser, timeline, explore rail, namespace cards). `data-theme` cannot
   reach these, because JavaScript bakes the value into the DOM.

So `colors.ts` leaves come in two flavours, and which one a token gets is **not** an
aesthetic choice:

- **Neutrals** (surfaces, text, borders, washes, the `ink` ramp) are `var(--calm-…)`
  strings, defined per theme in `src/theme/theme.css`. Inline styles resolve them
  against the active `data-theme`. No React state, no provider.
- **Chromatic** values (node-type hues, risk/status, brand accents) stay **hex**,
  because they are alpha-concatenated (`` `${color}20` ``) — `var(--x)20` is not a
  colour — and because ReactFlow serialises some into SVG presentation attributes.
  The exception is `redesign.primary`, which is `var(--color-interaction)` so that it follows the operator's brand
  colour. Mix it with `color-mix(in srgb, … N%, transparent)`, never with a hex suffix.

### Adding a colour

- Neutral? Add `--calm-*` to **both** blocks in `theme.css` and point `colors.ts` at it.
  The `[data-theme='light']` value must equal the hex it replaces — light mode must not
  move.
- Chromatic and used as **text or an icon**? It needs a separate `…Text` token
  (`brand.accentText`, `redesign.primaryText`, `resourceTypes.*.accentText`). `#007dff`
  and `#2563EB` cannot reach 4.5:1 on *any* dark background, not even black, so the
  text role has to lighten while the fill/border/stripe role does not. Check every new
  dark tint against its accent with a contrast checker.

### Three traps that have already bitten

1. **SVG presentation attributes ignore `var()`.** ReactFlow writes `<Background color>`
   and `<MiniMap maskColor>` straight into `fill`/`stroke` attributes (`nodeColor` and
   `nodeStrokeColor` go into a `style`, so `var()` works there). Don't
   pass theme colours through those props — omit them and style
   `.react-flow__background circle`, `.react-flow__minimap-mask` etc. in `index.css`,
   where a CSS *property* beats the attribute.
2. **`@xyflow/react/dist/style.css` is bundled after `index.css`.** It defines
   `.react-flow__controls-button`, `.react-flow__minimap` and `.react-flow__attribution a`,
   so an unqualified override here silently loses the source-order tie. Scope ours under
   `.react-flow` to win on specificity.
3. **Components with their own theme system need telling.** Monaco (`JsonRenderer`)
   paints its own colours. Use `useResolvedTheme()` from `src/theme/useTheme.ts`, which
   observes the `data-theme` attribute — never call `useTheme()` a second time, as each
   call holds its own state and the copies drift apart when the toggle is pressed.
   Monaco's theme API takes literal hex and cannot read `--calm-*`, so the dark editor
   chrome is duplicated in `src/theme/monaco-theme.ts`; `monaco-theme.test.ts` parses
   theme.css and fails if the copies drift. It registers the theme from `beforeMount`
   unconditionally — an editor first mounted in light must still be able to switch.

### Toggle and persistence

`useTheme(storage?)` owns the attribute. It reads `localStorage['calm-theme']`
(`light` | `dark` | absent → follow the OS via `prefers-color-scheme`, tracked live).
An inline script in `index.html` applies the same resolution before the bundle loads,
so there is no flash; do **not** rely on daisyUI's `--prefersdark`, which emits a media
query for daisyUI's own variables only and would leave every `--calm-*` token unresolved.

Pass a `createMemoryStorage()` from `src/test-support/memory-storage.ts` in tests.

### Testing colour

jsdom's inline-style resolver keeps `var(...)` and `color-mix(...)` verbatim but
normalises hex to `rgb(...)`. So assert **by reference**
(`toHaveStyle({ backgroundColor: colors.redesign.tintBg })`), never against a literal
hex — a literal will break the moment the token becomes a var.

Beware the `mockViewport`/`mockMobileViewport` helpers: they return `matches: <isMobile>`
for **every** query, not just the width one. Since the Navbar also asks for
`(prefers-color-scheme: dark)`, a `mockMobileViewport(true)` test silently resolves the
theme to dark and stamps `data-theme="dark"` on the document. Harmless for the
assertions that exist today, but if you write a theme-sensitive assertion inside a
mobile test, match on the query string in the mock.

## Responsive Design

The CALM Hub UI is **mobile responsive** — it must be usable on phones as well as
desktops. Both renders are first-class; a change is not complete until it has been
verified at **both** a desktop and a mobile viewport.

### The `useIsMobile` hook

Layout decisions key off `src/hooks/useMediaQuery.ts`:

- `useMediaQuery(query)` — subscribes to a CSS media query (test-safe: returns
  `false` when `window.matchMedia` is absent, so components fall back to desktop).
- `useIsMobile()` — `useMediaQuery('(max-width: 1023px)')`. The breakpoint is
  Tailwind's `lg` (1024px): anything narrower is treated as mobile.

```typescript
const isMobile = useIsMobile();
if (!isMobile) {
    return <DesktopLayout … />;   // early-return keeps desktop untouched
}
return <MobileLayout … />;
```

### Mobile-only changes must not alter desktop

When adding or reworking mobile behaviour, **branch on `isMobile` and keep the
desktop path byte-for-byte unchanged** (an early `return` for the desktop layout is
the clearest way). Reviewers have repeatedly rejected diffs that "accidentally"
restyled desktop while targeting mobile — don't.

### Established mobile patterns

- **Full-screen push overlays**, not float-overs: menus, the view-options menu, the
  timeline, and detail panels take over the viewport (`fixed inset-0`,
  `animate-slide-in-right`) rather than floating above the canvas where iOS chrome
  would hide them.
- **Navbar-hosted actions**: page-level controls (e.g. the diagram view-options
  menu) portal into the navbar `#navbar-actions` slot instead of floating in the
  render pane. See `components/navbar/Navbar.tsx` and `diagram-section/DiagramSection.tsx`.
- **iOS-style drill-down explorer** on mobile (`tree-navigation/MobileNavMenu.tsx`):
  one flat list per level for `types`, `resources`, `domains` and `controls`. The
  `namespaces` level is the exception — it renders as a nested tree, because the
  hierarchy is already latent in the dotted names.
- **Full-bleed render pane** with the minimap/zoom controls hidden (pinch is the
  native gesture) — see `visualizer/components/reactflow/`.
- **Tabbed detail views** where desktop stacks panels (e.g.
  `control-detail-section/ControlDetailSection.tsx` shows Requirement/Configuration
  as tabs on mobile).
- **Device safe areas**: `viewport-fit=cover` in `index.html` plus
  `env(safe-area-inset-*)` so the navbar clears the notch (`navbar/Navbar.css`).

Reference components for the patterns above: `hub/Hub.tsx`, `components/navbar/Navbar.tsx`,
`hub/components/diagram-section/DiagramSection.tsx`,
`hub/components/tree-navigation/MobileNavMenu.tsx`, and
`hub/components/control-detail-section/ControlDetailSection.tsx`.

## Testing

- Unit tests use Vitest + React Testing Library
- All new components and services must have tests
- Mock services at the module level with `vi.mock` and class constructor patterns
- E2E tests are in `cypress/`
- A test that fails only on CI with `Number of calls: 0` just after `await screen.findBy…` is
  usually an effect that has not run yet. To reproduce it, stub `performance.now` to add 10 ms on
  each call before `render`. Fix it with `await waitFor(...)` around the assertion.
- React Flow 11 gives a custom edge `url('#')` for an unset marker. Treat it as no marker (see
  `referencedMarker` in `FloatingEdge.tsx`), and test marker changes through a real `<ReactFlow>`.

### Storage must be injected, never taken from the global

Node 25+ ships the Web Storage API as a real global, and Node 26 **throws a
`DOMException`** when `localStorage` is touched without `--localstorage-file`. Under
Vitest's jsdom environment Node's global shadows jsdom's working implementation, so any
test that calls `.clear()` or `.getItem()` on the bare global fails.

Two defences, and new code needs both:

1. **Take `Storage` as a parameter.** `node-position-service.tsx`, `TimelineBar.tsx` and
   `viewportStore.ts` all accept an optional `Storage`, defaulting to `localStorage` /
   `sessionStorage`. In services and utilities take it as an argument; in components take
   it as a `storage?: Storage` prop. Tests pass `createMemoryStorage()` from
   `src/test-support/memory-storage.ts`.
2. **The safety net.** `vitest.setup.ts` stubs both globals with `createMemoryStorage()`
   for the whole run via `vi.stubGlobal`, so a test that forgets to inject still sees a
   working Storage rather than a throwing one. Do not rely on this in new code — it exists
   to stop the failure mode being silent.

### Test both desktop and mobile

Any change that touches layout/rendering **must be verified at both a desktop and a
mobile viewport** — never just one.

- **Unit tests**: components that branch on `useIsMobile()` need cases for both
  renders. Drive the breakpoint by mocking `window.matchMedia` (returning
  `matches: true` simulates mobile, `false` desktop). `ControlDetailSection.test.tsx`
  and `hub/Hub.test.tsx` show the `mockViewport`/`mockMobileViewport` helper pattern.
  The default (no mock) reports desktop, so add explicit mobile cases.
- **Manual/visual check**: run `npm run start --workspace calm-hub-ui` and confirm the
  change at a desktop width and at a mobile width (≤1023px — e.g. a 390px-wide device
  in browser dev-tools). Confirm desktop is unchanged when the work was mobile-only.
