# Phase 8: C4 View Mode - Context

**Gathered:** 2026-03-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Hierarchical C4 navigation (Context, Container, Component) as zoom levels over CALM architectures. Users can switch between C4 levels via a toolbar selector, drill into systems to see internal structure, and navigate with breadcrumbs. C4 view mode is a read-only navigation overlay — the underlying CALM JSON is unchanged and all edits go through the normal canvas/properties/code workflows in "All" mode.

</domain>

<decisions>
## Implementation Decisions

### Level mapping & filtering
- C4 levels map to CALM node types automatically (no manual tagging):
  - **Context**: actor, system, ecosystem (top-level nodes with no parentId)
  - **Container**: service, database, webclient, network, ldap, data-asset
  - **Component**: aws:*, gcp:*, azure:*, k8s:*, ai:*, generic, custom types
- Only top-level nodes shown at Context level — everything nested inside containers is hidden
- Extension pack infrastructure (VPC, Subnet, Namespace) appears at Component level, not Container
- Edges to hidden nodes are hidden (only show edges where both source AND target are visible)

### Drill-down interaction
- Double-click a system/container node to drill down into its children
- Single-click still selects the node for properties inspection
- Zoom-in animation when drilling down (spatial context: "going inside this thing")
- C4 view mode is read-only navigation — no editing, no drag-and-drop, no node creation
- Click "All" in the toolbar to exit C4 mode and return to full editing

### Breadcrumb navigation
- Clickable breadcrumb bar at top of canvas: "All Systems > Payment System > API Gateway"
- Click any breadcrumb segment to jump back to that level
- Always visible when in C4 mode
- "All Systems" as the root label at Context level

### Visual styling per level
- External systems greyed out with "[External]" badge at Context level
- External flag stored in customMetadata: `{ "c4-scope": "external" }`
- Ecosystem nodes auto-detected as external
- Subtle background tint per level: Context=neutral, Container=light blue (#f8faff), Component=light green (#f8fff8)
- Level badge in corner of canvas (e.g., "[Context]")
- When drilled into a container, show adjacent peer systems as small faded nodes at edges for spatial context

### View selector UX
- Segmented control in top toolbar: [All | Context | Container | Component]
- "All" is the default (normal editing mode); clicking a C4 level enters read-only navigation
- Keyboard shortcuts: 1=All, 2=Context, 3=Container, 4=Component (only when not editing text)
- Palette hidden in C4 mode (can't add nodes)
- Properties panel shows selected node info but read-only
- Code panel stays visible as reference
- Exiting C4 mode restores previous canvas position/zoom

### Claude's Discretion
- Exact animation timing and easing for drill-down transitions
- Faded peer node sizing and positioning
- Breadcrumb styling and overflow behavior for deep hierarchies
- Level badge positioning and design

</decisions>

<specifics>
## Specific Ideas

- Drill-down animation should feel like "zooming into" the node — spatial, not just a page switch
- Faded peer nodes at edges give context like Google Maps showing neighboring areas
- The segmented control should match the toolbar style already used in the app
- Number key shortcuts (1-4) match the visual left-to-right order of the segmented control

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `containment.ts`: `makeContainment()`, `removeContainment()`, `isContainmentType()` — already manages parent-child nesting via `parentId`/`extent`
- `ContainerNode.svelte`: renders container boxes with child nodes — basis for understanding which nodes have children
- `elkLayout.ts`: hierarchical layout engine — could auto-layout nodes at each C4 level
- `resolveNodeType()` in `nodeTypes.ts`: maps CALM types to component keys — can be used to determine C4 level from node type
- Extension pack `isContainer` flag on `NodeTypeEntry` — identifies infrastructure containers (VPC, Subnet, Namespace)

### Established Patterns
- Svelte Flow `parentId`/`extent` for nesting — C4 drill-down can use this to find children of a node
- `$state.raw` for reactive arrays (nodes/edges) — filtered views should derive from the same source
- `applyFromCanvas()`/`applyFromCode()` sync pattern — C4 mode should NOT call these (read-only)
- Svelte 5 `$derived` for computed state — C4 filtered node/edge lists should be derived stores

### Integration Points
- `+page.svelte`: top-level layout, toolbar area — segmented control goes here
- `CalmCanvas.svelte`: canvas component — needs to accept a "readonly" mode and filtered node/edge props
- `PropertiesPanel.svelte`: needs a "readonly" prop to disable editing in C4 mode
- `NodePalette.svelte`: needs to hide when C4 mode is active
- `customMetadata` on CalmNode: already supported, used for `c4-scope: external` tagging

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-c4-view-mode*
*Context gathered: 2026-03-13*
