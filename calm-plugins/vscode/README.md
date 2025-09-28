# CALM VS Code Extension

> **Status**: Experimental - APIs, behavior, and visuals may change. Use at your own risk.

Live-visualize CALM architecture models while you edit them. Features an interactive preview, tree navigation, intelligent validation, and documentation generation - all working offline with a clean MVVM architecture.

## Features

### 🎯 Interactive Preview Panel
- **Live Graph Visualization**: Powered by Cytoscape with configurable layouts (dagre, fcose, cose)
- **Smart Containment Rendering**: "deployed-in" and "composed-of" relationships render as nested compound containers
- **Smooth Updates**: Incremental updates preserve pan/zoom and node positions between edits
- **Rich Interactions**: Click to inspect, double-click to jump to source, drag nodes to reposition
- **Theme Integration**: Styling automatically matches your VS Code theme

![CALM VS Code Extension](docs/CalmVSExtension.png)
*Interactive preview with tree navigation, editor integration, and live graph visualization*

### 🌳 Tree View Navigation
- **Structured Overview**: Hierarchical view of Nodes, Relationships, and Flows
- **Quick Navigation**: Click to reveal elements in both editor and preview
- **Search & Filter**: Find specific elements across large models
- **Context Actions**: Right-click for additional operations

*Tree view navigation shown in the main extension screenshot above*

### ✨ Smart Editor Features
- **Hover Information**: Rich tooltips for model elements
- **CodeLens Actions**: Quick navigation links embedded in your code
- **Auto-Refresh**: File watching with automatic preview updates on save
- **Diagnostics Integration**: Problems panel shows validation errors

### 📋 Template & Documentation Mode
- **Template Processing**: Generate documentation from CALM models using Handlebars templates
- **Live Mode**: Auto-refresh documentation as you edit
- **Multiple Formats**: Support for HTML and Markdown output
- **Custom Templates**: Use your own templates or built-in defaults

![Live Docify Mode](docs/LiveDocifyMode.png)
*Live templating mode with real-time documentation generation*

## Architecture

The extension follows a **Redux Pattern + MVVM + Hexagonal Architecture** approach with clear separation of concerns:

### 🏗️ Core Architecture Principles

```mermaid
graph TB
    UI[VS Code UI<br/>TreeView, Webview, Commands]
    VM[View Models<br/>Presentation Logic]
    M[Mediators<br/>Cross-cutting Concerns]
    Store[Application Store<br/>Global State]
    
    UI <--> VM
    VM --> Store
    M --> Store
    M --> VM
    
    subgraph "Framework-Free Zone"
        VM
        Store
    end
    
    subgraph "VS Code Integration"
        UI
        M
    end
    
    style Store fill:#e1f5fe
    style VM fill:#f3e5f5
    style M fill:#fff3e0
    style UI fill:#e8f5e8
```

#### **MVVM (Model-View-ViewModel)**
- **Models**: `application-store.ts` - Zustand-based global state management
- **ViewModels**: Framework-free presentation logic (no `vscode` imports)
  - `TreeViewModel` - Tree structure and navigation
  - `EditorViewModel` - Editor interactions and positioning  
  - `DocifyViewModel` - Documentation generation state
  - `CalmModelViewModel` - Model data display
  - `TemplateViewModel` - Template processing and live mode
- **Views**: VS Code specific UI implementations (TreeDataProvider, WebviewPanel, etc.)
- **Controller**: `calm-extension-controller.ts` handles dependency wiring and VS Code lifecycle

#### **Hexagonal Architecture (Ports & Adapters)**
```
src/core/
├── ports/           # Interfaces (dependency inversion)
├── services/        # Core business logic
├── mediators/       # Cross-cutting concerns coordination
└── application-store.ts  # Central state management
```

#### **Mediator Pattern**
Mediators handle cross-cutting concerns without tight coupling:
- **RefreshService**: Coordinates model updates and UI refreshes
- **SelectionService**: Syncs selection across tree, editor, and preview
- **WatchService**: File system monitoring and change detection
- **StoreReactionMediator**: Reactive state management orchestration

### 📁 Project Structure

```
src/
├── application-store.ts         # Zustand store (global state)
├── calm-extension-controller.ts # Main orchestration controller
├── extension.ts                 # VS Code entry point
├── 
├── core/                        # Hexagonal architecture core
│   ├── ports/                   # Dependency inversion interfaces
│   ├── services/                # Business logic services
│   ├── mediators/               # Cross-cutting concern coordinators
│   └── emitter.ts              # Framework-free event system
│   
├── features/                    # Feature-based organization
│   ├── editor/                  # Editor integration (hover, CodeLens)
│   ├── preview/                 # Webview preview panel
│   │   ├── docify-tab/         # Documentation generation
│   │   ├── model-tab/          # Model data display
│   │   └── template-tab/       # Template processing
│   └── tree-view/              # Sidebar tree navigation
│       └── view-model/         # MVVM presentation logic
│
├── commands/                    # VS Code command implementations
├── models/                      # Model parsing and indexing
└── cli/                        # CLI integration (to be replaced)
```

## Installation & Development

### Prerequisites
- VS Code 1.88+
- Node.js 18+

### Development Setup

1. **Install dependencies**:
   ```bash
   cd calm-plugins/vscode
   npm install
   ```

2. **Start development server**:
   ```bash
   npm run watch
   ```

3. **Launch Extension Development Host**:
   - Press `F5` in VS Code
   - Or use "Run CALM Extension" from the debug panel

### Building for Production

```bash
npm run build
npm run package  # Creates .vsix file
```

### Testing

```bash
npm test                    # Run all tests
npm test -- --watch       # Run tests in watch mode
npm test -- tree-view     # Run specific test suite
```

**Test Coverage**: 109 tests across all ViewModels with comprehensive:
- State management validation
- Event emission testing  
- Resource cleanup verification
- Edge case handling

## Configuration

Settings can be configured in VS Code Settings UI by searching for "CALM", or programmatically in your workspace settings.

## Usage

### Basic Workflow

1. **Open a CALM model** (JSON or YAML)
2. **Run "CALM: Open Preview"** to launch the interactive graph
3. **Use the CALM activity bar** for tree navigation
4. **Edit your model** - preview updates automatically on save

### Advanced Features

- **Template Mode**: Generate docs using Handlebars templates
- **Search & Filter**: Find elements across large models  
- **Position Persistence**: Node positions saved per document
- **Multi-format Support**: JSON and YAML with automatic normalization

## Developer Guide

### 🎯 Current Implementation Status

#### ✅ **Completed** 
- **MVVM Architecture**: Clean separation with framework-free ViewModels
- **Comprehensive Testing**: 109 tests covering all ViewModels
- **State Management**: Zustand-based reactive store  
- **Interactive Preview**: Cytoscape-powered graph with rich interactions
- **Tree Navigation**: Full CRUD operations with search/filter
- **Editor Integration**: Hover, CodeLens, and automatic refresh
- **Template System**: Handlebars processing with live mode

#### 📋 **In Progress/Planned**
- **Hexagonal Architecture Refinement**: Completing ports/adapters pattern
- **Mediator Coordination**: Fine-tuning cross-cutting concerns
- **CLI Integration Replacement**: `--scaffold` mode from docify CLI will replace most of the code in  `src/cli/` folder (See https://github.com/finos/architecture-as-code/issues/1563)
- **Model Updates**: Original [POC](https://github.com/finos/architecture-as-code/pull/1516) models in `src/models/` and settings need updating to potentially use models from @finos/calm-models and reduce use of any
- **Enhanced Validation**: Richer diagnostics and error reporting

### 🎯 Contribution Guidelines

#### **ViewModels Should**
- ✅ Be framework-free (no `vscode` imports)
- ✅ React to store state changes only
- ✅ Provide presentation-ready data
- ✅ Emit events for user intents
- ❌ **NOT** know about mediators directly

#### **Mediators Should** 
- ✅ Coordinate between different parts of the system
- ✅ Handle cross-cutting concerns (selection, refresh, etc.)
- ✅ Subscribe to store changes and ViewModel events
- ❌ **NOT** contain business logic



---

**Contributing**: Issues and PRs welcome! Please follow the architectural patterns established and include tests for new functionality.
