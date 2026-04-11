---
status: complete
phase: 04-import-export-layout
source: [04-00-SUMMARY.md, 04-01-SUMMARY.md, 04-02-SUMMARY.md, 04-03-SUMMARY.md]
started: 2026-03-12T11:30:00Z
updated: 2026-03-12T11:45:00Z
---

## Current Test

[testing complete]

## Tests

### 1. CALM JSON Import via Drag-and-Drop
expected: Drag a .calm.json file onto the canvas. Nodes and edges appear with auto-layout applied. Canvas fits to show all elements.
result: pass

### 2. CALM JSON Import via Cmd+O
expected: Press Cmd+O. File picker opens. Select a .calm.json file. Nodes and edges appear with layout. Same result as drag-and-drop.
result: pass

### 3. Invalid JSON Import Error
expected: Drag an invalid JSON file onto the canvas. A dismissible error banner appears below the toolbar. Canvas remains unchanged. Clicking X dismisses the error.
result: pass

### 4. Auto-Layout Button
expected: Click the auto-layout button (four-boxes icon) in the canvas toolbar. Nodes rearrange using ELK layered algorithm. Canvas fits to view.
result: pass

### 5. Layout Direction Change
expected: Change the layout direction dropdown (Top-to-Bottom, Left-to-Right, Hierarchical). Layout immediately re-runs with the new direction. Nodes rearrange accordingly.
result: pass

### 6. Pin Node Toggle
expected: Select a node. In the properties panel header, a Pin/Unpin button appears. Click Pin — button shows "Pinned" in blue. Run auto-layout — pinned node stays in place while others rearrange.
result: pass

### 7. Save File (Cmd+S)
expected: Press Cmd+S. On first save, a file picker appears (Chrome/Edge) or a download triggers. File saved as .calm.json. Dirty indicator clears from title bar.
result: pass

### 8. Save As (Cmd+Shift+S)
expected: Press Cmd+Shift+S. A file picker appears (or download). File saved with chosen name. Title bar shows new filename.
result: pass

### 9. New Diagram (Option+N)
expected: Press Option+N. If diagram has unsaved changes, a confirmation dialog appears. On confirm, canvas clears to empty state. Title bar resets to "CalmStudio".
result: pass

### 10. Export CALM JSON
expected: Click Export dropdown in toolbar → "CALM JSON". Downloads architecture.calm.json with the current model data.
result: pass

### 11. Export SVG
expected: Click Export dropdown → "SVG". Downloads architecture.svg with transparent background showing all nodes and edges.
result: pass

### 12. Export PNG
expected: Click Export dropdown → "PNG". Downloads architecture.png at 2x resolution (Retina) with transparent background.
result: pass

### 13. Export Calmscript
expected: Click Export dropdown → "Calmscript". Downloads architecture.calmscript file with JSON content (stub for Phase 5).
result: pass

### 14. Dirty State and beforeunload
expected: Make any change (move a node, edit a property, edit code). Title bar shows "CalmStudio - Unsaved". Try to close or refresh the tab — browser shows a warning dialog.
result: pass

### 15. Toolbar File Controls
expected: Toolbar shows New, Open, Save buttons on the right. Center shows filename + dirty dot when a file is open. Export dropdown opens on click with 4 format options.
result: pass

## Summary

total: 15
passed: 15
issues: 0
pending: 0
skipped: 0

## Gaps

[none]
