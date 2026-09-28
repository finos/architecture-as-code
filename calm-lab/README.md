# CALM Learning Lab

An in-browser learning lab for CALM: a terminal, an editor and a live diagram, with `calm validate`,
`calm generate` and `calm diff` running the real CALM engine (`@finos/calm-shared/browser`) — the
same validation the CLI performs, with nothing to install and nothing sent to a server. The terminal
accepts the CLI's own syntax (`calm validate -p <pattern> -a <file>`, `calm generate -p <pattern> -o
<file>`, `calm diff -a <file> -b <file>`), so every command works unchanged after installing the CLI.

Hosted at **<https://lab.calm.finos.org>**. It has its own origin because many CALM users work
behind proxies that block sites accepting free-text input; the documentation at
<https://calm.finos.org> stays reachable, and the lab can be allow-listed on its own.

Learners work through guided lessons in an IDE-style workspace: a lesson rail with steps and
hints, an editor, a terminal, a Problems tab and a live diagram. Every step is checked against
real state — the saved workspace and the engine's validation result — so any valid solution passes.

## Lessons

A lesson is a folder under `src/lessons/`. Open one with `?lesson=<id>`
(e.g. `https://lab.calm.finos.org/?lesson=beginner-02`). The docs and each lesson's completion link to it;
the lab has no lesson picker.

| Lesson | Tutorial | Status |
|---|---|---|
| `beginner-02` | [02-first-node](https://calm.finos.org/tutorials/beginner/02-first-node) | Released |
| `beginner-03` | [03-relationships](https://calm.finos.org/tutorials/beginner/03-relationships) | Released |
| `beginner-05` | [05-interfaces](https://calm.finos.org/tutorials/beginner/05-interfaces) | Released |
| `beginner-06` | [06-metadata](https://calm.finos.org/tutorials/beginner/06-metadata) | Released |
| `beginner-07` | [07-complete-architecture](https://calm.finos.org/tutorials/beginner/07-complete-architecture) | Released |
| `intermediate-08` | [08-controls](https://calm.finos.org/tutorials/intermediate/08-controls) | Released |
| `intermediate-09` | [09-business-flows](https://calm.finos.org/tutorials/intermediate/09-business-flows) | Released |
| `intermediate-10` | [10-adr-linking](https://calm.finos.org/tutorials/intermediate/10-adr-linking) | Released |
| `intermediate-17` | [17-patterns](https://calm.finos.org/tutorials/intermediate/17-patterns) | Released |

### Write a lesson

1. Create `src/lessons/<id>/lesson.ts` that exports a `Lesson` (see `src/lessons/types.ts`):

   | Field | What it is |
   |---|---|
   | `id` | Lowercase, hyphenated. It is the `?lesson=` value and the storage key. Do not change it after release. |
   | `title` | The lesson's name, used in notices. |
   | `tutorial` | The tutorial page this lesson follows: `{ title, url }`, with the page's own title. The top of the lesson guide links to it in a new tab. |
   | `editorFile` | The lesson's main architecture. The editor opens it first, and `state.doc` and the status badge describe it. |
   | `editableFiles` | The files the learner can open in the editor, for example an ADR next to the architecture. It must include `editorFile`. Each file must be in `seedFiles` or be written by a hint (for example the output of `calm generate -o`); the selector lists a file only when it exists. Default: `[editorFile]`. With more than one file, a "File" selector shows in the editor tab bar. The diagram shows the open file when it is an architecture (it has a `nodes` array), else `editorFile`. |
   | `seedFiles` | The workspace at the start: absolute path under `/workspace` → contents. |
   | `chainsFrom` | The lesson whose end state this one starts from. Build the seed with `endFiles(previous)`, imported from `src/lessons/chain.ts` (not `index.ts`, to avoid a circular import). |
   | `steps` | Ordered steps, below. |
   | `completion` | Heading, message and links shown when every step is done. |

2. Write each step: `id`, `title`, `body` (inline code in backticks) and a `hint`:
   - `{ kind: 'file', content, path? }` — the **complete** file after the step, so paste-and-save
     always works. `path` is the file to write; it must be in `editableFiles`. Default: `editorFile`;
   - `{ kind: 'commands', commands }` — the commands to run, from `/workspace`. A command must not
     print an error or fail validation. To show a failure, write `{ run: 'calm validate …', expect: 'failure' }`: the
     command must run and every error must be in the architecture. A missing file, a `$ref` that
     does not load or an error in the pattern does not count. The learner sees only the command text.

3. Write each `check(state)` with the helpers in `src/lessons/checks.ts`. A check reads state, not
   history: `state.doc` (the saved editor file), `state.validation.ok`, and `state.commands` (the
   commands whose files have not changed since they ran). Check what the step asked for, not the
   names in the hint, so any valid answer passes. For a "see it fail" step, check
   `rejected(state, files)`: the same rule as `expect: 'failure'`. `ranFailed` accepts any failure,
   so use it only for `generate` or `diff`. File paths given to `ranOk`, `ranFailed` and `rejected`
   are absolute: use `state.editorFile` or a `/workspace/...` path.

   To read another saved file, use `fileText(state, path)` (the text, or `null`) or
   `fileJson(state, path)` (a JSON object, or `null`). `markdownSection(text, heading)` gives the
   trimmed text under `## heading` (case-insensitive), or `''`.

4. Register the lesson in `src/lessons/index.ts`, add it to the table above, and add
   `src/lessons/<id>/lesson.spec.ts`. For each step, it must have:
   - a passing answer that uses different names from the hint, which the check accepts;
   - at least one wrong answer, which the check rejects.

`src/lessons/invariants.spec.ts` runs every registered lesson through the real shell and engine:
files live under `/workspace`, editable files are seeded or written by a hint and include the
editor file, file hints write only to editable files, no step is complete before its hint, each hint
completes its step and each command does what the hint expects, the end state validates, every
`calm` command in the copy runs in the lab's shell after all the hints, lesson links name registered lessons, and a chained lesson starts from its predecessor's end
state.

## Development

Run everything from the repository root.

```bash
npm run calm-lab:run                  # Dev server
npm run build:calm-lab                # models → widgets → shared → lab, into calm-lab/dist
npm test --workspace calm-lab         # Unit tests
npm run lint --workspace calm-lab     # ESLint
npm run typecheck --workspace calm-lab  # tsc --noEmit
```

`shared` must be built first — the app imports the compiled browser entry, which
`build:calm-lab` takes care of.

## Notes

Commands the browser cannot honour report why: the shell reads the `BROWSER_COMMAND_SUPPORT`
manifest in `shared` rather than guessing, so `calm docify` explains that it needs a local
filesystem and a headless browser and points at the CLI docs.

See [AGENTS.md](./AGENTS.md) for the browser-engine contract and the conventions this package
follows.

Tracked by [#2879](https://github.com/finos/architecture-as-code/issues/2879) and
[#3029](https://github.com/finos/architecture-as-code/issues/3029).
