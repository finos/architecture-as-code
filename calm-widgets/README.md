# CALM Widgets

Powerful, intuitive Handlebars widgets for generating beautiful CALM architecture documentation with simplified syntax and advanced features.

## Overview

CALM Widgets provides a comprehensive collection of Handlebars helpers that make creating professional CALM architecture documentation incredibly simple. With intuitive bracket notation, automatic schema resolution, and powerful table formatting, you can create beautiful documentation using familiar syntax - no complex setup required!

## Features

- **🎯 Simplified Syntax**: Intuitive, consistent syntax across all widgets
- **🔧 Bracket Notation**: Direct property access by unique-id with `architecture.nodes['api-gateway']`
- **📊 Smart Table Widget**: Automatic detection and formatting of different data types
- **🛡️ Schema-Based Controls**: Automatic HTTP fetching and resolution of control schemas
- **🔢 Array Indexing**: Support for array access with `requirements[0]` syntax
- **🎨 Key-Value Tables**: Beautiful property-value tables for controls and metadata
- **⚡ Auto-Detection**: Automatically detects controls, metadata, and other CALM structures
- **🔍 Flexible Filtering**: Simple `filter='property:value'` syntax
- **📋 Multiple Formats**: Support for markdown and HTML output
- **🚀 Zero Configuration**: Works out-of-the-box with CALM CLI

## Quick Start with CALM CLI

No installation required! CALM Widgets are automatically available when using the CALM CLI template command.

### 1. Create Your Template

Create a template file (e.g., `my-template.md`):

```handlebars
# {{ architecture.title }}

## Services Overview
{{ table architecture.nodes filter='node-type:service' }}

## API Gateway Details
**Name:** {{ architecture.nodes['api-gateway'].name }}
**Description:** {{ architecture.nodes['api-gateway'].description }}

## Controls Collection
{{ table architecture.nodes['api-gateway'].controls }}

## Individual Control Requirements (Schema-Based)
{{ table architecture.nodes['api-gateway'].controls.security.requirements[0] }}

## Architecture Metadata
{{ table architecture.metadata }}

## Relationships
{{ table architecture.relationships }}
```

### 2. Generate Documentation

```bash
calm template --input architecture.json --template my-template.md --output docs/architecture.md
```

That's it! The CLI automatically registers all widget helpers and processes your template.

## Syntax Guide

### Bracket Notation (Recommended)

Access nodes and properties using intuitive bracket notation:

```handlebars
<!-- Direct property access -->
{{ architecture.nodes['api-gateway'].name }}
{{ architecture.nodes['payment-service'].description }}

<!-- Controls access -->
{{ architecture.nodes['api-gateway'].controls.security }}
{{ architecture.nodes['payment-service'].controls['pci-compliance'] }}

<!-- Array indexing -->
{{ architecture.nodes['api-gateway'].controls.security.requirements[0] }}
{{ architecture.nodes['user-service'].interfaces[0].protocol }}

<!-- Mixed notation -->
{{ architecture.nodes['api-gateway'].controls['security'].requirements[0]['control-requirement'] }}
```

### Property Access Patterns

- **`architecture.title`** - Architecture title
- **`architecture.nodes['unique-id']`** - Specific node by unique-id
- **`architecture.nodes['id'].controls`** - All controls from a node
- **`architecture.nodes['id'].controls['name']`** - Specific control
- **`architecture.nodes['id'].controls.name.requirements[0]`** - Array element access
- **`architecture.metadata`** - Architecture metadata
- **`architecture.relationships`** - All relationships

## Widget Reference

### Table Widget

The powerful table widget automatically detects and formats different types of CALM data:

```handlebars
<!-- Basic table generation -->
{{ table architecture.nodes }}
{{ table architecture.relationships }}
{{ table architecture.metadata }}

<!-- Filtered tables -->
{{ table architecture.nodes filter='node-type:service' }}
{{ table architecture.nodes filter='node-type:datastore' }}

<!-- Column selection -->
{{ table architecture.nodes columns='unique-id,name,description' }}
{{ table architecture.relationships columns='unique-id,relationship-type,protocol' }}

<!-- Controls tables (automatic schema resolution) -->
{{ table architecture.nodes['api-gateway'].controls }}
{{ table architecture.nodes['payment-service'].controls['pci-compliance'] }}

<!-- Array-indexed control requirements -->
{{ table architecture.nodes['api-gateway'].controls.security.requirements[0] }}
{{ table architecture.nodes['user-service'].controls['data-protection'].requirements[0] }}

<!-- Different output formats -->
{{ table architecture.nodes format='html' }}
```

**Parameters:**
- `filter`: Simple filtering using `'property:value'` syntax (e.g., `'node-type:service'`)
- `columns`: Comma-separated column list (e.g., `'unique-id,name,description'`)
- `format`: "markdown" (default) or "html"
- `headers`: Include headers (default: true)
- `emptyMessage`: Custom message when no data (default: "_No data found._")

**Auto-Detection Features:**
- **Controls Collections**: Automatically formats as Control/Description/Requirements tables
- **Single Controls**: Shows schema-based key-value tables with resolved properties
- **Control Requirements**: Displays individual requirements as property-value tables
- **Metadata Arrays**: Formats as Key/Value tables
- **Node Collections**: Shows comprehensive node information tables

## Schema-Based Controls

One of the most powerful features of CALM Widgets is automatic schema resolution for controls:

### How It Works

1. **Automatic HTTP Fetching**: Control requirement URLs are automatically fetched
2. **Schema Resolution**: JSON schemas are parsed to extract property definitions
3. **Configuration Matching**: Configuration values are matched to schema properties
4. **Beautiful Tables**: Results are displayed as readable key-value tables

### Examples

```handlebars
<!-- Controls collection shows all controls with requirement counts -->
{{ table architecture.nodes['api-gateway'].controls }}
<!-- Output: Control | Description | Requirements table -->

<!-- Single control shows resolved schema properties -->
{{ table architecture.nodes['payment-service'].controls['pci-compliance'] }}
<!-- Output: Property | Value table with actual schema properties -->

<!-- Individual requirements show detailed property tables -->
{{ table architecture.nodes['api-gateway'].controls.security.requirements[0] }}
<!-- Output: Property | Value table with resolved configuration values -->
```

### Schema Resolution Process

```json
// Control requirement structure in CALM
{
  "control-requirement": "https://example.com/schema.json",
  "control-config": "https://example.com/config.json"
}

// Automatically becomes:
{
  "_schemaProperties": ["scope-text", "scope-rego", "control-id", "name", "description"],
  "_configValues": {
    "scope-text": "All workloads going to production",
    "scope-rego": "input.metadata.target-deployment.environment == Production",
    "control-id": "ci-arch-001",
    "name": "Architecture review pre-production",
    "description": "As part of the SDLC requirements, each workload going to production is subject to an architecture review"
  }
}
```

## Advanced Features

### Array Indexing

Access array elements using intuitive bracket notation:

```handlebars
<!-- Access first requirement -->
{{ table architecture.nodes['api-gateway'].controls.security.requirements[0] }}

<!-- Access second requirement -->
{{ table architecture.nodes['api-gateway'].controls.security.requirements[1] }}

<!-- Access interface properties -->
{{ architecture.nodes['payment-service'].interfaces[0].protocol }}
{{ architecture.nodes['user-database'].interfaces[0]['data-classification'] }}

<!-- Mixed bracket and dot notation -->
{{ architecture.nodes['api-gateway'].controls['security'].requirements[0]['control-requirement'] }}
```

### Filtering

Simple, intuitive filtering syntax:

```handlebars
<!-- Filter by node type -->
{{ table architecture.nodes filter='node-type:service' }}
{{ table architecture.nodes filter='node-type:datastore' }}
{{ table architecture.nodes filter='node-type:system' }}

<!-- Filter relationships -->
{{ table architecture.relationships filter='relationship-type:connects' }}
{{ table architecture.relationships filter='protocol:HTTPS' }}
```

### Column Selection

Choose which columns to display:

```handlebars
<!-- Basic columns -->
{{ table architecture.nodes columns='unique-id,name,description' }}

<!-- Relationship columns -->
{{ table architecture.relationships columns='unique-id,relationship-type,protocol,authentication' }}

<!-- Custom column selection -->
{{ table architecture.nodes columns='name,node-type' }}
```

## Integration with CALM CLI

### Simple Template Usage (Recommended)

CALM Widgets are automatically available when using the CALM CLI template command:

```bash
calm template --input architecture.json --template my-template.md --output documentation.md
```

No additional setup required! The CLI automatically:
- Registers all CALM widget helpers
- Resolves control schemas via HTTP
- Processes bracket notation and array indexing
- Generates beautiful documentation

### Advanced Bundle Usage

For complex scenarios, you can create custom template bundles:

```typescript
import { registerCalmWidgetsWithInstance } from '@finos/calm-widgets';

export default class MyTransformer {
  constructor() {
    // Register widgets with your Handlebars instance
    registerCalmWidgetsWithInstance(this.handlebars);
  }
  
  getTransformedModel(calmJson: string) {
    // Your transformation logic
    return { architecture: parsedArchitecture };
  }
}
```

## Complete Example

Here's a comprehensive example showing all the features:

```handlebars
# {{ architecture.title }}

## Architecture Overview
{{ table architecture.metadata }}

## Services
{{ table architecture.nodes filter='node-type:service' }}

## Datastores
{{ table architecture.nodes filter='node-type:datastore' columns='unique-id,name,description' }}

## API Gateway Details
**Name:** {{ architecture.nodes['api-gateway'].name }}
**Description:** {{ architecture.nodes['api-gateway'].description }}

### API Gateway Controls
{{ table architecture.nodes['api-gateway'].controls }}

### Security Control Details
{{ table architecture.nodes['api-gateway'].controls.security }}

### First Security Requirement (Schema-Based)
{{ table architecture.nodes['api-gateway'].controls.security.requirements[0] }}

## Payment Service PCI Compliance
{{ table architecture.nodes['payment-service'].controls['pci-compliance'] }}

## System Relationships
{{ table architecture.relationships columns='unique-id,relationship-type,protocol,authentication' }}

## Interface Details
**Payment Service Protocol:** {{ architecture.nodes['payment-service'].interfaces[0].protocol }}
**User DB Classification:** {{ architecture.nodes['user-database'].interfaces[0]['data-classification'] }}
```

## API Reference

### Available Helpers

- **`table`** - Smart table widget with auto-detection
- **`eq`**, **`ne`**, **`lt`**, **`gt`** - Comparison helpers
- **`and`**, **`or`**, **`not`** - Logical helpers
- **`if`**, **`unless`**, **`each`**, **`with`** - Built-in Handlebars helpers

### Functions

- **`registerCalmWidgets()`** - Register widgets with global Handlebars
- **`registerCalmWidgetsWithInstance(handlebars)`** - Register with specific instance

### Key Features

- **🎯 Zero Configuration**: Works out-of-the-box with CALM CLI
- **🔧 Intuitive Syntax**: Bracket notation and array indexing
- **🛡️ Schema Resolution**: Automatic HTTP fetching of control schemas
- **📊 Smart Tables**: Auto-detection of data types and formatting
- **🚀 Production Ready**: Comprehensive testing and clean implementation

---

**Built with ❤️ for the CALM community**

## Contributing

Contributions are welcome! Please see the main repository's contributing guidelines.
