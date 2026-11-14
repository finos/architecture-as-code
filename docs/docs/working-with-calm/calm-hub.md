---
id: calm-hub
title: CALM Hub
sidebar_label: CALM Hub
sidebar_position: 4
---


:::tip CALM Hub documentation
This page covers the **visual interface** of CALM Hub. For the technical reference see the [overview and runtimes](/calm-hub/), the [developer guide](/calm-hub/calm-hub-developer-guide), and the [MCP and API reference](/calm-hub/calm-hub-mcp-api).
:::

# CALM Hub

**CALM Hub** is the central artifact store for the CALM ecosystem—similar in purpose to Maven Central, but built specifically for publishing, versioning, and distributing CALM architecture models and compliance assets. 

In addition to acting as a repository, CALM Hub serves as an interactive visualization and navigation tool. It provides a visual representation of system architectures, patterns, and security controls, making it easier for architects, developers, and compliance auditors to navigate and communicate system designs.

---

## Getting Started

### Accessing and Starting the Hub

CALM Hub can be run in two different database/storage modes depending on your requirements:

1. **MongoDB Mode (Default)**: Uses MongoDB for data persistence. This is the production-ready default mode.
2. **Standalone Mode**: Uses NitriteDB (an embedded NoSQL database) for local file-based storage. This mode does not require running an external MongoDB instance, making it ideal for local testing, demo scenarios, or quick setup.

#### Starting in MongoDB Mode (Default)

To run in MongoDB mode, you need a running MongoDB database:

1. **Start MongoDB**:
   ```bash
   cd calm-hub/local-dev
   docker-compose up
   ```
2. **Start the Hub**:
   ```bash
   cd calm-hub
   ../mvnw quarkus:dev
   ```

#### Starting in Standalone Mode (NitriteDB)

To run the Hub in standalone mode without an external database dependency, run:

```bash
cd calm-hub
../mvnw quarkus:dev -Pstandalone
```

This sets the storage mode to `standalone` (NitriteDB), suppresses MongoDB health checks and turns off dev services, so it needs no Docker. Use the Maven profile (`-Pstandalone`): dev mode does not apply `-Dquarkus.profile=standalone`.

#### Accessing the UI & API Docs

Once running, you can access the Hub at:
- **Visual Interface**: [http://localhost:8080/](http://localhost:8080/)
- **Swagger API Docs**: [http://localhost:8080/q/swagger-ui](http://localhost:8080/q/swagger-ui)

---

## Interface Layout

The CALM Hub dashboard is divided into three primary zones:

1. **Top Navbar:** Displays the branding, navigation links (Hub explorer, standalone Visualizer), and a global search bar.
2. **Explore Sidebar (Left):** Allows hierarchical or flat navigation of Namespaces, Resource Types, and Compliance Control Domains.
3. **Main Content Area (Center/Right):** Dynamically updates depending on the selected resource, rendering visual diagrams, JSON documents, or interactive schema forms.

![CALM Hub Explorer Dashboard](/img/hub-ui/home.png)

---

## Exploring Hub Artifacts

### Namespaces Sidebar

Architectures and related documents in CALM Hub are organized under **Namespaces** (e.g. `traderx`, `finos`). The sidebar allows you to explore these assets using two viewing modes:

* **Hierarchical View (Tree):** Group and nest sub-namespaces based on dot-notation boundaries (e.g. `org.finos`).
* **Flat View (List):** Lists all namespaces alphabetically at the root level.

Toggle between these modes using the list and tree buttons at the top of the sidebar.

### Artifact Resource Types

Under each namespace, you can browse and retrieve the following artifacts:

| Artifact Type | Purpose | Typical Content |
| :--- | :--- | :--- |
| **Architectures** | Deployed systems and architectures | Component relationships, protocols, and control mappings |
| **Patterns** | Standard blueprints or reusable architectures | Reusable design specifications (e.g., trading system layout) |
| **Flows** | System transactions or business processes | Sequential interactions between components over time |
| **Standards** | Architectural rules and policies | Structural validations (e.g., mandating encryption) |
| **ADRs** | Architectural Decision Records | Human-readable markdown files capturing system decisions |
| **Interfaces** | Declared communication endpoints | Exposed APIs, host-port pairs, or container images |

---

### My Namespace

If the operator turns on personal namespaces, each user can have one private namespace for scratch work, for example `users.jane-doe`. The home page shows a **My namespace** card:

| Card | What it means |
| :--- | :--- |
| Name and **Create** | The namespace does not exist yet. **Create** makes it |
| Name, **Open** and **Copy name** | The namespace is yours. **Copy name** is for the `$id` of documents that you push with the CLI |
| A message to ask an admin | Another user holds the name, or your user name cannot be used |

No card shows when personal namespaces are off.

![My namespace card](/img/hub-ui/my-namespace-card.png)

Only you can see your namespace until you give other users access. See [Personal Namespaces](./calm-hub-entitlements.md#personal-namespaces) for the rules. From the command line, use `calm hub whoami` and `calm hub create my-namespace` (see the [CLI hub commands](../calm-cli/hub.md#your-personal-namespace)).

A new namespace contains **My architecture**, a starter architecture. It shows you, the CALM CLI, CALM Hub UI and the CALM Hub API, with flows for how you use them. Change it, or replace it with your own.

![The starter architecture in a new personal namespace](/img/hub-ui/my-architecture.png)

---

## Interactive Architecture Visualizer

When you select an **Architecture** or **Pattern** artifact, CALM Hub renders the model using an interactive canvas.

![CALM Hub Architecture Diagram](/img/hub-ui/diagram-view.png)

### Canvas Features

* **Interactive Elements:** Hovering or clicking on a node or edge displays its name, type, and relationships.
* **Pan & Zoom:** Click and drag the canvas background to pan; use your scroll wheel or the floating bottom-left controls to zoom.
* **Minimap:** A floating overview panel in the bottom-right corner helps navigate larger diagrams.
* **Component Search & Filtering:** Filter nodes dynamically using the search bar and type dropdown at the top right of the canvas.
* **Details Sidebar:** Clicking any component opens a right-hand sidebar displaying its complete metadata, interfaces, and compliance controls. Its **Decorators** section lists the decorators whose `applies-to` contains the component.
* **Image Export:** The export control (the image icon in the bottom-left diagram controls) saves the whole diagram as an SVG or PNG file, as it is drawn on screen, in the current theme. The image includes the decision overlay and the decorator overlay badges, but not the overlay legend. It is not available on mobile.

### Tab Views

* **Diagram Tab:** The interactive visual representation of the model.
* **C4 Tab:** The architecture as a C4 model. See [C4 View](#c4-view).
* **JSON Tab:** The raw, validated CALM JSON backing the diagram.
* **Decorators Tab:** Lists all decorators of the architecture version, of every type. Each shows its type (or "(no type)"), `applies-to`, its created and updated times when Hub returns them, and `data`, with links, dates, lists, tables and collapsible nested values. The JSON view shows the decorator as a write takes it, without the Hub-owned times, so you can copy it into a `PUT`. Filter by type and by `$schema`. The filters are in the URL, for example `?tab=decorators&type=deployment`.

An unknown `?tab=` value opens the Diagram tab. The old `?tab=deployments` link opens the Decorators tab filtered to `deployment`.

### C4 View

The **C4** tab shows the architecture as a C4 context, container, component or deployment diagram. The [CALM C4 standard](../core-concepts/c4.md) sets the C4 kind of each node.

![The C4 tab at container level](/img/hub-ui/c4-view.png)

* **Level and scope:** select a level. At container and component level, select the system or container in scope. Click an element to open the next level down. The next level is a `composed-of` child, or the detailed architecture of the node. The breadcrumb goes back up.
* **Mapping:** the badge shows the C4 mapping in use. The tab uses the `c4-mapping` default config of the namespace, or of its nearest parent namespace. When no namespace sets one, it uses the default mapping of the standard. When the mapping, or a mapping that it extends, does not load or is not valid, the tab shows the error and no diagram.
* **Guessed elements:** an element with a dashed border has a node type that the mapping does not name. Its kind comes from the structure of the architecture. Add the node type to the mapping to fix the kind.
* **External elements:** a grey element is outside the enterprise or owned by another team. Its chip gives the reason.
* **Notes:** the panel at the bottom right lists the conflicts with the standard, and why an element shows at a different kind than its mapping.

The level and the scope are in the URL, for example `?tab=c4&level=container&scope=trading-system`.

### Decorator Overlays

Some decorator types are drawn on the diagram as an overlay. Each node or relationship gets a badge with its status, and a status that needs attention also colours the element: red for an error, amber for a warning. CALM Hub has two built-in overlays:

| Overlay | Decorator type | Shows |
|---|---|---|
| Control evaluations | `control-evaluation` | The latest result of each control: see [Control Evaluations](#control-evaluations) |
| Deployments | `deployment` | The status of the latest deployment, by `start-time`: completed (OK), pending or in progress (Info), rolled back (Warning), failed (Error) |

The legend at the bottom of the diagram lists each overlay that has decorators on screen, with how many elements show each status. Clear an overlay's checkbox to hide it. On a screen narrower than 1024 pixels, the legend starts closed: tap **Overlays** to open it. **View all** opens the Decorators tab filtered to the type and the `$schema` of that overlay. While the diagram, the Decorators tab or the details drawer is open, they refresh every 5 seconds.

![CALM Hub Raw JSON Viewer](/img/hub-ui/json-view.png)

### Control Evaluations

When a tool checks an architecture's controls, for example a policy engine that checks a change before it merges, it can record each result in CALM Hub as a **control evaluation decorator**. Each decorator says which control was evaluated, whether it was `met`, `not-met` or `not-applicable`, and, when not met, which checks failed. The format is the [control evaluation decorator Standard](https://github.com/finos/calm-schema/tree/standard-control-evaluation-v1.0/standards/control-evaluation). The decorator's `target` is the architecture version, in the form `/api/calm/namespaces/{namespace}/architectures/{id}/versions/{major-minor-patch}`, and its `applies-to` lists the nodes and relationships the result is about. Create it with `POST /api/calm/namespaces/{namespace}/decorators`.

The diagram shows the latest result for each node and relationship of the version on screen:

* **Not met:** The node gets a red border and a **Not met** badge. Hover over it to see its latest evaluations, not met first, and what each failed check requires. A relationship is drawn red, arrowheads included, with a **Not met** label.
* **Met:** The node gets a **Met** badge. Hover over it to see who approved the change, when an approver is recorded.
* **Containers:** A container (a node that other nodes are `deployed-in` or `composed-of`) shows the same badge beside its label, and a solid red border when not met. A `deployed-in` or `composed-of` relationship is drawn as its container rather than as a line, so its results show on the container.
* **Evaluations panel:** The metadata panel below the diagram lists every evaluation of the version, newest first, with the elements it applies to and its findings.

The results refresh every 5 seconds, so a new decision appears without reloading the page.

![CALM Hub Control Evaluations](/img/hub-ui/control-evaluations.png)

#### Decision Overlay

The **Show decisions** control (the gavel icon in the bottom-left diagram controls) draws each element's latest decision on the diagram, so it can be read without hovering. This is useful when you present the diagram or share your screen.

* Below each evaluated node or container, a callout says **Blocked**, with each control that was not met, what it requires and the element it is about; **Approved by** someone, with the control and the short commit; or **Met**, with the reviewer when one is recorded.
* A relationship that was not met says what it requires beside its **Not met** label.

The overlay turns on and off with **presentation mode** (the presentation icon beside it), which makes the diagram text larger for a projector. You can also switch the overlay on or off by itself. The choice is kept for the browser session.

![CALM Hub Decision Overlay in Presentation Mode](/img/hub-ui/decision-overlay.png)

---

## Timeline

The bottom of the visualizer features a collapsible **Timeline Bar** that represents the history and evolution of the selected architecture or pattern artifact.

How the Hub renders this bar depends on whether the artifact has an authored timeline document or only published versions — see [Explicit vs. Implied Timelines](../core-concepts/timelines#explicit-vs-implied-timelines) for the underlying concept.

### Collapsed Mode

By default, the timeline appears as a compact sparkline strip at the bottom of the screen.

* **Version Dots:** Each version is represented by a dot arranged chronologically (oldest first on the left). The currently active version is highlighted in blue.
* **Navigation:** Left-click any dot to switch the main canvas to that specific version.
* **Date Markers:** Release dates or milestone dates are rendered underneath each version dot when configured.

![CALM Hub Collapsed Timeline](/img/hub-ui/timeline-collapsed.png)

---

### Expanded Mode

Click the **chevron button** on the right side of the sparkline to expand the timeline.

* **Moment Cards:** Displays larger card layouts for each version containing titles, release dates, and descriptions of what was introduced in that milestone.
* **Baseline Indicator (NOW Badge):** Authored timelines feature a **NOW** badge on the card matching the current production-deployed release.
* **Change Log (What Changed):** Renders a live-diff table below the cards detailing precisely what components, relationships, or controls were added, modified, or removed compared to the immediately preceding version.

![CALM Hub Expanded Timeline](/img/hub-ui/timeline-expanded.png)

---

### Version Comparison (Compare Mode)

To visually compare how an architecture evolved between any two milestones in its history:

1. Right-click the starting version's dot on the sparkline to open the context menu and select **Compare from**.
2. Navigate or right-click the ending version's dot and select **Compare to**.
3. CALM Hub enters **Compare Mode**, displaying:
   * **Side-by-Side Diagram Diffs:** Shows the baseline version and the comparison version canvases next to each other.
   * **Color-Coded Canvas Changes:** Added items are highlighted in green on the comparison canvas, modified items in blue, and deleted items in red.
   * **Change Matrix Table:** Displays the total changes count split by Node Changes and Relationship Changes, with detailed lists of exact additions and modifications.

![CALM Hub Timeline Comparison Mode](/img/hub-ui/timeline-compare.png)

---

## Compliance and Controls Deep-Dive

Selecting a control from a **Control Domain** (e.g. `security` or `ai-governance`) displays detailed policy configurations.

![CALM Hub Control Viewer](/img/hub-ui/control-view.png)

### Views

* **Readable Tab:** Parses complex JSON Schema rules into human-readable tables detailing parameter constraints, encryption requirements (e.g. approved TLS versions), and rotation periods.
* **Raw JSON Tab:** Inspects the raw control requirement schema.
* **Configurations & Versions:** Toggles between different policy revisions and environment-specific overrides.

---

## Access Control

CALM Hub uses a hierarchical entitlement model to control who can read, write, and administer namespaces. See [CALM Hub Entitlements](./calm-hub-entitlements) for the full model, worked examples, and API usage.
