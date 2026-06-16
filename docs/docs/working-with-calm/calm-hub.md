---
id: calm-hub
title: CALM Hub
sidebar_position: 4
---

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
../mvnw quarkus:dev -Dquarkus.profile=standalone
```

This automatically sets the storage mode to `standalone` (NitriteDB) and suppresses MongoDB health checks and dev services.

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

## Interactive Architecture Visualizer

When you select an **Architecture** or **Pattern** artifact, CALM Hub renders the model using an interactive canvas.

![CALM Hub Architecture Diagram](/img/hub-ui/diagram-view.png)

### Canvas Features

* **Interactive Elements:** Hovering or clicking on a node or edge displays its name, type, and relationships.
* **Pan & Zoom:** Click and drag the canvas background to pan; use your scroll wheel or the floating bottom-left controls to zoom.
* **Minimap:** A floating overview panel in the bottom-right corner helps navigate larger diagrams.
* **Component Search & Filtering:** Filter nodes dynamically using the search bar and type dropdown at the top right of the canvas.
* **Details Sidebar:** Clicking any component opens a right-hand sidebar displaying its complete metadata, interfaces, and compliance controls.

### Tab Views

* **Diagram Tab:** The interactive visual representation of the model.
* **JSON Tab:** The raw, validated CALM 1.2 JSON schema backing the diagram.
* **Deployments Tab:** Overlays deployment decorators (environments, hosts, and instance settings) on top of the base architecture.

![CALM Hub Raw JSON Viewer](/img/hub-ui/json-view.png)

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
