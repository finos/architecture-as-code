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

Everything is TypeScript, matching the rest of the repo's frontends. The files ported from
`calm-hub-ui` keep their original formatting and `Ported from …` headers — do not reformat them,
so future diffs against the Hub originals stay readable. The diagram pipeline types live in
`src/lab/hubRenderer/types.ts`: loose, all-optional CALM shapes, because the lab parses the live
editor buffer rather than schema-valid documents.

## Key Commands

```bash
# All commands from the repository root
npm run calm-lab:run                  # Dev server
npm run build:calm-lab                # models → widgets → shared → lab
npm test --workspace calm-lab         # Unit tests
npm run lint --workspace calm-lab     # ESLint
npm run typecheck --workspace calm-lab  # tsc --noEmit (CI runs this after lint)
```

`shared` must be built before the lab: the app imports the compiled `@finos/calm-shared/browser`
entry, not its source. `build:calm-lab` does this for you.

## The browser-engine contract

`shared/README.md` defines it, and `shared/scripts/check-browser-entry.mjs` enforces the shared
side of it. The lab's half is `vite.config.ts`:

- `fs` and `path` resolve to `src/shims/empty.ts`, `buffer` to `src/shims/buffer.ts`. The shared
  browser entry's dependency chain asks for them at bundle time but never calls them at runtime.
- `resolve.mainFields` puts `browser` first.
- `__CALM_CLI_VERSION__` is a `define` reading `cli/package.json` at config time, so `src/`
  never imports a manifest from outside its own tree. Declared in `src/vite-env.d.ts`.

**Never add Node-only code to `src/`** — no `fs`, `path`, `process`, `__dirname`. If something you
need is not on the browser entry, the fix belongs upstream in `shared`, behind that guard, not in a
shim here.

## Where things live

| Path | What it is |
| --- | --- |
| `src/engine.ts` | `validateArchitecture`, `validateOutcome`, `generateArchitecture` on `@finos/calm-shared/browser` |
| `src/schemas.ts` | The CALM meta-schemas, imported from `calm/` and keyed by `$id` |
| `src/shell.ts` | The terminal's command interpreter; dispatches `calm` subcommands to `src/cli/` |
| `src/cli/` | CLI-compatible `calm validate`/`calm generate`/`calm diff`: argument parsing, output and error text |
| `src/lab/**` | The lab UI, moved from `docs/src/components/Lab` |
| `src/App.tsx` | Page frame — replaces the Docusaurus `Layout` |
| `src/ErrorBoundary.tsx` | Class boundary wrapping the lab and, keyed on the document, the diagram |
| `src/lessons/` | Lesson model, check helpers, registry and one folder per lesson |
| `src/lab/storage.ts` | Workspace and progress keys for each lesson, plus one shared UI-prefs key |

`src/engine.ts` holds one memoised `SchemaDirectory` for the session, built over
`buildBrowserDocumentLoader` with `allowRemote: false`. Schemas are bundled from `calm/` in this
repo, so the lab and the spec can never drift. A command with `-u` gets its own `SchemaDirectory`
(`schemaDirectoryWith`): the mapped workspace files first (`src/cli/files.ts`), then the bundled
schemas. Mapped paths resolve against the mapping file's directory, as in the CLI.

## The async rule

`validate()` is async (Spectral), so `Lab.tsx`'s `recompute` is too. Every result is published
behind a `validationSeq` guard: a recompute that is no longer the newest returns without calling
`setValidation`. Keep that guard if you touch the validation path — saving and running
`calm validate` can both be in flight at once, and without it the older result wins at random.

A second ref, `sessionEpoch`, is bumped by `handleReset` and when `Lab` unmounts. A command and a
recompute capture it before awaiting; if it has changed, the command discards its lines, its event
and its recompute, and the recompute publishes nothing and saves no progress. Otherwise an
in-flight `calm validate` ticks a step off the fresh lesson.

`runShell` does not await `recompute`: `ls` and `cat` must not sit behind a Spectral run with the
input disabled.

A step is complete when there are no **errors**. Warnings are listed in the Problems panel but
never fail a step.

When `Lab` unmounts, the epoch goes up, so work still in flight writes no progress and no outcomes.

## Writing a lesson

Follow "Write a lesson" in `README.md`. The rules an agent is most likely to break:

- Use the helpers in `src/lessons/checks.ts`. Add a new helper there, with tests, rather than
  inline JSON walking in a lesson. Helpers must never throw on a half-edited document.
- A check reads state (`doc`, `validation`, `commands`, `files`), never event order. For "run X after
  the last change", use `ranOk`/`ranFailed` — stale outcomes are already filtered out.
- A "see it fail" validate step checks `rejected(state, files)`, never `ranFailed`. `ranFailed`
  accepts a missing mapped file or a broken pattern; `rejected` needs a validate whose errors are
  all in the architecture (`errorsIn.architecture === errorCount`) and no `$ref` load failure.
- A check reads a file other than the editor file only through `fileText`, `fileJson` or
  `markdownSection`. They see the saved text and never throw.
- A file hint is the complete target file, never a fragment.
- A hint command that must fail is `{ run, expect: 'failure' }`. It passes only on a validate that
  `isRejection` accepts (the rule `rejected` uses), so a typo in a path or a broken pattern still
  fails the invariants. A plain command must not fail either. The copy scan runs after every hint, so a
  command that a hint expects to fail may pass there, when a later step fixed the input. The scan
  matches those commands by their exact text: copy that writes the command differently (extra
  spaces, another option order) is checked as a plain command.
- `endFiles(lesson)` applies only file hints. A file that a command writes (`calm generate -o`) is
  not in it, so a chained lesson seeds that file itself.
- Every `calm` command in the summary, step copy, hints or completion message must be one the lab
  runs (`validate`, `generate`, `diff`, `help`), with arguments its shell accepts. The invariants spec runs each
  one; do not weaken it to make a lesson pass.
- A lesson that continues another sets `chainsFrom` and builds its seed from `endFiles(previous)`,
  imported from `src/lessons/chain.ts` (importing it from `index.ts` creates a circular import back
  through the registry). Never copy the previous lesson's JSON.
- Never rename a released lesson id: it is the URL and the storage key.

## The diagram renders untrusted input

The Diagram tab parses the editor buffer as the learner types, so `src/lab/hubRenderer/**` must
never assume the document is schema-valid: containment parents are filtered to nodes that exist and
checked for cycles, and every value that reaches React or `.toLowerCase()` goes through
`toDisplayText`. Both the lab and the diagram sit behind `ErrorBoundary` for whatever gets through.

## Commands the lab does not run

`src/shell.ts` dispatches `calm validate`, `calm generate` and `calm diff` to `src/cli/`. Those files accept exactly
the CLI's syntax: `src/cli/options.ts` parses arguments like commander, from the option table in
`BROWSER_COMMAND_SUPPORT` (`shared/src/browser-capabilities.ts`). `cli/src/browser-manifest.spec.ts`
fails when that table and the CLI disagree, so never hard-code flags, choices or descriptions here.

Output is the CLI's own text, pinned in `src/cli/*.spec.ts` from the real CLI. When the CLI's
output changes, re-capture it and update the specs. The only lab-specific text is
`unsupportedInLab` (a command or option the browser cannot run) and the lab-labelled help.

`calm generate -o` writes a workspace file. `Lab.tsx` then shows the new text of the open file,
unless the editor has unsaved edits (they win on Save, as in any editor), and marks a hidden diagram
as updated. A pattern with options needs an interactive prompt in the CLI; the lab prints a note
instead and writes nothing. A generate outcome has `ok: true` only when the command wrote an
architecture: a `generate()` error and an output path that is a directory both send `ok: false`.
A load error for the pattern (or the `-u` file) sends no outcome.

Shared code logs through the browser console, so the terminal shows only the log lines the lab
writes itself. For a pattern `$ref` that fails to load, `src/cli/files.ts` records the failure in
its loaders and prints the CLI's three lines (`multi-strategy-document-loader`,
`json-schema-validator`, and `calm-validate` when an architecture is checked) before the report.

Known differences:

- `diffDocuments` logs "Skipped N node(s)…" warnings to the browser console, not the terminal.
- With `-p`, the CLI's file loader looks for a relative path in the pattern's directory first. The
  lab resolves every path from the working directory.
- The lab never downloads. A `$ref` to an http(s) URL that no `-u` mapping covers fails with the
  CLI's message for a host outside its default allowlist, and the CLI's log lines. For
  `calm.finos.org`, which the CLI allows by default, the lab prints its own note (only a schema the
  lab does not bundle gets there).
- `calm validate -a` without `-p` does not load the pattern named in the architecture's `$schema`.

## Node 26 storage rule

Node 26 throws a `DOMException` on `localStorage` without `--localstorage-file`, and in jsdom its
global shadows jsdom's working implementation. `vitest.setup.ts` stubs both `localStorage` and
`sessionStorage` with `createMemoryStorage()` from `src/test-support/memory-storage.ts`. `vfs.ts`
also guards every storage access, so the lab degrades to in-memory in private-browsing mode.

## Deploy

`.github/workflows/s3-lab-sync.yml` builds `calm-lab/dist` and syncs it to
`s3://lab.calm.finos.org/` on pushes to `main`, then invalidates CloudFront — the same shape as
the docs sync. The bucket, distribution, DNS, certificate and
`AWS_CLOUDFRONT_LAB_DISTRIBUTION_ID` are provisioned outside this repository.
