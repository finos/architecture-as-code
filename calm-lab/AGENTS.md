# CALM Learning Lab - AI Assistant Guide

The in-browser learning lab: a terminal, an editor and a live diagram running the real CALM
engine. Deployed on its own origin, <https://lab.calm.finos.org>, so organisations whose proxies
block sites that accept free-text input can allow-list it separately from the documentation.

## Tech Stack

- **Build**: Vite 8 + `@vitejs/plugin-react`
- **Framework**: React 19
- **Testing**: Vitest + jsdom + React Testing Library
- **Engine**: `@finos/calm-shared/browser`
- **Diagram**: `reactflow` + `@dagrejs/dagre`

New modules are TypeScript. The components moved over from the docs site are still JSX and keep
their original formatting — do not reformat them, and do not convert them wholesale.

## Key Commands

```bash
# All commands from the repository root
npm run calm-lab:run                  # Dev server
npm run build:calm-lab                # models → widgets → shared → lab
npm test --workspace calm-lab         # Unit tests
npm run lint --workspace calm-lab     # ESLint
```

`shared` must be built before the lab: the app imports the compiled `@finos/calm-shared/browser`
entry, not its source. `build:calm-lab` does this for you.

## The browser-engine contract

`shared/README.md` defines it, and `shared/scripts/check-browser-entry.mjs` enforces the shared
side of it. The lab's half is `vite.config.ts`:

- `fs` and `path` resolve to `src/shims/empty.ts`, `buffer` to `src/shims/buffer.ts`. The shared
  browser entry's dependency chain asks for them at bundle time but never calls them at runtime.
- `resolve.mainFields` puts `browser` first.

**Never add Node-only code to `src/`** — no `fs`, `path`, `process`, `__dirname`. If something you
need is not on the browser entry, the fix belongs upstream in `shared`, behind that guard, not in a
shim here.

## Where things live

| Path | What it is |
| --- | --- |
| `src/engine.ts` | `validateArchitecture` / `diffArchitectures` on `@finos/calm-shared/browser` |
| `src/schemas.ts` | The CALM meta-schemas, imported from `calm/` and keyed by `$id` |
| `src/shell.ts` | The terminal's command interpreter |
| `src/lab/**` | The lab UI, moved from `docs/src/components/Lab` |
| `src/App.tsx` | Page frame — replaces the Docusaurus `Layout` |

`src/engine.ts` holds one memoised `SchemaDirectory` for the session, built over
`buildBrowserDocumentLoader` with `allowRemote: false`. Schemas are bundled from `calm/` in this
repo, so the lab and the spec can never drift.

## The async rule

`validate()` is async (Spectral), so `Lab.jsx`'s `recompute` is too. Every result is published
behind a `validationSeq` guard: a recompute that is no longer the newest returns without calling
`setValidation`. Keep that guard if you touch the validation path — saving and running
`calm validate` can both be in flight at once, and without it the older result wins at random.

A step is complete when there are no **errors**. Warnings are listed in the Problems panel but
never fail a step.

## Commands the lab does not run

`src/shell.ts` asks `browserSupportFor()` (the `BROWSER_COMMAND_SUPPORT` manifest in `shared`) why
a command is unavailable and prints that reason. `cli/src/browser-manifest.spec.ts` keeps the
manifest in step with the commands the CLI registers, so do not hard-code these messages here.

## Node 26 storage rule

Node 26 throws a `DOMException` on `localStorage` without `--localstorage-file`, and in jsdom its
global shadows jsdom's working implementation. `vitest.setup.ts` stubs both `localStorage` and
`sessionStorage` with `createMemoryStorage()` from `src/test-support/memory-storage.ts`. `vfs.js`
also guards every storage access, so the lab degrades to in-memory in private-browsing mode.

## Deploy

`.github/workflows/s3-lab-sync.yml` builds `calm-lab/dist` and syncs it to
`s3://lab.calm.finos.org/` on pushes to `main`, then invalidates CloudFront — the same shape as
the docs sync. The bucket, distribution, DNS, certificate and
`AWS_CLOUDFRONT_LAB_DISTRIBUTION_ID` are provisioned outside this repository.
