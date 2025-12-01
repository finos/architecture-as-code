# Day 23: Exploring the CALM Explorer - A Community Contribution

## Overview
Run the calm-explorer project locally and visualise the e-commerce architecture you built during Advent of CALM.

## Objective and Rationale
- **Objective:** Set up and run the calm-explorer, a community-contributed visualisation tool, and use it to explore your e-commerce architecture
- **Rationale:** The calm-explorer demonstrates the power of open source collaboration. It was contributed by someone outside the core CALM team and provides an alternative visualisation experience. By exploring it, you see how the community extends CALM and learn about contributing your own tools.

## Requirements

### 1. Understand the calm-explorer Project

The calm-explorer is an experimental community contribution:

**Location:** `experimental/calm-explorer/`

**Features:**
- Interactive graph visualisation using ReactFlow
- Built-in JSON editor with Monaco (same as VSCode)
- AIGF risk visualisation support
- Node details panel
- File upload capability

**Technology Stack:**
- React 18 + TypeScript
- Vite (build tool)
- ReactFlow (graph visualisation)
- Dagre (graph layout)
- Monaco Editor
- Tailwind CSS

### 2. Navigate to the Project

```bash
cd experimental/calm-explorer
```

### 3. Review the README

```bash
cat README.md
```

Note the experimental status - this is a community contribution that may change.

### 4. Install Dependencies

```bash
npm install
```

This will install all required packages.

### 5. Start the Development Server

```bash
npm run dev
```

The application will start on `http://localhost:8080`

### 6. Explore the Default Architecture

1. Open `http://localhost:8080` in your browser
2. You'll see a demo CALM architecture loaded
3. Explore the features:
   - **Drag** to pan the diagram
   - **Scroll** to zoom
   - **Click nodes** to see details
   - **Use the JSON editor** on the left to modify

### 7. Load Your E-Commerce Architecture

Now load your architecture from Day 7:

**Steps:**
1. Click the upload button in the interface
2. Navigate to your `architectures/ecommerce-platform.json` file
3. Upload it

Or use the JSON editor:
1. Open `architectures/ecommerce-platform.json` in a text editor
2. Copy the entire content
3. Paste it into the Monaco editor in calm-explorer
4. Watch the graph update!

### 8. Explore Your Architecture

With your e-commerce architecture loaded:

1. **View the graph layout** - See how Dagre arranges your nodes
2. **Click on nodes** - View the details panel for each service
3. **Follow relationships** - Trace the connections between services
4. **Check metadata** - See the Standard properties you added

**Take a screenshot** of your e-commerce architecture in calm-explorer!

### 9. Compare Visualisation Tools

Compare calm-explorer with the VSCode extension:

| Feature | VSCode Extension | calm-explorer |
|---------|------------------|---------------|
| Integration | IDE integrated | Standalone web |
| Layout | Auto-layout | Dagre auto-layout |
| Editing | Full IDE | Monaco editor |
| Interactivity | Click to navigate | Click + drag |
| Risk Display | Basic | AIGF annotations |

### 10. Try Editing in Real-Time

One powerful feature is live editing:

1. In the Monaco editor, find a node's description
2. Change the description text
3. Watch the graph update immediately
4. This is great for experimenting!

### 11. Document Your Experience

**File:** `docs/calm-explorer-review.md`

**Prompt:**
```text
Create docs/calm-explorer-review.md documenting:

1. Setup Experience:
   - How easy was it to install and run?
   - Any issues encountered?

2. Visualisation Quality:
   - How well did it display your architecture?
   - Layout quality compared to VSCode?

3. Useful Features:
   - What features did you find most useful?
   - What would you like added?

4. Community Contribution Value:
   - What does this project demonstrate about open source?
   - Would you consider contributing to it?
```

### 12. Stop the Development Server

When done exploring:

```bash
# Press Ctrl+C in the terminal running npm run dev
```

### 13. Return to Project Root

```bash
cd ../..
```

### 14. Update Your README

```markdown
- [x] Day 23: Explore calm-explorer community contribution
```

### 15. Commit Your Work

```bash
git add docs/calm-explorer-review.md README.md
git commit -m "Day 23: Explore calm-explorer community visualisation tool"
git tag day-23
```

## Deliverables / Validation Criteria

Your Day 23 submission should include a commit tagged `day-23` containing:

✅ **Required Files:**
- `docs/calm-explorer-review.md` - Your exploration review
- Screenshot of your architecture in calm-explorer
- Updated `README.md` - Day 23 marked as complete

✅ **Actions Taken:**
- [ ] Installed calm-explorer dependencies
- [ ] Started the development server
- [ ] Loaded your e-commerce architecture
- [ ] Explored the visualisation features
- [ ] Took a screenshot

✅ **Validation:**
```bash
# Review exists
test -f docs/calm-explorer-review.md

# Check tag
git tag | grep -q "day-23"
```

## Resources

- [calm-explorer README](https://github.com/finos/architecture-as-code/tree/main/experimental/calm-explorer)
- [ReactFlow Documentation](https://reactflow.dev/)
- [FINOS Experimental Features Process](https://github.com/finos/architecture-as-code/tree/main/experimental)

## Tips

- If port 8080 is in use, check the console for the actual port
- Large architectures may take a moment to layout
- Use the editor to experiment with changes
- Remember this is experimental - expect rough edges

## About Experimental Features

The `experimental/` directory contains features that:
- Are not considered stable
- May change or be removed without notice
- Are intended for testing and feedback
- Have a defined feedback process for promotion or removal

### How Experimental Features Become Stable

1. **Issue Created**: Summarising the feature and inviting feedback
2. **Feedback Period**: 3 months of community input
3. **Refinement**: Based on feedback
4. **Vote**: Maintainers decide to promote or remove
5. **Documentation**: If promoted, full documentation is required

This process encourages active development while protecting users from instability.

## The Power of Community Contributions

The calm-explorer demonstrates several things:

1. **Different Perspectives**: Someone saw a need for a different visualisation approach
2. **Technology Diversity**: React + ReactFlow vs VSCode extension architecture
3. **Innovation Space**: Experimental folder allows trying new ideas
4. **Community Growth**: External contributors expand what CALM can do

**Your contribution could be next!**

## Next Steps

Tomorrow (Day 24) is the final day - you'll review everything you've learned and celebrate your achievement!
