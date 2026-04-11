---
phase: 15-opengris-scaler-toml-exporter-and-deployment-templates
plan: "02"
subsystem: templates
tags: [opengris, templates, registry, deployment]
dependency_graph:
  requires: []
  provides: [opengris-templates, opengris-category-ui]
  affects: [registry.ts, TemplatePicker.svelte]
tech_stack:
  added: []
  patterns: [json-template, category-registration, vitest]
key_files:
  created:
    - apps/studio/src/lib/templates/opengris-local-dev.json
    - apps/studio/src/lib/templates/opengris-market-risk.json
    - apps/studio/src/lib/templates/opengris-scientific-research.json
    - apps/studio/src/lib/templates/opengris-multi-cloud.json
  modified:
    - apps/studio/src/lib/templates/registry.ts
    - apps/studio/src/lib/templates/TemplatePicker.svelte
    - apps/studio/src/tests/templates/registry.test.ts
decisions:
  - "[15-02] opengris template IDs use prefixes ogld/ogmr/ogsr/ogmc for uniqueness across all CALM nodes"
  - "[15-02] TCP protocol used for all ZeroMQ connections per CALM 1.2 protocol vocabulary"
  - "[15-02] All customMetadata keys match exact TOML field names (manager_type, priority, max_workers, etc.)"
metrics:
  duration_seconds: 186
  completed_date: "2026-03-23"
  tasks_completed: 2
  tasks_total: 2
  files_created: 4
  files_modified: 3
---

# Phase 15 Plan 02: OpenGRIS Deployment Templates Summary

**One-liner:** 4 OpenGRIS Scaler deployment templates (local-dev, market-risk waterfall, HPC batch, multi-cloud 3-tier) registered under green 'opengris' category with TOML-matching customMetadata.

## Objective

Create 4 OpenGRIS deployment templates covering real Scaler.toml deployment patterns and register them in the CalmStudio template system with proper categorization and visual styling.

## What Was Built

### Template JSON Files

Four new template JSON files in `apps/studio/src/lib/templates/`:

| File | ID | Pattern | Nodes |
|------|----|---------|-------|
| opengris-local-dev.json | `opengris-local-dev` | Single-machine native | 6 (cluster, scheduler, 2 workers, object-store, native manager) |
| opengris-market-risk.json | `opengris-market-risk` | Waterfall (native p1 + ECS p2) | 9 (scheduler, 4 workers, 2 managers, object-store, client) |
| opengris-scientific-research.json | `opengris-scientific-research` | AWS HPC Batch with task-graph | 12 (scheduler, 8 workers, aws_hpc manager, object-store, task-graph) |
| opengris-multi-cloud.json | `opengris-multi-cloud` | 3-tier waterfall (native+ECS+symphony) | 6 (scheduler, 3 managers, object-store, client) |

All templates:
- Use `"category": "opengris"` and CALM-compliant unique-id prefixes (ogld/ogmr/ogsr/ogmc)
- Include `customMetadata` with exact TOML field names (`manager_type`, `priority`, `max_workers`, `scheduler_address`, `storage_address`, `ecs_cluster`, `ecs_task_definition`, `aws_region`, `hpc_queue`, `client_address`)
- Use `TCP` protocol for ZeroMQ connections (CALM 1.2 protocol vocabulary)
- Use `composed-of` relationship-type for containment (local-dev cluster)

### Registry and UI Updates

**registry.ts:**
- Added 4 static imports for OpenGRIS templates
- Updated `initAllTemplates()` comment to reflect 10 templates (6 FluxNova + 4 OpenGRIS)
- Added 4 `registerTemplate()` calls for OpenGRIS templates

**TemplatePicker.svelte:**
- Added `opengris: 'OpenGRIS'` to `categoryLabel` map
- Added `opengris: '#16a34a'` to `categoryColor` map (green, matching Phase 14 OpenGRIS pack color family)

**registry.test.ts:**
- Added 4 new tests: OpenGRIS registration count, total count >= 10, category filter, loadTemplate stripping `_template`
- All 26 tests pass

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create 4 OpenGRIS template JSON files | dccf853 | 4 new JSON templates |
| 2 | Register templates and update TemplatePicker styling | ac4908f | registry.ts, TemplatePicker.svelte, registry.test.ts |

## Verification

```
✓ src/tests/templates/registry.test.ts (26 tests) 5ms
Test Files  1 passed (1)
Tests  26 passed (26)
```

Node verification:
```
opengris-local-dev: OK (6 nodes, 8 rels)
opengris-market-risk: OK (9 nodes, 8 rels)
opengris-scientific-research: OK (12 nodes, 11 rels)
opengris-multi-cloud: OK (6 nodes, 5 rels)
```

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- [x] opengris-local-dev.json exists
- [x] opengris-market-risk.json exists
- [x] opengris-scientific-research.json exists
- [x] opengris-multi-cloud.json exists
- [x] registry.ts updated with 4 imports and 4 registerTemplate calls
- [x] TemplatePicker.svelte has opengris label and #16a34a color
- [x] registry.test.ts has 4 new OpenGRIS test cases
- [x] Commit dccf853 exists (Task 1)
- [x] Commit ac4908f exists (Task 2)
- [x] All 26 registry tests pass
