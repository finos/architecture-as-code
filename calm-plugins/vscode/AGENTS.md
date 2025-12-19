# CALM VSCode Extension - AI Assistant Guide

This guide helps AI assistants work efficiently with the CALM VSCode extension codebase.

## Tech Stack

- **Language**: TypeScript 5.8+
- **Framework**: VSCode Extension API 1.88+
- **State Management**: Zustand (Redux-like store)
- **Build Tool**: tsup (esbuild-based)
- **Test Framework**: Vitest
- **Architecture Pattern**: MVVM + Hexagonal + Mediator
- **UI Components**: Native VSCode API (TreeView, Webview, Commands)

## Key Commands

```bash
# Development
npm run build          # Build extension
npm run watch          # Watch mode (no auto-reload in VSCode)
npm test               # Run Vitest tests
npm run lint           # ESLint check
npm run lint-fix       # Auto-fix linting issues
npm run package        # Create .vsix package for distribution

# Testing Extension in VSCode
# 1. Open calm-plugins/vscode/ folder in VSCode (File → Open Folder)
# 2. Press F5 (or Run → Start Debugging) to launch Extension Development Host
# 3. In the new Extension Development Host window, open a CALM JSON file to activate extension
```

## Architecture Overview

### 🏗️ Three-Layer Architecture

**MVVM (Model-View-ViewModel)**
```
View (VSCode UI) <--> ViewModel (Framework-free) <--> Model (Zustand Store)
```

**Hexagonal Architecture** (Ports & Adapters)
```
src/core/
├── ports/           # Interfaces (dependency inversion)
├── services/        # Core business logic
└── mediators/       # Cross-cutting orchestration
```

**Mediator Pattern**
- Coordinates between services without tight coupling
- Examples: RefreshService, SelectionService, WatchService

### Directory Structure

```
src/
├── extension.ts                    # VSCode entry point (activate/deactivate)
├── calm-extension-controller.ts    # Main orchestrator (wires dependencies)
├── application-store.ts            # Zustand global state
│
├── core/                           # Framework-free business logic
│   ├── ports/                      # Interfaces for dependency inversion
│   ├── services/                   # Core services (refresh, selection, watch)
│   ├── mediators/                  # Cross-cutting coordinators
│   └── emitter.ts                 # Event system (framework-free)
│
├── features/                       # Feature modules
│   ├── tree-view/                 # Sidebar tree navigation
│   │   └── view-model/           # MVVM presentation logic
│   ├── editor/                    # Editor integration (hover, CodeLens)
│   └── preview/                   # Webview preview panel
│       ├── docify-tab/           # Documentation generation
│       ├── model-tab/            # Model data display
│       └── template-tab/         # Template processing & live mode
│
├── commands/                       # VSCode command handlers
├── models/                         # CALM model parsing & indexing
└── cli/                           # CLI integration (deprecated, being replaced)
```

### Key Design Principles

1. **Framework Isolation**: ViewModels have NO `vscode` imports
2. **Dependency Inversion**: Core depends on ports, not VSCode
3. **Single Store**: All state in `application-store.ts`
4. **Mediator Coordination**: Services don't call each other directly

## Key Concepts

### State Management (Zustand)

**Store Location**: `src/application-store.ts`

```typescript
interface ApplicationStore {
    calmModel: CalmModel | null;
    selectedNode: string | null;
    isLoading: boolean;
    // ... other state
    
    // Actions
    setCalmModel: (model: CalmModel) => void;
    setSelectedNode: (nodeId: string | null) => void;
    // ... other actions
}
```

**Usage**:
```typescript
import { useApplicationStore } from './application-store';

// In ViewModels or components
const model = useApplicationStore(state => state.calmModel);
const setModel = useApplicationStore(state => state.setCalmModel);
```

### MVVM Pattern

**ViewModel Example**:
```typescript
// src/features/tree-view/view-model/tree-view-model.ts
export class TreeViewModel {
    // NO vscode imports!
    constructor(
        private store: ApplicationStore,
        private emitter: Emitter
    ) {}
    
    getTreeData(): TreeNode[] {
        const model = this.store.getState().calmModel;
        return this.transformToTree(model);
    }
}
```

**View (VSCode Specific)**:
```typescript
// src/features/tree-view/tree-data-provider.ts
export class CalmTreeDataProvider implements vscode.TreeDataProvider {
    constructor(private viewModel: TreeViewModel) {}
    
    getChildren(element?: TreeItem): TreeItem[] {
        return this.viewModel.getTreeData().map(toTreeItem);
    }
}
```

### Mediator Pattern

**Mediators** coordinate between services:

```typescript
// src/core/mediators/store-reaction-mediator.ts
export class StoreReactionMediator {
    constructor(
        private store: ApplicationStore,
        private refreshService: RefreshService,
        private selectionService: SelectionService
    ) {
        // React to store changes
        this.store.subscribe(
            state => state.calmModel,
            model => this.refreshService.refreshAll()
        );
    }
}
```

### Features

#### Tree View
- **Purpose**: Sidebar navigation of CALM model structure
- **Location**: `src/features/tree-view/`
- **Key Files**:
  - `tree-data-provider.ts` - VSCode TreeDataProvider
  - `view-model/tree-view-model.ts` - Business logic (framework-free)

#### Webview Preview
- **Purpose**: Multi-tab preview (Model, Docify, Template)
- **Location**: `src/features/preview/`
- **Tabs**:
  - **Model Tab**: Display CALM JSON in formatted view
  - **Docify Tab**: Generate documentation websites
  - **Template Tab**: Live template processing with Handlebars

#### Editor Integration
- **Hover Providers**: Show info on hover
- **CodeLens**: Inline commands in editor
- **Location**: `src/features/editor/`

## Testing

### Test Structure
- `*.spec.ts` - Unit tests alongside source
- `test-architectures/` - Sample CALM files for testing

### Running Tests
```bash
npm test              # All tests
npm test -- --watch   # Watch mode
npm test -- <file>    # Specific test file
```

### Testing ViewModels
ViewModels are framework-free, so they're easy to unit test:

```typescript
import { TreeViewModel } from './tree-view-model';

describe('TreeViewModel', () => {
    it('transforms model to tree', () => {
        const store = createMockStore();
        const vm = new TreeViewModel(store, mockEmitter);
        
        const tree = vm.getTreeData();
        expect(tree).toHaveLength(3);
    });
});
```

## Common Tasks

### Adding a New Command

1. Register in `package.json`:
```json
{
    "contributes": {
        "commands": [{
            "command": "calm.myCommand",
            "title": "CALM: My Command"
        }]
    }
}
```

2. Create handler in `src/commands/`:
```typescript
export function registerMyCommand(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand('calm.myCommand', () => {
            // Implementation
        })
    );
}
```

3. Register in `src/extension.ts`:
```typescript
import { registerMyCommand } from './commands/my-command';

export function activate(context: vscode.ExtensionContext) {
    registerMyCommand(context);
}
```

### Adding State to Store

1. Update `src/application-store.ts`:
```typescript
interface ApplicationStore {
    myNewState: string;
    setMyNewState: (value: string) => void;
}

export const useApplicationStore = create<ApplicationStore>((set) => ({
    myNewState: '',
    setMyNewState: (value) => set({ myNewState: value }),
}));
```

### Creating a New ViewModel

1. Create in appropriate feature folder (framework-free!):
```typescript
// src/features/my-feature/view-model/my-view-model.ts
export class MyViewModel {
    constructor(
        private store: ApplicationStore,
        private emitter: Emitter
    ) {}
    
    // Methods that work with store, NO vscode imports
}
```

2. Create VSCode View:
```typescript
// src/features/my-feature/my-view.ts
import * as vscode from 'vscode';
import { MyViewModel } from './view-model/my-view-model';

export class MyView {
    constructor(private viewModel: MyViewModel) {}
    
    // VSCode-specific implementation
}
```

### Adding a Webview Tab

1. Create tab component in `src/features/preview/my-tab/`
2. Update `src/features/preview/preview-panel.ts` to include new tab
3. Add HTML template if needed

## Dependencies on Other Packages

```
vscode-plugin depends on:
  ├── calm-models (via ../../calm-models)
  ├── calm-widgets (via ../../calm-widgets)
  └── shared (via ../../shared)
```

**Important**: Build dependencies first:
```bash
# From root
npm run build:shared    # Builds models, widgets, shared
```

## Common Pitfalls

1. **Importing vscode in ViewModels**: ViewModels must be framework-free!
2. **Direct Service Calls**: Use mediators for cross-cutting concerns
3. **Store Mutations**: Always use store actions, never mutate directly
4. **Extension Not Activating**: Check `activationEvents` in package.json
5. **Webview Not Updating**: Remember to postMessage from webview to extension

## Debugging

### Debug Extension
1. Open this folder in VSCode
2. Set breakpoints in TypeScript source
3. Press F5 (or Run → Start Debugging)
4. Extension Development Host window opens
5. Open a CALM file to trigger activation

### Debug Webview
1. In Extension Development Host: `Ctrl+Shift+P`
2. Run: "Developer: Open Webview Developer Tools"
3. Use browser devtools to debug webview

## Configuration Files

- `package.json` - Extension manifest, commands, views
- `tsconfig.json` - TypeScript compiler options
- `tsup.config.ts` - Build configuration
- `vitest.config.mts` - Test configuration
- `eslint.config.mjs` - Linting rules

## Publishing

```bash
npm run package        # Creates .vsix file
# Then publish to VS Code Marketplace via GitHub Actions
```

## Useful Links

- [DEVELOPER.md](./DEVELOPER.md) - Detailed architecture guide with diagrams
- [README.md](./README.md) - User-facing documentation
- [VSCode Extension API](https://code.visualstudio.com/api) - Official docs
- [Root README](../../README.md) - Monorepo overview
