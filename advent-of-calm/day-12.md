# Day 12: Understanding CALM Widgets

## Overview
Learn about calm-widgets - the React component library that powers all CALM visualisations, including the VSCode Extension and the documentation website you created yesterday.

## Objective and Rationale
- **Objective:** Understand what calm-widgets are and how they're used to render CALM architecture data
- **Rationale:** Before creating custom documentation, it's valuable to understand the building blocks. CALM Widgets are the foundation for all CALM visualisations - understanding them helps you appreciate what's possible and prepares you for creating custom documentation in the next days.

## Requirements

### 1. What are CALM Widgets?

CALM Widgets is a library of reusable React components designed specifically for visualising CALM architecture data. They provide:

- **Consistent visualisation** across all CALM tools
- **Interactive exploration** of architecture elements
- **Ready-to-use components** for nodes, relationships, flows, and controls

**Where you've already seen them:**
- The **VSCode Extension** preview panel uses calm-widgets
- The **docify website** you generated yesterday is built entirely with calm-widgets

### 2. Explore the Widgets Project

Let's look at what's available:

```bash
# From the architecture-as-code repo
ls calm-widgets/src/components/
```

Review the README to understand the project:

```bash
cat calm-widgets/README.md
```

### 3. Available Widget Components

| Widget | Purpose | Where You've Seen It |
|--------|---------|---------------------|
| `ArchitectureViewer` | Complete architecture visualisation | VSCode preview, docify website |
| `NodeCard` | Individual node display | Node details in docify |
| `RelationshipDiagram` | Visual relationship graph | Architecture overview |
| `FlowSequenceDiagram` | Sequence diagram for flows | Flow pages in docify |
| `ControlsPanel` | Security controls display | Controls section |
| `MetadataPanel` | Architecture metadata | Header of docify site |

### 4. See Widgets in Action

Open your architecture in VSCode and use the preview command (`Ctrl+Shift+C` / `Cmd+Shift+C`):

Notice how the preview renders:
- Node cards with type icons
- Relationship connections
- Flow sequence diagrams
- Metadata display

Now open the docify website you created yesterday and compare - you'll see the same visual components!

### 5. Understand the Widget Architecture

```
┌─────────────────────────────────────────┐
│           Your CALM JSON                │
│   (architectures/ecommerce-platform)    │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│          CALM Widgets                   │
│   (React components that parse and      │
│    render CALM data)                    │
└────────────────┬────────────────────────┘
                 │
        ┌────────┼────────┐
        ▼        ▼        ▼
   ┌────────┐ ┌────────┐ ┌────────┐
   │ VSCode │ │ Docify │ │ Custom │
   │  Ext   │ │Website │ │  Apps  │
   └────────┘ └────────┘ └────────┘
```

### 6. Why This Matters

Understanding that calm-widgets power both the VSCode extension and docify website means:

1. **Consistency:** Changes to widgets improve all tools
2. **Predictability:** What you see in VSCode is what you get in docs
3. **Extensibility:** You can build custom applications using these widgets
4. **Customisation:** Tomorrow you'll learn to create custom documentation that complements (or replaces) the default widgets output

### 7. Quick Widget Demo (Optional)

If you want to see widgets in isolation, you can run the widgets storybook:

```bash
cd calm-widgets
npm install
npm run storybook
```

This opens an interactive gallery showing each widget with sample data.

### 8. Compare VSCode and Docify Output

Take screenshots of:
1. Your architecture in VSCode preview
2. The same architecture in the docify website

Note the similarities - both use the same underlying widgets.

### 9. Update Your README

Document Day 12 progress: note what calm-widgets are and where they're used.

### 10. Commit Your Work

```bash
git add README.md
git commit -m "Day 12: Learn about calm-widgets foundation"
git tag day-12
```

## Deliverables

✅ **Required:**
- Understanding of what calm-widgets are and where they're used
- Screenshots comparing VSCode preview and docify website
- Updated `README.md` - Day 12 marked complete

✅ **Validation:**
```bash
# Check tag
git tag | grep -q "day-12"
```

## Resources

- [CALM Widgets Repository](https://github.com/finos/architecture-as-code/tree/main/calm-widgets)
- [CALM Widgets README](https://github.com/finos/architecture-as-code/blob/main/calm-widgets/README.md)

## Tips

- The VSCode Extension and docify website share the same visualisation components
- Understanding widgets helps you know what's possible with custom documentation
- Widget consistency means your architecture looks the same everywhere

## Next Steps
Tomorrow (Day 13) you'll create custom documentation templates using Handlebars - giving you full control over the output format while optionally using the data structures that calm-widgets understand!
