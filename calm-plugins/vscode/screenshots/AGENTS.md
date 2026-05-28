# CALM VSCode Screenshots — AI Assistant Guide

This folder generates documentation screenshots for the CALM VSCode extension. It is a **dev-only orchestrator** that drives a real VSCode instance via Playwright Electron and writes PNGs into `docs/static/img/vscode/`.

This guide is for AI assistants working in this folder. Human contributors should read `README.md` first.

## What this folder is and is not

- **Is**: a standalone Node tool, with its own `package.json`, that orchestrates VSCode + the extension to produce documentation imagery.
- **Is not**: an npm workspace member. Adding it to root `workspaces` would pull Playwright (~150 MB) into every contributor's `npm install`. Keep it standalone.
- **Is not**: shipped in the VSIX. The extension's `package.json` does not reference this folder.

## Key commands

Run from the repo root unless noted otherwise.

```bash
# First-time install (only when this folder is touched)
npm --prefix calm-plugins/vscode/screenshots install

# Generate all shots into docs/static/img/vscode/
npm --prefix calm-plugins/vscode/screenshots run shoot

# Smoke test (runs orchestrator, asserts outputs)
npm --prefix calm-plugins/vscode/screenshots run test

# Static checks (run in CI)
npm --prefix calm-plugins/vscode/screenshots run typecheck
npm --prefix calm-plugins/vscode/screenshots run lint
```

The extension must be built first. The orchestrator will fail with a helpful message if `calm-plugins/vscode/dist/extension.js` is missing.

## Layout

```
src/
├── launch.ts       Download VSCode binary, launch via Playwright Electron, return { app, window }.
├── normalise.ts    Fixed viewport, forced theme, close aux side bar, dismiss notifications.
├── frames.ts       Find the inner webview iframe given the outer wrapper.
├── shoot.ts        Capture (full window or selector-bound crop), write PNG, append manifest entry.
├── shots.ts        Declarative list: each shot has { name, fixture, setup(window), capture(window) }.
└── index.ts        Orchestrator: launch → for-each-shot → close → write manifest.

test/
└── smoke.test.ts   Runs orchestrator end-to-end; asserts every shot produced a non-empty PNG matching the manifest.

fixtures/
└── three-tier/     Sample CALM architecture used by most shots.
```

## How a shot works

Each shot in `src/shots.ts` is a declarative object:

```ts
{
    name: '04-preview-hero',          // becomes 04-preview-hero.png
    fixture: 'three-tier',            // fixtures/three-tier/ opens as the workspace
    description: 'Live preview …',    // caption hint surfaced in the docs page
    implemented: true,                // false to scaffold a TODO entry
    async setup(window) {
        // Drive the UI into the state we want to capture.
        // Examples: Cmd+Shift+P to open Command Palette, type a command, press Enter.
        // Or: click the activity bar, expand tree nodes, hover an element.
    },
    async capture(window) {
        // Return Buffer. Usually `window.screenshot()` of the whole viewport.
        // For cropped shots, get bounding box of a selector first.
        return await window.screenshot()
    },
}
```

The orchestrator handles: opening the fixture, calling `setup`, waiting for renders to settle, calling `capture`, writing the PNG, updating the manifest, and resetting state between shots.

## Common workflows

### Add a shot
1. If no existing fixture fits, add one under `fixtures/<name>/architecture.json` (and any other files VSCode needs to open it).
2. Append an entry to `src/shots.ts` with all six required `Shot` fields (`name`, `fixture`, `description`, `implemented`, `setup`, `capture`).
3. Run `npm run shoot` and inspect the resulting PNG in `docs/static/img/vscode/`.
4. Commit the PNG, the updated `_manifest.json`, and (if added) the fixture.

### Update a shot after a UI change
1. Run `npm run shoot`.
2. Inspect the resulting PNG visually.
3. Commit both PNG and the manifest update.

### Pin a different VSCode version
Bump the version string in `src/launch.ts`. Then run all shots and re-commit every PNG and the manifest in the same PR — the rendered output across versions will differ, and reviewers should see the change as one atomic update.

## Pitfalls and gotchas

**VSCode selector drift.** Internal class names (`.monaco-workbench`, `.activitybar`, `.tab .tab-label`, etc.) are not a stable API. They change between VSCode releases. When a shot starts failing after a `@vscode/test-electron` version bump, the most likely cause is a selector that no longer matches — not a Playwright issue. Inspect the launched window with `await window.pause()` (when running headed) to find the new selector.

**Two webview iframes per panel.** VSCode wraps the extension's webview in an outer iframe (`index.html`) for sandboxing, with the actual content in an inner iframe (`fake.html`). To click or hover *inside* the preview (e.g. for the hover-info shot), use `frames.ts` to traverse to the inner frame, not the outer wrapper.

**`--disable-extensions` shows a banner.** Using it loads only our extension but displays "All installed extensions disabled" in the status area. We instead use `--extensions-dir=<empty-tmp-dir>` so the workbench loads no other extensions without showing the banner. Do not switch to `--disable-extensions` without a way to suppress that banner.

**Renderer non-determinism across OSes.** macOS and Linux produce subtly different PNGs (font subpixel rendering, GPU compositor, scaling). Shots committed from one OS may report drift if regenerated on another. Initial generation should happen on macOS (the maintainer's OS); if a contributor on Linux regenerates, expect every PNG to change slightly.

**Activate event is `onStartupFinished`.** The extension may still be activating when the first window appears. Always wait for the `.monaco-workbench` selector and a short stability delay before issuing commands.

**Notifications can cover the screenshot.** Workspace-trust prompts, update prompts, and welcome tabs all draw over the workbench. `normalise.ts` suppresses them via launch flags; if a new one shows up, add the relevant `--skip-*` or close it explicitly.

## Trust / security model

- The extension's `package.json` and VSIX are not modified by anything in this folder.
- Playwright and `@vscode/test-electron` are deps of this folder alone, not of the extension.
- Marketplace users see no change in extension behaviour, capability, or VSIX size.
- The shipped artefacts are the resulting PNGs only, committed under `docs/static/img/vscode/`.

## Related

- Issue: [finos/architecture-as-code#2529](https://github.com/finos/architecture-as-code/issues/2529) — design and CI rationale.
- Structural model: [PR #2523](https://github.com/finos/architecture-as-code/pull/2523) — CALM Hub docs page with annotated screenshots.
- Extension folder: `calm-plugins/vscode/` (with its own `AGENTS.md`).
