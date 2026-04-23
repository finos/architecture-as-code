# Integration tests

These tests run inside a real VSCode instance via [`@vscode/test-electron`](https://github.com/microsoft/vscode-test). They complement the vitest unit tests under `src/**/*.spec.ts` by exercising the extension end-to-end: commands are registered, webview panels are created, and the webview JS actually runs.

## Running locally

```sh
# from the repo root — defaults to VSCode stable
npm run test:integration --workspace=calm-plugins/vscode

# pin a specific VSCode version (e.g. to reproduce a version-specific regression)
VSCODE_VERSION=1.116.0 npm run test:integration --workspace=calm-plugins/vscode
```

The first run per version downloads a VSCode build to `calm-plugins/vscode/.vscode-test/` (gitignored). Subsequent runs reuse it.

On macOS and Windows, a real VSCode window appears briefly during the run. On Linux, a display is required — use `xvfb-run -a npm run test:integration --workspace=calm-plugins/vscode` (Xvfb is a virtual framebuffer that provides an in-memory display).

## CI matrix

The `build-vscode-extension.yml` workflow runs integration tests against `1.115.0`, `1.116.0`, and `stable`. `1.115.0` is the last known-good version for issue #2361; `1.116.0` is where the blank-paint regression was introduced.

## What's covered

- `preview.test.ts` — regression guard for issue #2361. Runs `calm.openPreview` against a fixture, asserts a webview tab is created, waits for `ready` (JS executed), and waits for `rendered` (compositor produced a frame via requestAnimationFrame). Fails if either signal is missing.
- `paint-probe-validation.test.ts` — **self-validation for the paint probe itself.** Creates a standalone webview (not the CALM extension) that deliberately reproduces the pre-fix bug pattern (`createWebviewPanel` immediately followed by `panel.reveal()`). Asserts:
  - On `1.116.0`: the buggy pattern produces **no** `rendered` message within 15s — proves the probe really is catching the paint stall.
  - On `1.115.0` / other versions: the same pattern **does** produce `rendered` — proves the probe isn't stuck returning false for unrelated reasons (broken rAF under Xvfb, etc.).
  
  Both tests run on every CI matrix entry. If the main `preview.test.ts` passes but `paint-probe-validation.test.ts` fails, the probe is broken and the main test's green status is untrustworthy.

## Test API

Integration tests need to observe state that isn't exposed through VSCode's public API (e.g. whether a webview has finished initializing). The extension's `activate()` returns a small `CalmExtensionTestApi` object for this purpose — see `src/test-api.ts`. This API is for tests only; don't depend on it from product code.
