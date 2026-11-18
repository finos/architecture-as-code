# 🏛️ CALM Hub UI


https://github.com/user-attachments/assets/931cca52-6dff-4895-8de4-88a291acd41a


Explore, visualize, and manage CALM architecture models through an interactive web interface. Features graph-based visualization, pattern decision exploration.

## ✨ Features

### 🎯 Interactive Architecture Visualization
- **Graph-Based Rendering**: ReactFlow-powered diagrams with automatic layout via Dagre
- **Smart Node Rendering**: Type-specific icons for Actors, Systems, Services, Databases, Networks, and more
- **Group Nodes**: Automatic container grouping for `deployed-in` and `composed-of` relationships
- **Floating Edges**: Bezier-curved edges with labels and badges that avoid node overlap
- **Pan, Zoom & Minimap**: Full interactive controls with fit-to-view

### 🧩 Pattern Visualization with Decision Support
- **JSON Schema Patterns**: Render architecture patterns with automatic layout
- **Decision Points**: Extract and display `oneOf`/`anyOf` constraints as interactive decision selectors
- **Dynamic Filtering**: Select decision paths to see how the architecture changes
- **Decision Group Nodes**: Visual grouping highlights pattern variants

### 🌳 Hub Navigation
- **Tree-Based Browsing**: Collapsible sidebar to explore Namespaces, Architectures, Patterns, Flows, and ADRs
- **Diagram & JSON Views**: Toggle between interactive visualization and raw JSON with syntax highlighting
- **Version Selection**: Browse and switch between architecture revisions
- **Quick Visualize**: Jump from any document into the full Visualizer workspace
- **Extension Round Trips**: A resource or extension link keeps the exact namespace, resource, version and selected element, and the next page shows **Back to …**. Browser Back and Forward select again the node that you selected, also when the URL does not name it. See [Extension Navigation](https://calm.finos.org/calm-hub/calm-hub-extension-navigation)
- **Extension Identity**: An extension's logo, or its generated marker, shows beside its name in the menu, home cards, screen headings and inspector
- **Operator Branding**: The operator can set the organisation name, logo and colour, a menu at the side of each page, hidden namespace or control domain sections, and a start page. See [UI Customization](https://calm.finos.org/calm-hub/#ui-customization)
- **Collapsible Menu**: Collapse the desktop side menu to make more room for the page. The browser remembers the choice; narrow screens still use the menu drawer

### 🔍 Search & Filtering
- **Node Search**: Find nodes by name, unique-id, or node-type
- **Type-Based Filtering**: Filter by node type via dropdown
- **Opacity Dimming**: Matching nodes at full opacity, non-matching dimmed to 15%
- **Edge Filtering**: Edges follow connected node visibility

### 📋 Metadata Panel
- **Flows Panel**: View business and data flows with step-by-step transitions
- **Controls Panel**: Hierarchical security and compliance controls
- **Flow Highlighting**: Click a transition to highlight the corresponding relationship in the graph
- **Control Deep-Linking**: Jump from a control to the affected node

### 🛡️ Risk & Control Integration
- **Risk-Aware Borders**: Node border color indicates risk level (red, yellow, green)
- **Hover Details**: Tooltips show associated risks and mitigations
- **Control Badges**: Quick visibility into control coverage per node

### 📝 ADR Rendering
- **Rich Display**: Context, decision drivers, considered options, outcome, and links
- **Markdown Support**: GitHub-flavored Markdown in context, option descriptions, and rationale, including tables, task lists, strikethrough, and footnotes. Overflowing tables scroll and enter the tab order, with labels identifying their section and source line; footnotes keep the current ADR route.
- **Revision Browsing**: Switch between ADR versions
- **Status Badges**: Visual indicators for approved, deprecated, and other statuses

### 🔎 Inspector Sidebar
- **Edge Handle**: The **Details & extensions** handle opens the inspector from a separate right-edge rail, without covering diagram or tab controls
- **Selection Details**: Click any node or edge to see its details, readable or as JSON. With no selection, the inspector shows the resource
- **View Menu**: Details comes first, followed by views grouped under each extension name. Select one view at a time; the extension's actions stay with it. Visited views keep their state without loading in the background. `?extension=<id>` opens the extension's first view on a fresh load; view choices stay in memory
- **Narrow Screens**: The inspector fills the screen, with **Back to diagram**
- **Drag & Drop Upload**: Load CALM JSON files directly into the visualizer

## 🚀 Getting Started

### Prerequisites
- Node.js (see `.nvmrc` for the recommended version)
- A running instance of CALM Hub (the backend API)

### Development

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000) to view the app in your browser. The page will reload when you make changes.

### 🧪 Running Tests

```bash
# Unit tests
npm test

# End-to-end tests (headed mode)
npm run start-cypress
```

E2E tests use [Cypress](https://docs.cypress.io/) with [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/) queries. All tests are stubbed against the CALM Hub API.

You need to set the environment variable `VITE_BASE_URL` to the address where the Vite dev server is running (see `.env.example` for defaults).

### 📦 Production Build

```bash
npm run build
```

Outputs an optimized production bundle to the `build` folder.

## 🛠️ Tech Stack

| Category | Libraries |
|---|---|
| UI Framework | React 19, React Router, TypeScript |
| Visualization | ReactFlow, Dagre, D3 |
| Styling | TailwindCSS, DaisyUI |
| Code Display | Monaco Editor, react-json-view-lite |
| Auth | OpenID Connect (oidc-client-ts) |
| Testing | Vitest, Cypress |
| Build | Vite |

## 🤝 Getting Involved

Architecture as Code was developed as part of the [DevOps Automation Special Interest Group](https://devops.finos.org/) before graduating as a top level project in its own right. Our community Zoom meetups take place on the fourth Tuesday of every month, see [here](https://github.com/finos/architecture-as-code/issues?q=label%3Ameeting) for upcoming and previous meetings. For active contributors we have Office Hours every Thursday, see the [FINOS Event Calendar](http://calendar.finos.org) for meeting details.

Have an idea or feedback? [Raise an issue](https://github.com/finos/architecture-as-code/issues/new/choose) in this repository.

---

**Contributing**: Issues and PRs welcome! 🎉
