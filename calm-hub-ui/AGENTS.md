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
- Architecture: the inspector beside the diagram (`hub/components/inspector/DiagramInspector`, in Hub's `Sidebar` on a
  wide screen and `MobileInspector` on a narrow one). `InspectorHandle` on the right edge of the diagram canvas opens
  it on both widths; do not add a toolbar toggle. Keep the handle in a separate layout column, outside the view's positioned container, so it cannot cover lens notes or tab controls. The handle stays in the page, hidden, while the inspector is open, so
  focus can go back to it. `InspectorMenu` lists Details first, then individual views grouped by extension name. `resourceExtensions()` decides which extensions show; `inspectorViews()` keeps resource views before node views, in manifest order within each kind. An action-only extension has an Actions entry. `MobileInspector` is a
  `<dialog>` that opens with `showModal()`, so focus stays in it and the page behind it is inert. It stays in the page
  when it closes, so slot state stays. Its `cancel` handler ignores the cancel of a dialog in a slot, which closes only
  that dialog. Hub owns the inspector, so the
  diagram stays mounted while it opens and closes. Hub renders the inspector once, with `createPortal`, into one node
  (`inspectorNode`) that the `Sidebar` or the `MobileInspector` holds. A change of breakpoint moves that node, so the
  chosen views and the slot state stay. Do not render the inspector as a child of either one: a new parent remounts it.
  A move ends the modal state of an open `<dialog>` in a slot, and the dialog stays open. `SlotHostContext` names the
  host; when it changes, `ConfirmActionDialog` shows itself modally again, on top, with focus on Cancel. A new dialog in
  a slot must do the same. `placeInspector` does not move the node to the host that holds it: StrictMode attaches the
  ref of a new host twice, and a second move ends the modal state again.
  `?extension=<id>` (`EXTENSION_PARAM`) opens it on an extension;
  Details and each extension's chosen view stay in memory only. A fresh `?extension=` link shows the extension's first view. A change of only `extension` keeps the selection.
  The router shows a replace in a transition, so a close can come before the choice before it shows, also while a
  render of it waits. Hub shows the latest choice at once (`inspectorChoice`) and sends one replace at a time. It never
  sends a replace to the URL that shows: that loads the resource again and clears the selection. Set each choice as a
  whole value, not with an update that reads the state: a render that has not shown can change what React reads. Each
  replace adds its id (`inspectorWrite`) to the history state. A location is Hub's replace only if it is a replace in
  the same browser entry with that id. Never compare URLs: another navigation can have the URL of the replace. Every
  other navigation drops the choice, and its URL decides the inspector. A selection that takes `node` out of the URL
  (`handleItemSelect`) is one of these replaces: it takes the latest choice, and the place and the id of a replace that
  has not shown. It reads them from a ref, so its identity stays. The old
  `?tab=extensions` redirects to `?extension=` (`DIAGRAM_TAB_REDIRECTS`). Do not add an extension tab to
  `DIAGRAM_TABS`, and keep diagram lenses (`?lens=`) apart from the inspector.
- Actions: `ExtensionActionButton`, only in the inspector, so each action runs with a resource context. There
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
- Stat tiles and tables: a stat `filter` names a table `id` in the same reply; the schema requires an `id` with
  `search` or `source`. `ExtensionSlot` gives the reply to its blocks through `BlockScopeContext`
  (`blocks/BlockScope.tsx`) and keys each filterable table by its `id`, so a reply that moves a table keeps its search
  box with it, also text not sent yet; outside a slot a tile is a figure and a table has no filters.
  `blocks/tableFilters.ts` holds the rules. Inline `rows` are the whole dataset, so the browser filters them; a table
  with a `source` gets each page from a `GET` `readOnly` route and never filters a page. It sends no page request over
  Hub's request-line limit (`fitsRequestLine`, `MAX_REQUEST_LINE` 4096, after the browser's own URL encoding): it says
  the search is too long and keeps it. Tile figures are the extension's numbers, never recounted. `UrlTableState`
  (screen page only) keeps `<table>.filter|q|page` in the URL with `replace: true` and the fields of the current
  `location.state`, at most 12 such keys (the limit #3799's return points keep); over that, or with a value that
  `isTableStateEntry` refuses (page 10001), the table keeps its filters in memory and says so. Other slots keep them in
  memory for one context (`useTableStateStore(view)`): a query change on an architecture page clears the selection.
  The router shows a navigation in a transition, so the page can show a query late: `UrlTableState` keeps the newest
  filters in its own state, the tables read them there, and `update(tableId, change)` changes them. Of the changes in
  one render, only the last goes to the router. Each write adds its id (`tableStateWrite`, unique to the page load, the mounted store and the write) to the history state, and
  the store keeps a list of the writes it sent. A location is a write of the store only if it is a replace on the same
  page with the id of a write that has not shown yet (`showLocation`). Never compare queries: another navigation can
  have the query of a write. It knows a location by its key, path and query, because React Router keys every location
  that the browser makes, such as an address typed in, `default`. Every other navigation, such as a link or Back, sets
  the filters from the address, also when its query is that of a write. It ends the filters in memory and changes
  `origin`. A search box replaces its text only when `origin` or Clear filters changes its `resetKey`.
- Reload: `ExtensionRefresh` (`extensions/extensionRefresh.ts`), one per `ExtensionsProvider`. Call
  `refresh(extensionId)` only after a confirmed 2xx write, never after a failure or an unknown outcome. Slots and
  source tables read `useExtensionRevision()` and load again through `useRefreshingRequest`, which keeps the earlier
  value, shows a value only for the view (context, filters) it was loaded for, and drops a late reply. Do not add a
  second refresh store.
- Identity: `ExtensionLogo` (`extensions/ExtensionLogo.tsx`) is the mark beside an extension name everywhere, also in
  search and chat attribution. It is the `ExtensionMarker` when the manifest has no `logo`, and while a logo loads or
  after it fails. A logo has loaded when its `img` fires `load` or is `complete`, not when its bytes arrive: Firefox
  draws nothing for a large SVG until then. It is decorative (`aria-hidden`), so keep the name as text beside it. Do
  not fetch a logo yourself: `useImageAsset()` (`assets/`) reads Hub assets with the user's credentials through
  `ImageAssetLoader`, which has its own axios instance (a failure must not open the sign-in prompt), accepts only a
  same-origin `/api/calm/` path and the image types of `ImageAsset`, and gives a `data:` URL. Never use a `blob:` URL
  or put asset bytes in markup: an SVG opened from a `blob:` URL as a page runs with Hub's origin. Tests inject a
  loader with `ImageAssetContext` (`test-support/fake-image-assets.tsx`).
- Forms: a `form` block draws `FormBlock` (`extensions/forms/`) from `contributes.form`. It shows only in a slot
  that passes its `point` (`screen`, `designer-tab`, `detail-panel`), not in a landing card. The draft lives in the
  provider's `FormDrafts`, keyed by extension, form and `<point>:<contribution id>`, so a remount, a closed section or
  a page change keeps the input and a submission in flight. Never put form values in the URL, history state or
  `localStorage`. The first edit pins the target: a change of selection shows a notice and never retargets by
  itself. `submitForm()` never throws and never aborts. It reads `Calm-Extension-Dispatch`, not the body, to tell a
  refusal from an unknown outcome. After an unknown outcome, `FormDrafts.submit` sends only a repeat of the same
  target and input, with the same id, and the form holds changed input until the user changes it back or forgets the
  earlier submission (`forget`). Do not keep more than one unresolved submission. Only a 2xx, a backend reply
  (`sent: true`) to that id or `forget` settles it: a Hub refusal before it sent the repeat keeps the warning, the id
  and the beforeunload prompt, also for input that the user did not edit. Read field-id dictionaries (values, errors,
  backend `fields`) with `own()`: a field can be called `constructor` or `toString`. A
  screen form fills its target picker from the slot context. Call `useExtensionRefresh().refresh(id)` only after a 2xx. `formRules.ts` copies the messages of
  `ExtensionForms` in calm-hub, and `formRules.test.ts` reads the shared cases.
- `ExtensionInspector` shows one extension at a time; `ExtensionInspectorSection` shows its actions and one chosen resource or node view. Each view mounts when it first shows and stays mounted, hidden, after
  that, also while the inspector is closed, so slot state stays. `SlotActiveContext` is false for a hidden slot:
  `ExtensionSlot` and its `SourceTable`s then pass no `load` to `useRefreshingRequest`, so they send no request, and
  load when they show again if their context, revision or table query changed. A failed request does not load again
  when it shows: the slot and the table show **Try again**, also for a first load. A reply that cannot render shows
  **Try again** too (`ScreenErrorBoundary` with `retry`): it mounts the slot content again, which loads the reply again
  for the same context and sends no write. Form drafts and their targets stay in `FormDrafts`. Give `retry` only where
  the children load again on mount. Keep the inspector's tree the same when it closes, or React remounts the slots.
- On a wide screen, each selection that the user makes opens the inspector, also a click on the item that is already
  selected (`selections` in `Hub`). `handleItemSelect` counts it with a functional update, so its identity stays.
  Each link, and each Back or Forward, whose URL names the selected node opens it too, also a link to the URL that
  shows (`useLinkKey()` in `hooks/entrySelection.ts`: a count of the new `location` values and the browser moves of
  `useBrowserEntry()`). A replace that changes the URL, such as closing the inspector or Hub taking `node` out when
  the user selects another node, updates the page in place and is not a link: the open extension, its chosen view and
  the slots stay. React Router makes a link to the URL that shows a replace, so a replace that keeps the URL is a link.
- The `ExtensionSlot` key is the extension and the contribution, not the context, so a change of selection keeps
  the slot mounted. `useRefreshingRequest` shows a reply only for the context it was loaded for, so a slot shows
  Loading, never the earlier target's data, beside actions that follow the new context. `ScreenErrorBoundary`
  takes the context and screen parameters as its `resetKey`. Key a slot in a list as `<point>:<contribution id>`.
  Give `ExtensionSlot` a `headingLevel` one below the heading of the place that holds it: `h3` in the inspector
  (the extension name is the `h2`), `h1` on a screen page (nothing else there is an `h1`).
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

### Navigation and return points

A link from an extension, a search result or a chat citation names a typed `Destination` (`model/extensions.ts`):
exactly one of `href`, `hub` (namespace, type, id, version, optional `element` and `extension`) or `screen`
(extension, screen, optional resource `context` and `params`). Never accept or build an internal URL from extension
data. `navigation/destinations.ts` is the one place that maps a destination to a route (`destinationLocation()`),
checks one (`isDestination()`, the same rules as `blocks.schema.json#/$defs/destination`) and reads a screen URL
(`readScreenQuery()`). Screen params (no dot, at most 8) go to the screen route; table keys (`<table>.filter|q|page`,
at most 12, `isTableStateEntry()`) stay in the browser and do not reload the screen. The context and the screen params
have at most 2048 characters form-encoded (`SCREEN_STATE_LIMITS.routeQuery`): the extension's query budget inside Hub's
4096-byte request line. Every length counts Unicode code points, as JSON Schema `maxLength` does (`isWithin()`), not
UTF-16 units. `resourceContext()` maps a target to the `ExtensionContext` names. The server applies the same limits to search
results and chat citations in `ExtensionDestinations` (calm-hub); change both together.

Render links with `DestinationLink` (or `ScreenLink` for a block link with a label). A Hub or screen link records the
current page as a return point in `location.state.returnTo` (`navigation/returnPoints.ts`, at most 5), never in the
URL: a page, its query and a label. A page declares itself with `ReturnPointProvider` (the screen page, `Hub` for
resource pages and `/search`; the chat view adds `{ kind: 'chat' }`). `ReturnLink` shows **Back to …**. A navigation
that is not a new destination, such as a breadcrumb or a detailed-architecture hop, keeps the points with
`carryReturnPoints(location.state)`, and a URL state change uses `{ replace: true, state: location.state }`. Pass the
target to `useLinkState(to)`: a link to the same page, such as a filter, keeps the points and adds none. A link whose
target is known only on a click, such as a lens node, reads `const here = useContext(ReturnPointContext)` during render
and calls `linkState(here, to)` in the click handler. A typed
Hub link (`destinationLocation()`) and a return to a resource (`returnPointLocation()`) add `exact=1`
(`EXACT_VERSION_PARAM`) to the URL, so DiagramSection's timeline redirect (`isExactVersion(location)`) leaves the
version, also for a copied link. A plain latest-version URL keeps the redirect; a timeline pick still uses
`EXACT_VERSION_STATE` in history state. DiagramSection keeps `exact` through tab and lens changes, and a lens param
cannot take the name. `boundLabel()` shortens a label to 200 code points on write and
read; a long title never costs the return point. `safeHref()` takes `unknown`: extension data is untyped at run time. Form
input never goes in a URL, a param or a return point. `ReturnBar` shows the return link and the notices for a linked
`node` that is not in the version or a linked `extension` that does not apply. Hub finds a linked `node` of a pattern
with `findPatternElement()` (`patternTransformer.ts`), which gives the data that a diagram click gives the details
panel. A node that the user selects is not in the URL: Hub keeps it per history entry (`hooks/entrySelection.ts`,
session storage keyed by `location.key`), so browser Back and Forward select it again. The browser makes an entry with
no state for a first visit or a pasted URL, and the router gives each one the key `default`: such an entry gets its own
id in `history.state` (`calmHubEntry`, next to the router's fields), which a reload keeps. Do not detect an entry
change with the key or the `location` value alone: the router gives two entries that the browser made at the same URL
the same `location` and does not render again. `useBrowserEntry()` counts the `popstate` events and sets its count in
a transition, as the router sets its location, so one render gets both. After Back, Forward or a URL that the user
opens, the entry decides: Hub opens its kept selection or none. A lens change keeps the selection only on the page. Hub
reads the selection on each new `location` value and each browser move, and the effect that keeps it waits while
`hasMoved()`, so a restore comes before a write. A `node` in the URL comes first, and a node of a dropped file is
never kept.

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
   `src/test-support/memory-storage.ts`. In a browser that blocks site data, reading the
   `localStorage` global itself throws, and a default parameter is read outside any
   `try`. So resolve a default with a `defaultStorage()` helper that returns `undefined`
   on failure (see `theme/useMotion.ts`, `theme/useTheme.ts` and `AppLayout`), and treat
   `undefined` as no storage: the control still works, but the choice is not kept. To
   test it, make the `localStorage` getter throw (see `AppLayout.test.tsx`).
2. **The safety net.** `vitest.setup.ts` stubs both globals with `createMemoryStorage()`
   for the whole run via `vi.stubGlobal`, so a test that forgets to inject still sees a
   working Storage rather than a throwing one. Do not rely on this in new code — it exists
   to stop the failure mode being silent. It also hides a default that reads the global
   outside a `try`, so test that case as item 1 says.

### Test both desktop and mobile

Any change that touches layout/rendering **must be verified at both a desktop and a
mobile viewport** — never just one.

- **Unit tests**: components that branch on `useIsMobile()` need cases for both
  renders. Drive the breakpoint by mocking `window.matchMedia` (returning
  `matches: true` simulates mobile, `false` desktop). `ControlDetailSection.test.tsx`
  and `hub/Hub.test.tsx` show the `mockViewport`/`mockMobileViewport` helper pattern.
  For a change of breakpoint in one render, `resizableViewport` in `hub/Hub.test.tsx` fires the change event.
  The default (no mock) reports desktop, so add explicit mobile cases.
- **Manual/visual check**: run `npm run start --workspace calm-hub-ui` and confirm the
  change at a desktop width and at a mobile width (≤1023px — e.g. a 390px-wide device
  in browser dev-tools). Confirm desktop is unchanged when the work was mobile-only.
