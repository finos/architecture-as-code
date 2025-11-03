# CALM Explorer

An interactive exploration tool for [FINOS CALM](https://github.com/finos/architecture-as-code) (Common Architecture Language Model) architecture diagrams. This tool provides a real-time graph visualization with an integrated JSON editor, enabling users to explore and understand software architecture definitions with support for AI Governance Framework (AIGF) risk annotations.

## Features

- **Interactive Graph Visualization**: Auto-layouted architecture diagrams using ReactFlow and Dagre
- **JSON Editor**: Built-in Monaco editor with syntax highlighting and validation
- **AIGF Risk Visualization**: Color-coded risk levels, risk/mitigation badges, and governance control annotations
- **Node Details Panel**: Detailed view of node properties, interfaces, risks, and mitigations
- **File Import**: Upload and visualize your own CALM JSON files
- **Responsive Layout**: Resizable panels for optimal workspace management

## Prerequisites (macOS)

Before you begin, ensure you have the following installed:

### 1. Install Homebrew

If you don't have Homebrew installed, run:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### 2. Install Node.js and npm

We recommend using Node Version Manager (nvm) for managing Node.js versions:

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Close and reopen your terminal, then install Node.js
nvm install node
nvm use node

# Verify installation
node --version  # Should show v20 or higher
npm --version   # Should show v10 or higher
```

Alternatively, you can install Node.js directly with Homebrew:

```bash
brew install node
```

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/finos/architecture-as-code.git
cd architecture-as-code/experimental/calm-explorer
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start Development Server

```bash
npm run dev
```

The application will start on `http://localhost:8080`

## Available Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Build in development mode
npm run build:dev

# Preview production build
npm run preview

# Lint code
npm run lint

# Fix linting issues
npm run lint-fix

# Run tests
npm test

# Run tests in watch mode
npm run test

# Run tests once
npm run test:run

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

## Usage

1. **Load Architecture**: The app starts with a demo CALM architecture
2. **Edit JSON**: Use the left panel to edit or paste your CALM JSON
3. **Upload File**: Click the upload button to load a local CALM JSON file
4. **Download**: Export your current architecture as a JSON file
5. **Explore Graph**: Click and drag to pan, scroll to zoom, click nodes to view details
6. **View Details**: Click any node to see detailed information, including AIGF risks and mitigations

## CALM JSON Format

The explorer expects CALM-compliant JSON with this structure:

```json
{
  "nodes": [
    {
      "unique-id": "node-id",
      "name": "Node Name",
      "node-type": "system",
      "description": "Description",
      "interfaces": [...],
      "controls": {
        "control-id": {
          "description": "Control description",
          "requirements": [
            {
              "requirement-url": "https://example.com/requirement",
              "config": {
                "key": "value"
              }
            }
          ]
        }
      }
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
      "protocol": "HTTPS",
      "controls": {
        "control-id": {
          "description": "Control description",
          "requirements": [...]
        }
      }
    }
  ],
  "flows": [
    {
      "unique-id": "flow-id",
      "name": "Flow Name",
      "description": "Flow description",
      "transitions": [...],
      "controls": {
        "control-id": {
          "description": "Control description",
          "requirements": [...]
        }
      }
    }
  ]
}
```

See the included `calm-example.json` file for a complete architecture with FINOS AIGF controls.

## Technology Stack

- **React 18** - UI framework
- **TypeScript** - Type-safe development
- **Vite** - Build tool and dev server
- **ReactFlow** - Graph visualization
- **Dagre** - Graph layout algorithm
- **Monaco Editor** - Code editor component
- **Tailwind CSS** - Styling
- **shadcn/ui** - UI component library
- **React Query** - Data fetching and state management

## Project Structure

```
src/
├── components/
│   ├── ArchitectureGraph.tsx  # Main graph visualization
│   ├── JsonEditor.tsx          # Monaco JSON editor
│   ├── NodeDetails.tsx         # Node details panel
│   ├── CustomEdge.tsx          # Custom edge rendering
│   ├── ControlBadge.tsx        # Control badge component
│   ├── ControlDetails.tsx      # Control details display
│   ├── ControlPanel.tsx        # Control panel UI
│   └── ui/                     # shadcn/ui components
├── pages/
│   └── Index.tsx               # Main application page
├── utils/
│   ├── controlResolver.ts      # Control resolution logic
│   └── urlValidation.test.ts   # URL validation tests
├── types/
│   └── calm.ts                 # TypeScript type definitions
├── test/
│   ├── setup.ts                # Test setup and configuration
│   ├── idExtraction.test.ts    # ID extraction tests
│   └── mockData/               # Test mock data
└── public/
    └── calm-example.json       # Example CALM architecture
```

## Testing

The project uses Vitest for unit testing with React Testing Library integration. Tests are located in `src/test/` and alongside component files.

Run tests with:
```bash
npm test              # Run tests in watch mode
npm run test:run      # Run tests once
npm run test:ui       # Run tests with UI
npm run test:coverage # Generate coverage report
```

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

This project is licensed under the Apache License, Version 2.0 - see the [LICENSE](../LICENSE) file for details.

Copyright 2025 Fintech Open Source Foundation

## Resources

- [FINOS CALM Specification](https://github.com/finos/architecture-as-code)
- [FINOS AI Governance Framework](https://github.com/finos/architecture-as-code/tree/main/calm/aigf)
- [ReactFlow Documentation](https://reactflow.dev/)
