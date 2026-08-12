# IDEA — CALM project file (`.calmrj`) and node extract

| | |
| --- | --- |
| **Status** | Accepted → PRD v0.17 |
| **Date** | 2026-07-21 |
| **Source** | BBR.MD V4 (lines 26–30) |

## Summary

Add a project configuration file (`*.calmrj`) at the folder root for validation ruleset selection, directory/naming conventions, and future diagram settings. Enable extracting a canvas node into its own CALM diagram file, replacing it in the parent with a `detailed-architecture` reference.

## Decisions (locked)

1. **Validation:** Spectral rulesets; `.calmrj` lists enabled relative paths; core CALM schema validation always on.
2. **Project file:** `*.calmrj` (case-insensitive), JSON, any filename, one in root; auto-load on Open folder; Create wizard if missing.
3. **Naming:** Configurable patterns in `.calmrj` + bundled default profile `cengineering-archimate` (from CEngineering naming conventions); unmapped types → confirm dialog with empty path + warning.
4. **Extract:** Node + containment children + internal relationships → new file; parent stub keeps same `unique-id` + `detailed-architecture`; external relationships stay on stub; all node types; open child tab after OK.
5. **Priority:** Iteration 4 (P1); Tauri/watch (R13–R14) → Iteration 5.

## PRD

See [prd.md](../prd.md) — R24–R27.
