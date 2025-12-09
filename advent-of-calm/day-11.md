# Day 11: Generate Documentation with Docify

## Overview
Transform your CALM architecture into browsable HTML documentation using the docify command.

## Objective and Rationale
- **Objective:** Use `calm docify` to generate a comprehensive documentation website from your architecture
- **Rationale:** Machine-readable architecture (JSON) needs human-readable outputs. Docify generates documentation automatically, ensuring docs stay in sync with architecture. Essential for stakeholder communication and onboarding.

## Requirements

### 1. Understand Docify

The `calm docify` command generates documentation in multiple modes:
- **Website mode (default):** Full HTML website with navigation - what we'll use today
- **Template mode:** Single file using custom template - covered in Day 13
- **Template-dir mode:** Multiple files using template bundle - for advanced use cases

### 2. Generate Default Documentation Website

```bash
calm docify --architecture architectures/ecommerce-platform.json --output docs/generated/ecommerce-docs
```

This creates a complete HTML website with:
- Index page with architecture overview
- Node details pages
- Relationship visualisation
- Flow diagrams
- Control and metadata display

### 3. Install and Run the Documentation Website

The generated website is a self-contained application. Install dependencies and start it:

```bash
cd docs/generated/ecommerce-docs
npm install
npm start
```

This will start a local development server. Open the URL shown in your terminal (usually `http://localhost:3000`) to browse your architecture documentation.

**Explore the website:**
- Navigate through different sections (nodes, relationships, flows, controls)
- Click on nodes to see their details
- View flow sequence diagrams
- **Take screenshots** of the main pages

When done, press `Ctrl+C` to stop the server and return to your project root:

```bash
cd ../../..
```

### 4. Understand How the Website is Built

The generated website uses **calm-widgets** - a library of React components specifically designed for rendering CALM architecture data. You'll learn more about calm-widgets tomorrow, but for now understand that:

- The VSCode Extension uses the same calm-widgets under the hood
- The website provides an interactive way to explore your architecture
- All visualisations are automatically generated from your architecture JSON

### 5. Compare with VSCode Extension

Open your `architectures/ecommerce-platform.json` in VSCode and use the preview (Ctrl+Shift+C / Cmd+Shift+C):

| Feature | VSCode Extension | Docify Website |
|---------|------------------|----------------|
| Editing | Live edit + preview | Read-only |
| Sharing | Requires VSCode | Any browser |
| Hosting | Local only | Can deploy to web |
| Offline | Always works | Can work offline |

**Use VSCode for development**, **use Docify website for sharing with stakeholders**.

### 6. Customise Website Metadata (Optional)

You can influence what appears in the website by ensuring your architecture has good metadata:

**Prompt:**
```text
Update architectures/ecommerce-platform.json to ensure metadata includes:
- title: A descriptive name for the architecture
- description: A summary of what this architecture does
- version: The current version
- owner: Who maintains this architecture

This metadata will appear prominently in the generated documentation website.
```

### 7. Regenerate with Updated Metadata

```bash
calm docify --architecture architectures/ecommerce-platform.json --output docs/generated/ecommerce-docs
```

Restart the website and see your metadata displayed!

### 8. Update Your README

Document Day 11 progress in your README: mark the checklist, describe the documentation website, and note where to find the generated site.

### 9. Commit Your Work

```bash
git add docs/generated/ README.md architectures/ecommerce-platform.json
git commit -m "Day 11: Generate documentation website with docify"
git tag day-11
```

## Deliverables

✅ **Required:**
- `docs/generated/ecommerce-docs/` - Full website documentation
- Screenshots of generated documentation website
- Updated `README.md` - Day 11 marked complete

✅ **Validation:**
```bash
# Verify generated documentation exists
test -d docs/generated/ecommerce-docs

# Check tag
git tag | grep -q "day-11"
```

## Resources

- [Docify Documentation](https://github.com/finos/architecture-as-code/tree/main/cli#docify)
- [CALM Widgets](https://github.com/finos/architecture-as-code/tree/main/calm-widgets)

## Tips

- Regenerate documentation after every architecture change
- Add documentation generation to CI/CD pipeline for always up-to-date docs
- Deploy the generated website to your internal hosting for team access
- The website works great for architecture reviews and stakeholder presentations

## Next Steps
Tomorrow (Day 12) you'll learn about calm-widgets - the building blocks that power both the VSCode extension and the docify website - and create custom documentation using them!
