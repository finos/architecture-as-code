# Day 4: Install the CALM VSCode Extension

## Overview
Install the CALM VSCode extension to visualize your architectures as interactive diagrams and navigate them with a tree view.

## Objective and Rationale
- **Objective:** Install the CALM VSCode extension and use it to visualize and navigate your architecture from Days 2-3
- **Rationale:** The extension transforms CALM JSON into visual diagrams with a navigable tree view. Seeing your architecture visually accelerates understanding - you can explore nodes, relationships, and flows interactively. This makes CALM tangible and helps you grasp complex architectures at a glance.

## Requirements

### 1. Understand What the Extension Provides

The CALM VSCode extension gives you:
- **Live Architecture Visualization**: Real-time interactive diagram as you edit
- **Tree View Navigation**: Sidebar showing all Nodes, Relationships, and Flows
- **Search & Filter**: Find elements across your architecture
- **Home Button**: Quick navigation back to top-level view
- **Documentation Preview**: Live docify mode for template-based docs

### 2. Install the CALM VSCode Extension

1. Open VSCode
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for "CALM Preview & Tools" 
4. Click **Install**

**Marketplace Link:** https://marketplace.visualstudio.com/items?itemName=FINOS.calm-vscode-plugin

### 3. Verify Installation

Check that the extension is working:

1. Look for the **CALM icon** in the VSCode Activity Bar (left sidebar)
2. Click it to open the CALM sidebar view
3. You should see "Model Elements" panel

**If you see the CALM sidebar, the extension is installed correctly!**

### 4. Open the Preview Panel

Visualize the architecture you've built over Days 2-3.

**Steps:**
1. Open `architectures/my-first-architecture.json` in VSCode
2. Use one of these methods to open the preview:
   - **Keyboard**: Press `Ctrl+Shift+C` (Windows/Linux) or `Cmd+Shift+C` (Mac)
   - **Command Palette**: Press `Ctrl+Shift+P` / `Cmd+Shift+P`, type "CALM: Open Preview"
   - **Right-click**: Right-click in the editor and select "CALM: Open Preview"

**What you should see:**
- Interactive diagram panel opens next to your JSON editor
- Visual representation of your nodes (System, Service, Database, Actor)
- Lines showing relationships (interacts, connects, composed-of)
- Different visual styles for different node types and relationship types

**Take a screenshot!** You'll include this in your commit.

### 5. Explore the Tree View

The CALM sidebar provides a structured view of your architecture:

**Steps:**
1. Click the **CALM icon** in the Activity Bar (left sidebar)
2. Expand the "Model Elements" tree
3. You should see sections for:
   - **Nodes** - All your nodes listed
   - **Relationships** - All your relationships listed
   - **Flows** - Any flows (empty for now)

**Try this:**
- Click on a node in the tree to focus on it
- Click on a relationship to see the connection
- Use the **search icon** (magnifying glass) to filter elements
- Use the **clear search** icon to show all elements

### 6. Experience Live Updates

See how the preview updates as you edit:

**Steps:**
1. Keep the preview panel open
2. In the JSON editor, change the `name` property of one of your nodes
3. **Save the file** (Ctrl+S / Cmd+S)
4. Watch the preview panel update automatically with the new name

**This live feedback makes iterating on architectures fast and visual!**

### 7. Use the Home Button

The preview panel has a home button for navigation:

**Steps:**
1. In the preview panel, look for the **home button** (typically in the toolbar)
2. If you've zoomed or panned the diagram, click home to return to the full view
3. This resets the view to show your entire architecture

### 8. Search for Elements

Test the search functionality:

**Steps:**
1. In the CALM sidebar tree view, click the **search icon** (magnifying glass)
2. Type part of a node name (e.g., "service")
3. The tree view filters to show only matching elements
4. Click the **clear search icon** to show all elements again

**This becomes invaluable for large architectures with dozens of nodes!**

### 9. Understand Your Architecture Visually

Look at your architecture in the diagram:

1. Open the preview if not already open
2. Observe the visual structure:
   - **Actor** → **Service** (interacts relationship)
   - **Service** → **Database** (connects relationship)
   - **System** contains **Service** (composed-of relationship)

**Ask yourself:**
- Does the visual make sense?
- Can you explain this architecture to someone using the diagram?
- What would you change to make it clearer?

### 10. Document Your Tools

Update your README with the extension information.

**Prompt:**
```text
Update my README.md to add a "Tools" section that documents:

1. CALM CLI (installed Day 1)
   - What it's used for: generation, validation, templates
   - Basic commands
   
2. CALM VSCode Extension (installed Day 4)
   - Marketplace link: https://marketplace.visualstudio.com/items?itemName=FINOS.calm-vscode-plugin
   - What it provides: visualization, tree navigation, live preview
   - Keyboard shortcut: Ctrl+Shift+C / Cmd+Shift+C to open preview
   
3. How these tools work together (CLI for validation, extension for visualization)
```

### 11. Commit Your Work

Update your README.md progress:
```markdown
- [x] Day 1: Install CALM CLI and Initialize Repository
- [x] Day 2: Create Your First Node
- [x] Day 3: Connect Nodes with Relationships
- [x] Day 4: Install CALM VSCode Extension
```

Commit your work:
```bash
mkdir -p docs/screenshots
# Save your visualization screenshot as docs/screenshots/day-4-visualization.png
git add docs/screenshots/day-4-visualization.png README.md
git commit -m "Day 4: Install CALM VSCode extension and visualize architecture"
git tag day-4
```

## Deliverables / Validation Criteria

Your Day 4 submission should include a commit tagged `day-4` containing:

✅ **Required Files:**
- Updated `README.md` - Day 4 marked as complete, Tools section added
- `docs/screenshots/day-4-visualization.png` - Screenshot of architecture visualization

✅ **Validation:**
```bash
# Check git tag exists
git tag | grep -q "day-4"
```

✅ **Extension Check:**
- CALM icon appears in VSCode Activity Bar
- Can open preview with Ctrl+Shift+C / Cmd+Shift+C
- Tree view shows your nodes and relationships
- Diagram visualizes your architecture

## Resources
- [CALM VSCode Extension - Marketplace](https://marketplace.visualstudio.com/items?itemName=FINOS.calm-vscode-plugin)
- [CALM VSCode Extension - GitHub](https://github.com/finos/architecture-as-code/tree/main/calm-plugins/vscode)

## Tips
- **Use the keyboard shortcut** - `Ctrl+Shift+C` / `Cmd+Shift+C` is the fastest way to open preview
- **Keep preview open** - see changes as you edit and save
- **Use tree view for navigation** - easier than scrolling through JSON
- **Use search** to find specific elements quickly
- **Use home button** to return to full architecture view
- **Visualization aids communication** - screenshots help explain architectures to others
- **Save to update** - preview refreshes when you save the file
- **The extension complements the CLI** - use CLI for validation and generation, extension for visualization

## Common Pitfalls

**"The preview panel isn't showing"**
- Check that the JSON file is valid (no syntax errors)
- Make sure you're in a CALM architecture file (has nodes/relationships)
- Try the keyboard shortcut: `Ctrl+Shift+C` / `Cmd+Shift+C`
- Look for the command in the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P` , type "CALM")
- If all else fails, you may need to restart the Extensions Host in VSCode (our CALM Preview is still in experimental mode and can be a little temperamental!) - (`Ctrl+Shift+P` / `Cmd+Shift+P` , type "Restart Extension Host")

**"Changes aren't appearing in the preview"**
- **Save the file** - preview updates on save, not on every keystroke
- Check for JSON syntax errors (invalid JSON won't render)

**"Where's the CALM sidebar?"**
- Click the CALM icon in the Activity Bar (left side of VSCode)
- If you don't see the icon, check Extensions panel to confirm installation

## Extension Features Reference

**Main Features:**
- **Preview Panel**: Live diagram visualization
- **Tree View**: Navigate nodes, relationships, flows
- **Search**: Filter elements in tree view
- **Home Button**: Return to top-level view
- **Live Docify**: Preview documentation generation (we'll use this later in the Advent of CALM)

**Commands:**
- `CALM: Open Preview` - Open visualization panel
- `Search Model Elements` - Filter tree view
- `Clear Search` - Reset tree view filter

**Keyboard Shortcuts:**
- `Ctrl+Shift+C` / `Cmd+Shift+C` - Open preview

## Comparison: CLI vs Extension

| Capability | CLI | VSCode Extension |
|------------|-----|------------------|
| Validation | ✅ Full validation | Uses CLI |
| Generation | ✅ `calm generate` | ❌ |
| Visualization | ❌ | ✅ Live diagram |
| Tree Navigation | ❌ | ✅ Sidebar view |
| Documentation Preview | Static output | ✅ Live preview |
| CI/CD Integration | ✅ | ❌ |

**Best practice:** Use both!
- **VSCode extension** for authoring and visualizing
- **CLI** for validation, generation, and automation

## Next Steps
Tomorrow (Day 5) you'll add interfaces to your nodes - and you'll be able to see them visualized in the diagram!
