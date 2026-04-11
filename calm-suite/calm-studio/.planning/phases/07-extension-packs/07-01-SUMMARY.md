---
phase: 07-extension-packs
plan: 01
subsystem: extensions
tags: [extensions, pack-registry, aws, gcp, azure, kubernetes, ai, svg-icons]
dependency_graph:
  requires: [07-00]
  provides: [awsPack, gcpPack, azurePack, kubernetesPack, aiPack, initAllPacks-complete]
  affects: [07-02, 07-03]
tech_stack:
  added: []
  patterns:
    - "Hand-crafted abstract SVG icons (16x16 viewBox, stroke-based, originalcreative works)"
    - "Pack-specific helper node() factory functions reduce repetition"
    - "Provider color families: AWS orange, GCP green, Azure blue, K8s blue, AI purple"
key_files:
  created:
    - packages/extensions/src/types.ts
    - packages/extensions/src/registry.ts
    - packages/extensions/src/packs/core.ts
    - packages/extensions/src/packs/aws.ts
    - packages/extensions/src/packs/gcp.ts
    - packages/extensions/src/packs/azure.ts
    - packages/extensions/src/packs/kubernetes.ts
    - packages/extensions/src/packs/ai.ts
    - packages/extensions/src/icons/aws.ts
    - packages/extensions/src/icons/gcp.ts
    - packages/extensions/src/icons/azure.ts
    - packages/extensions/src/icons/k8s.ts
    - packages/extensions/src/icons/ai.ts
  modified:
    - packages/extensions/src/index.ts
    - packages/extensions/src/registry.test.ts
    - packages/extensions/package.json
decisions:
  - "Azure icons are hand-crafted abstract designs — NOT Microsoft official Azure icons (per licensing research)"
  - "Pack node() factory function pattern used in all packs — reduces boilerplate, enforces consistent color application"
  - "core pack types use unprefixed typeIds (actor, system, etc.) per existing CALM convention"
  - "initAllPacks() uses synchronous static imports — avoids dynamic import complexity for a predictable startup call"
metrics:
  duration: "~9 minutes"
  completed: "2026-03-12"
  tasks: 2
  files: 15
---

# Phase 7 Plan 01: Extension Pack Definitions Summary

All 5 extension packs (AWS, GCP, Azure, Kubernetes, AI/Agentic) created with hand-crafted SVG icons, provider color families, and wired into initAllPacks() alongside the core CALM pack.

## What Was Built

### Infrastructure (prerequisite from 07-00, executed inline)

- `src/types.ts` — PackColor, NodeTypeEntry, PackDefinition interfaces
- `src/registry.ts` — PackRegistry singleton (registerPack, resolvePackNode, getAllPacks, getPacksForTypes, resetRegistry)
- `src/packs/core.ts` — Core CALM pack wrapping all 9 built-in types with SVG icons from NodePalette.svelte

### Extension Packs

| Pack | id | Nodes | Color |
|------|-----|-------|-------|
| AWS | `aws` | 30 | Orange `#ff9900` |
| GCP | `gcp` | 15 | Green `#34a853` |
| Azure | `azure` | 15 | Blue `#0078d4` |
| Kubernetes | `k8s` | 14 | Blue `#326ce5` |
| AI/Agentic | `ai` | 14 | Purple `#8b5cf6` |

**Total node types across all packs: 97** (9 core + 88 extension)

### initAllPacks() Updated

`src/index.ts` now registers all 6 packs on a single synchronous call:
```
registerPack(corePack)  // 9 types
registerPack(awsPack)   // 30 types
registerPack(gcpPack)   // 15 types
registerPack(azurePack) // 15 types
registerPack(kubernetesPack) // 14 types
registerPack(aiPack)    // 14 types
```

### Tests

24 tests pass covering:
- Registry behaviors (register, resolve, getAll, reset, getPacksForTypes)
- Core pack structure (9 types, all SVG icons present)
- Pack count assertions (AWS >= 30, GCP >= 15, Azure >= 15, K8s >= 14, AI >= 14)
- resolvePackNode spot checks across all 5 extension packs
- Icon and color completeness validation for every node in every pack

## Deviations from Plan

### Auto-executed 07-00 prerequisite (Rule 3 - Blocking Issue)

**Found during:** Pre-execution dependency check
**Issue:** Plan 07-01 depends_on 07-00, but 07-00 had not been executed. The extensions package had only an empty stub index.ts with no types, registry, or core pack.
**Fix:** Implemented all 07-00 artifacts (types.ts, registry.ts, packs/core.ts, package.json updates) as part of this plan execution before proceeding with the 07-01 pack definitions.
**Files modified:** packages/extensions/src/types.ts, registry.ts, packs/core.ts, package.json, vitest.config.ts (already existed)
**Impact:** No 07-00-SUMMARY.md was created (out of scope for this execution); state counters reflect 07-01 completion.

## Verification Results

- `pnpm --filter @calmstudio/extensions test` — 24/24 tests pass
- `pnpm --filter @calmstudio/extensions typecheck` — 0 type errors
- Manual count: AWS 30, GCP 15, Azure 15, K8s 14, AI 14 — all meet minimums

## Self-Check: PASSED

All created files exist on disk. Both commits verified in git log.
