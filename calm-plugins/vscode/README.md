# CALM Visual Studio Code Extension

> **Status**: Active - From v0.1.0 (December 2025) the extension has been moved out of experimental status, as it has
> become a worthy part of the CALM tooling ecosystem. It will continue to be in active development, meaning that APIs, behavior, and visuals
> will evolve.

Live-visualize CALM architecture models while you edit them. Features an interactive preview, tree navigation, intelligent validation, and documentation generation.

## Features

### 🎯 Interactive Preview Panel
- **Live Architecture Visualization**: Real-time diagram generation as you edit
- **Smart Layout**: Automatic positioning with multiple layout options
- **Interactive Elements**: Click to inspect, navigate between components

### 🌳 Tree View Navigation
- **Structured Overview**: Browse Nodes, Relationships, and Flows
- **Quick Navigation**: Jump between editor and preview
- **Search & Filter**: Find elements across large models

### ✨ Smart Editor Features
- **Hover Information**: Rich tooltips for model elements
- **Auto-Refresh**: Preview updates automatically on save
- **Diagnostics Integration**: Validation errors in Problems panel


![CALM VS Code Extension](https://raw.githubusercontent.com/finos/architecture-as-code/main/calm-plugins/vscode/docs/CalmVSExtension.png)
*Interactive preview with tree navigation, editor integration, and live visualization*


### 📋 Template & Documentation Mode
- **Documentation Generation**: Create docs from CALM models
- **Live Mode**: Auto-refresh as you edit
- **Multiple Formats**: HTML and Markdown output
- **Custom Templates**: Use built-in or custom templates

![Live Docify Mode](https://raw.githubusercontent.com/finos/architecture-as-code/main/calm-plugins/vscode/docs/LiveDocifyMode.png)
*Live templating mode with real-time documentation generation*

## Configuration
    
The extension can be configured via VS Code settings (`.vscode/settings.json` or User Settings).

### Multi-Document Navigation
Navigate between related CALM files using `detailed-architecture` references.

1.  Create a mapping file (e.g., `calm-mapping.json`) in your workspace:
    ```json
    {
      "https://specs.internal/payment-service": "./services/payment-service.json",
      "https://specs.internal/inventory": "./services/inventory.json"
    }
    ```
2.  Configure the extension to use this mapping:
    ```json
    "calm.urlMapping": "calm-mapping.json"
    ```

### File Discovery
Customize how the extension finds your CALM models and templates.

-   `calm.files.globs`: Patterns for CALM model files (Default: `["calm/**/*.json", "calm/**/*.y?(a)ml"]`)
-   `calm.template.globs`: Patterns for template files (Default: `["**/*.md", "**/*.hbs", ...]`)
-   `calm.cli.path`: Path to the CALM CLI executable (Default: `./cli`)

## Getting Involved

Architecture as Code was developed as part of the [DevOps Automation Special Interest Group](https://devops.finos.org/) before graduating as a top level project in it's own right. Our community Zoom meetups take place on the fourth Tuesday of every month, see [here](https://github.com/finos/architecture-as-code/issues?q=label%3Ameeting) for upcoming and previous meetings. For active contributors we have Office Hours every Thursday, see the [FINOS Event Calendar](http://calendar.finos.org) for meeting details.

Have an idea or feedback? [Raise an issue](https://github.com/finos/architecture-as-code/issues/new/choose) in this repository.

---

**Contributing**: Issues and PRs welcome!
