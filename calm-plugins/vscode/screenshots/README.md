# CALM VSCode Extension — Documentation Screenshot Generator

Dev-only tool that launches a pinned VSCode build with the CALM extension loaded, drives it through a declarative shot list, and writes PNGs into `docs/static/img/vscode/` for use by the Docusaurus site.

**This tool is not published and is not bundled in the VSIX.** It only runs when a contributor with a clone of the monorepo explicitly invokes it.

## When to run it

- You changed the extension UI (new view, new command, renamed label) and the docs need refreshing.
- You added a new documentation page or section and need new shots.
- A reviewer asks you to regenerate the screenshot manifest.

You **do not** need to run it for every PR — only when extension UI or documentation imagery is in scope.

## Prerequisites

- Node 22 (see root `AGENTS.md` for the Node-version policy).
- The extension must be built. From the repo root:
  ```bash
  npm run build --workspace calm-plugins/vscode
  ```

## Running

From the repo root:

```bash
npm --prefix calm-plugins/vscode/screenshots install   # first time only
npm --prefix calm-plugins/vscode/screenshots run shoot
```

On first run this downloads a pinned VSCode build (~210 MB) into `.vscode-test/`. Subsequent runs reuse the cache.

The output lands directly in `docs/static/img/vscode/<name>.png`, alongside `docs/static/img/vscode/_manifest.json` recording each shot's dimensions and content hash for drift detection.

## How it works

1. Resolves the pinned VSCode binary via `@vscode/test-electron`.
2. Launches it via Playwright's Electron support (`_electron.launch()`) with the built extension loaded via `--extensionDevelopmentPath`. The launch uses a clean temporary `--user-data-dir` so previous local state never leaks in.
3. Normalises the workbench: fixed viewport, forced theme, closes the auxiliary side bar (Copilot panel), dismisses notifications.
4. Iterates the shot list in `src/shots.ts`. Each shot declares the fixture file to open, a `setup(window)` function that prepares the UI (open preview, expand tree, focus Problems panel, etc.), and a `capture` step that either screenshots the whole window or crops to a selector's bounding box.
5. Writes the manifest and shuts down cleanly.

## Adding a new shot

1. Add a fixture under `fixtures/` if an existing one doesn't fit your case.
2. Append an entry to `src/shots.ts`:
   ```ts
   {
       name: '11-my-new-shot',
       fixture: 'three-tier',
       async setup(window) {
           // Whatever the shot needs: open command, expand tree, hover, etc.
       },
       async capture(window) {
           return await window.screenshot({ /* options */ })
       },
   }
   ```
3. Run `npm run shoot` and inspect the output PNG.
4. Commit both the new shot's PNG and the updated `_manifest.json`.

## Layout

```
screenshots/
├── package.json          (private; not an npm workspace member)
├── tsconfig.json
├── eslint.config.mjs
├── README.md             (this file)
├── AGENTS.md             (AI-assistant guide)
├── CLAUDE.md             (one-liner that imports AGENTS.md)
├── src/
│   ├── launch.ts         (download VSCode + Playwright launch)
│   ├── normalise.ts      (viewport, theme, close aux panels, dismiss notifications)
│   ├── frames.ts         (find the webview iframe content frame)
│   ├── shoot.ts          (capture + crop + manifest entry helpers)
│   ├── shots.ts          (declarative shot list)
│   └── index.ts          (orchestrator)
├── test/
│   └── smoke.test.ts     (asserts every shot in shots.ts produced a non-empty PNG)
└── fixtures/
    └── three-tier/       (sample CALM architecture used by most shots)
```

## Troubleshooting

**"Extension not built"** — the orchestrator checks for `calm-plugins/vscode/dist/extension.js`. Build the extension first.

**"VSCode download failed"** — the CDN occasionally times out. Re-run; `@vscode/test-electron` caches the binary after the first successful download.

**A shot is blank or partly clipped** — the renderer often needs more time than the default `waitForStable` allows for that specific shot. Increase the per-shot timeout, not the global one.

**Selectors stop matching after a VSCode bump** — VSCode internal class names drift between releases. The pinned version in `src/launch.ts` is deliberate; only bump it intentionally and re-verify every shot.

## What is and isn't tested in CI

- **Typecheck and lint** run in CI on every PR that touches `calm-plugins/vscode/screenshots/**`.
- **The screenshot tool itself does not run in CI.** Renderer non-determinism across operating systems would produce constant false positives, and the PNGs are committed artefacts — human PR review is the right gate.
- **The smoke test (`test/smoke.test.ts`)** is local-only by design. It runs the full orchestrator end-to-end and asserts every shot produced a non-empty PNG of expected dimensions.

See the [Testing & Continuous Integration section of issue #2529](https://github.com/finos/architecture-as-code/issues/2529) for the full rationale.
