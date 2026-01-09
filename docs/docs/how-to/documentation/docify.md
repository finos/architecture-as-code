---
id: docify
title: Generate Documentation
sidebar_position: 2
---

# How to Generate Documentation with Docify

Docify transforms CALM architectures into readable Markdown documentation, enabling automatic doc generation as part of your workflow.

## When to Use This

Use docify when you need to:
- Generate architecture documentation automatically
- Keep docs in sync with architecture changes
- Create consistent documentation across projects
- Include architecture data in README files

## Quick Start

```bash
calm docify \
  --architecture my-architecture.json \
  --output docs/architecture.md
```

## Step-by-Step

### 1. Install the CALM CLI

```bash
npm install -g @finos/calm-cli
```

### 2. Create Your Architecture

Ensure you have a valid CALM architecture file:

```json
{
  "unique-id": "my-system",
  "name": "My System",
  "description": "A sample system architecture",
  "nodes": [
    {
      "unique-id": "api",
      "name": "API Service",
      "node-type": "service",
      "description": "Main API endpoint"
    }
  ]
}
```

### 3. Generate Basic Documentation

```bash
calm docify \
  --architecture architectures/my-system.json \
  --output docs/my-system.md
```

This generates a Markdown file with:
- Architecture overview
- Node listing
- Relationship diagram
- Metadata summary

### 4. Use a Custom Template

Create a template file with placeholders:

**File:** `templates/architecture-template.md`

```markdown
---
architecture: {{architecturePath}}
---

# {{metadata.name}}

> {{metadata.description}}

## Architecture Diagram

{{block-architecture this}}

## Components

{{table nodes columns="unique-id,name,node-type,description"}}

## Relationships

{{table relationships columns="unique-id,source,destination"}}
```

Generate using the template:

```bash
calm docify \
  --input templates/architecture-template.md \
  --output docs/my-system.md \
  --architecture architectures/my-system.json
```

### 5. Preview in VSCode

1. Open your template in VSCode
2. Add front matter pointing to your architecture:
   ```yaml
   ---
   architecture: ../architectures/my-system.json
   ---
   ```
3. Open Command Palette (`Cmd+Shift+P`)
4. Run **"CALM: Open Preview"**
5. See live rendering with your architecture data

### 6. Integrate with CI/CD

Add to your build pipeline:

```yaml
# .github/workflows/docs.yml
name: Generate Docs

on:
  push:
    paths:
      - 'architectures/**'

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install -g @finos/calm-cli
      - run: |
          for arch in architectures/*.json; do
            calm docify \
              --architecture "$arch" \
              --output "docs/$(basename "$arch" .json).md"
          done
      - uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: "docs: regenerate architecture documentation"
```

## Command Reference

```bash
calm docify [options]

Options:
  --architecture, -a  Path to CALM architecture JSON file
  --input, -i         Path to template file (optional)
  --output, -o        Output file path
  --format, -f        Output format (markdown, html)
  --help              Show help
```

## Best Practices

:::tip Version Control Generated Docs
Commit generated docs so they're available without running the CLI
:::

:::tip Use Templates for Consistency
Create standard templates for your organization
:::

:::tip Generate on Architecture Change
Use CI/CD to regenerate docs when architecture files change
:::

## Related Guides

- [Create Custom Templates](custom-widgets) - Build sophisticated templates with widgets
- [Advanced Handlebars](handlebars) - Full control over template output
