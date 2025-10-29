# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React-based visualization tool for FINOS CALM (Common Architecture Language Model) architecture diagrams. It provides an interactive graph visualization with a JSON editor, allowing users to visualize and explore software architecture definitions.

## Development Commands

```bash
# Install dependencies
npm i

# Start development server (runs on http://[::]:8080)
npm run dev

# Build for production
npm run build

# Build in development mode
npm run build:dev

# Lint code
npm run lint

# Preview production build
npm run preview
```

## Architecture

### Core Application Flow

1. **App.tsx**: Root component that sets up routing, React Query, and toast providers
2. **pages/Index.tsx**: Main page that orchestrates the three-panel layout using ResizablePanelGroup
3. **State Management**: Simple React state in Index.tsx manages:
   - `jsonContent`: Raw JSON string for the editor
   - `parsedData`: Parsed CALM object for visualization
   - `selectedNode`: Currently selected node for details view

### Key Components

**JsonEditor** (`components/JsonEditor.tsx`)
- Monaco editor for JSON input
- File upload functionality
- Validates and parses JSON on change

**ArchitectureGraph** (`components/ArchitectureGraph.tsx`)
- Uses ReactFlow for graph visualization
- Dagre algorithm for automatic layout (left-to-right, configurable spacing)
- Parses FINOS CALM format with nested `relationship-type.connects` structure
- Handles both array and object node formats
- Custom edge rendering with protocol tooltips

**NodeDetails** (`components/NodeDetails.tsx`)
- Displays selected node properties
- Replaces graph view when a node is clicked

**CustomEdge** (`components/CustomEdge.tsx`)
- Custom ReactFlow edge with hover tooltips
- Shows description and protocol information
- Uses EdgeLabelRenderer for proper z-index handling

### FINOS CALM Data Structure

The app expects CALM JSON with this structure:

```json
{
  "nodes": [
    {
      "unique-id": "node-id",
      "name": "Node Name",
      "node-type": "system|service|data-store",
      "interfaces": [...]
    }
  ],
  "relationships": [
    {
      "unique-id": "rel-id",
      "relationship-type": {
        "connects": {
          "source": { "node": "source-id", "interface": "interface-id" },
          "destination": { "node": "dest-id", "interface": "interface-id" }
        }
      },
      "protocol": "HTTPS|MCP|..."
    }
  ]
}
```

### Layout Algorithm

Graph layout uses Dagre with these settings:
- `rankdir: 'LR'` (left to right)
- `ranksep: 150` (horizontal spacing between ranks)
- `nodesep: 100` (vertical spacing between nodes)
- Node dimensions: 250x100

To modify layout, adjust parameters in `getLayoutedElements()` in ArchitectureGraph.tsx.

### Styling System

- **Framework**: Tailwind CSS with shadcn/ui components
- **Theme**: HSL-based CSS variables for colors (supports dark mode via `class` strategy)
- **Component library**: Full shadcn/ui suite in `components/ui/`
- **Path alias**: `@/` maps to `src/`

### State and Data Flow

1. User inputs JSON in JsonEditor or uploads file
2. onChange handler in Index.tsx updates `jsonContent` and attempts parse
3. Valid JSON updates `parsedData` state
4. ArchitectureGraph receives `parsedData` and re-renders graph
5. Clicking a node calls `onNodeClick` which updates `selectedNode`
6. NodeDetails panel replaces graph when `selectedNode` is set

## Project Configuration

- **Vite**: SWC-based React plugin for fast builds
- **TypeScript**: Strict mode enabled
- **Dev Server**: Runs on port 8080, listens on all interfaces (`::`), configured in vite.config.ts
- **ESLint**: React hooks and refresh plugins configured
- **Build Tool**: Vite with production optimizations
