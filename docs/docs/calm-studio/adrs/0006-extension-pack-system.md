---
status: accepted
date: 2026-03-15
decision-makers: [CalmStudio maintainers]
---

# ADR-0006: Extension Pack System for Node Types

## Context and Problem Statement

CALM 1.2 defines 9 node types (`actor`, `ecosystem`, `system`, `service`, `database`, `network`, `ldap`, `webclient`, `data-asset`). These are sufficient for generic architectures, but not for cloud-native, AI, or platform engineering diagrams where architects need specific types like AWS Lambda, Kubernetes Deployment, or LLM Agent. CalmStudio needed a way to support domain-specific node types without hardcoding every possible type into the core application.

## Considered Options

- **Hardcode all cloud types** — add 60+ cloud types as first-class CALM types in the core palette. Simpler to implement, no extension API needed.
- **Plugin system (runtime-loaded modules)** — dynamic imports from external URLs or local files. Maximum flexibility, but complex security model and loading mechanics.
- **Extension packs (static TypeScript modules)** — define `PackDefinition` objects in TypeScript, bundled at build time. Registered via `initAllPacks()`.

## Decision Outcome

Chosen: **Extension pack system with `PackDefinition` type**. Packs are TypeScript modules that export a `PackDefinition` object. The `packages/extensions` package ships 7 built-in packs covering AWS (33 types), GCP (~20), Azure (~20), Kubernetes (~15), AI/Agentic (~10), and FluxNova (~10). External developers can create their own packs by implementing the `PackDefinition` interface from `@calmstudio/extensions`.

### Consequences

- **Good:** 7 packs shipped in v1.0, covering 60+ node types. Adding a new pack requires only one TypeScript file and a registration call. The `PackDefinition` interface is published as part of `@calmstudio/extensions`, so external developers can create packs without forking CalmStudio. Type-safe — TypeScript enforces the interface contract.
- **Neutral:** All packs are bundled at build time (no lazy loading in v1.0). Users who only need CALM core types still download AWS/GCP/Azure pack code. Lazy loading can be added in a future iteration.
- **Bad:** Packs cannot be loaded at runtime from external sources (e.g., a community registry). Adding a new pack requires a code change and rebuild. Third-party packs must be distributed as npm packages.
