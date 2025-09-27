# CALM VS Code Plugin - Architecture & File Structure

This document provides a comprehensive overview of the CALM VS Code plugin's architecture and codebase structure. Every file has been analyzed to understand its purpose and functionality.

## Overview

The CALM VS Code Plugin is an experimental extension that provides live visualization, validation, and documentation generation for CALM (Common Architecture Language Model) architecture files. It follows hexagonal architecture patterns with MVVM (Model-View-ViewModel) presentation logic.

## Root Configuration Files

### Package & Build Configuration
- **`package.json`** - VS Code extension manifest with commands, views, configuration, dependencies and build scripts. Defines extension metadata, activation events, contribution points (commands, views, configuration), and dependencies.
- **`tsconfig.json`** - TypeScript configuration targeting ES2020 with Node.js types for the extension environment.
- **`tsup.config.ts`** - Build configuration using tsup bundler with two targets: Node.js extension and browser webview with different external dependencies.
- **`eslint.config.mjs`** - ESLint configuration with TypeScript support, disabling console warnings and handling unused variables.

### Packaging & Distribution
- **`.vscodeignore`** - Strict bundle-only packaging configuration that includes only essential files (dist, media, templates) while excluding source code and dependencies.
- **`LICENSE`** - References root Apache license.
- **`README.md`** - Comprehensive documentation covering features, usage, installation, configuration, and development setup with VS Code launch configurations.

## Source Code Architecture (`src/`)

### Main Extension Entry Point
- **`extension.ts`** - Simple extension entry point that creates and starts the CalmExtensionController on activation and disposes it on deactivation.

### Core Layer (`src/core/`)

#### Main Controller
- **`calm-extension-controller.ts`** - Central orchestrator implementing hexagonal architecture. Initializes all services, wires dependencies using ports/adapters pattern, and manages the extension lifecycle. Coordinates between logging, configuration, preview, tree view, watchers, language features, and commands.

#### Ports (Interfaces)
- **`ports/config.ts`** - Configuration port interface abstracting VS Code workspace configuration access for hexagonal architecture.
- **`ports/logger.ts`** - Simple logger port interface with info/warn/error methods.

#### Services (Adapters)
- **`services/config-service.ts`** - Concrete implementation of Config port, accessing VS Code workspace configuration for file globs, preview settings, and auto-open behavior.
- **`services/logging-service.ts`** - Logger port implementation that bridges VS Code OutputChannel and @finos/calm-shared logging.
- **`services/refresh-service.ts`** - Handles model refresh logic when documents change. Detects file types, loads CALM models, updates model index, and triggers preview/tree updates with debounced refresh.
- **`services/selection-service.ts`** - Centralizes selection propagation between tree view, preview, and editor with bidirectional synchronization.
- **`services/watch-service.ts`** - Manages file system watchers and document lifecycle events using configuration port for file globs.
- **`services/diagnostics-service.ts`** - Startup diagnostics service that logs version information and validates @finos/calm-shared integration.
- **`services/tree-adapter.ts`** - Simple adapter interface for tree view updates.

### Domain Layer (`src/domain/`)

- **`file-types.ts`** - File type detection logic distinguishing between architecture files (JSON/YAML with CALM model) and template files with front-matter architecture references.
- **`front-matter.ts`** - YAML front-matter parser for template files that extracts architecture references and URL-to-local-path mappings with relative path resolution.
- **`model.ts`** - Core CALM model processing with JSON/YAML parsing, model normalization, and graph conversion for visualization.
- **`model-index.ts`** - Document indexing service that maps CALM element IDs to their positions in the source document for navigation and provides structured access to nodes, relationships, and flows.

### Commands (`src/commands/`)

- **`command-registrar.ts`** - Command registration coordinator that registers all extension commands.
- **`types.ts`** - Command dependency injection interface defining all services needed by commands.
- **`open-preview-command.ts`** - Opens CALM preview panel with file type detection and template mode support.
- **`search-tree-view-command.ts`** - Provides search functionality for the tree view with input box prompt.
- **`clear-tree-view-search-command.ts`** - Clears active search filter in the tree view.

### Features

#### Editor Features (`src/features/editor/`)
- **`editor-gateway.ts`** - Centralizes editor lifecycle bridges including ID-based revelation with view column handling and selection synchronization.
- **`language-features-registrar.ts`** - Registers VS Code language features (hovers, CodeLens) for JSON/YAML files.
- **`language.ts`** - Provides hover and CodeLens functionality for CALM model elements.

#### Tree View Features (`src/features/tree-view/`)
- **`tree-view-manager.ts`** - High-level tree view management with selection binding and search functionality.
- **`tree-view.ts`** - VS Code TreeDataProvider implementation with hierarchical grouping (Architecture > Nodes/Relationships/Flows) and search filtering.
- **`tree.view-model.ts`** - MVVM ViewModel managing tree presentation logic including search filtering, template mode, expansion state, and element grouping completely decoupled from VS Code APIs.

#### Preview Features (`src/features/preview/`)

##### Core Preview Management
- **`preview-manager.ts`** - High-level preview panel lifecycle management.
- **`preview-panel.ts`** - Main webview panel implementation with command routing, state persistence, and MVVM ViewModel integration. Handles template/architecture mode switching and docify operations.
- **`preview.view-model.ts`** - MVVM ViewModel for preview panel managing visibility, template mode, selection, labels, and data without VS Code dependencies.

##### Data Services
- **`model-service.ts`** - Model data reading and filtering service for JSON/YAML architecture files.
- **`state-store.ts`** - Persistent storage for node positions, viewport, and UI toggles using VS Code workspace state.
- **`template-service.ts`** - Template content generation and processing with label visibility handling and focus templates.
- **`html-builder.ts`** - HTML generation for webview panel with CSP nonce and asset URI resolution.
- **`docify-service.ts`** - Live documentation generation service using @finos/calm-shared Docifier with temporary file handling and template processing.

##### Command System
- **`commands.ts`** - Command pattern implementation for webview messages with typed command interfaces and registry for routing.
- **`types.ts`** - Type definitions for graph data structures and preview data.

##### Utilities
- **`utils/debounce.ts`** - Simple debounce utility class for rate-limiting operations.
- **`utils/async-guard.ts`** - Async operation guard preventing concurrent execution.

#### Webview Implementation (`src/features/preview/webview/`)
- **`main.ts`** - Browser-side webview entry point with error handling, MVVM initialization, and VS Code API communication.
- **`view.ts`** - DOM manipulation layer that observes ViewModel and updates UI elements including tabs, content, and controls.
- **`webview.view-model.ts`** - Browser-side ViewModel managing tab state, content rendering, and VS Code extension communication completely decoupled from DOM.
- **`mermaid-renderer.ts`** - Markdown-It renderer with Mermaid diagram support optimized for large architecture files.
- **`tsconfig.json`** - Browser environment TypeScript configuration.

## Templates (`templates/`)

Handlebars templates for documentation generation:
- **`default-template.hbs`** - Basic architecture overview template with block-architecture widget.
- **`node-focus-template.hbs`** - Node-focused documentation with overview table, architecture view, related nodes, and interface view.
- **`flow-focus-template.hbs`** - Flow-focused documentation with flow sequence diagrams and interface views.
- **`relationship-focus-template.hbs`** - Relationship-focused documentation with related nodes and interface views.

## Media Assets (`media/`)

- **`preview.html`** - Webview HTML template with CSP configuration, tabs, controls, and content areas.
- **`preview.css`** - Comprehensive CSS with VS Code theming, tab styling, GitHub-style markdown rendering, and responsive design.
- **`icon.png`** / **`icon.svg`** - Extension icons.

## Build Scripts (`scripts/`)

- **`copy-widgets.js`** - Post-build script that copies widget assets from calm-widgets package to the extension's dist folder, checking both built and source locations.

## Key Architectural Patterns

### Hexagonal Architecture
- **Ports**: Abstract interfaces (Config, Logger) that define what the core needs
- **Adapters**: Concrete implementations (ConfigService, LoggingService) that adapt external dependencies
- **Core**: Business logic isolated from external dependencies

### MVVM Pattern
- **Models**: Domain entities and data services
- **ViewModels**: Presentation logic without UI dependencies (TreeViewModel, PreviewViewModel, WebviewViewModel)
- **Views**: UI layer that observes ViewModels and handles DOM manipulation

### Command Pattern
- Webview communication uses command objects with typed interfaces
- Command registry routes messages to appropriate handlers
- Separation of concerns between message handling and business logic

### Service Orchestration
- CalmExtensionController wires all dependencies
- Services communicate through well-defined interfaces
- Lifecycle management handled centrally

## File Types & Detection

The extension handles two primary file types:
1. **Architecture Files**: JSON/YAML files containing CALM models
2. **Template Files**: Any file with YAML front-matter referencing an architecture file

## State Management

- **Document State**: Node positions, viewport, UI toggles persisted per-document
- **Selection State**: Synchronized across tree view, preview, and editor
- **Template Mode**: Dynamic switching between architecture and template file contexts
- **Search State**: Tree view filtering with debounced updates

## Integration Points

- **@finos/calm-shared**: Core CALM functionality and validation
- **@finos/calm-models**: Type definitions and model structures
- **VS Code APIs**: Extension host, webview, language features, workspace management
- **Mermaid**: Diagram rendering in documentation output
- **Markdown-It**: Markdown processing with plugin support

This architecture provides a clean separation of concerns, testable components, and extensible functionality while maintaining tight integration with VS Code's extension APIs.
