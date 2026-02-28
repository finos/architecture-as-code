# 🏛️ CALM Hub UI


https://github.com/user-attachments/assets/4719b97c-41e3-4c8a-99ad-34360a2b5fdd


Explore, visualize, and manage CALM architecture models through an interactive web interface. Features graph-based visualization, pattern decision exploration, flow animation, risk-aware rendering, and deep metadata inspection.

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
- **Markdown Support**: Full markdown rendering within ADR sections
- **Revision Browsing**: Switch between ADR versions
- **Status Badges**: Visual indicators for approved, deprecated, and other statuses

### 🔎 Inspector Sidebar
- **Selection Details**: Click any node or edge to inspect its raw JSON
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
| Auth | OpenID Connect (oidc-client) |
| Testing | Vitest, Cypress |
| Build | Vite |

## 🤝 Getting Involved

Architecture as Code was developed as part of the [DevOps Automation Special Interest Group](https://devops.finos.org/) before graduating as a top level project in its own right. Our community Zoom meetups take place on the fourth Tuesday of every month, see [here](https://github.com/finos/architecture-as-code/issues?q=label%3Ameeting) for upcoming and previous meetings. For active contributors we have Office Hours every Thursday, see the [FINOS Event Calendar](http://calendar.finos.org) for meeting details.

Have an idea or feedback? [Raise an issue](https://github.com/finos/architecture-as-code/issues/new/choose) in this repository.

---

**Contributing**: Issues and PRs welcome! 🎉
